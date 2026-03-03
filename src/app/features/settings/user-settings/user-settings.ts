import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { ConfigurationService } from '../../../core/services/configuration.service';
import { NotificationService } from '../../../core/services/notification.service';
import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-user-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  templateUrl: './user-settings.html',
  styleUrl: './user-settings.scss'
})
export class UserSettingsComponent {
  private readonly auth = inject(AuthService);
  private readonly config = inject(ConfigurationService);
  private readonly notifications = inject(NotificationService);
  private readonly dialog = inject(MatDialog);

  protected readonly profileMessage = signal<string | null>(null);
  protected readonly passwordMessage = signal<string | null>(null);
  protected readonly profileValidationError = signal<string | null>(null);
  protected readonly passwordValidationError = signal<string | null>(null);
  protected readonly profileError = signal<string | null>(null);
  protected readonly passwordError = signal<string | null>(null);
  protected readonly avatarError = signal<string | null>(null);

  protected readonly avatarPreview = signal(this.auth.currentUser()?.avatar ?? this.config.authDefaultAvatar);
  private avatarValue = this.auth.currentUser()?.avatar;

  protected readonly fullName = computed(() => this.auth.fullName());

  protected readonly firstNameControl = new FormControl(this.auth.currentUser()?.firstName ?? '', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(this.config.authMinNameLength), Validators.maxLength(this.config.authMaxNameLength)]
  });
  protected readonly lastNameControl = new FormControl(this.auth.currentUser()?.lastName ?? '', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(this.config.authMinNameLength), Validators.maxLength(this.config.authMaxNameLength)]
  });
  protected readonly phoneControl = new FormControl(this.auth.currentUser()?.phone ?? '', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(this.config.authPhonePattern), Validators.maxLength(this.config.authMaxPhoneLength)]
  });
  protected readonly ageControl = new FormControl(this.auth.currentUser()?.age ?? this.config.authDefaultAge, {
    nonNullable: true,
    validators: [Validators.required, Validators.min(this.config.authMinAge), Validators.max(this.config.authMaxAge)]
  });

  protected readonly currentPasswordControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(this.config.authMinPasswordLength), Validators.maxLength(this.config.authMaxPasswordLength)]
  });
  protected readonly newPasswordControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(this.config.authMinPasswordLength), Validators.maxLength(this.config.authMaxPasswordLength)]
  });

  protected onAvatarSelected(event: Event): void {
    this.avatarError.set(null);

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      this.avatarValue = undefined;
      this.avatarPreview.set(this.config.authDefaultAvatar);
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.avatarValue = undefined;
      this.avatarPreview.set(this.config.authDefaultAvatar);
      this.avatarError.set('Only image files are allowed.');
      input.value = '';
      return;
    }

    if (file.size > this.config.authMaxAvatarSizeBytes) {
      this.avatarValue = undefined;
      this.avatarPreview.set(this.config.authDefaultAvatar);
      this.avatarError.set('Image is too large. Maximum size is 2 MB.');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '').trim();
      if (!result.startsWith('data:image/')) {
        this.avatarValue = undefined;
        this.avatarPreview.set(this.config.authDefaultAvatar);
        this.avatarError.set('Unable to read selected image.');
        return;
      }

      this.avatarValue = result;
      this.avatarPreview.set(result);
    };

    reader.onerror = () => {
      this.avatarValue = undefined;
      this.avatarPreview.set(this.config.authDefaultAvatar);
      this.avatarError.set('Unable to read selected image.');
    };

    reader.readAsDataURL(file);
  }

  protected async removeAvatar(): Promise<void> {
    const confirmed = await firstValueFrom(this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Remove avatar',
        message: 'Do you want to remove your avatar and use the default image?',
        confirmLabel: 'Remove',
        cancelLabel: 'Cancel'
      },
      panelClass: 'app-confirm-dialog'
    }).afterClosed());

    if (!confirmed) {
      return;
    }

    this.avatarValue = undefined;
    this.avatarPreview.set(this.config.authDefaultAvatar);
    this.avatarError.set(null);
  }

  protected onProfileFormSubmit(event: Event): void {
    event.preventDefault();
    void this.saveProfile();
  }

  protected onPasswordFormSubmit(event: Event): void {
    event.preventDefault();
    void this.changePassword();
  }

  private async saveProfile(): Promise<void> {
    this.profileMessage.set(null);
    this.profileError.set(null);
    this.profileValidationError.set(null);

    if (this.firstNameControl.invalid || this.lastNameControl.invalid || this.phoneControl.invalid || this.ageControl.invalid || this.avatarError()) {
      this.firstNameControl.markAsTouched();
      this.lastNameControl.markAsTouched();
      this.phoneControl.markAsTouched();
      this.ageControl.markAsTouched();
      this.profileValidationError.set(this.firstProfileValidationError());
      return;
    }

    const result = await this.auth.updateProfile({
      firstName: this.firstNameControl.value,
      lastName: this.lastNameControl.value,
      phone: this.phoneControl.value,
      age: this.ageControl.value,
      avatar: this.avatarValue
    });

    if (!result.success) {
      this.profileError.set(result.error ?? 'Unable to update profile.');
      this.notifications.error(this.profileError() ?? 'Unable to update profile.');
      return;
    }

    this.profileMessage.set('Profile updated successfully.');
    this.notifications.success('Profile updated.');
  }

  private async changePassword(): Promise<void> {
    this.passwordMessage.set(null);
    this.passwordError.set(null);
    this.passwordValidationError.set(null);

    if (this.currentPasswordControl.invalid || this.newPasswordControl.invalid) {
      this.currentPasswordControl.markAsTouched();
      this.newPasswordControl.markAsTouched();
      this.passwordValidationError.set(this.firstPasswordValidationError());
      return;
    }

    const result = await this.auth.changePassword(this.currentPasswordControl.value, this.newPasswordControl.value);

    if (!result.success) {
      this.passwordError.set(result.error ?? 'Unable to change password.');
      this.notifications.error(this.passwordError() ?? 'Unable to change password.');
      return;
    }

    this.passwordMessage.set('Password changed successfully.');
    this.notifications.success('Password changed.');
    this.currentPasswordControl.setValue('');
    this.newPasswordControl.setValue('');
  }

  private firstProfileValidationError(): string {
    if (this.firstNameControl.hasError('required')) {
      return 'First name is required.';
    }
    if (this.firstNameControl.hasError('minlength')) {
      return `First name must be at least ${this.config.authMinNameLength} characters.`;
    }
    if (this.firstNameControl.hasError('maxlength')) {
      return `First name must be at most ${this.config.authMaxNameLength} characters.`;
    }

    if (this.lastNameControl.hasError('required')) {
      return 'Last name is required.';
    }
    if (this.lastNameControl.hasError('minlength')) {
      return `Last name must be at least ${this.config.authMinNameLength} characters.`;
    }
    if (this.lastNameControl.hasError('maxlength')) {
      return `Last name must be at most ${this.config.authMaxNameLength} characters.`;
    }

    if (this.phoneControl.hasError('required') || this.phoneControl.hasError('pattern') || this.phoneControl.hasError('maxlength')) {
      return 'Enter a valid phone number.';
    }

    if (this.ageControl.hasError('required') || this.ageControl.hasError('min') || this.ageControl.hasError('max')) {
      return `Age must be between ${this.config.authMinAge} and ${this.config.authMaxAge}.`;
    }

    if (this.avatarError()) {
      return this.avatarError() ?? 'Avatar is invalid.';
    }

    return 'Please fix validation errors and try again.';
  }

  private firstPasswordValidationError(): string {
    if (this.currentPasswordControl.hasError('required')) {
      return 'Current password is required.';
    }
    if (this.currentPasswordControl.hasError('minlength')) {
      return `Current password must be at least ${this.config.authMinPasswordLength} characters.`;
    }
    if (this.currentPasswordControl.hasError('maxlength')) {
      return `Current password must be at most ${this.config.authMaxPasswordLength} characters.`;
    }

    if (this.newPasswordControl.hasError('required')) {
      return 'New password is required.';
    }
    if (this.newPasswordControl.hasError('minlength')) {
      return `New password must be at least ${this.config.authMinPasswordLength} characters.`;
    }
    if (this.newPasswordControl.hasError('maxlength')) {
      return `New password must be at most ${this.config.authMaxPasswordLength} characters.`;
    }

    return 'Please fix validation errors and try again.';
  }
}
