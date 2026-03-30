export type UserRole = 'admin' | 'user';
export type UserStatus = 'active' | 'inactive' | 'pending';

export interface User {
  id?: number | null;
  email: string;
  nombre?: string | null;
  apellidos?: string | null;
  rol: UserRole;
  estado?: UserStatus;
  telefono?: string | null;
  avatarUrl?: string | null;
  metadata?: Record<string, string | number | boolean | null>;
}
