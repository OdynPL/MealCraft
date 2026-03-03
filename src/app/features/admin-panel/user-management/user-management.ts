import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { firstValueFrom } from 'rxjs';

import { AuthUser } from '../../../core/models/auth';
import { AuthService } from '../../../core/services/auth.service';
import { ConfigurationService } from '../../../core/services/configuration.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-user-management',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule
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
  protected readonly editingUserId = signal<number | null>(null);
  protected readonly actionUserId = signal<number | null>(null);

  protected readonly firstNameControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(this.config.authMinNameLength), Validators.maxLength(this.config.authMaxNameLength)]
  });
  protected readonly lastNameControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(this.config.authMinNameLength), Validators.maxLength(this.config.authMaxNameLength)]
  });
  protected readonly phoneControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(this.config.authPhonePattern), Validators.maxLength(this.config.authMaxPhoneLength)]
  });
  protected readonly ageControl = new FormControl(this.config.authDefaultAge, {
    nonNullable: true,
    validators: [Validators.required, Validators.min(this.config.authMinAge), Validators.max(this.config.authMaxAge)]
  });
  protected readonly roleControl = new FormControl<'user' | 'admin'>('user', { nonNullable: true });
  protected readonly emailVerifiedControl = new FormControl(false, { nonNullable: true });

  protected readonly currentUserId = computed(() => this.auth.currentUser()?.id ?? null);

  constructor() {
    void this.loadUsers();
  }

  protected fullName(user: AuthUser): string {
    return `${user.firstName} ${user.lastName}`.trim() || 'Unknown';
  }

  protected isEditing(userId: number): boolean {
    return this.editingUserId() === userId;
  }

  protected isBusy(userId: number): boolean {
    return this.actionUserId() === userId;
  }

  protected startEdit(user: AuthUser): void {
    this.editingUserId.set(user.id);
    this.firstNameControl.setValue(user.firstName);
    this.lastNameControl.setValue(user.lastName);
    this.phoneControl.setValue(user.phone);
    this.ageControl.setValue(user.age);
    this.roleControl.setValue(user.role);
    this.emailVerifiedControl.setValue(user.emailVerified);
  }

  protected cancelEdit(): void {
    this.editingUserId.set(null);
  }

  protected async saveEdit(user: AuthUser): Promise<void> {
    if (!this.isEditing(user.id)) {
      return;
    }

    if (this.firstNameControl.invalid || this.lastNameControl.invalid || this.phoneControl.invalid || this.ageControl.invalid) {
      this.firstNameControl.markAsTouched();
      this.lastNameControl.markAsTouched();
      this.phoneControl.markAsTouched();
      this.ageControl.markAsTouched();
      this.notifications.error('Please fix user form validation errors.');
      return;
    }

    this.actionUserId.set(user.id);

    try {
      const result = await this.auth.updateUserForAdmin(user.id, {
        firstName: this.firstNameControl.value,
        lastName: this.lastNameControl.value,
        phone: this.phoneControl.value,
        age: this.ageControl.value,
        role: this.roleControl.value,
        emailVerified: this.emailVerifiedControl.value
      });

      if (!result.success) {
        this.notifications.error(result.error ?? 'Unable to update user.');
        return;
      }

      this.notifications.success('User updated.');
      this.editingUserId.set(null);
      await this.loadUsers();
    } finally {
      this.actionUserId.set(null);
    }
  }

  protected async banUser(user: AuthUser): Promise<void> {
    if (this.isBusy(user.id)) {
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
    if (this.isBusy(user.id)) {
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
      if (this.editingUserId() === user.id) {
        this.editingUserId.set(null);
      }
      await this.loadUsers();
    } finally {
      this.actionUserId.set(null);
    }
  }

  protected canEditUser(user: AuthUser): boolean {
    return Boolean(user.id);
  }

  protected canBanUser(user: AuthUser): boolean {
    return Boolean(user.id);
  }

  protected canRemoveUser(user: AuthUser): boolean {
    return Boolean(user.id);
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
