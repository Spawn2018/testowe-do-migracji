/**
 * wyglad/2fa — „Moje konto” › 2FA: urządzenia, „Dodaj drugie urządzenie”, „Usuń”; „Przełączniki” › wymaganie 2FA
 * dla administratorów; Podgląd — nieaktywne (D-20261014-1420-01 „Koordynator”; E12, E19; W38). Tylko po polsku (E43).
 */
const pl = {
  m2_devices: 'Urządzenia z kodem 2FA',
  m2_since: 'od {d}',
  m2_remove: 'Usuń',
  m2_add_second: 'Dodaj drugie urządzenie',
  m2_second_hint: 'Drugie urządzenie — gdy zgubisz telefon, zalogujesz się kodem z drugiego.',
  m2_remove_last: 'Ostatniego urządzenia nie usuniesz — 2FA przestałoby działać.',
  m2_needs_code: 'Dodawanie i usuwanie urządzeń — po zalogowaniu kodem z aplikacji.',
  m2_preview: 'Podgląd — nic tu nie zapiszesz.',
  m2_q_remove: 'Usunąć urządzenie „{name}”?',
  m2_q_remove_fx: 'Kody z tego urządzenia przestaną działać przy logowaniu.',
  m2_cancel: 'Anuluj',
  m2_flag_blocked_two: 'Włączysz, gdy Twoje konto ma 2FA na dwóch urządzeniach — inaczej po utracie telefonu nikt z Administratorów nie wejdzie.',
  m2_flag_blocked_code: 'Włączysz po zalogowaniu kodem 2FA.',
} as const;

export type M2Key = keyof typeof pl;
export function m2(key: M2Key, vars?: Record<string, string | number>): string {
  let s: string = pl[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
export const M2_PL = pl;
