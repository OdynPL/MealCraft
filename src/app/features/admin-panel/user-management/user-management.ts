import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
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

  protected readonly currentUserId = computed(() => this.auth.currentUser()?.id ?? null);

  constructor() {
    void this.loadUsers();
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
