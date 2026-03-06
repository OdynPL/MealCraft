import { Injectable, inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ConfigurationService } from './configuration.service';

@Injectable({ providedIn: 'root' })
export class PasswordValidationService {
  private config = inject(ConfigurationService);

  public firstPasswordValidationError(
    currentPasswordControl: FormControl,
    newPasswordControl: FormControl
  ): string {
    if (currentPasswordControl.hasError('required')) {
      return 'Current password is required.';
    }
    if (currentPasswordControl.hasError('minlength')) {
      return `Current password must be at least ${this.config.authMinPasswordLength} characters.`;
    }
    if (currentPasswordControl.hasError('maxlength')) {
      return `Current password must be at most ${this.config.authMaxPasswordLength} characters.`;
    }

    if (newPasswordControl.hasError('required')) {
      return 'New password is required.';
    }
    if (newPasswordControl.hasError('minlength')) {
      return `New password must be at least ${this.config.authMinPasswordLength} characters.`;
    }
    if (newPasswordControl.hasError('maxlength')) {
      return `New password must be at most ${this.config.authMaxPasswordLength} characters.`;
    }

    return 'Please fix validation errors and try again.';
  }
}
