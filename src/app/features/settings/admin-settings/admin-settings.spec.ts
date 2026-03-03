import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { AdminSettingsComponent } from './admin-settings';
import { AdminDataResetService } from '../../../core/services/admin-data-reset.service';
import { AppPreferencesService } from '../../../core/services/app-preferences.service';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { FoodStore } from '../../../core/stores/food.store';

class MockAuthService {
  currentUser = vi.fn().mockReturnValue({
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

  fullName = vi.fn().mockReturnValue('System Admin');
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

describe('AdminSettingsComponent', () => {
  let component: AdminSettingsComponent;
  let fixture: ComponentFixture<AdminSettingsComponent>;
  let adminDataReset: MockAdminDataResetService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminSettingsComponent],
      providers: [
        provideHttpClientTesting(),
        { provide: AuthService, useClass: MockAuthService },
        { provide: AppPreferencesService, useClass: MockAppPreferencesService },
        { provide: NotificationService, useClass: MockNotificationService },
        { provide: FoodStore, useClass: MockFoodStore },
        { provide: AdminDataResetService, useClass: MockAdminDataResetService },
        { provide: MatDialog, useClass: MockMatDialog }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AdminSettingsComponent);
    component = fixture.componentInstance;
    adminDataReset = TestBed.inject(AdminDataResetService) as unknown as MockAdminDataResetService;
    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should reset all data and reload after admin confirms reset action', async () => {
    const dialogOpenSpy = vi.fn().mockReturnValue({
      afterClosed: () => of(true)
    });

    const reloadSpy = vi.fn();
    vi.stubGlobal('location', { reload: reloadSpy });

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
