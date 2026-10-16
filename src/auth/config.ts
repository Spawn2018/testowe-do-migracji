/**
 * BK2 — tryb uwierzytelniania.
 * Supabase Auth działa WYŁĄCZNIE gdy VITE_AUTH_MODE=supabase oraz podano
 * VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY. W każdym innym przypadku
 * aplikacja działa na DemoProvider bez ekranu logowania (baseline, testy).
 */
export type AuthMode = 'demo' | 'supabase';

export function authMode(env: Record<string, unknown>): AuthMode {
  const mode = String(env.VITE_AUTH_MODE ?? '').trim().toLowerCase();
  const url = String(env.VITE_SUPABASE_URL ?? '').trim();
  const key = String(env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  return mode === 'supabase' && url && key ? 'supabase' : 'demo';
}

/**
 * Wartości czytane TYLKO gdy build ma VITE_AUTH_MODE=supabase — w buildzie demo
 * warunek jest stały (false), więc URL/klucz nie trafiają do paczki.
 */
const BUILD_SUPABASE = import.meta.env.VITE_AUTH_MODE === 'supabase';
export const SUPABASE_URL: string = BUILD_SUPABASE ? (import.meta.env.VITE_SUPABASE_URL ?? '') : '';
export const SUPABASE_ANON_KEY: string = BUILD_SUPABASE ? (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '') : '';

/** Stała czasu budowania — w buildzie demo `false`, więc bundler usuwa kod Supabase. */
export const SUPABASE_AUTH_ENABLED: boolean = BUILD_SUPABASE && SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '';
export const isSupabaseAuth = (): boolean => SUPABASE_AUTH_ENABLED;

/** Role z migracji 0001 (enum user_role). */
export const USER_ROLES = [
  'HHL_ADMIN', 'HHL_OPS', 'CLIENT_ADMIN', 'CLIENT_USER',
  'CARRIER_DISPATCH', 'CARRIER_USER', 'SITE_VIEWER',
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABEL_PL: Record<UserRole, string> = {
  HHL_ADMIN: 'Administrator HHL',
  HHL_OPS: 'Operacje HHL',
  CLIENT_ADMIN: 'KSH — administrator',
  CLIENT_USER: 'KSH — podgląd',
  CARRIER_DISPATCH: 'SCX — dyspozytor',
  CARRIER_USER: 'SCX — użytkownik',
  SITE_VIEWER: 'Plac budowy — podgląd',
};

/**
 * Role do zaproszeń i zmiany w UI — 5 rodzajów kont (E9, E14).
 * CLIENT_ADMIN i SITE_VIEWER zostają w enumie bazy (USER_ROLES), ale nie w liście wyboru.
 */
export const ROLES_FOR_ORG: Record<string, UserRole[]> = {
  HHL: ['HHL_ADMIN', 'HHL_OPS'],
  KSH: ['CLIENT_USER'],
  SCX: ['CARRIER_DISPATCH', 'CARRIER_USER'],
};

/** Kod organizacji → rola widoku aplikacji (HHL/KSH/SCX). */
export function viewRoleForOrg(orgCode: string): 'HHL' | 'KSH' | 'SCX' | null {
  return orgCode === 'HHL' || orgCode === 'KSH' || orgCode === 'SCX' ? orgCode : null;
}

/** Komunikat błędu Supabase → polski tekst dla użytkownika. */
export function authErrorPl(message: string | undefined): string {
  const m = String(message ?? '');
  if (/TOWER_NO_INVITE|Database error saving new user|Signups not allowed/i.test(m)) {
    return 'Brak zaproszenia — skontaktuj się z HHL.';
  }
  if (/Invalid login credentials|invalid.*credentials|wrong password/i.test(m)) {
    return 'Nieprawidłowy e-mail lub hasło.';
  }
  if (/Email link is invalid or has expired|otp_expired|Token has expired|expired/i.test(m)) {
    return 'Link wygasł lub został już użyty. Poproś o nowy.';
  }
  if (/rate limit|too many|security purposes|over_request_rate/i.test(m)) {
    return 'Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.';
  }
  if (/Password should be|password.*weak|at least/i.test(m)) {
    return 'Hasło musi mieć co najmniej 12 znaków.';
  }
  if (/not authorized|Error sending|smtp/i.test(m)) {
    /* E37 „Komunikaty zdaniami”: bez nazw usług; szczegóły w Stanie systemu */
    return 'Nie udało się wysłać e-maila. Spróbuj za kilka minut.';
  }
  if (/invalid.*email|unable to validate email/i.test(m)) return 'Nieprawidłowy adres e-mail.';
  return m || 'Nieznany błąd logowania.';
}

/** AUTH-1: minimalna długość hasła. */
export const PASSWORD_MIN = 12;

export function passwordOk(pw: string): boolean {
  return pw.length >= PASSWORD_MIN;
}
