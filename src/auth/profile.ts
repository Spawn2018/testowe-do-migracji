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
 * przeładowań): `'done'` — przeładowanie skończone, `'timeout'` — brak końca w `AUTH_RELOAD_MAX_MS`
 * (bez słuchacza: demo, testy — albo bardzo wolna sieć). Nigdy nie odrzuca. */
export const AUTH_RELOAD_MAX_MS = 20_000;
/** F7 #383 r4: górny limit czekania na faktyczny koniec (zawieszone zapytanie nie blokuje przełącznika na zawsze). */
export const AUTH_RELOAD_HARD_MS = 90_000;
export type AuthReloadResult = 'done' | 'timeout';
export type AuthReloadDetail = { done: () => void; heard?: boolean };
export function requestAuthReload(): Promise<AuthReloadResult> {
  return requestAuthReloadTracked().first;
}

/** F7 #383 r3: `first` — koniec albo limit czasu; `finished` — faktyczny koniec przeładowania (bez limitu,
 * spełnia się od razu, gdy nikt nie słucha zdarzenia — demo, testy). */
export function requestAuthReloadTracked(): { first: Promise<AuthReloadResult>; finished: Promise<void> } {
  if (typeof window === 'undefined') return { first: Promise.resolve('done'), finished: Promise.resolve() };
  let markFinished: () => void = () => {};
  const finished = new Promise<void>((r) => {
    const hard = setTimeout(r, AUTH_RELOAD_HARD_MS);
    markFinished = () => { clearTimeout(hard); r(); };
  });
  const first = new Promise<AuthReloadResult>((resolve) => {
    let fin = false;
    const timer = setTimeout(() => { if (!fin) { fin = true; resolve('timeout'); } }, AUTH_RELOAD_MAX_MS);
    const done = () => {
      markFinished();
      if (!fin) { fin = true; clearTimeout(timer); resolve('done'); }
    };
    const detail: AuthReloadDetail = { done };
    window.dispatchEvent(new CustomEvent<AuthReloadDetail>(AUTH_RELOAD_EVENT, { detail }));
    /* słuchacz (AuthGate) oznacza `heard` synchronicznie; bez słuchacza nie ma na co czekać */
    if (!detail.heard) markFinished();
  });
  return { first, finished };
}
