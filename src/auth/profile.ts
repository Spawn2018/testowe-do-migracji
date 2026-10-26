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
  /** B5 (0300): `impersonation_state.read_only` — Podgląd w bazie (tylko odczyt); false = „Działaj jako”. */
  preview_ro?: boolean;
  /** B5 (0300, F7 #382): to samo pole zwracane wprost przez `my_profile` (gdy baza je ma). */
  preview_read_only?: boolean | null;
  /** wyglad/P3 (E37): „ostatnie logowanie” w menu konta — pole wypełnia logika profilu (gdy jest). */
  last_sign_in_at?: string | null;
}

let current: AuthProfile | null = null;
/** Profil zalogowanego (null w trybie demo lub przed logowaniem). */
export const getAuthProfile = (): AuthProfile | null => current;
export const setAuthProfile = (p: AuthProfile | null): void => { current = p; };

/** ADM-10: po start/stop impersonacji — AuthGate przeładowuje profil + dane. */
export const AUTH_RELOAD_EVENT = 'wt-auth-reload';
/** Zwraca obietnicę spełnioną po zakończeniu przeładowania (F7 #383: Podgląd czeka na koniec, bez wyścigu dwóch
 * przeładowań). Bez słuchacza (demo, testy) — spełnia się po `AUTH_RELOAD_MAX_MS`. */
export const AUTH_RELOAD_MAX_MS = 20_000;
export type AuthReloadDetail = { done: () => void };
export function requestAuthReload(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  return new Promise<void>((resolve) => {
    let fin = false;
    const done = () => { if (!fin) { fin = true; resolve(); } };
    window.dispatchEvent(new CustomEvent<AuthReloadDetail>(AUTH_RELOAD_EVENT, { detail: { done } }));
    setTimeout(done, AUTH_RELOAD_MAX_MS);
  });
}
