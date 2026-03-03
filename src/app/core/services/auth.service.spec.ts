import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import { ConfigurationService } from './configuration.service';

describe('AuthService', () => {
  const sessionCacheKey = 'food-explorer.current-user';
  let storageData: Record<string, string>;

  beforeEach(() => {
    storageData = {};

    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => storageData[key] ?? null,
        setItem: (key: string, value: string) => {
          storageData[key] = value;
        },
        removeItem: (key: string) => {
          delete storageData[key];
        }
      }
    });

    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: undefined
    });

    TestBed.configureTestingModule({
      providers: [AuthService, ConfigurationService]
    });
  });

  it('should restore session from localStorage cache on startup', () => {
    localStorage.setItem(sessionCacheKey, JSON.stringify({
      id: 100,
      email: 'user@example.com',
      firstName: 'User',
      lastName: 'Tester',
      phone: '+48123456789',
      age: 25,
      createdAt: new Date('2025-01-01').toISOString()
    }));

    const service = TestBed.inject(AuthService);

    expect(service.isLoggedIn()).toBe(true);
    expect(service.currentUser()?.email).toBe('user@example.com');
    expect(service.fullName()).toBe('User Tester');
  });

  it('should ignore invalid cached session payload', () => {
    localStorage.setItem(sessionCacheKey, JSON.stringify({
      id: 0,
      email: 'not-an-email'
    }));

    const service = TestBed.inject(AuthService);

    expect(service.isLoggedIn()).toBe(false);
    expect(service.currentUser()).toBeNull();
  });

  it('should clear cache on logout even without indexedDB', async () => {
    localStorage.setItem(sessionCacheKey, JSON.stringify({
      id: 101,
      email: 'logout@example.com',
      firstName: 'Log',
      lastName: 'Out',
      phone: '+48111111111',
      age: 28,
      createdAt: new Date('2025-01-02').toISOString()
    }));

    const service = TestBed.inject(AuthService);
    await service.logout();

    expect(service.isLoggedIn()).toBe(false);
    expect(localStorage.getItem(sessionCacheKey)).toBeNull();
  });
});
