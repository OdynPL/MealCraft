import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { ConfigurationService } from '../../core/services/configuration.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class SettingsComponent {
  private readonly auth = inject(AuthService);
  private readonly config = inject(ConfigurationService);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  protected readonly profileMessage = signal<string | null>(null);
  protected readonly passwordMessage = signal<string | null>(null);
  protected readonly profileError = signal<string | null>(null);
  protected readonly passwordError = signal<string | null>(null);
  protected readonly avatarError = signal<string | null>(null);

  protected readonly avatarPreview = signal(this.auth.currentUser()?.avatar ?? this.config.authDefaultAvatar);
  private avatarValue = this.auth.currentUser()?.avatar;

  protected readonly fullName = computed(() => this.auth.fullName());

  protected readonly firstNameControl = new FormControl(this.auth.currentUser()?.firstName ?? '', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(2), Validators.maxLength(80)]
  });
  protected readonly lastNameControl = new FormControl(this.auth.currentUser()?.lastName ?? '', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(2), Validators.maxLength(80)]
  });
  protected readonly phoneControl = new FormControl(this.auth.currentUser()?.phone ?? '', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^[+]?[-0-9\s()]{6,}$/), Validators.maxLength(20)]
  });
  protected readonly ageControl = new FormControl(this.auth.currentUser()?.age ?? 18, {
    nonNullable: true,
    validators: [Validators.required, Validators.min(13), Validators.max(120)]
  });

  protected readonly currentPasswordControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(6), Validators.maxLength(120)]
  });
  protected readonly newPasswordControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(6), Validators.maxLength(120)]
  });

  constructor() {
    if (!this.auth.currentUser()) {
      void this.router.navigate(['/login'], { queryParams: { returnUrl: '/settings' } });
    }
  }

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

  protected async saveProfile(): Promise<void> {
    this.profileMessage.set(null);
    this.profileError.set(null);

    if (this.firstNameControl.invalid || this.lastNameControl.invalid || this.phoneControl.invalid || this.ageControl.invalid || this.avatarError()) {
      this.firstNameControl.markAsTouched();
      this.lastNameControl.markAsTouched();
      this.phoneControl.markAsTouched();
      this.ageControl.markAsTouched();
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
      return;
    }

    this.profileMessage.set('Profile updated successfully.');
  }

  protected async changePassword(): Promise<void> {
    this.passwordMessage.set(null);
    this.passwordError.set(null);

    if (this.currentPasswordControl.invalid || this.newPasswordControl.invalid) {
      this.currentPasswordControl.markAsTouched();
      this.newPasswordControl.markAsTouched();
      return;
    }

    const result = await this.auth.changePassword(this.currentPasswordControl.value, this.newPasswordControl.value);

    if (!result.success) {
      this.passwordError.set(result.error ?? 'Unable to change password.');
      return;
    }

    this.passwordMessage.set('Password changed successfully.');
    this.currentPasswordControl.setValue('');
    this.newPasswordControl.setValue('');
  }
}
