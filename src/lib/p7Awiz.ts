/**
 * wyglad/P7-a — Przegląd i okno Awizacja (E32, img/e32-after): czyste funkcje wyglądu.
 * Kompletna awizacja (E32 pkt 6): kierowca, telefon, ciągnik, naczepa; przy przepięciu — kierowca, telefon i ciągnik odcinka SE;
 * gdy symbol wymaga pilotów („PL + SE”, D-20261009-1233-01) — pilot PL i pilot SE (numer rejestracyjny, imię i nazwisko).
 * Ta sama definicja ma działać w bazie (L3_AWIZ), w Do zrobienia i w Kokpicie — tam po stronie wykonawcy.
 * Termin (E32, 0143): ostrzeżenie 48 h, pilne 12 h przed załadunkiem (godzina z planu; bez niej 00:00 czasu polskiego).
 */
import type { Load } from '../types';

export type MissKey =
  | 'driver' | 'phone' | 'tractor' | 'trailer'
  | 'driverSe' | 'phoneSe' | 'tractorSe'
  | 'pilotPl' | 'pilotPlPlate' | 'pilotPlName'
  | 'pilotSe' | 'pilotSePlate' | 'pilotSeName';

export interface Pilot { plate: string | null; name: string | null }
export interface Pilots { pl: Pilot; se: Pilot }
export const NO_PILOTS: Pilots = { pl: { plate: null, name: null }, se: { plate: null, name: null } };

export interface AwizFields {
  driverName?: string | null;
  driverPhone?: string | null;
  tractorPlate?: string | null;
  trailerPlate?: string | null;
  trailerSwap?: boolean;
  driverDeliveryName?: string | null;
  driverDeliveryPhone?: string | null;
  tractorDeliveryPlate?: string | null;
}

const has = (v: string | null | undefined) => !!(v ?? '').trim();

function pilotMiss(p: Pilot, side: 'Pl' | 'Se'): MissKey[] {
  const plate = has(p.plate);
  const name = has(p.name);
  if (!plate && !name) return [`pilot${side}` as MissKey];
  return [...(plate ? [] : [`pilot${side}Plate` as MissKey]), ...(name ? [] : [`pilot${side}Name` as MissKey])];
}

/** Braki awizacji według jednej definicji (E32 pkt 6, D-20261009-1233-01 pkt 2). */
export function awizMissing(r: AwizFields, pilotsRequired: boolean, pilots: Pilots | null): MissKey[] {
  const out: MissKey[] = [];
  if (!has(r.driverName)) out.push('driver');
  if (!has(r.driverPhone)) out.push('phone');
  if (!has(r.tractorPlate)) out.push('tractor');
  if (!has(r.trailerPlate)) out.push('trailer');
  if (r.trailerSwap) {
    if (!has(r.driverDeliveryName)) out.push('driverSe');
    if (!has(r.driverDeliveryPhone)) out.push('phoneSe');
    if (!has(r.tractorDeliveryPlate)) out.push('tractorSe');
  }
  if (pilotsRequired) {
    const p = pilots ?? NO_PILOTS;
    out.push(...pilotMiss(p.pl, 'Pl'), ...pilotMiss(p.se, 'Se'));
  }
  return out;
}

/** Stan awizacji: nic nie wpisano / część / komplet. */
export function awizState(r: AwizFields, missing: readonly MissKey[]): 'none' | 'part' | 'ok' {
  if (missing.length === 0) return 'ok';
  const any = has(r.driverName) || has(r.driverPhone) || has(r.tractorPlate) || has(r.trailerPlate);
  return any ? 'part' : 'none';
}

/** Ile pilotów brakuje (do znacznika „2 brakują”). */
export function pilotsMissingCount(missing: readonly MissKey[]): number {
  const pl = missing.some((m) => m.startsWith('pilotPl'));
  const se = missing.some((m) => m.startsWith('pilotSe'));
  return (pl ? 1 : 0) + (se ? 1 : 0);
}

const TZ = 'Europe/Warsaw';

/** Chwila, w której w Polsce jest `day` `hh:mm` (czas letni i zimowy). */
export function warsawInstant(day: string, hm = '00:00'): number {
  const guess = Date.parse(`${day}T${hm}:00Z`);
  if (!Number.isFinite(guess)) return NaN;
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
  const asIfUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour) % 24, Number(p.minute));
  return guess - (asIfUtc - guess);
}

export interface AwizDeadline { warnAt: string; urgentAt: string; phase: 'early' | 'warn' | 'urgent'; byHour: boolean }

/**
 * Termin awizacji: ostrzeżenie 48 h, pilne 12 h przed załadunkiem (AWIZ_EARLY_H, AWIZ_LATE_H).
 * Punkt odniesienia jak `l3_anchor` (0143): godzina załadunku z planu (`plan_load_from`), a bez niej 00:00 czasu polskiego
 * w dniu załadunku („12 h przed dniem załadunku”).
 */
export function awizDeadline(loadDay: string, nowIso: string, loadFromIso: string | null = null, earlyH = 48, lateH = 12): AwizDeadline | null {
  const byHour = !!loadFromIso && Number.isFinite(Date.parse(loadFromIso));
  const day0 = byHour ? Date.parse(loadFromIso!) : warsawInstant(loadDay.slice(0, 10));
  if (!Number.isFinite(day0)) return null;
  const urgent = day0 - lateH * 3600_000;
  const warn = day0 - earlyH * 3600_000;
  const now = Date.parse(nowIso);
  return {
    warnAt: new Date(warn).toISOString(),
    urgentAt: new Date(urgent).toISOString(),
    phase: now >= urgent ? 'urgent' : now >= warn ? 'warn' : 'early',
    byHour,
  };
}

const WD = ['nd', 'pon', 'wt', 'śr', 'czw', 'pt', 'sob'];

/** Dzień tygodnia po polsku dla daty `RRRR-MM-DD` (kalendarzowy, bez strefy). */
export function weekdayPl(day: string): string {
  const d = new Date(`${day.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? '' : WD[d.getUTCDay()];
}

/** Numer tygodnia ISO. */
export function isoWeek(day: string): number | null {
  const d = new Date(`${day.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  const tmp = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const wd = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - wd);
  const y0 = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  return Math.ceil(((tmp.getTime() - y0.getTime()) / 86400000 + 1) / 7);
}

/** „czw 08.10” */
export function dayShort(day: string | null | undefined): string {
  if (!day || !/^\d{4}-\d{2}-\d{2}/.test(day)) return '—';
  return `${weekdayPl(day)} ${day.slice(8, 10)}.${day.slice(5, 7)}`;
}

/** „czw 08.10.2026” */
export function dayLong(day: string | null | undefined): string {
  if (!day || !/^\d{4}-\d{2}-\d{2}/.test(day)) return '—';
  return `${weekdayPl(day)} ${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(0, 4)}`;
}

/** „08:00” w czasie polskim; null przy braku. */
export function hm(iso: string | null | undefined): string | null {
  if (!iso || !Number.isFinite(Date.parse(iso))) return null;
  return new Intl.DateTimeFormat('pl-PL', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
}

/** „07.10, 12:00” w czasie polskim. */
export function dmHm(iso: string | null | undefined): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return '—';
  const p = Object.fromEntries(new Intl.DateTimeFormat('pl-PL', { timeZone: TZ, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day}.${p.month}, ${p.hour}:${p.minute}`;
}

/** Dzień kalendarzowy w Polsce. */
export function warsawDay(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}

/** Okno godzin „08:00–14:00”; jedna godzina „08:00”; brak — null. */
export function hourWindow(from: string | null | undefined, to: string | null | undefined): string | null {
  const a = hm(from);
  const b = hm(to);
  if (a && b && a !== b) return `${a}–${b}`;
  return a ?? b ?? null;
}

/** Odcinek, na którym jest teraz ładunek (E6: wyróżniony kierowca). */
export function segmentNow(l: Pick<Load, 'status' | 'stage'>): 'PL' | 'SE' | null {
  const s = String(l.status);
  if (['LOADING', 'IN_TRANSIT_PL', 'AT_PORT'].includes(s)) return 'PL';
  if (['AT_PORT_SE', 'IN_TRANSIT_SE', 'APPROACHING_SITE', 'UNLOADING'].includes(s)) return 'SE';
  if (s === 'DELAYED' || s === 'SILENT') {
    if (['LOADING', 'TO_PORT', 'GDANSK'].includes(l.stage)) return 'PL';
    if (['APPROACH', 'SE_ROAD', 'SITE'].includes(l.stage)) return 'SE';
  }
  return null;
}

/** Konwój KR (D-20261009-1309-01 R1): transporty z tym samym symbolem wymagającym pilotów i tą samą datą załadunku. */
export function convoyOf<T extends Pick<Load, 'id' | 'code' | 'plannedLoadDate'>>(load: T, loads: readonly T[], sameGroup: (l: T) => boolean): T[] {
  if (!sameGroup(load) || !load.plannedLoadDate) return [];
  const day = load.plannedLoadDate.slice(0, 10);
  const group = loads.filter((l) => sameGroup(l) && (l.plannedLoadDate ?? '').slice(0, 10) === day);
  return group.length > 1 ? [...group].sort((a, b) => a.code.localeCompare(b.code, 'pl', { numeric: true })) : [];
}
