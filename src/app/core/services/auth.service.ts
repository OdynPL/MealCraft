import { Injectable, computed, inject, signal } from '@angular/core';

import { AdminUserUpdatePayload, AuthResult, AuthUser, RegisterPayload, StoredUser, UpdateProfilePayload } from '../models/auth';
import { ActivityLogService } from './activity-log.service';
import { ConfigurationService } from './configuration.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly config = inject(ConfigurationService);
  private readonly activityLog = inject(ActivityLogService);
  private readonly userState = signal<AuthUser | null>(this.readSessionCache());
  private readonly bootstrapReady: Promise<void>;

  readonly currentUser = computed(() => this.userState());
  readonly isLoggedIn = computed(() => this.userState() !== null);
  readonly fullName = computed(() => {
    const user = this.userState();
    if (!user) {
      return '';
    }

    return `${user.firstName} ${user.lastName}`.trim();
  });

  constructor() {
    this.bootstrapReady = this.bootstrapAuthState();
  }

  private async bootstrapAuthState(): Promise<void> {
    await this.ensureSeedUsers();
    await this.hydrateSessionFromIndexedDb();
  }

  async register(payload: RegisterPayload): Promise<AuthResult> {
    await this.bootstrapReady;

    const normalizedEmail = payload.email.trim().toLowerCase();
    const validationError = this.validateProfileData(payload.firstName, payload.lastName, payload.phone, payload.age);

    if (!isValidEmail(normalizedEmail)) {
      return { success: false, error: 'Invalid email address.' };
    }

    if (payload.password.trim().length < this.config.authMinPasswordLength) {
      return {
        success: false,
        error: `Password must be at least ${this.config.authMinPasswordLength} characters.`
      };
    }

    if (validationError) {
      return { success: false, error: validationError };
    }

    const users = await this.getAllUsers();
    if (users.some((user) => user.email === normalizedEmail)) {
      return { success: false, error: 'This email is already registered.' };
    }

    const storedUser: StoredUser = {
      id: Date.now(),
      email: normalizedEmail,
      ...(await createPasswordRecord(
        payload.password,
        this.config.authPasswordAlgorithm,
        this.config.authPasswordIterations
      )),
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      phone: payload.phone.trim(),
      age: payload.age,
      role: payload.role,
      registrationDate: new Date().toISOString(),
      isAccountLocked: false,
      failedLoginAttempts: 0,
      emailVerified: false,
      updatedAt: new Date().toISOString(),
      avatar: normalizeOptional(payload.avatar),
      createdAt: new Date().toISOString()
    };

    await this.putUser(storedUser);
    await this.saveSession(toAuthUser(storedUser));

    this.activityLog.record({
      area: 'auth',
      action: 'register',
      status: 'success',
      actor: {
        id: storedUser.id,
        email: storedUser.email,
        name: `${storedUser.firstName} ${storedUser.lastName}`.trim(),
        role: storedUser.role
      },
      target: storedUser.email,
      details: 'New account registered and session started.'
    });

    return { success: true };
  }

  async login(email: string, password: string, rememberMe = false): Promise<AuthResult> {
    await this.bootstrapReady;

    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      return { success: false, error: 'Invalid email address.' };
    }

    const users = await this.getAllUsers();
    const user = users.find((item) => item.email === normalizedEmail);

    if (!user) {
      this.activityLog.record({
        area: 'auth',
        action: 'login',
        status: 'warning',
        target: normalizedEmail,
        details: 'Login failed: user not found.'
      });
      return { success: false, error: 'Invalid email or password.' };
    }

    if (user.isAccountLocked) {
      this.activityLog.record({
        area: 'auth',
        action: 'login',
        status: 'warning',
        target: user.email,
        details: 'Login blocked: account is locked.'
      });
      return { success: false, error: 'Account is locked. Contact administrator.' };
    }

    const verification = await verifyPassword(
      user,
      password,
      this.config.authPasswordAlgorithm,
      this.config.authPasswordIterations
    );
    if (!verification.valid) {
      const failedAttempts = (user.failedLoginAttempts ?? 0) + 1;
      const shouldLock = failedAttempts >= this.config.authMaxFailedLoginAttempts;

      await this.putUser({
        ...user,
        failedLoginAttempts: failedAttempts,
        isAccountLocked: shouldLock,
        accountLockedAt: shouldLock ? new Date().toISOString() : user.accountLockedAt,
        updatedAt: new Date().toISOString()
      });

      if (shouldLock) {
        this.activityLog.record({
          area: 'auth',
          action: 'login',
          status: 'warning',
          target: user.email,
          details: 'Account locked due to too many failed login attempts.'
        });
        return { success: false, error: 'Account is locked due to too many failed login attempts.' };
      }

      this.activityLog.record({
        area: 'auth',
        action: 'login',
        status: 'warning',
        target: user.email,
        details: 'Login failed: invalid password.'
      });

      return { success: false, error: 'Invalid email or password.' };
    }

    const authenticatedUser = verification.upgradedUser ?? user;
    const refreshedUser: StoredUser = {
      ...authenticatedUser,
      failedLoginAttempts: 0,
      isAccountLocked: false,
      accountLockedAt: undefined,
      lastLoginAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.putUser(refreshedUser);

    await this.saveSession(toAuthUser(refreshedUser), rememberMe);
    this.activityLog.record({
      area: 'auth',
      action: 'login',
      status: 'success',
      actor: {
        id: refreshedUser.id,
        email: refreshedUser.email,
        name: `${refreshedUser.firstName} ${refreshedUser.lastName}`.trim(),
        role: refreshedUser.role
      },
      target: refreshedUser.email,
      details: rememberMe ? 'Login successful with remember me.' : 'Login successful.'
    });
    return { success: true };
  }

  async updateProfile(payload: UpdateProfilePayload): Promise<AuthResult> {
    const currentUser = this.userState();
    if (!currentUser) {
      return { success: false, error: 'You must be logged in.' };
    }

    const validationError = this.validateProfileData(payload.firstName, payload.lastName, payload.phone, payload.age);
    if (validationError) {
      return { success: false, error: validationError };
    }

    const users = await this.getAllUsers();
    const index = users.findIndex((user) => user.id === currentUser.id);

    if (index < 0) {
      return { success: false, error: 'User not found.' };
    }

    const updatedUser: StoredUser = {
      ...users[index],
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      phone: payload.phone.trim(),
      age: payload.age,
      updatedAt: new Date().toISOString(),
      avatar: normalizeOptional(payload.avatar)
    };

    await this.putUser(updatedUser);
    await this.saveSession(toAuthUser(updatedUser));
    this.activityLog.record({
      area: 'settings',
      action: 'profile-update',
      status: 'success',
      actor: this.actorFromUser(updatedUser),
      target: updatedUser.email,
      details: 'Profile data updated.'
    });
    return { success: true };
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<AuthResult> {
    const sessionUser = this.userState();
    if (!sessionUser) {
      return { success: false, error: 'You must be logged in.' };
    }

    if (newPassword.trim().length < this.config.authMinPasswordLength) {
      return {
        success: false,
        error: `New password must be at least ${this.config.authMinPasswordLength} characters.`
      };
    }

    const users = await this.getAllUsers();
    const index = users.findIndex((item) => item.id === sessionUser.id);

    if (index < 0) {
      return { success: false, error: 'User not found.' };
    }

    const verification = await verifyPassword(
      users[index],
      currentPassword,
      this.config.authPasswordAlgorithm,
      this.config.authPasswordIterations
    );
    if (!verification.valid) {
      return { success: false, error: 'Current password is incorrect.' };
    }

    const nextPassword = await createPasswordRecord(
      newPassword,
      this.config.authPasswordAlgorithm,
      this.config.authPasswordIterations
    );

    users[index] = {
      ...users[index],
      ...nextPassword
    };

    await this.putUser(users[index]);
    this.activityLog.record({
      area: 'settings',
      action: 'password-change',
      status: 'success',
      actor: this.actorFromUser(users[index]),
      target: users[index].email,
      details: 'Password changed successfully.'
    });
    return { success: true };
  }

  async logout(): Promise<void> {
    const user = this.userState();
    this.userState.set(null);
    this.writeSessionCache(null);

    if (user) {
      this.activityLog.record({
        area: 'auth',
        action: 'logout',
        status: 'info',
        actor: this.actorFromUser(user),
        target: user.email,
        details: 'User logged out.'
      });
    }

    if (typeof indexedDB === 'undefined') {
      return;
    }

    try {
      const db = await this.openDb();
      await this.runTransaction<void>(db, this.config.authSessionStore, 'readwrite', (store, done, fail) => {
        const request = store.delete(this.config.authSessionKey);
        request.onsuccess = () => done(undefined);
        request.onerror = () => fail(request.error);
      });
    } catch {
      return;
    }
  }

  async listUsersForAdmin(): Promise<AuthUser[]> {
    await this.bootstrapReady;

    const currentUser = this.userState();
    if (!currentUser || currentUser.role !== 'admin') {
      return [];
    }

    const users = await this.getAllUsers();
    return users
      .map((user) => toAuthUser(user))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }

  async updateUserForAdmin(userId: number, payload: AdminUserUpdatePayload): Promise<AuthResult> {
    await this.bootstrapReady;

    const currentUser = this.userState();
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, error: 'Admin access required.' };
    }

    const validationError = this.validateProfileData(payload.firstName, payload.lastName, payload.phone, payload.age);
    if (validationError) {
      return { success: false, error: validationError };
    }

    const users = await this.getAllUsers();
    const index = users.findIndex((user) => user.id === userId);
    if (index < 0) {
      return { success: false, error: 'User not found.' };
    }

    const targetUser = users[index];
    const normalizedRole = normalizeUserRole(payload.role, this.config.authDefaultRole, this.config.authAllowedRoles);
    const seedAdminEmail = this.config.authSeedAdminEmail.trim().toLowerCase();

    if (targetUser.email === seedAdminEmail && normalizedRole !== 'admin') {
      return { success: false, error: 'Seed admin role cannot be changed.' };
    }

    if (targetUser.id === currentUser.id && normalizedRole !== 'admin') {
      return { success: false, error: 'You cannot remove your own admin role.' };
    }

    const updatedUser: StoredUser = {
      ...targetUser,
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      phone: payload.phone.trim(),
      age: payload.age,
      role: normalizedRole,
      emailVerified: payload.emailVerified,
      updatedAt: new Date().toISOString()
    };

    await this.putUser(updatedUser);

    this.activityLog.record({
      area: 'admin',
      action: 'user-update',
      status: 'success',
      actor: this.actorFromUser(currentUser),
      target: updatedUser.email,
      details: 'Admin updated user profile/role.'
    });

    if (updatedUser.id === currentUser.id) {
      await this.saveSession(toAuthUser(updatedUser));
    }

    return { success: true };
  }

  async setUserLockForAdmin(userId: number, shouldLock: boolean): Promise<AuthResult> {
    await this.bootstrapReady;

    const currentUser = this.userState();
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, error: 'Admin access required.' };
    }

    const users = await this.getAllUsers();
    const index = users.findIndex((user) => user.id === userId);
    if (index < 0) {
      return { success: false, error: 'User not found.' };
    }

    const targetUser = users[index];
    const seedAdminEmail = this.config.authSeedAdminEmail.trim().toLowerCase();

    if (targetUser.id === currentUser.id && shouldLock) {
      return { success: false, error: 'You cannot ban your own account.' };
    }

    if (targetUser.email === seedAdminEmail && shouldLock) {
      return { success: false, error: 'Seed admin account cannot be banned.' };
    }

    const updatedUser: StoredUser = {
      ...targetUser,
      isAccountLocked: shouldLock,
      failedLoginAttempts: shouldLock
        ? Math.max(targetUser.failedLoginAttempts, this.config.authMaxFailedLoginAttempts)
        : 0,
      accountLockedAt: shouldLock ? new Date().toISOString() : undefined,
      updatedAt: new Date().toISOString()
    };

    await this.putUser(updatedUser);

    this.activityLog.record({
      area: 'admin',
      action: shouldLock ? 'user-ban' : 'user-unban',
      status: 'success',
      actor: this.actorFromUser(currentUser),
      target: updatedUser.email,
      details: shouldLock ? 'Admin banned user account.' : 'Admin unbanned user account.'
    });

    if (updatedUser.id === currentUser.id && shouldLock) {
      await this.logout();
    }

    return { success: true };
  }

  async removeUserForAdmin(userId: number): Promise<AuthResult> {
    await this.bootstrapReady;

    const currentUser = this.userState();
    if (!currentUser || currentUser.role !== 'admin') {
      return { success: false, error: 'Admin access required.' };
    }

    if (currentUser.id === userId) {
      return { success: false, error: 'You cannot remove your own account.' };
    }

    const users = await this.getAllUsers();
    const targetUser = users.find((user) => user.id === userId);
    if (!targetUser) {
      return { success: false, error: 'User not found.' };
    }

    const seedAdminEmail = this.config.authSeedAdminEmail.trim().toLowerCase();
    if (targetUser.email === seedAdminEmail) {
      return { success: false, error: 'Seed admin account cannot be removed.' };
    }

    await this.deleteUser(userId);
    this.activityLog.record({
      area: 'admin',
      action: 'user-remove',
      status: 'success',
      actor: this.actorFromUser(currentUser),
      target: targetUser.email,
      details: 'Admin removed user account.'
    });
    return { success: true };
  }

  private actorFromUser(user: Pick<AuthUser, 'id' | 'email' | 'firstName' | 'lastName' | 'role'>) {
    return {
      id: user.id,
      email: user.email,
      name: `${user.firstName} ${user.lastName}`.trim(),
      role: user.role
    };
  }

  private validateProfileData(firstName: string, lastName: string, phone: string, age: number): string | null {
    if (firstName.trim().length < this.config.authMinNameLength) {
      return `First name must have at least ${this.config.authMinNameLength} characters.`;
    }

    if (lastName.trim().length < this.config.authMinNameLength) {
      return `Last name must have at least ${this.config.authMinNameLength} characters.`;
    }

    if (!isValidPhone(phone, this.config.authPhonePattern, this.config.authMaxPhoneLength)) {
      return 'Invalid phone number.';
    }

    if (!Number.isInteger(age) || age < this.config.authMinAge || age > this.config.authMaxAge) {
      return `Age must be between ${this.config.authMinAge} and ${this.config.authMaxAge}.`;
    }

    return null;
  }

  private async hydrateSessionFromIndexedDb(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    try {
      const db = await this.openDb();
      const user = await this.runTransaction<AuthUser | null>(db, this.config.authSessionStore, 'readonly', (store, done, fail) => {
        const request = store.get(this.config.authSessionKey);
        request.onsuccess = () => done(normalizeAuthUser(request.result, this.config));
        request.onerror = () => fail(request.error);
      });

      if (user) {
        this.userState.set(user);
        this.writeSessionCache(user);
        return;
      }

      if (!this.userState()) {
        this.userState.set(null);
        this.writeSessionCache(null);
      }
    } catch {
      // keep cache fallback
    }
  }

  private async ensureSeedUsers(): Promise<void> {
    const seeds = this.config.authSeedUsers
      .map((seed) => ({
        ...seed,
        email: seed.email.trim().toLowerCase(),
        password: seed.password.trim()
      }))
      .filter((seed) => seed.email.length > 0 && seed.password.length > 0);

    if (seeds.length === 0) {
      return;
    }

    const users = await this.getAllUsers();
    const shouldSeedMissingUsers = users.length === 0;
    const now = new Date().toISOString();

    for (const seed of seeds) {
      const existing = users.find((user) => user.email === seed.email);

      if (existing) {
        continue;
      }

      if (!shouldSeedMissingUsers) {
        continue;
      }

      let passwordPatch: Pick<StoredUser, 'passwordHash' | 'passwordSalt' | 'passwordIterations' | 'passwordVersion'>;

      passwordPatch = await createPasswordRecord(
        seed.password,
        this.config.authPasswordAlgorithm,
        this.config.authPasswordIterations
      );

      const seededUser: StoredUser = {
        id: seed.id,
        email: seed.email,
        ...passwordPatch,
        firstName: seed.firstName,
        lastName: seed.lastName,
        phone: seed.phone,
        age: seed.age,
        role: seed.role,
        registrationDate: now,
        isAccountLocked: false,
        failedLoginAttempts: 0,
        emailVerified: true,
        lastLoginAt: undefined,
        accountLockedAt: undefined,
        updatedAt: now,
        avatar: undefined,
        createdAt: now
      };

      await this.putUser(seededUser);
    }
  }

  private async getAllUsers(): Promise<StoredUser[]> {
    if (typeof indexedDB === 'undefined') {
      return this.readUsersCache();
    }

    try {
      const db = await this.openDb();
      return await this.runTransaction<StoredUser[]>(db, this.config.authUsersStore, 'readonly', (store, done, fail) => {
        const request = store.getAll();
        request.onsuccess = () => {
          const result = ((request.result as unknown[]) ?? [])
            .map((item) => normalizeStoredUser(item, this.config.authPasswordAlgorithm, this.config))
            .filter((item): item is StoredUser => item !== null);
          done(result);
        };
        request.onerror = () => fail(request.error);
      });
    } catch {
      return this.readUsersCache();
    }
  }

  private async putUser(user: StoredUser): Promise<void> {
    const users = this.readUsersCache();
    const index = users.findIndex((item) => item.id === user.id);
    const nextUsers = index >= 0
      ? [...users.slice(0, index), user, ...users.slice(index + 1)]
      : [...users, user];

    this.writeUsersCache(nextUsers);

    if (typeof indexedDB === 'undefined') {
      return;
    }

    try {
      const db = await this.openDb();
      await this.runTransaction<void>(db, this.config.authUsersStore, 'readwrite', (store, done, fail) => {
        const request = store.put(user);
        request.onsuccess = () => done(undefined);
        request.onerror = () => fail(request.error);
      });
    } catch {
      return;
    }
  }

  private async deleteUser(userId: number): Promise<void> {
    const users = this.readUsersCache().filter((user) => user.id !== userId);
    this.writeUsersCache(users);

    if (typeof indexedDB === 'undefined') {
      return;
    }

    try {
      const db = await this.openDb();
      await this.runTransaction<void>(db, this.config.authUsersStore, 'readwrite', (store, done, fail) => {
        const request = store.delete(userId);
        request.onsuccess = () => done(undefined);
        request.onerror = () => fail(request.error);
      });
    } catch {
      return;
    }
  }

  private async saveSession(user: AuthUser, persist = true): Promise<void> {
    this.userState.set(user);

    if (!persist) {
      this.writeSessionCache(null);
      await this.deleteSessionFromIndexedDb();
      return;
    }

    this.writeSessionCache(user);

    if (typeof indexedDB === 'undefined') {
      return;
    }

    try {
      const db = await this.openDb();
      await this.runTransaction<void>(db, this.config.authSessionStore, 'readwrite', (store, done, fail) => {
        const request = store.put(user, this.config.authSessionKey);
        request.onsuccess = () => done(undefined);
        request.onerror = () => fail(request.error);
      });
    } catch {
      return;
    }
  }

  private async deleteSessionFromIndexedDb(): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      return;
    }

    try {
      const db = await this.openDb();
      await this.runTransaction<void>(db, this.config.authSessionStore, 'readwrite', (store, done, fail) => {
        const request = store.delete(this.config.authSessionKey);
        request.onsuccess = () => done(undefined);
        request.onerror = () => fail(request.error);
      });
    } catch {
      return;
    }
  }

  private readSessionCache(): AuthUser | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    try {
      const raw = localStorage.getItem(this.config.authSessionCacheKey);
      if (!raw) {
        return null;
      }

      const value = JSON.parse(raw);
      return normalizeAuthUser(value, this.config);
    } catch {
      return null;
    }
  }

  private readUsersCache(): StoredUser[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const raw = localStorage.getItem(this.config.authUsersCacheKey);
      if (!raw) {
        return [];
      }

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .map((item) => normalizeStoredUser(item, this.config.authPasswordAlgorithm, this.config))
        .filter((item): item is StoredUser => item !== null);
    } catch {
      return [];
    }
  }

  private writeUsersCache(users: StoredUser[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(this.config.authUsersCacheKey, JSON.stringify(users));
    } catch {
      return;
    }
  }

  private writeSessionCache(user: AuthUser | null): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    if (!user) {
      localStorage.removeItem(this.config.authSessionCacheKey);
      return;
    }

    localStorage.setItem(this.config.authSessionCacheKey, JSON.stringify(user));
  }

  private openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.authDbName, this.config.authDbVersion);

      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(this.config.authUsersStore)) {
          db.createObjectStore(this.config.authUsersStore, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(this.config.authSessionStore)) {
          db.createObjectStore(this.config.authSessionStore);
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB.'));
    });
  }

  private runTransaction<T>(
    db: IDBDatabase,
    storeName: string,
    mode: IDBTransactionMode,
    task: (store: IDBObjectStore, done: (value: T) => void, fail: (reason?: unknown) => void) => void
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);

      task(store, resolve, reject);

      transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
    });
  }
}

function normalizeStoredUser(
  value: unknown,
  passwordAlgorithm: StoredUser['passwordVersion'],
  config: ConfigurationService
): StoredUser | null {
  if (!isObject(value)) {
    return null;
  }

  const id = Number(value['id']);
  const email = String(value['email'] ?? '').trim().toLowerCase();
  const passwordHash = String(value['passwordHash'] ?? '').trim();
  const passwordSalt = normalizeOptional(value['passwordSalt']);
  const passwordIterationsRaw = Number(value['passwordIterations']);
  const passwordIterations = Number.isFinite(passwordIterationsRaw) && passwordIterationsRaw > 0
    ? passwordIterationsRaw
    : undefined;
  const passwordVersionRaw = String(value['passwordVersion'] ?? '').trim().toLowerCase();
  const passwordVersion: StoredUser['passwordVersion'] = passwordVersionRaw === passwordAlgorithm
    ? passwordAlgorithm
    : passwordVersionRaw === 'legacy'
      ? 'legacy'
      : undefined;
  const firstName = String(value['firstName'] ?? '').trim() || config.authDefaultFirstName;
  const lastName = String(value['lastName'] ?? '').trim() || config.authDefaultLastName;
  const phone = String(value['phone'] ?? '').trim() || config.authDefaultPhone;
  const age = Number(value['age']);
  const role = normalizeUserRole(value['role'], config.authDefaultRole, config.authAllowedRoles);
  const registrationDate = normalizeDate(value['registrationDate']);
  const isAccountLocked = Boolean(value['isAccountLocked']);
  const failedLoginAttemptsRaw = Number(value['failedLoginAttempts']);
  const failedLoginAttempts = Number.isFinite(failedLoginAttemptsRaw) && failedLoginAttemptsRaw >= 0
    ? failedLoginAttemptsRaw
    : 0;
  const emailVerified = Boolean(value['emailVerified']);
  const lastLoginAt = normalizeOptionalDate(value['lastLoginAt']);
  const accountLockedAt = normalizeOptionalDate(value['accountLockedAt']);
  const updatedAt = normalizeOptionalDate(value['updatedAt']);
  const avatar = normalizeOptional(value['avatar']);
  const createdAt = normalizeDate(value['createdAt']);

  if (!Number.isFinite(id) || id <= 0 || !isValidEmail(email) || !passwordHash) {
    return null;
  }

  return {
    id,
    email,
    passwordHash,
    passwordSalt,
    passwordIterations,
    passwordVersion,
    firstName,
    lastName,
    phone,
    age: Number.isFinite(age) && age > 0 ? age : config.authDefaultAge,
    role,
    registrationDate,
    isAccountLocked,
    failedLoginAttempts,
    emailVerified,
    lastLoginAt,
    accountLockedAt,
    updatedAt,
    avatar,
    createdAt
  };
}

function normalizeAuthUser(value: unknown, config: ConfigurationService): AuthUser | null {
  if (!isObject(value)) {
    return null;
  }

  const id = Number(value['id']);
  const email = String(value['email'] ?? '').trim().toLowerCase();
  const firstName = String(value['firstName'] ?? '').trim() || config.authDefaultFirstName;
  const lastName = String(value['lastName'] ?? '').trim() || config.authDefaultLastName;
  const phone = String(value['phone'] ?? '').trim() || config.authDefaultPhone;
  const age = Number(value['age']);
  const role = normalizeUserRole(value['role'], config.authDefaultRole, config.authAllowedRoles);
  const registrationDate = normalizeDate(value['registrationDate']);
  const isAccountLocked = Boolean(value['isAccountLocked']);
  const emailVerified = Boolean(value['emailVerified']);
  const lastLoginAt = normalizeOptionalDate(value['lastLoginAt']);
  const avatar = normalizeOptional(value['avatar']);
  const createdAt = normalizeDate(value['createdAt']);

  if (!Number.isFinite(id) || id <= 0 || !isValidEmail(email)) {
    return null;
  }

  return {
    id,
    email,
    firstName,
    lastName,
    phone,
    age: Number.isFinite(age) && age > 0 ? age : config.authDefaultAge,
    role,
    registrationDate,
    isAccountLocked,
    emailVerified,
    lastLoginAt,
    avatar,
    createdAt
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string, pattern: RegExp, maxLength: number): boolean {
  const normalized = value.trim();
  return pattern.test(normalized) && normalized.length <= maxLength;
}

function toHash(value: string): string {
  return btoa(unescape(encodeURIComponent(value)));
}

async function createPasswordRecord(
  password: string,
  passwordAlgorithm: StoredUser['passwordVersion'],
  passwordIterations: number
): Promise<Pick<StoredUser, 'passwordHash' | 'passwordSalt' | 'passwordIterations' | 'passwordVersion'>> {
  const saltBytes = randomBytes(16);
  const derived = await derivePasswordHash(password, saltBytes, passwordIterations);

  return {
    passwordHash: bytesToBase64(derived),
    passwordSalt: bytesToBase64(saltBytes),
    passwordIterations,
    passwordVersion: passwordAlgorithm
  };
}

async function verifyPassword(
  user: StoredUser,
  password: string,
  passwordAlgorithm: StoredUser['passwordVersion'],
  passwordIterations: number
): Promise<{ valid: boolean; upgradedUser?: StoredUser }> {
  if (isPbkdf2User(user, passwordAlgorithm)) {
    const saltBytes = base64ToBytes(user.passwordSalt);
    if (!saltBytes) {
      return { valid: false };
    }

    const derived = await derivePasswordHash(password, saltBytes, user.passwordIterations);
    const valid = bytesToBase64(derived) === user.passwordHash;
    return { valid };
  }

  const validLegacy = user.passwordHash === toHash(password);
  if (!validLegacy) {
    return { valid: false };
  }

  const nextPassword = await createPasswordRecord(password, passwordAlgorithm, passwordIterations);
  return {
    valid: true,
    upgradedUser: {
      ...user,
      ...nextPassword
    }
  };
}

function isPbkdf2User(
  user: StoredUser,
  passwordAlgorithm: StoredUser['passwordVersion']
): user is StoredUser & {
  passwordSalt: string;
  passwordIterations: number;
  passwordVersion: 'pbkdf2-sha256';
} {
  return user.passwordVersion === passwordAlgorithm
    && typeof user.passwordSalt === 'string'
    && user.passwordSalt.trim().length > 0
    && Number.isFinite(user.passwordIterations)
    && (user.passwordIterations ?? 0) > 0;
}

async function derivePasswordHash(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  if (!globalThis.crypto?.subtle) {
    return fallbackDerivePasswordHash(password, salt, iterations);
  }

  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  return new Uint8Array(derivedBits);
}

function fallbackDerivePasswordHash(password: string, salt: Uint8Array, iterations: number): Uint8Array {
  const saltEncoded = bytesToBase64(salt);
  const fallbackHash = toHash(`${password}:${saltEncoded}:${iterations}`);
  return new TextEncoder().encode(fallbackHash);
}

function randomBytes(length: number): Uint8Array {
  if (!globalThis.crypto?.getRandomValues) {
    throw new Error('Web Crypto API is not available.');
  }

  const array = new Uint8Array(length);
  globalThis.crypto.getRandomValues(array);
  return array;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function base64ToBytes(value: string | undefined): Uint8Array | null {
  if (!value) {
    return null;
  }

  try {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return bytes;
  } catch {
    return null;
  }
}

function toAuthUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    age: user.age,
    role: user.role,
    registrationDate: user.registrationDate,
    isAccountLocked: user.isAccountLocked,
    emailVerified: user.emailVerified,
    lastLoginAt: user.lastLoginAt,
    avatar: user.avatar,
    createdAt: user.createdAt
  };
}

function normalizeDate(value: unknown): string {
  const raw = String(value ?? '').trim();
  const date = raw ? new Date(raw) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

function normalizeOptional(value: unknown): string | undefined {
  const normalized = String(value ?? '').trim();
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeOptionalDate(value: unknown): string | undefined {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return undefined;
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function normalizeUserRole(value: unknown, fallback: StoredUser['role'], allowed: readonly StoredUser['role'][]): StoredUser['role'] {
  const role = String(value ?? '').trim().toLowerCase();
  return allowed.includes(role as StoredUser['role'])
    ? role as StoredUser['role']
    : fallback;
}
