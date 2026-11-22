export interface User {
  id: string;
  name: string;
  role: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  user: User;
}

export type UserRole = 'analyst' | 'supervisor' | 'admin';

export interface UserListItem {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  /** Dependencia policial a la que está adscrito (RF-12). */
  dependency: string | null;
  lastAccessAt: string | null;
}
