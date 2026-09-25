import type { UserRole } from './config';

export interface AuthProfile {
  user_id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  org_code: string;
  org_name: string;
  locale: string;
  active: boolean;
}

let current: AuthProfile | null = null;
/** Profil zalogowanego (null w trybie demo lub przed logowaniem). */
export const getAuthProfile = (): AuthProfile | null => current;
export const setAuthProfile = (p: AuthProfile | null): void => { current = p; };
