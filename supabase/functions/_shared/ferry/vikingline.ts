/**
 * BN2 — rozkład Viking Line (TLLA-HEL / HELA-TLL, Terminal A).
 *
 * Źródło docelowe: publiczny rozkład vikingline.com (HTML/JSON — do potwierdzenia
 * przy pierwszym LIVE). Parser przyjmuje znormalizowaną listę rejsów (fixture / API).
 * User-Agent uczciwy; awaria struktury → SOURCE_DOWN:VIKING_SCHEDULE.
 */
import { localToUtc, type FerryRoute } from './polferries.ts';

export const VIKING_SCHEDULE_PAGE = 'https://www.vikingline.com/';
export const VIKING_UA = 'Watch Tower (https://tower.log-mar.pl; ferry timetable)';
export const VIKING_ATTRIBUTION = 'Rozkład: Viking Line';

const SHIP: Record<string, string> = {
  'viking xprs': 'M/F Viking XPRS',
  xprs: 'M/F Viking XPRS',
};

export interface VikingSailing {
  route: FerryRoute;
  vessel: string;
  departureUtc: string;
  arrivalUtc: string;
}

export interface VikingParseResult {
  sailings: VikingSailing[];
  warnings: string[];
}

/** Znormalizowany wpis (fixture albo przyszły JSON). */
export type VikingRawSail = {
  route?: string;
  vessel?: string;
  departureLocal?: string;
  arrivalLocal?: string;
  tzDep?: string;
  tzArr?: string;
};

export function parseVikingSchedule(raw: unknown): VikingParseResult {
  const warnings: string[] = [];
  const sailings: VikingSailing[] = [];
  if (!raw || typeof raw !== 'object') {
    warnings.push('Struktura rozkładu Viking zmieniona: oczekiwano obiektu z polem sailings.');
    return { sailings, warnings };
  }
  const list = (raw as { sailings?: unknown }).sailings;
  if (!Array.isArray(list)) {
    warnings.push('Struktura rozkładu Viking zmieniona: brak tablicy sailings.');
    return { sailings, warnings };
  }
  if (list.length === 0) {
    warnings.push('Viking: brak rejsów w odczycie.');
    return { sailings, warnings };
  }
  for (let i = 0; i < list.length; i++) {
    const row = list[i] as VikingRawSail;
    if (!row || typeof row !== 'object') {
      warnings.push(`Viking: nieczytelny rejs nr ${i + 1}.`);
      continue;
    }
    const routeCode = String(row.route ?? '').toUpperCase();
    const route = (routeCode === 'TLLA-HEL' || routeCode === 'HELA-TLL')
      ? routeCode as FerryRoute
      : null;
    if (!route) {
      warnings.push(`Viking: nieznana trasa „${row.route}” — pominięty.`);
      continue;
    }
    const vesselKey = String(row.vessel ?? '').trim().toLowerCase();
    const vessel = SHIP[vesselKey] ?? (vesselKey.startsWith('m/f ') ? String(row.vessel) : null);
    if (!vessel) {
      warnings.push(`Viking: nieznany statek „${row.vessel}” — pominięty.`);
      continue;
    }
    const depM = String(row.departureLocal ?? '').match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
    const arrM = String(row.arrivalLocal ?? '').match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
    if (!depM || !arrM) {
      warnings.push(`Viking ${route}: nieczytelne godziny.`);
      continue;
    }
    const tzDep = row.tzDep ?? (route === 'TLLA-HEL' ? 'Europe/Tallinn' : 'Europe/Helsinki');
    const tzArr = row.tzArr ?? (route === 'TLLA-HEL' ? 'Europe/Helsinki' : 'Europe/Tallinn');
    sailings.push({
      route,
      vessel,
      departureUtc: localToUtc(depM[1], depM[2], 0, tzDep),
      arrivalUtc: localToUtc(arrM[1], arrM[2], 0, tzArr),
    });
  }
  return { sailings, warnings };
}
