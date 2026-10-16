/**
 * wyglad/P10b-a — teksty E37 pkt 4 (komunikat HHL z „Zamknij”) i pkt 7 (logowanie: „Nie pamiętam hasła”,
 * „Link wygasł”). Tabela „Komunikaty — dziś i po zmianie” z `makiety_html/E37/pasek.html`. Interfejs po polsku (E43).
 */
import type { Locale } from '../types';
import { t } from './messages';

const PL: Record<string, string> = {
  p10b_bcast_close: 'Zamknij',
  p10b_bcast_close_aria: 'Zamknij komunikat HHL',
  p10b_reset_sent: 'Jeśli adres ma konto, wysłaliśmy link. Działa na każdym urządzeniu przez {ttl}.',
  p10b_expired_title: 'Link wygasł',
  p10b_expired_invite: 'Link w e-mailu działa {ttl}. Twoje zaproszenie jest ważne do {date}.',
  p10b_expired_recovery: 'Link w e-mailu działa {ttl}.',
  p10b_expired_invite_gone: 'Twoje zaproszenie też wygasło. Poproś Operacje HHL o nowe.',
  p10b_expired_general: 'Poproś o nowy link: wpisz swój adres w „Nie pamiętam hasła”.',
  p10b_expired_resend: 'Wyślij nowy link na {email}',
  p10b_expired_sending: 'Wysyłam…',
  p10b_expired_sent: 'Wysłaliśmy nowy link na {email}.',
  p10b_expired_send_fail: 'Nie udało się wysłać e-maila. Spróbuj za kilka minut.',
  p10b_expired_note: 'Nowy link przychodzi w ciągu minuty. Problem? Zadzwoń do Operacji HHL.',
  p10b_expired_forgot: 'Nie pamiętam hasła',
  p10b_expired_login: 'Wróć do logowania',
};

export function p10b(locale: Locale, key: string): string {
  return PL[key] ?? t(locale, key);
}

export function p10bp(locale: Locale, key: string, params: Record<string, string | number>): string {
  let s = p10b(locale, key);
  for (const [k, v] of Object.entries(params)) s = s.split(`{${k}}`).join(String(v));
  return s;
}
