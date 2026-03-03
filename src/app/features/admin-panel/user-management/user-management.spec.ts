import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { UserManagementComponent } from './user-management';
import { AuthUser } from '../../../core/models/auth';
import { AuthService } from '../../../core/services/auth.service';
import { ConfigurationService } from '../../../core/services/configuration.service';
import { LocalRecipeService } from '../../../core/services/local-recipe.service';
import { NotificationService } from '../../../core/services/notification.service';

class MockAuthService {
  currentUser = vi.fn().mockReturnValue({ id: 1, role: 'admin' });
  listUsersForAdmin = vi.fn<() => Promise<AuthUser[]>>();
  updateUserForAdmin = vi.fn().mockResolvedValue({ success: true });
  setUserLockForAdmin = vi.fn().mockResolvedValue({ success: true });
  removeUserForAdmin = vi.fn().mockResolvedValue({ success: true });
}

class MockConfigurationService {
  authSeedAdminEmail = 'admin@admin.pl';
}

class MockLocalRecipeService {
  getSnapshot = vi.fn().mockReturnValue({
    custom: [
      { id: 101, ownerId: 2 },
      { id: 102, ownerId: 2 }
    ],
    overrides: [
      { id: 201, ownerId: 3 }
    ],
    deletedIds: []
  });
}

class MockNotificationService {
  success = vi.fn();
  error = vi.fn();
}

class MockMatDialog {
  open = vi.fn().mockReturnValue({
    afterClosed: () => of(undefined)
  });
}

describe('UserManagementComponent', () => {
  let component: UserManagementComponent;
  let fixture: ComponentFixture<UserManagementComponent>;
  let auth: MockAuthService;
  let dialog: MockMatDialog;
  let notifications: MockNotificationService;

  const users: AuthUser[] = [
    {
      id: 1,
      email: 'admin@admin.pl',
      firstName: 'System',
      lastName: 'Admin',
      phone: '+48000000000',
      age: 30,
      role: 'admin',
      registrationDate: new Date('2026-01-01').toISOString(),
      isAccountLocked: false,
      emailVerified: true,
      createdAt: new Date('2026-01-01').toISOString()
    },
    {
      id: 2,
      email: 'john@example.com',
      firstName: 'John',
      lastName: 'Cook',
      phone: '+48111111111',
      age: 28,
      role: 'user',
      registrationDate: new Date('2026-01-02').toISOString(),
      isAccountLocked: false,
      emailVerified: false,
      createdAt: new Date('2026-01-02').toISOString()
    },
    {
      id: 3,
      email: 'ann@example.com',
      firstName: 'Ann',
      lastName: 'Chef',
      phone: '+48222222222',
      age: 32,
      role: 'user',
      registrationDate: new Date('2026-01-03').toISOString(),
      isAccountLocked: true,
      emailVerified: true,
      createdAt: new Date('2026-01-03').toISOString()
    }
  ];

  beforeEach(async () => {
    const authMock = new MockAuthService();
    authMock.listUsersForAdmin.mockResolvedValue(users);
    const dialogMock = new MockMatDialog();

    await TestBed.configureTestingModule({
      imports: [UserManagementComponent],
      providers: [
        { provide: AuthService, useValue: authMock },
        { provide: ConfigurationService, useClass: MockConfigurationService },
        { provide: LocalRecipeService, useClass: MockLocalRecipeService },
        { provide: NotificationService, useClass: MockNotificationService },
        { provide: MatDialog, useValue: dialogMock }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(UserManagementComponent);
    component = fixture.componentInstance;
    auth = TestBed.inject(AuthService) as unknown as MockAuthService;
    dialog = TestBed.inject(MatDialog) as unknown as MockMatDialog;
    notifications = TestBed.inject(NotificationService) as unknown as MockNotificationService;

    await fixture.whenStable();
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('should create and load users', () => {
    expect(component).toBeTruthy();
    expect((component as any).users().length).toBe(3);
    expect((component as any).ownedRecipesCount(2)).toBe(2);
  });

  it('should filter users by search and role', () => {
    (component as any).updateSearchTerm({ target: { value: 'john' } } as unknown as Event);
    expect((component as any).filteredUsers().length).toBe(1);

    (component as any).updateRoleFilter('user');
    expect((component as any).filteredUsers().length).toBe(1);
  });

  it('should not allow ban/remove for current user and seed admin', () => {
    const currentAdmin = users[0];

    expect((component as any).canBanUser(currentAdmin)).toBe(false);
    expect((component as any).canRemoveUser(currentAdmin)).toBe(false);
  });

  it('should edit user when dialog returns payload', async () => {
    dialog.open.mockReturnValue({
      afterClosed: () => of({
        firstName: 'John',
        lastName: 'Cook',
        phone: '+48111111111',
        age: 29,
        role: 'user',
        emailVerified: true
      })
    });
    (component as any).dialog = { open: dialog.open };

    await (component as any).startEdit(users[1]);

    expect(auth.updateUserForAdmin).toHaveBeenCalledWith(2, expect.any(Object));
    expect(notifications.success).toHaveBeenCalledWith('User updated.');
    expect(auth.listUsersForAdmin).toHaveBeenCalledTimes(2);
  });

  it('should ban user when confirmed', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(true) });
    (component as any).dialog = { open: dialog.open };

    await (component as any).banUser(users[1]);

    expect(auth.setUserLockForAdmin).toHaveBeenCalledWith(2, true);
    expect(notifications.success).toHaveBeenCalledWith('User banned.');
  });

  it('should not remove user when dialog is cancelled', async () => {
    dialog.open.mockReturnValue({ afterClosed: () => of(false) });
    (component as any).dialog = { open: dialog.open };

    await (component as any).removeUser(users[1]);

    expect(auth.removeUserForAdmin).not.toHaveBeenCalled();
  });
});
