/**
 * ANEKS 5 §4 — sesja użytkownika 365 dni (plan darmowy: zadanie pg_cron usuwa sesje > 365 dni).
 * Czyste funkcje: czas logowania z tokenu (claim amr), powód zakończenia sesji i komunikat PL/EN/SV.
 * JWT zostaje 3600 s — rok żyje w sesji serwera, którą da się usunąć.
 */
import type { Locale } from '../types';
import { dictEntry } from '../i18n/messages';

export const SESSION_DAYS = 365;
export const LOGIN_AT_KEY = 'wt-login-at';
export const MANUAL_LOGOUT_KEY = 'wt-logout-manual';
const DAY_MS = 86_400_000;

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const store = (): KV | null => (typeof localStorage === 'undefined' ? null : localStorage);

/** Czas uwierzytelnienia (ms) z tokenu dostępu Supabase: najwcześniejszy `amr[].timestamp`. */
export function loginAtFromJwt(token: string | null | undefined): number | null {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/'))) as { amr?: { timestamp?: number }[] };
    const ts = (json.amr ?? []).map((a) => a.timestamp).filter((t): t is number => typeof t === 'number');
    return ts.length ? Math.min(...ts) * 1000 : null;
  } catch {
    return null;
  }
}

export function rememberLogin(token: string | null | undefined, s: KV | null = store()): void {
  const at = loginAtFromJwt(token);
  if (at) s?.setItem(LOGIN_AT_KEY, String(at));
  s?.removeItem(MANUAL_LOGOUT_KEY);
}

export function markManualLogout(s: KV | null = store()): void {
  s?.setItem(MANUAL_LOGOUT_KEY, '1');
}

export type SessionEnd = 'YEAR' | 'REVOKED' | null;
/** Powód wylogowania bez udziału użytkownika (wywołać przy SIGNED_OUT); czyści zapisane znaczniki. */
export function sessionEndReason(now: number, s: KV | null = store()): SessionEnd {
  const manual = s?.getItem(MANUAL_LOGOUT_KEY) === '1';
  const at = Number(s?.getItem(LOGIN_AT_KEY) ?? '');
  s?.removeItem(MANUAL_LOGOUT_KEY);
  s?.removeItem(LOGIN_AT_KEY);
  if (manual || !Number.isFinite(at) || at <= 0) return null;
  return now - at >= (SESSION_DAYS - 1) * DAY_MS ? 'YEAR' : 'REVOKED';
}

export const SESSION_END_MSG: Record<'YEAR' | 'REVOKED', Record<Locale, string>> = {
  YEAR: dictEntry('a6_session_end_msg_year'),
  REVOKED: dictEntry('a6_session_end_msg_revoked'),
};

/** Przeglądarka i system z nagłówka User-Agent — do listy „Moje urządzenia”. */
export function deviceLabel(ua: string | null | undefined): string {
  const u = ua ?? '';
  const browser = /Edg\//.test(u) ? 'Edge' : /OPR\//.test(u) ? 'Opera' : /Firefox\//.test(u) ? 'Firefox'
    : /Chrome\//.test(u) ? 'Chrome' : /Safari\//.test(u) ? 'Safari' : 'Przeglądarka';
  const os = /iPhone|iPad/.test(u) ? 'iOS' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'Windows'
    : /Mac OS X/.test(u) ? 'macOS' : /Linux/.test(u) ? 'Linux' : '';
  return os ? `${browser} · ${os}` : browser;
}
