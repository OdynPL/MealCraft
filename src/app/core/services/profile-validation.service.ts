import { Injectable, inject } from '@angular/core';
import { FormControl } from '@angular/forms';
import { ConfigurationService } from './configuration.service';

@Injectable({ providedIn: 'root' })
export class ProfileValidationService {
  private config = inject(ConfigurationService);

  public firstProfileValidationError(
    firstNameControl: FormControl,
    lastNameControl: FormControl,
    phoneControl: FormControl,
    ageControl: FormControl,
    avatarError: string | null
  ): string {
    if (firstNameControl.hasError('required')) {
      return 'First name is required.';
    }
    if (firstNameControl.hasError('minlength')) {
      return `First name must be at least ${this.config.authMinNameLength} characters.`;
    }
    if (firstNameControl.hasError('maxlength')) {
      return `First name must be at most ${this.config.authMaxNameLength} characters.`;
    }

    if (lastNameControl.hasError('required')) {
      return 'Last name is required.';
    }
    if (lastNameControl.hasError('minlength')) {
      return `Last name must be at least ${this.config.authMinNameLength} characters.`;
    }
    if (lastNameControl.hasError('maxlength')) {
      return `Last name must be at most ${this.config.authMaxNameLength} characters.`;
    }

    if (phoneControl.hasError('required') || phoneControl.hasError('pattern') || phoneControl.hasError('maxlength')) {
      return 'Enter a valid phone number.';
    }

    if (ageControl.hasError('required') || ageControl.hasError('min') || ageControl.hasError('max')) {
      return `Age must be between ${this.config.authMinAge} and ${this.config.authMaxAge}.`;
    }

    if (avatarError) {
      return avatarError ?? 'Avatar is invalid.';
    }

    return 'Please fix validation errors and try again.';
  }
}
