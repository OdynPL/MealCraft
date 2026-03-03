import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import { AuthUser } from '../../../core/models/auth';
import { AuthService } from '../../../core/services/auth.service';
import { ConfigurationService } from '../../../core/services/configuration.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog';
import { EditUserDialogComponent } from './edit-user-dialog/edit-user-dialog';
import { RoleLabelPipe } from './role-label.pipe';
import { YesNoColorPipe } from './yes-no-color.pipe';

@Component({
  selector: 'app-user-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    RoleLabelPipe,
    YesNoColorPipe
  ],
  templateUrl: './user-management.html',
  styleUrl: './user-management.scss'
})
export class UserManagementComponent {
  private readonly auth = inject(AuthService);
  private readonly config = inject(ConfigurationService);
  private readonly notifications = inject(NotificationService);
  private readonly dialog = inject(MatDialog);

  protected readonly users = signal<AuthUser[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly actionUserId = signal<number | null>(null);
  protected readonly searchTerm = signal('');
  protected readonly roleFilter = signal<'all' | 'admin' | 'user'>('all');
  protected readonly lockFilter = signal<'all' | 'locked' | 'unlocked'>('all');
  protected readonly sortBy = signal<'name' | 'email' | 'role' | 'registered' | 'lastLogin'>('registered');
  protected readonly sortDirection = signal<'asc' | 'desc'>('desc');
  protected readonly pageSize = signal(10);
  protected readonly pageIndex = signal(0);

  protected readonly pageSizeOptions = [10, 20, 50] as const;

  protected readonly currentUserId = computed(() => this.auth.currentUser()?.id ?? null);
  protected readonly filteredUsers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const roleFilter = this.roleFilter();
    const lockFilter = this.lockFilter();

    return this.users().filter((user) => {
      if (roleFilter !== 'all' && user.role !== roleFilter) {
        return false;
      }

      if (lockFilter === 'locked' && !user.isAccountLocked) {
        return false;
      }

      if (lockFilter === 'unlocked' && user.isAccountLocked) {
        return false;
      }

      if (!term) {
        return true;
      }

      const haystack = [
        this.fullName(user),
        user.email,
        user.phone,
        user.role,
        String(user.age)
      ].join(' ').toLowerCase();

      return haystack.includes(term);
    });
  });

  protected readonly sortedUsers = computed(() => {
    const sortBy = this.sortBy();
    const direction = this.sortDirection();
    const factor = direction === 'asc' ? 1 : -1;
    const users = [...this.filteredUsers()];

    users.sort((left, right) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = this.fullName(left).localeCompare(this.fullName(right));
          break;
        case 'email':
          comparison = left.email.localeCompare(right.email);
          break;
        case 'role':
          comparison = left.role.localeCompare(right.role);
          break;
        case 'lastLogin':
          comparison = this.timestamp(left.lastLoginAt) - this.timestamp(right.lastLoginAt);
          break;
        case 'registered':
        default:
          comparison = this.timestamp(left.registrationDate) - this.timestamp(right.registrationDate);
          break;
      }

      return comparison * factor;
    });

    return users;
  });

  protected readonly totalItems = computed(() => this.sortedUsers().length);
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalItems() / this.pageSize())));
  protected readonly pageUsers = computed(() => {
    const currentPage = Math.min(this.pageIndex(), this.totalPages() - 1);
    const size = this.pageSize();
    const start = currentPage * size;
    const end = start + size;
    return this.sortedUsers().slice(start, end);
  });
  protected readonly pageFrom = computed(() => {
    if (this.totalItems() === 0) {
      return 0;
    }

    const currentPage = Math.min(this.pageIndex(), this.totalPages() - 1);
    return currentPage * this.pageSize() + 1;
  });
  protected readonly pageTo = computed(() => {
    if (this.totalItems() === 0) {
      return 0;
    }

    return Math.min(this.pageFrom() + this.pageSize() - 1, this.totalItems());
  });

  constructor() {
    void this.loadUsers();
  }

  protected updateSearchTerm(event: Event): void {
    const value = (event.target as HTMLInputElement | null)?.value ?? '';
    this.searchTerm.set(value);
    this.pageIndex.set(0);
  }

  protected updateRoleFilter(value: string): void {
    this.roleFilter.set((value as 'all' | 'admin' | 'user') || 'all');
    this.pageIndex.set(0);
  }

  protected updateLockFilter(value: string): void {
    this.lockFilter.set((value as 'all' | 'locked' | 'unlocked') || 'all');
    this.pageIndex.set(0);
  }

  protected updateSortBy(value: string): void {
    this.sortBy.set((value as 'name' | 'email' | 'role' | 'registered' | 'lastLogin') || 'registered');
    this.pageIndex.set(0);
  }

  protected updateSortDirection(value: string): void {
    this.sortDirection.set((value as 'asc' | 'desc') || 'desc');
    this.pageIndex.set(0);
  }

  protected updatePageSize(value: string): void {
    const parsed = Number(value);
    this.pageSize.set(Number.isFinite(parsed) && parsed > 0 ? parsed : 10);
    this.pageIndex.set(0);
  }

  protected prevPage(): void {
    this.pageIndex.update((current) => Math.max(0, current - 1));
  }

  protected nextPage(): void {
    this.pageIndex.update((current) => Math.min(this.totalPages() - 1, current + 1));
  }

  protected fullName(user: AuthUser): string {
    return `${user.firstName} ${user.lastName}`.trim() || 'Unknown';
  }

  protected isBusy(userId: number): boolean {
    return this.actionUserId() === userId;
  }

  protected async startEdit(user: AuthUser): Promise<void> {
    if (this.isBusy(user.id) || !this.canEditUser(user)) {
      return;
    }

    const payload = await firstValueFrom(this.dialog.open(EditUserDialogComponent, {
      data: { user },
      panelClass: 'app-confirm-dialog',
      width: 'min(560px, calc(100vw - 2rem))',
      disableClose: true
    }).afterClosed());

    if (!payload) {
      return;
    }

    this.actionUserId.set(user.id);

    try {
      const result = await this.auth.updateUserForAdmin(user.id, payload);

      if (!result.success) {
        this.notifications.error(result.error ?? 'Unable to update user.');
        return;
      }

      this.notifications.success('User updated.');
      await this.loadUsers();
    } finally {
      this.actionUserId.set(null);
    }
  }

  protected async banUser(user: AuthUser): Promise<void> {
    if (this.isBusy(user.id) || !this.canBanUser(user)) {
      return;
    }

    const shouldLock = !user.isAccountLocked;
    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: shouldLock ? 'Ban user' : 'Unban user',
        message: shouldLock
          ? `Do you want to ban ${user.email}?`
          : `Do you want to unban ${user.email}?`,
        confirmLabel: shouldLock ? 'Ban' : 'Unban',
        cancelLabel: 'Cancel'
      },
      panelClass: 'app-confirm-dialog'
    }).afterClosed());

    if (!confirmed) {
      return;
    }

    this.actionUserId.set(user.id);

    try {
      const result = await this.auth.setUserLockForAdmin(user.id, shouldLock);
      if (!result.success) {
        this.notifications.error(result.error ?? 'Unable to update lock status.');
        return;
      }

      this.notifications.success(shouldLock ? 'User banned.' : 'User unbanned.');
      await this.loadUsers();
    } finally {
      this.actionUserId.set(null);
    }
  }

  protected async removeUser(user: AuthUser): Promise<void> {
    if (this.isBusy(user.id) || !this.canRemoveUser(user)) {
      return;
    }

    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Remove user',
        message: `Do you want to permanently remove ${user.email}?`,
        confirmLabel: 'Remove',
        cancelLabel: 'Cancel'
      },
      panelClass: 'app-confirm-dialog'
    }).afterClosed());

    if (!confirmed) {
      return;
    }

    this.actionUserId.set(user.id);

    try {
      const result = await this.auth.removeUserForAdmin(user.id);
      if (!result.success) {
        this.notifications.error(result.error ?? 'Unable to remove user.');
        return;
      }

      this.notifications.success('User removed.');
      await this.loadUsers();
    } finally {
      this.actionUserId.set(null);
    }
  }

  protected canEditUser(user: AuthUser): boolean {
    return Boolean(user.id);
  }

  protected canBanUser(user: AuthUser): boolean {
    const currentUserId = this.currentUserId();
    const seedAdminEmail = this.config.authSeedAdminEmail.trim().toLowerCase();
    return Boolean(user.id)
      && user.id !== currentUserId
      && user.email.trim().toLowerCase() !== seedAdminEmail;
  }

  protected canRemoveUser(user: AuthUser): boolean {
    const currentUserId = this.currentUserId();
    const seedAdminEmail = this.config.authSeedAdminEmail.trim().toLowerCase();
    return Boolean(user.id)
      && user.id !== currentUserId
      && user.email.trim().toLowerCase() !== seedAdminEmail;
  }

  protected formatDate(value: string | undefined): string {
    if (!value) {
      return '—';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '—';
    }

    return new Intl.DateTimeFormat('en-GB', {
      year: 'numeric',
      month: 'short',
      day: '2-digit'
    }).format(date);
  }

  private timestamp(value: string | undefined): number {
    if (!value) {
      return 0;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }

  private async loadUsers(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const users = await this.auth.listUsersForAdmin();
      this.users.set(users);
    } catch {
      this.error.set('Unable to load users.');
      this.users.set([]);
    } finally {
      this.loading.set(false);
    }
  }
}
