/**
 * wyglad/P10b-d — pierwsze wejście (E37 pkt 9): 4 ekrany po zaproszeniu — 1 Zaproszenie, 2 Hasło, 3 Twoje dane
 * (telefon wymagany), 4 Powiadomienia i telefon; potem Kokpit z „Jak pracuję” otwartym raz. Krok 4 można pominąć.
 * Konta bez telefonu dostają krok 3 przy następnym logowaniu. Tu tylko obliczenia widoku — bez zapisów.
 */
import type { MatrixGroup } from '../components/options/channels';
import type { AccountKind } from './cockpitE9';
import { toE164, toNationalPhone, type PhoneCountry } from './phoneNational';

export type FirstStep = 'invite' | 'password' | 'details' | 'notify';

/** Pełna ścieżka po zaproszeniu (E37 pkt 9). */
export const INVITE_STEPS: readonly FirstStep[] = ['invite', 'password', 'details', 'notify'];

/** Numer kroku w ścieżce zaproszenia („1 z 4”) — `null` poza nią (np. sam krok 3 przy logowaniu bez telefonu). */
export function stepNumber(step: FirstStep, steps: readonly FirstStep[]): { n: number; total: number } | null {
  if (steps.length < 2) return null;
  const i = steps.indexOf(step);
  return i < 0 ? null : { n: i + 1, total: steps.length };
}

/** Długość hasła z oceną wobec minimum (makieta: „14 znaków — dobrze (min. 12)”). */
export function pwCheck(pw: string, min: number): { len: number; ok: boolean } {
  const len = [...pw].length;
  return { len, ok: len >= min };
}

export type Platform = 'ios' | 'android' | 'desktop';

/** iPhone / iPad (także iPad z „Macintosh” i dotykiem), Android, reszta — komputer. */
export function platformOf(ua: string, maxTouchPoints = 0): Platform {
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

const lowerFirst = (s: string) => (s.length > 1 && s[1] === s[1].toLocaleUpperCase('pl') && /\p{L}/u.test(s[1]) ? s : s.charAt(0).toLocaleLowerCase('pl') + s.slice(1));

/**
 * „Dostajesz: …” (E37 pkt 9 krok 4, według „Dla mnie” — E11): rodzaje, które trafiają do konta tego rodzaju
 * dowolnym kanałem; najpierw te, które przychodzą na telefon. Bez „Sytuacji ogólnej” (tylko strona Ryzyka).
 */
export function receivesSummary(groups: readonly MatrixGroup[], kind: AccountKind, max = 3): { titles: string[]; more: number; push: number } {
  const rows = groups.flatMap((g) => g.rows).filter((r) => {
    const c = r.cells[kind];
    return !r.risksOnly && !!c && (c.bell || c.push || c.mail);
  });
  const push = rows.filter((r) => r.cells[kind]!.push);
  const ordered = [...push, ...rows.filter((r) => !r.cells[kind]!.push)];
  return { titles: ordered.slice(0, max).map((r) => lowerFirst(r.title)), more: Math.max(0, ordered.length - max), push: push.length };
}

/** Telefon z kroku 3: kierunkowy + numer krajowy → E.164 (`null` = numer niepoprawny). */
export function phoneE164(country: PhoneCountry, national: string): string | null {
  const d = national.replace(/\D/g, '');
  if (!/^0?\d{7,11}$/.test(d)) return null;
  return toE164(d, country);
}

/** Pola kroku 3 z telefonu zapisanego w koncie (E.164) — kierunkowy i numer krajowy. */
export function phoneParts(e164: string | null | undefined): { country: PhoneCountry; national: string } {
  if (!e164) return { country: 'PL', national: '' };
  const p = toNationalPhone(e164, 'PL');
  return { country: p.country === 'SE' ? 'SE' : 'PL', national: p.national };
}

/** „Imię Nazwisko” → imię i nazwisko (gdy konto ma tylko pełne imię i nazwisko). */
export function splitName(full: string | null | undefined): { first: string; last: string } {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: '', last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}
