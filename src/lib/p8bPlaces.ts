/**
 * wyglad/P8-b — Opcje › Powiadomienia › SMS przy miejscach (E42, decyzje 07.10.2026, 22:15; img/e42-after).
 * Model widoku: 2 miejsca (Załadunek · KSH Śrem, Rozładunek · plac Stegra Boden), po 2 osoby, przy osobie rodzaje A–D
 * (B tylko Boden), stałe warunki (60 min, 30 min / 2 km, cisza 20:00–06:00), wysyłka do odbiorców albo tryb testowy.
 * Treść tylko po polsku (E43, 22:42) — bez wyboru języka; kraj przy numerze (PL / SE) to kierunkowy.
 * Czyste funkcje widoku — bez zapytań i zapisów.
 */
import type { Load } from '../types';
import { stageTileOf, trackingPhase } from './stageTiles';
import { toE164, type PhoneCountry } from './phoneNational';
import { groupPhone } from './phoneDisplay';

export type PlaceId = 'LOAD_SREM' | 'UNLOAD_BODEN';
export type SmsKind = 'A' | 'B' | 'C' | 'D';
export const SMS_KINDS: readonly SmsKind[] = ['A', 'B', 'C', 'D'];

export interface ZonePerson {
  /** konto z Użytkowników (E6) albo null, gdy numer wpisany ręcznie */
  userId: string | null;
  name: string;
  country: 'PL' | 'SE';
  /** numer krajowy bez kierunkowego */
  phone: string;
  kinds: SmsKind[];
}

export interface PlaceView {
  id: PlaceId;
  people: [ZonePerson | null, ZonePerson | null];
}

export interface SmsPlacesState {
  /** wysyłka do odbiorców (E42 „Włączenie”); false = tryb testowy — wszystko na numer z `testTo` */
  sending: boolean;
  /** numer testowy (G-14: numer właściciela z `sms_test_numbers`), pełny (decyzja 15.10, 03:12) */
  testTo: string | null;
  places: [PlaceView, PlaceView];
  /** bramka SMS (Stan systemu); null — brak danych */
  gateway: { active: boolean; lastSignal: string | null; today: number; limit: number } | null;
}

/** konto z Użytkowników; `phone` null — konto bez telefonu (nie do wyboru) */
export interface ZoneUser { id: string; name: string; phone: string | null }

/** Stałe warunki E42 (nie do zmiany w Opcjach). */
export const LEAD_MIN = 60;
export const WAIT_MIN = 30;
export const WAIT_KM = 2;
export const QUIET = { from: '20:00', to: '06:00' } as const;
/** „20–06” (telefon) */
export const QUIET_SHORT = `${QUIET.from.slice(0, 2)}–${QUIET.to.slice(0, 2)}`;

/** Rodzaje SMS dostępne w miejscu: B (wcześniejszy przyjazd) tylko Boden (E42 pkt B). */
export function kindsFor(place: PlaceId): SmsKind[] {
  return place === 'UNLOAD_BODEN' ? ['A', 'B', 'C', 'D'] : ['A', 'C', 'D'];
}

export const peopleCount = (p: PlaceView) => p.people.filter(Boolean).length;

/**
 * Transporty, których dotyczy brak odbiorców w miejscu (E42: „Dziś to dotyczy też SG-03”), w oknie śledzenia (E27):
 * Śrem — jeszcze przed wyjazdem z załadunku; Boden — od promu (SMS do Boden wychodzą dopiero po promie, E42 pkt A i B).
 */
export function affectedLoads<T extends Pick<Load, 'code' | 'status' | 'stage' | 'plannedLoadDate'>>(
  place: PlaceId, loads: readonly T[], nowIso: string,
): T[] {
  return loads.filter((l) => {
    if (trackingPhase(l, nowIso) !== 'on') return false;
    const k = stageTileOf(l);
    return place === 'UNLOAD_BODEN'
      ? k === 'FERRY' || k === 'PORT_SE' || k === 'ROAD_SE' || k === 'SITE'
      : k === 'PREP' || k === 'LOADING';
  });
}

/** Pełny numer do wyświetlenia: „+48 600 000 907”. */
export function personPhone(p: Pick<ZonePerson, 'country' | 'phone'>): string {
  const e = toE164(p.phone, p.country as PhoneCountry);
  return e ? groupPhone(e) : p.phone;
}

/** Numer krajowy w polu (kierunkowy jest w wyborze obok): PL „600 000 907”, SE „070 000 00 00”. */
export function nationalText(p: Pick<ZonePerson, 'country' | 'phone'>): string {
  const d = p.phone.replace(/\D/g, '');
  if (p.country === 'PL') return d.match(/\d{1,3}/g)?.join(' ') ?? d;
  return [d.slice(0, 3), d.slice(3, 6), ...(d.slice(6).match(/\d{1,2}/g) ?? [])].filter(Boolean).join(' ');
}

/** Wiersz zwinięty na telefonie: „Anna Wiśniewska · +48 600 000 010 · A, C, D”. */
export function personSummary(p: ZonePerson): string {
  return [p.name, personPhone(p), p.kinds.join(', ')].filter(Boolean).join(' · ');
}

/**
 * Numer z pola. Kierunkowy wpisany w polu (+48 / +46 / 0048 / 0046) wygrywa z wyborem obok, inaczej liczy się wybór.
 * PL: 9 cyfr. SE: numer krajowy z zerem na początku, 9–10 cyfr (komórka 07x xxx xx xx). null — numer nie pasuje.
 */
export function parsePhone(raw: string, country: 'PL' | 'SE'): { country: 'PL' | 'SE'; phone: string } | null {
  const t = raw.trim();
  let d = t.replace(/\D/g, '');
  let c = country;
  if (t.startsWith('+') || d.startsWith('00')) {
    if (d.startsWith('00')) d = d.slice(2);
    if (d.startsWith('48')) { c = 'PL'; d = d.slice(2); } else if (d.startsWith('46')) { c = 'SE'; d = d.slice(2); } else return null;
  }
  if (c === 'PL') return /^\d{9}$/.test(d) ? { country: 'PL', phone: d } : null;
  if (!d.startsWith('0')) d = `0${d}`;
  return /^0\d{8,9}$/.test(d) ? { country: 'SE', phone: d } : null;
}

/** Ten sam numer (kraj + numer krajowy). */
export const samePhone = (a: Pick<ZonePerson, 'country' | 'phone'>, b: Pick<ZonePerson, 'country' | 'phone'>) =>
  a.country === b.country && a.phone === b.phone;

/** Osoba z konta (E6: imię i telefon z Użytkowników); null — konto bez telefonu albo z numerem spoza PL i SE. */
export function personFromUser(u: ZoneUser, kinds: readonly SmsKind[]): ZonePerson | null {
  const ph = u.phone ? parsePhone(u.phone, 'PL') : null;
  if (!ph) return null;
  return { userId: u.id, name: u.name, country: ph.country, phone: ph.phone, kinds: [...kinds] };
}
