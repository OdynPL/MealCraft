import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { ConfigurationService } from '../../../core/services/configuration.service';
import { NotificationService } from '../../../core/services/notification.service';
import { LocalRecipeService } from '../../../core/services/local-recipe.service';
import { ActivityLogService } from '../../../core/services/activity-log.service';
import { ProfileValidationService } from '../../../core/services/profile-validation.service';
import { PasswordValidationService } from '../../../core/services/password-validation.service';
import { AvatarService } from '../../../core/services/avatar.service';

import { ConfirmDialogComponent } from '../../../shared/confirm-dialog/confirm-dialog';
import { RecipeExportService } from '../../../core/services/recipe-export.service';
import { RecipeImportService } from '../../../core/services/recipe-import.service';

@Component({
  selector: 'app-user-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatButtonToggleModule
  ],
  templateUrl: './user-settings.html',
  styleUrl: './user-settings.scss'
})
export class UserSettingsComponent implements OnInit {
    private readonly profileValidation = inject(ProfileValidationService);
    private readonly passwordValidation = inject(PasswordValidationService);
    private readonly avatarService = inject(AvatarService);
  private readonly auth = inject(AuthService);
  public readonly config = inject(ConfigurationService);
  private readonly notifications = inject(NotificationService);
  private readonly dialog = inject(MatDialog);
  private readonly localRecipes = inject(LocalRecipeService);
  private readonly recipeExport = inject(RecipeExportService);
  private readonly recipeImport = inject(RecipeImportService);
  private readonly activityLog = inject(ActivityLogService);

  protected readonly importExportMessage = signal<string | null>(null);
  protected readonly importExportError = signal<string | null>(null);
  protected readonly importFailedRecipes = signal<{ index: number; title?: string; reasons: string[] }[] | null>(null);
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

  protected readonly ownRecipeCount = signal(0);

  private updateOwnRecipeCount() {
    const user = this.auth.currentUser();
    if (!user) {
      this.ownRecipeCount.set(0);
      return;
    }
    this.ownRecipeCount.set(this.localRecipes.getAllCustom().filter(r => r.ownerId === user.id).length);
  }

  exportRecipes(): void {
    this.importExportMessage.set(null);
    this.importExportError.set(null);
    const result = this.recipeExport.exportUserRecipes();
    if (result.error) {
      this.importExportError.set(result.error);
      this.activityLog.record({
        area: 'settings',
        action: 'export-fail',
        status: 'error',
        actor: { id: this.auth.currentUser()?.id ?? 0, name: this.auth.fullName() },
        details: result.error
      });
      return;
    }
    // File handling and download logic remains here, as RecipeExportService only returns blob and filename
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
    this.importExportMessage.set(`Exported ${result.count} recipe(s) to ${result.filename}.`);
    this.activityLog.record({
      area: 'settings',
      action: 'export',
      status: 'success',
      actor: { id: this.auth.currentUser()?.id ?? 0, name: this.auth.fullName() },
      details: `Exported ${result.count} recipes to ${result.filename}`
    });
    this.updateOwnRecipeCount();
  }

  async onImportRecipes(event: Event): Promise<void> {
    this.importExportMessage.set(null);
    this.importExportError.set(null);
    this.importFailedRecipes.set(null);
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      this.importExportError.set('No file selected.');
      this.activityLog.record({
        area: 'settings',
        action: 'import-fail',
        status: 'error',
        actor: { id: this.auth.currentUser()?.id ?? 0, name: this.auth.fullName() },
        details: 'No file selected.'
      });
      return;
    }
    if (file.type !== 'application/json') {
      this.importExportError.set('Please select a valid JSON file.');
      this.activityLog.record({
        area: 'settings',
        action: 'import-fail',
        status: 'error',
        actor: { id: this.auth.currentUser()?.id ?? 0, name: this.auth.fullName() },
        details: 'Invalid file type.'
      });
      input.value = '';
      return;
    }
    const text = await file.text();
    const result = this.recipeImport.validateAndImport(text);
    if (result.errors.length > 0) {
      this.importExportError.set(result.errors.join(' '));
      this.importFailedRecipes.set(result.failedRecipes && result.failedRecipes.length > 0 ? result.failedRecipes : null);
      this.activityLog.record({
        area: 'settings',
        action: 'import-fail',
        status: 'error',
        actor: { id: this.auth.currentUser()?.id ?? 0, name: this.auth.fullName() },
        details: result.errors.join(' ')
      });
    } else if (result.imported > 0) {
      this.importExportMessage.set(`Successfully imported ${result.imported} recipe(s). Skipped: ${result.skipped}.`);
      this.importFailedRecipes.set(result.failedRecipes && result.failedRecipes.length > 0 ? result.failedRecipes : null);
      this.activityLog.record({
        area: 'settings',
        action: 'import',
        status: 'success',
        actor: { id: this.auth.currentUser()?.id ?? 0, name: this.auth.fullName() },
        details: `Imported ${result.imported} recipes. Skipped: ${result.skipped}`
      });
    } else {
      this.importExportError.set('No valid recipes found in file.');
      this.importFailedRecipes.set(result.failedRecipes && result.failedRecipes.length > 0 ? result.failedRecipes : null);
      this.activityLog.record({
        area: 'settings',
        action: 'import-fail',
        status: 'error',
        actor: { id: this.auth.currentUser()?.id ?? 0, name: this.auth.fullName() },
        details: 'No valid recipes found in file.'
      });
    }
    this.updateOwnRecipeCount();
    input.value = '';
  }

  triggerImportFile(): void {
    this.updateOwnRecipeCount();
    document.getElementById('import-recipes-input')?.click();
  }
  ngOnInit(): void {
    this.updateOwnRecipeCount();
    // Ensure theme is applied on init (in case user changes)
    this.applyThemeToDocument(this.theme());
  }

  // Theme toggle state and message
  protected readonly theme = signal<'light' | 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'teal' | 'gray'>(this.getInitialTheme());
  protected readonly themeMessage = signal<string | null>(null);

  private getInitialTheme(): 'light' | 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'teal' | 'gray' {
    const user = this.auth.currentUser();
    if (user) {
      try {
        const stored = (localStorage.getItem('food-explorer.user-theme-' + user.id) ?? '') as string;
        if ((['light', 'blue', 'green', 'red', 'purple', 'orange', 'teal', 'gray'] as string[]).includes(stored)) {
          this.applyThemeToDocument(stored as 'light' | 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'teal' | 'gray');
          return stored as 'light' | 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'teal' | 'gray';
        }
      } catch { /* ignore */ }
      const userTheme = (user.theme ?? '') as string;
      if ((['light', 'blue', 'green', 'red', 'purple', 'orange', 'teal', 'gray'] as string[]).includes(userTheme)) {
        this.applyThemeToDocument(userTheme as 'light' | 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'teal' | 'gray');
        return userTheme as 'light' | 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'teal' | 'gray';
      }
    }
    this.applyThemeToDocument('light');
    return 'light';
  }

  private applyThemeToDocument(theme: 'light' | 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'teal' | 'gray') {
    document.body.classList.remove('theme-light', 'theme-blue', 'theme-green', 'theme-red', 'theme-purple', 'theme-orange', 'theme-teal', 'theme-gray');
    document.body.classList.add(`theme-${theme}`);
  }

  protected readonly currentPasswordControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(this.config.authMinPasswordLength), Validators.maxLength(this.config.authMaxPasswordLength)]
  });
  protected readonly newPasswordControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(this.config.authMinPasswordLength), Validators.maxLength(this.config.authMaxPasswordLength)]
  });

  protected async onAvatarSelected(event: Event): Promise<void> {
    this.avatarError.set(null);
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      this.avatarValue = undefined;
      this.avatarPreview.set(this.config.authDefaultAvatar);
      return;
    }
    const error = this.avatarService.validateAvatar(file);
    if (error) {
      this.avatarValue = undefined;
      this.avatarPreview.set(this.config.authDefaultAvatar);
      this.avatarError.set(error);
      input.value = '';
      return;
    }
    const result = await this.avatarService.readAvatarFile(file);
    if (!result) {
      this.avatarValue = undefined;
      this.avatarPreview.set(this.config.authDefaultAvatar);
      this.avatarError.set('Unable to read selected image.');
      return;
    }
    this.avatarValue = result;
    this.avatarPreview.set(result);
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
    return this.profileValidation.firstProfileValidationError(
      this.firstNameControl,
      this.lastNameControl,
      this.phoneControl,
      this.ageControl,
      this.avatarError()
    );
  }

  private firstPasswordValidationError(): string {
    return this.passwordValidation.firstPasswordValidationError(
      this.currentPasswordControl,
      this.newPasswordControl
    );
  }

  protected async onThemeChange(value: string) {
    const allowed: string[] = ['light', 'blue', 'green', 'red', 'purple', 'orange', 'teal', 'gray'];
    if (!allowed.includes(value)) return;
    const theme = value as 'light' | 'blue' | 'green' | 'red' | 'purple' | 'orange' | 'teal' | 'gray';
    const user = this.auth.currentUser();
    if (!user) {
      this.themeMessage.set('You must be logged in to change theme.');
      return;
    }
    // Update user theme in storage and session, and persist in localStorage (user profile)
    const users = await this.auth.getAllUsersPublic();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx < 0) {
      this.themeMessage.set('User not found.');
      return;
    }
    users[idx] = { ...users[idx], theme };
    try {
      localStorage.setItem('food-explorer.user-theme-' + user.id, theme);
    } catch { /* ignore */ }
    // TODO: Replace with public methods if possible in AuthService
    (this.auth as unknown as { writeUsersCache: (users: import('../../../core/models/auth').StoredUser[]) => void; writeSessionCache: (session: import('../../../core/models/auth').AuthUser | null) => void }).writeUsersCache(users);
    (this.auth as unknown as { writeUsersCache: (users: import('../../../core/models/auth').StoredUser[]) => void; writeSessionCache: (session: import('../../../core/models/auth').AuthUser | null) => void }).writeSessionCache({ ...user, theme });
    this.theme.set(theme);
    this.themeMessage.set(`Theme changed to ${theme.charAt(0).toUpperCase() + theme.slice(1)}.`);
    this.applyThemeToDocument(theme);
  }
}
