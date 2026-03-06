import { TestBed } from '@angular/core/testing';
import { ProfileValidationService } from './profile-validation.service';
import { ConfigurationService } from './configuration.service';
import { FormControl } from '@angular/forms';

describe('ProfileValidationService', () => {
  let service: ProfileValidationService;

  class MockConfigService {
    authMinNameLength = 2;
    authMaxNameLength = 80;
    authMinAge = 13;
    authMaxAge = 120;
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProfileValidationService,
        { provide: ConfigurationService, useClass: MockConfigService }
      ]
    });
    service = TestBed.inject(ProfileValidationService);
  });

  function makeControls({
    firstNameErrors = null as Record<string, any> | null,
    lastNameErrors = null as Record<string, any> | null,
    phoneErrors = null as Record<string, any> | null,
    ageErrors = null as Record<string, any> | null,
    avatarError = null as string | null
  } = {}) {
    const firstName = new FormControl('John', { nonNullable: true });
    if (firstNameErrors) firstName.setErrors(firstNameErrors);
    const lastName = new FormControl('Doe', { nonNullable: true });
    if (lastNameErrors) lastName.setErrors(lastNameErrors);
    const phone = new FormControl('123456789', { nonNullable: true });
    if (phoneErrors) phone.setErrors(phoneErrors);
    const age = new FormControl(30, { nonNullable: true });
    if (ageErrors) age.setErrors(ageErrors);
    return { firstName, lastName, phone, age, avatarError };
  }

  it('should return required error for first name', () => {
    const c = makeControls({ firstNameErrors: { required: true } });
    expect(service.firstProfileValidationError(c.firstName, c.lastName, c.phone, c.age, c.avatarError)).toBe('First name is required.');
  });

  it('should return minlength error for first name', () => {
    const c = makeControls({ firstNameErrors: { minlength: true } });
    expect(service.firstProfileValidationError(c.firstName, c.lastName, c.phone, c.age, c.avatarError)).toBe('First name must be at least 2 characters.');
  });

  it('should return maxlength error for first name', () => {
    const c = makeControls({ firstNameErrors: { maxlength: true } });
    expect(service.firstProfileValidationError(c.firstName, c.lastName, c.phone, c.age, c.avatarError)).toBe('First name must be at most 80 characters.');
  });

  it('should return required error for last name', () => {
    const c = makeControls({ lastNameErrors: { required: true } });
    expect(service.firstProfileValidationError(c.firstName, c.lastName, c.phone, c.age, c.avatarError)).toBe('Last name is required.');
  });

  it('should return minlength error for last name', () => {
    const c = makeControls({ lastNameErrors: { minlength: true } });
    expect(service.firstProfileValidationError(c.firstName, c.lastName, c.phone, c.age, c.avatarError)).toBe('Last name must be at least 2 characters.');
  });

  it('should return maxlength error for last name', () => {
    const c = makeControls({ lastNameErrors: { maxlength: true } });
    expect(service.firstProfileValidationError(c.firstName, c.lastName, c.phone, c.age, c.avatarError)).toBe('Last name must be at most 80 characters.');
  });

  it('should return phone error', () => {
    const c = makeControls({ phoneErrors: { required: true } });
    expect(service.firstProfileValidationError(c.firstName, c.lastName, c.phone, c.age, c.avatarError)).toBe('Enter a valid phone number.');
    c.phone.setErrors({ pattern: true });
    expect(service.firstProfileValidationError(c.firstName, c.lastName, c.phone, c.age, c.avatarError)).toBe('Enter a valid phone number.');
    c.phone.setErrors({ maxlength: true });
    expect(service.firstProfileValidationError(c.firstName, c.lastName, c.phone, c.age, c.avatarError)).toBe('Enter a valid phone number.');
  });

  it('should return age error', () => {
    const c = makeControls({ ageErrors: { required: true } });
    expect(service.firstProfileValidationError(c.firstName, c.lastName, c.phone, c.age, c.avatarError)).toBe('Age must be between 13 and 120.');
    c.age.setErrors({ min: true });
    expect(service.firstProfileValidationError(c.firstName, c.lastName, c.phone, c.age, c.avatarError)).toBe('Age must be between 13 and 120.');
    c.age.setErrors({ max: true });
    expect(service.firstProfileValidationError(c.firstName, c.lastName, c.phone, c.age, c.avatarError)).toBe('Age must be between 13 and 120.');
  });

  it('should return avatar error if present', () => {
    const c = makeControls({ avatarError: 'Avatar too large.' });
    expect(service.firstProfileValidationError(c.firstName, c.lastName, c.phone, c.age, c.avatarError)).toBe('Avatar too large.');
  });

  it('should return generic error if no specific error', () => {
    const c = makeControls();
    expect(service.firstProfileValidationError(c.firstName, c.lastName, c.phone, c.age, c.avatarError)).toBe('Please fix validation errors and try again.');
  });
});
