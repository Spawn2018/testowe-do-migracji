/**
 * BN2 — Eckerö Line (pasażerski TLLA-HEL) + Finbo Cargo (MUU-VUO).
 *
 * Źródła docelowe: eckeroline.com / finbocargo (HTML) — User-Agent uczciwy.
 * Parser przyjmuje znormalizowaną listę (fixture / przyszły scrape).
 */
import { localToUtc, type FerryRoute } from './polferries.ts';

export const ECKERO_SCHEDULE_PAGE = 'https://www.eckeroline.com/';
export const FINBO_SCHEDULE_PAGE = 'https://www.finbocargo.com/';
export const ECKERO_UA = 'Watch Tower (https://tower.log-mar.pl; ferry timetable)';
export const ECKERO_ATTRIBUTION = 'Rozkład: Eckerö Line / Finbo Cargo';

const SHIP: Record<string, string> = {
  finlandia: 'M/F Finlandia',
  'finbo cargo': 'M/F Finbo Cargo',
  finbo: 'M/F Finbo Cargo',
};

const ROUTES = new Set<FerryRoute>(['TLLA-HEL', 'HELA-TLL', 'MUU-VUO', 'VUO-MUU']);

export interface EckeroSailing {
  route: FerryRoute;
  vessel: string;
  departureUtc: string;
  arrivalUtc: string;
}

export interface EckeroParseResult {
  sailings: EckeroSailing[];
  warnings: string[];
}

export type EckeroRawSail = {
  route?: string;
  vessel?: string;
  departureLocal?: string;
  arrivalLocal?: string;
  tzDep?: string;
  tzArr?: string;
};

export function parseEckeroSchedule(raw: unknown): EckeroParseResult {
  const warnings: string[] = [];
  const sailings: EckeroSailing[] = [];
  if (!raw || typeof raw !== 'object') {
    warnings.push('Struktura rozkładu Eckerö zmieniona: oczekiwano obiektu z polem sailings.');
    return { sailings, warnings };
  }
  const list = (raw as { sailings?: unknown }).sailings;
  if (!Array.isArray(list)) {
    warnings.push('Struktura rozkładu Eckerö zmieniona: brak tablicy sailings.');
    return { sailings, warnings };
  }
  if (list.length === 0) {
    warnings.push('Eckerö/Finbo: brak rejsów w odczycie.');
    return { sailings, warnings };
  }
  for (let i = 0; i < list.length; i++) {
    const row = list[i] as EckeroRawSail;
    if (!row || typeof row !== 'object') {
      warnings.push(`Eckerö: nieczytelny rejs nr ${i + 1}.`);
      continue;
    }
    const route = String(row.route ?? '').toUpperCase() as FerryRoute;
    if (!ROUTES.has(route)) {
      warnings.push(`Eckerö: nieznana trasa „${row.route}” — pominięty.`);
      continue;
    }
    const vesselKey = String(row.vessel ?? '').trim().toLowerCase();
    const vessel = SHIP[vesselKey] ?? (vesselKey.startsWith('m/f ') ? String(row.vessel) : null);
    if (!vessel) {
      warnings.push(`Eckerö: nieznany statek „${row.vessel}” — pominięty.`);
      continue;
    }
    const depM = String(row.departureLocal ?? '').match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
    const arrM = String(row.arrivalLocal ?? '').match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
    if (!depM || !arrM) {
      warnings.push(`Eckerö ${route}: nieczytelne godziny.`);
      continue;
    }
    const fromEe = route === 'TLLA-HEL' || route === 'MUU-VUO';
    const tzDep = row.tzDep ?? (fromEe ? 'Europe/Tallinn' : 'Europe/Helsinki');
    const tzArr = row.tzArr ?? (fromEe ? 'Europe/Helsinki' : 'Europe/Tallinn');
    sailings.push({
      route,
      vessel,
      departureUtc: localToUtc(depM[1], depM[2], 0, tzDep),
      arrivalUtc: localToUtc(arrM[1], arrM[2], 0, tzArr),
    });
  }
  return { sailings, warnings };
}
