export type UserRole = 'client' | 'master' | 'admin';

export interface SessionUser {
  id: number;
  role: UserRole;
}