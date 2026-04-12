export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  lastName: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  tokenType: string;
}

export interface UserInfoResponse {
  email: string;
  role: string;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  nombre?: string | null;
  apellidos?: string | null;
  telefono?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
}

export type AuthSessionStatus = 'anonymous' | 'authenticated';
