import { TestBed } from '@angular/core/testing';
import { PasswordValidationService } from './password-validation.service';
import { ConfigurationService } from './configuration.service';
import { FormControl } from '@angular/forms';

describe('PasswordValidationService', () => {
  let service: PasswordValidationService;

  class MockConfigService {
    authMinPasswordLength = 6;
    authMaxPasswordLength = 20;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PasswordValidationService,
        { provide: ConfigurationService, useClass: MockConfigService }
      ]
    });
    service = TestBed.inject(PasswordValidationService);
  });

  it('should return required error for current password', () => {
    const current = new FormControl('', { nonNullable: true });
    current.setErrors({ required: true });
    const next = new FormControl('valid', { nonNullable: true });
    expect(service.firstPasswordValidationError(current, next)).toBe('Current password is required.');
  });

  it('should return minlength error for current password', () => {
    const current = new FormControl('123', { nonNullable: true });
    current.setErrors({ minlength: true });
    const next = new FormControl('valid', { nonNullable: true });
    expect(service.firstPasswordValidationError(current, next)).toBe('Current password must be at least 6 characters.');
  });

  it('should return maxlength error for current password', () => {
    const current = new FormControl('a'.repeat(21), { nonNullable: true });
    current.setErrors({ maxlength: true });
    const next = new FormControl('valid', { nonNullable: true });
    expect(service.firstPasswordValidationError(current, next)).toBe('Current password must be at most 20 characters.');
  });

  it('should return required error for new password', () => {
    const current = new FormControl('valid', { nonNullable: true });
    const next = new FormControl('', { nonNullable: true });
    next.setErrors({ required: true });
    expect(service.firstPasswordValidationError(current, next)).toBe('New password is required.');
  });

  it('should return minlength error for new password', () => {
    const current = new FormControl('valid', { nonNullable: true });
    const next = new FormControl('123', { nonNullable: true });
    next.setErrors({ minlength: true });
    expect(service.firstPasswordValidationError(current, next)).toBe('New password must be at least 6 characters.');
  });

  it('should return maxlength error for new password', () => {
    const current = new FormControl('valid', { nonNullable: true });
    const next = new FormControl('a'.repeat(21), { nonNullable: true });
    next.setErrors({ maxlength: true });
    expect(service.firstPasswordValidationError(current, next)).toBe('New password must be at most 20 characters.');
  });

  it('should return generic error if no specific error', () => {
    const current = new FormControl('valid', { nonNullable: true });
    const next = new FormControl('valid', { nonNullable: true });
    expect(service.firstPasswordValidationError(current, next)).toBe('Please fix validation errors and try again.');
  });
});
