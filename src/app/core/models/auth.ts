export interface StoredUser {
  id: number;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  phone: string;
  age: number;
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
  avatar?: string;
}

export interface UpdateProfilePayload {
  firstName: string;
  lastName: string;
  phone: string;
  age: number;
  avatar?: string;
}

export interface AuthResult {
  success: boolean;
  error?: string;
}
