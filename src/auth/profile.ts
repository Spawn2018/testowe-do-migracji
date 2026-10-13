import type { UserRole } from './config';

export interface AuthProfile {
  user_id: string;
  email: string;
  full_name: string | null;
  /** E6: imię / nazwisko osobno; full_name = „Imię Nazwisko”. */
  first_name?: string | null;
  last_name?: string | null;
  /** E6-4: telefon E.164. */
  phone?: string | null;
  role: UserRole;
  org_code: string;
  org_name: string;
  locale: string;
  active: boolean;
  /** AUTH-1: po zaproszeniu / magic linku — wymuś ustawienie hasła. */
  must_set_password?: boolean;
  /** ADM-10: prawdziwy administrator przy „Działaj jako”. */
  real_user_id?: string | null;
  real_email?: string | null;
  /** D-20261013-2255-01 G4: imię i nazwisko administratora w pasku „Działasz jako”. */
  real_full_name?: string | null;
  real_role?: UserRole | null;
  acting_as?: boolean;
  /** wyglad/P3 (E37): „ostatnie logowanie” w menu konta — pole wypełnia logika profilu (gdy jest). */
  last_sign_in_at?: string | null;
}

let current: AuthProfile | null = null;
/** Profil zalogowanego (null w trybie demo lub przed logowaniem). */
export const getAuthProfile = (): AuthProfile | null => current;
export const setAuthProfile = (p: AuthProfile | null): void => { current = p; };

/** ADM-10: po start/stop impersonacji — AuthGate przeładowuje profil + dane. */
export const AUTH_RELOAD_EVENT = 'wt-auth-reload';
export function requestAuthReload(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(AUTH_RELOAD_EVENT));
}
