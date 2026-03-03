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

  protected async submit(): Promise<void> {
    this.error.set(null);

    const registerMode = this.mode() === 'register';
    const invalid = this.emailControl.invalid
      || this.passwordControl.invalid
      || (registerMode && this.firstNameControl.invalid)
      || (registerMode && this.lastNameControl.invalid)
      || (registerMode && this.phoneControl.invalid)
      || (registerMode && this.ageControl.invalid)
      || (registerMode && !!this.avatarError());

    if (invalid) {
      this.emailControl.markAsTouched();
      this.passwordControl.markAsTouched();
      this.firstNameControl.markAsTouched();
      this.lastNameControl.markAsTouched();
      this.phoneControl.markAsTouched();
      this.ageControl.markAsTouched();
      return;
    }

    this.loading.set(true);

    const email = this.emailControl.value;
    const password = this.passwordControl.value;

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
      return;
    }

    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/home';
    await this.router.navigateByUrl(returnUrl);
  }
}
