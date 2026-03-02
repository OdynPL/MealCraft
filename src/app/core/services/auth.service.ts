import { Injectable, computed, inject, signal } from '@angular/core';

import { AuthResult, AuthUser, RegisterPayload, StoredUser, UpdateProfilePayload } from '../models/auth';
import { ConfigurationService } from './configuration.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly config = inject(ConfigurationService);
  private readonly userState = signal<AuthUser | null>(this.readSessionCache());

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
    void this.hydrateSessionFromIndexedDb();
  }

  async register(payload: RegisterPayload): Promise<AuthResult> {
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
      passwordHash: toHash(payload.password),
      firstName: payload.firstName.trim(),
      lastName: payload.lastName.trim(),
      phone: payload.phone.trim(),
      age: payload.age,
      avatar: normalizeOptional(payload.avatar),
      createdAt: new Date().toISOString()
    };

    await this.putUser(storedUser);
    await this.saveSession(toAuthUser(storedUser));

    return { success: true };
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = email.trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      return { success: false, error: 'Invalid email address.' };
    }

    const users = await this.getAllUsers();
    const user = users.find((item) => item.email === normalizedEmail);

    if (!user || user.passwordHash !== toHash(password)) {
      return { success: false, error: 'Invalid email or password.' };
    }

    await this.saveSession(toAuthUser(user));
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
      avatar: normalizeOptional(payload.avatar)
    };

    await this.putUser(updatedUser);
    await this.saveSession(toAuthUser(updatedUser));
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

    if (users[index].passwordHash !== toHash(currentPassword)) {
      return { success: false, error: 'Current password is incorrect.' };
    }

    users[index] = {
      ...users[index],
      passwordHash: toHash(newPassword)
    };

    await this.putUser(users[index]);
    return { success: true };
  }

  async logout(): Promise<void> {
    this.userState.set(null);
    this.writeSessionCache(null);

    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = await this.openDb();
    await this.runTransaction<void>(db, this.config.authSessionStore, 'readwrite', (store, done, fail) => {
      const request = store.delete(this.config.authSessionKey);
      request.onsuccess = () => done(undefined);
      request.onerror = () => fail(request.error);
    });
  }

  private validateProfileData(firstName: string, lastName: string, phone: string, age: number): string | null {
    if (firstName.trim().length < 2) {
      return 'First name must have at least 2 characters.';
    }

    if (lastName.trim().length < 2) {
      return 'Last name must have at least 2 characters.';
    }

    if (!isValidPhone(phone, this.config.authMaxPhoneLength)) {
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
        request.onsuccess = () => done(normalizeAuthUser(request.result));
        request.onerror = () => fail(request.error);
      });

      this.userState.set(user);
      this.writeSessionCache(user);
    } catch {
      // keep cache fallback
    }
  }

  private async getAllUsers(): Promise<StoredUser[]> {
    if (typeof indexedDB === 'undefined') {
      return [];
    }

    const db = await this.openDb();
    return this.runTransaction<StoredUser[]>(db, this.config.authUsersStore, 'readonly', (store, done, fail) => {
      const request = store.getAll();
      request.onsuccess = () => {
        const result = ((request.result as unknown[]) ?? [])
          .map((item) => normalizeStoredUser(item))
          .filter((item): item is StoredUser => item !== null);
        done(result);
      };
      request.onerror = () => fail(request.error);
    });
  }

  private async putUser(user: StoredUser): Promise<void> {
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB is not available.');
    }

    const db = await this.openDb();
    await this.runTransaction<void>(db, this.config.authUsersStore, 'readwrite', (store, done, fail) => {
      const request = store.put(user);
      request.onsuccess = () => done(undefined);
      request.onerror = () => fail(request.error);
    });
  }

  private async saveSession(user: AuthUser): Promise<void> {
    this.userState.set(user);
    this.writeSessionCache(user);

    if (typeof indexedDB === 'undefined') {
      return;
    }

    const db = await this.openDb();
    await this.runTransaction<void>(db, this.config.authSessionStore, 'readwrite', (store, done, fail) => {
      const request = store.put(user, this.config.authSessionKey);
      request.onsuccess = () => done(undefined);
      request.onerror = () => fail(request.error);
    });
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
      return normalizeAuthUser(value);
    } catch {
      return null;
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

function normalizeStoredUser(value: unknown): StoredUser | null {
  if (!isObject(value)) {
    return null;
  }

  const id = Number(value['id']);
  const email = String(value['email'] ?? '').trim().toLowerCase();
  const passwordHash = String(value['passwordHash'] ?? '').trim();
  const firstName = String(value['firstName'] ?? '').trim() || 'User';
  const lastName = String(value['lastName'] ?? '').trim() || '';
  const phone = String(value['phone'] ?? '').trim() || '000000000';
  const age = Number(value['age']);
  const avatar = normalizeOptional(value['avatar']);
  const createdAt = normalizeDate(value['createdAt']);

  if (!Number.isFinite(id) || id <= 0 || !isValidEmail(email) || !passwordHash) {
    return null;
  }

  return {
    id,
    email,
    passwordHash,
    firstName,
    lastName,
    phone,
    age: Number.isFinite(age) && age > 0 ? age : 18,
    avatar,
    createdAt
  };
}

function normalizeAuthUser(value: unknown): AuthUser | null {
  const stored = normalizeStoredUser(value);
  if (!stored) {
    return null;
  }

  return toAuthUser(stored);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string, maxLength: number): boolean {
  const normalized = value.trim();
  return /^[+]?[-0-9\s()]{6,}$/.test(normalized) && normalized.length <= maxLength;
}

function toHash(value: string): string {
  return btoa(unescape(encodeURIComponent(value)));
}

function toAuthUser(user: StoredUser): AuthUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    age: user.age,
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
