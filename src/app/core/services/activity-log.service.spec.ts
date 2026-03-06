import { TestBed } from '@angular/core/testing';
import { ActivityLogService } from './activity-log.service';
import { AuthService } from './auth.service';

let storageData: Record<string, string> = {};

beforeEach(() => {
  storageData = {};
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => storageData[key] ?? null,
      setItem: (key: string, value: string) => { storageData[key] = value; },
      removeItem: (key: string) => { delete storageData[key]; },
      clear: () => { storageData = {}; }
    }
  });
  TestBed.configureTestingModule({
    providers: [ActivityLogService, AuthService]
  });
});

describe('ActivityLogService', () => {
  let service: ActivityLogService;

  beforeEach(() => {
    service = TestBed.inject(ActivityLogService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should log activity for profile update', async () => {
    const auth = TestBed.inject((await import('./auth.service')).AuthService);
    const service = TestBed.inject(ActivityLogService);
    await auth.register({
      email: 'log.profile@example.com',
      password: 'password123',
      firstName: 'Log',
      lastName: 'Profile',
      phone: '+48123456789',
      age: 22,
      role: 'user'
    });
    await service.clear();
    await auth.updateProfile({
      firstName: 'Log',
      lastName: 'Changed',
      phone: '+48987654321',
      age: 23
    });
    const logs = service.entries();
    expect(logs.some(l => l.action === 'profile-update' && l.status === 'success')).toBe(true);
  });

  it('should log activity for password change', async () => {
    const auth = TestBed.inject((await import('./auth.service')).AuthService);
    const service = TestBed.inject(ActivityLogService);
    await auth.register({
      email: 'log.pass@example.com',
      password: 'oldpass',
      firstName: 'Log',
      lastName: 'Pass',
      phone: '+48123456789',
      age: 22,
      role: 'user'
    });
    await service.clear();
    await auth.changePassword('oldpass', 'newpass');
    const logs = service.entries();
    expect(logs.some(l => l.action === 'password-change' && l.status === 'success')).toBe(true);
  });

  it('should log activity for logout', async () => {
    const auth = TestBed.inject((await import('./auth.service')).AuthService);
    const service = TestBed.inject(ActivityLogService);
    await auth.register({
      email: 'log.logout@example.com',
      password: 'logoutpass',
      firstName: 'Log',
      lastName: 'Logout',
      phone: '+48123456789',
      age: 22,
      role: 'user'
    });
    await service.clear();
    await auth.logout();
    const logs = service.entries();
    expect(logs.some(l => l.action === 'logout' && l.status === 'info')).toBe(true);
  });
});