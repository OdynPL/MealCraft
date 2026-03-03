export type UserRole = 'user' | 'admin';

export interface StoredUser {
  id: number;
  email: string;
  passwordHash: string;
  passwordSalt?: string;
  passwordIterations?: number;
  passwordVersion?: 'legacy' | 'pbkdf2-sha256';
  firstName: string;
  lastName: string;
  phone: string;
  age: number;
  role: UserRole;
  registrationDate: string;
  isAccountLocked: boolean;
  failedLoginAttempts: number;
  emailVerified: boolean;
  lastLoginAt?: string;
  accountLockedAt?: string;
  updatedAt?: string;
  avatar?: string;
  createdAt: string;
}

export interface AuthUser {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  age: number;
  role: UserRole;
  registrationDate: string;
  isAccountLocked: boolean;
  emailVerified: boolean;
  lastLoginAt?: string;
  avatar?: string;
  createdAt: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  age: number;
  role: UserRole;
  avatar?: string;
}

export interface UpdateProfilePayload {
  firstName: string;
  lastName: string;
  phone: string;
  age: number;
  avatar?: string;
}

export interface AdminUserUpdatePayload {
  firstName: string;
  lastName: string;
  phone: string;
  age: number;
  role: UserRole;
  emailVerified: boolean;
}

export interface AuthResult {
  success: boolean;
  error?: string;
}
