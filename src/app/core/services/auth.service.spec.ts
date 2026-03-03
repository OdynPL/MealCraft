import { TestBed } from '@angular/core/testing';

import { AuthService } from './auth.service';
import { ConfigurationService } from './configuration.service';

describe('AuthService', () => {
  const sessionCacheKey = 'food-explorer.current-user';
  const usersCacheKey = 'food-explorer.users';
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

  it('should register and auto-login when IndexedDB is unavailable', async () => {
    const service = TestBed.inject(AuthService);

    const result = await service.register({
      email: 'new.user@example.com',
      password: 'password123',
      firstName: 'New',
      lastName: 'User',
      phone: '+48123123123',
      age: 27,
      role: 'user'
    });

    expect(result.success).toBe(true);
    expect(service.isLoggedIn()).toBe(true);
    expect(service.currentUser()?.email).toBe('new.user@example.com');

    const cachedUsersRaw = localStorage.getItem(usersCacheKey);
    expect(cachedUsersRaw).toBeTruthy();
    const cachedUsers = JSON.parse(cachedUsersRaw ?? '[]') as Array<{ email: string }>;
    expect(cachedUsers.some((item) => item.email === 'new.user@example.com')).toBe(true);
  });

  it('should login from localStorage fallback users when IndexedDB is unavailable', async () => {
    const service = TestBed.inject(AuthService);

    const register = await service.register({
      email: 'fallback.login@example.com',
      password: 'password123',
      firstName: 'Fallback',
      lastName: 'Login',
      phone: '+48111222333',
      age: 30,
      role: 'user'
    });
    expect(register.success).toBe(true);

    await service.logout();
    expect(service.isLoggedIn()).toBe(false);

    const login = await service.login('fallback.login@example.com', 'password123');
    expect(login.success).toBe(true);
    expect(service.isLoggedIn()).toBe(true);
    expect(service.currentUser()?.email).toBe('fallback.login@example.com');
    expect(localStorage.getItem(sessionCacheKey)).toBeNull();
  });

  it('should persist session on login when remember me is enabled', async () => {
    const service = TestBed.inject(AuthService);

    const register = await service.register({
      email: 'remember.me@example.com',
      password: 'password123',
      firstName: 'Remember',
      lastName: 'Me',
      phone: '+48111222444',
      age: 31,
      role: 'user'
    });
    expect(register.success).toBe(true);

    await service.logout();
    const login = await service.login('remember.me@example.com', 'password123', true);

    expect(login.success).toBe(true);
    expect(service.isLoggedIn()).toBe(true);
    expect(localStorage.getItem(sessionCacheKey)).toContain('remember.me@example.com');
  });

  it('should lock account after too many failed login attempts', async () => {
    const service = TestBed.inject(AuthService);

    const register = await service.register({
      email: 'locked.user@example.com',
      password: 'password123',
      firstName: 'Locked',
      lastName: 'User',
      phone: '+48111222999',
      age: 29,
      role: 'user'
    });
    expect(register.success).toBe(true);

    await service.logout();

    for (let attempt = 0; attempt < 4; attempt += 1) {
      const failed = await service.login('locked.user@example.com', 'wrong-password');
      expect(failed.success).toBe(false);
      expect(failed.error).toContain('Invalid email or password');
    }

    const lockedAttempt = await service.login('locked.user@example.com', 'wrong-password');
    expect(lockedAttempt.success).toBe(false);
    expect(lockedAttempt.error).toContain('locked');

    const validAfterLock = await service.login('locked.user@example.com', 'password123');
    expect(validAfterLock.success).toBe(false);
    expect(validAfterLock.error).toContain('locked');
  });

  it('should register successfully when IndexedDB open throws', async () => {
    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: {
        open: () => {
          throw new Error('IndexedDB blocked');
        }
      }
    });

    const service = TestBed.inject(AuthService);
    const result = await service.register({
      email: 'blocked.idb@example.com',
      password: 'password123',
      firstName: 'Blocked',
      lastName: 'Db',
      phone: '+48111111999',
      age: 26,
      role: 'user'
    });

    expect(result.success).toBe(true);
    expect(service.isLoggedIn()).toBe(true);
    expect(service.currentUser()?.email).toBe('blocked.idb@example.com');
  });

  it('should keep cached session when indexedDB session is empty', async () => {
    const cachedUser = {
      id: 777,
      email: 'cache.only@example.com',
      firstName: 'Cache',
      lastName: 'Only',
      phone: '+48123456000',
      age: 33,
      createdAt: new Date('2025-02-10').toISOString()
    };
    localStorage.setItem(sessionCacheKey, JSON.stringify(cachedUser));

    Object.defineProperty(globalThis, 'indexedDB', {
      configurable: true,
      value: {
        open: () => {
          const request: {
            result?: unknown;
            error?: unknown;
            onupgradeneeded: (() => void) | null;
            onsuccess: (() => void) | null;
            onerror: (() => void) | null;
          } = {
            onupgradeneeded: null,
            onsuccess: null,
            onerror: null
          };

          queueMicrotask(() => {
            request.result = {
              objectStoreNames: {
                contains: () => true
              },
              transaction: () => ({
                objectStore: () => ({
                  get: () => {
                    const getRequest: { result?: unknown; onsuccess: (() => void) | null; onerror: (() => void) | null } = {
                      result: undefined,
                      onsuccess: null,
                      onerror: null
                    };
                    queueMicrotask(() => {
                      getRequest.onsuccess?.();
                    });
                    return getRequest;
                  }
                }),
                onerror: null,
                error: null
              })
            };
            request.onsuccess?.();
          });

          return request;
        }
      }
    });

    const service = TestBed.inject(AuthService);
    await Promise.resolve();
    await Promise.resolve();

    expect(service.isLoggedIn()).toBe(true);
    expect(service.currentUser()?.email).toBe('cache.only@example.com');
  });

  it('should always provide seeded admin account', async () => {
    const service = TestBed.inject(AuthService);
    await Promise.resolve();

    const login = await service.login('admin@admin.pl', 'admin@admin.pl', true);
    expect(login.success).toBe(true);
    expect(service.currentUser()?.email).toBe('admin@admin.pl');
    expect(service.currentUser()?.role).toBe('admin');
  });

  it('should seed admin and three default user accounts', async () => {
    const service = TestBed.inject(AuthService);
    await Promise.resolve();

    const login = await service.login('admin@admin.pl', 'admin@admin.pl', true);
    expect(login.success).toBe(true);

    const users = await service.listUsersForAdmin();
    expect(users).toHaveLength(4);

    const rolesByEmail = new Map(users.map((user) => [user.email, user.role]));
    expect(rolesByEmail.get('admin@admin.pl')).toBe('admin');
    expect(rolesByEmail.get('user1@test.pl')).toBe('user');
    expect(rolesByEmail.get('user2@test.pl')).toBe('user');
    expect(rolesByEmail.get('user3@test.pl')).toBe('user');
  });

  it('should prevent admin from banning or removing own account', async () => {
    const service = TestBed.inject(AuthService);
    await Promise.resolve();

    const login = await service.login('admin@admin.pl', 'admin@admin.pl', true);
    expect(login.success).toBe(true);

    const selfId = service.currentUser()?.id;
    expect(selfId).toBeTruthy();

    const banSelf = await service.setUserLockForAdmin(selfId as number, true);
    expect(banSelf.success).toBe(false);
    expect(banSelf.error).toContain('cannot ban your own account');

    const removeSelf = await service.removeUserForAdmin(selfId as number);
    expect(removeSelf.success).toBe(false);
    expect(removeSelf.error).toContain('cannot remove your own account');
  });
});
