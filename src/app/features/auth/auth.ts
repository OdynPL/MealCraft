import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { AuthService } from '../../core/services/auth.service';
import { ConfigurationService } from '../../core/services/configuration.service';
import { NotificationService } from '../../core/services/notification.service';
import { FoodStore } from '../../core/stores/food.store';

@Component({
  selector: 'app-auth',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule
  ],
  templateUrl: './auth.html',
  styleUrl: './auth.scss'
})
export class AuthComponent {
  private readonly auth = inject(AuthService);
  private readonly config = inject(ConfigurationService);
  private readonly notifications = inject(NotificationService);
  private readonly store = inject(FoodStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly mode = signal<'login' | 'register'>('login');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly emailControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.email, Validators.maxLength(this.config.authMaxEmailLength)]
  });
  protected readonly passwordControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(this.config.authMinPasswordLength), Validators.maxLength(this.config.authMaxPasswordLength)]
  });
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

  protected readonly avatarPreview = signal(this.config.authDefaultAvatar);
  protected readonly avatarError = signal<string | null>(null);
  private avatarValue: string | undefined;

  protected readonly pageTitle = computed(() => this.mode() === 'login' ? 'Login' : 'Register');
  protected readonly submitLabel = computed(() => this.mode() === 'login' ? 'Sign in' : 'Create account');

  constructor() {
    this.route.data
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((data) => {
        const mode = data['mode'];
        this.mode.set(mode === 'register' ? 'register' : 'login');
        this.error.set(null);
      });
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

  protected onFormSubmit(event: Event): void {
    event.preventDefault();
    void this.submit();
  }

  protected async submit(): Promise<void> {
    this.error.set(null);

    const registerMode = this.mode() === 'register';
    const invalid = this.hasInvalidAuthForm(registerMode);

    if (invalid) {
      this.markRelevantControlsTouched(registerMode);
      this.error.set(this.firstValidationError(registerMode));
      return;
    }

    this.loading.set(true);

    const email = this.emailControl.value;
    const password = this.passwordControl.value;

    try {
      const result = this.mode() === 'login'
        ? await this.auth.login(email, password)
        : await this.auth.register({
          email,
          password,
          firstName: this.firstNameControl.value,
          lastName: this.lastNameControl.value,
          phone: this.phoneControl.value,
          age: this.ageControl.value,
          avatar: this.avatarValue
        });

      this.loading.set(false);

      if (!result.success) {
        this.error.set(result.error ?? 'Authentication failed.');
        this.notifications.error(this.error() ?? 'Authentication failed.');
        return;
      }

      this.notifications.success(this.mode() === 'login' ? 'Logged in successfully.' : 'User created successfully.');
      this.store.reset();

      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/home';
      await this.router.navigateByUrl(returnUrl);
    } catch {
      this.loading.set(false);
      this.error.set('Authentication is temporarily unavailable. Please try again.');
      this.notifications.error('Authentication is temporarily unavailable. Please try again.');
    }
  }

  protected forgotPassword(): void {
    this.error.set('Password reset is not available yet. Create a new account or change password in Settings after login.');
  }

  private hasInvalidAuthForm(registerMode: boolean): boolean {
    return this.emailControl.invalid
      || this.passwordControl.invalid
      || (registerMode && this.firstNameControl.invalid)
      || (registerMode && this.lastNameControl.invalid)
      || (registerMode && this.phoneControl.invalid)
      || (registerMode && this.ageControl.invalid)
      || (registerMode && !!this.avatarError());
  }

  private markRelevantControlsTouched(registerMode: boolean): void {
    this.emailControl.markAsTouched();
    this.passwordControl.markAsTouched();

    if (!registerMode) {
      return;
    }

    this.firstNameControl.markAsTouched();
    this.lastNameControl.markAsTouched();
    this.phoneControl.markAsTouched();
    this.ageControl.markAsTouched();
  }

  private firstValidationError(registerMode: boolean): string {
    if (this.emailControl.hasError('required')) {
      return 'Email is required.';
    }
    if (this.emailControl.hasError('email')) {
      return 'Enter a valid email address.';
    }
    if (this.emailControl.hasError('maxlength')) {
      return `Email must be at most ${this.config.authMaxEmailLength} characters.`;
    }

    if (this.passwordControl.hasError('required')) {
      return 'Password is required.';
    }
    if (this.passwordControl.hasError('minlength')) {
      return `Password must be at least ${this.config.authMinPasswordLength} characters.`;
    }
    if (this.passwordControl.hasError('maxlength')) {
      return `Password must be at most ${this.config.authMaxPasswordLength} characters.`;
    }

    if (!registerMode) {
      return 'Please fix validation errors and try again.';
    }

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

    if (this.phoneControl.hasError('required')) {
      return 'Phone number is required.';
    }
    if (this.phoneControl.hasError('pattern') || this.phoneControl.hasError('maxlength')) {
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
}
