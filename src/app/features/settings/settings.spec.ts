import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { SettingsComponent } from './settings';
import { AdminDataResetService } from '../../core/services/admin-data-reset.service';
import { AuthService } from '../../core/services/auth.service';
import { AppPreferencesService } from '../../core/services/app-preferences.service';
import { NotificationService } from '../../core/services/notification.service';
import { FoodStore } from '../../core/stores/food.store';

class MockAuthService {
  currentUser = vi.fn().mockReturnValue({
    id: 1,
    email: 'user@example.com',
    firstName: 'Regular',
    lastName: 'User',
    phone: '123456789',
    age: 30,
    role: 'user',
    registrationDate: new Date('2026-01-01').toISOString(),
    isAccountLocked: false,
    emailVerified: true,
    createdAt: new Date('2026-01-01').toISOString()
  });
  fullName = vi.fn().mockReturnValue('Regular User');
  updateProfile = vi.fn().mockResolvedValue({ success: true });
  changePassword = vi.fn().mockResolvedValue({ success: true });
}

class MockAppPreferencesService {
  includeDummyProducts = vi.fn().mockReturnValue(false);
  setIncludeDummyProducts = vi.fn();
}

class MockNotificationService {
  info = vi.fn();
  success = vi.fn();
  error = vi.fn();
}

class MockFoodStore {
  reset = vi.fn();
}

class MockAdminDataResetService {
  resetAllData = vi.fn().mockResolvedValue(undefined);
}

class MockMatDialog {
  open = vi.fn().mockReturnValue({
    afterClosed: () => of(false)
  });
}

describe('SettingsComponent', () => {
  let component: SettingsComponent;
  let fixture: ComponentFixture<SettingsComponent>;
  let auth: MockAuthService;
  let adminDataReset: MockAdminDataResetService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [
        provideRouter([]),
        provideHttpClientTesting(),
        { provide: AuthService, useClass: MockAuthService },
        { provide: AppPreferencesService, useClass: MockAppPreferencesService },
        { provide: NotificationService, useClass: MockNotificationService },
        { provide: FoodStore, useClass: MockFoodStore },
        { provide: AdminDataResetService, useClass: MockAdminDataResetService },
        { provide: MatDialog, useClass: MockMatDialog }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    auth = TestBed.inject(AuthService) as unknown as MockAuthService;
    adminDataReset = TestBed.inject(AdminDataResetService) as unknown as MockAdminDataResetService;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should not render Admin Settings for a regular user', () => {
    const hostElement = fixture.nativeElement as HTMLElement;
    const cardTitles = Array.from(hostElement.querySelectorAll('mat-card-title'))
      .map((element) => (element.textContent ?? '').trim());
    const dummyProductsToggle = hostElement.querySelector('mat-slide-toggle');

    expect(cardTitles).toContain('User Settings');
    expect(cardTitles).not.toContain('Admin Settings');
    expect(dummyProductsToggle).toBeNull();
    expect(hostElement.textContent).not.toContain('Dummy products');
    expect(hostElement.textContent).not.toContain('Reset all data & reload');
  });

  it('should render Admin Settings for admin user', () => {
    auth.currentUser.mockReturnValue({
      id: 10,
      email: 'admin@example.com',
      firstName: 'System',
      lastName: 'Admin',
      phone: '123456789',
      age: 35,
      role: 'admin',
      registrationDate: new Date('2026-01-01').toISOString(),
      isAccountLocked: false,
      emailVerified: true,
      createdAt: new Date('2026-01-01').toISOString()
    });
    auth.fullName.mockReturnValue('System Admin');

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const hostElement = fixture.nativeElement as HTMLElement;
    const cardTitles = Array.from(hostElement.querySelectorAll('mat-card-title'))
      .map((element) => (element.textContent ?? '').trim());
    const dummyProductsToggle = hostElement.querySelector('mat-slide-toggle');

    expect(component).toBeTruthy();
    expect(cardTitles).toContain('User Settings');
    expect(cardTitles).toContain('Admin Settings');
    expect(dummyProductsToggle).toBeTruthy();
    expect(hostElement.textContent).toContain('Dummy products');
    expect(hostElement.textContent).toContain('Reset all data & reload');
  });

  it('should reset all data and reload after admin confirms reset action', async () => {
    auth.currentUser.mockReturnValue({
      id: 10,
      email: 'admin@example.com',
      firstName: 'System',
      lastName: 'Admin',
      phone: '123456789',
      age: 35,
      role: 'admin',
      registrationDate: new Date('2026-01-01').toISOString(),
      isAccountLocked: false,
      emailVerified: true,
      createdAt: new Date('2026-01-01').toISOString()
    });
    auth.fullName.mockReturnValue('System Admin');
    const dialogOpenSpy = vi.fn().mockReturnValue({
      afterClosed: () => of(true)
    });

    const reloadSpy = vi.fn();
    vi.stubGlobal('location', { reload: reloadSpy });

    fixture = TestBed.createComponent(SettingsComponent);
    component = fixture.componentInstance;
    (component as unknown as { dialog: { open: typeof dialogOpenSpy } }).dialog = { open: dialogOpenSpy };
    fixture.detectChanges();

    const hostElement = fixture.nativeElement as HTMLElement;
    const resetButton = Array.from(hostElement.querySelectorAll('button'))
      .find((button) => (button.textContent ?? '').includes('Reset all data & reload'));

    expect(resetButton).toBeTruthy();

    (resetButton as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(dialogOpenSpy).toHaveBeenCalledTimes(1);
    expect(adminDataReset.resetAllData).toHaveBeenCalledTimes(1);
    expect(reloadSpy).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });
});
