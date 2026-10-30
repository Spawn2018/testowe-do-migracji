/**
 * BN2 — DFDS Paldiski ↔ Kapellskär (PLD-KPS / KPS-PLD).
 *
 * Źródło docelowe: strona DFDS freight / rozkład (HTML) — User-Agent uczciwy.
 * Parser przyjmuje znormalizowaną listę (fixture / przyszły scrape).
 */
import { localToUtc, type FerryRoute } from './polferries.ts';

export const DFDS_SCHEDULE_PAGE = 'https://www.dfds.com/';
export const DFDS_UA = 'Watch Tower (https://tower.log-mar.pl; ferry timetable)';
export const DFDS_ATTRIBUTION = 'Rozkład: DFDS';

const SHIP: Record<string, string> = {
  'sirena seaways': 'M/F Sirena Seaways',
  sirena: 'M/F Sirena Seaways',
};

const ROUTES = new Set<FerryRoute>(['PLD-KPS', 'KPS-PLD']);

export interface DfdsSailing {
  route: FerryRoute;
  vessel: string;
  departureUtc: string;
  arrivalUtc: string;
}

export interface DfdsParseResult {
  sailings: DfdsSailing[];
  warnings: string[];
}

export type DfdsRawSail = {
  route?: string;
  vessel?: string;
  departureLocal?: string;
  arrivalLocal?: string;
  tzDep?: string;
  tzArr?: string;
};

export function parseDfdsSchedule(raw: unknown): DfdsParseResult {
  const warnings: string[] = [];
  const sailings: DfdsSailing[] = [];
  if (!raw || typeof raw !== 'object') {
    warnings.push('Struktura rozkładu DFDS zmieniona: oczekiwano obiektu z polem sailings.');
    return { sailings, warnings };
  }
  const list = (raw as { sailings?: unknown }).sailings;
  if (!Array.isArray(list)) {
    warnings.push('Struktura rozkładu DFDS zmieniona: brak tablicy sailings.');
    return { sailings, warnings };
  }
  if (list.length === 0) {
    warnings.push('DFDS: brak rejsów w odczycie.');
    return { sailings, warnings };
  }
  for (let i = 0; i < list.length; i++) {
    const row = list[i] as DfdsRawSail;
    if (!row || typeof row !== 'object') {
      warnings.push(`DFDS: nieczytelny rejs nr ${i + 1}.`);
      continue;
    }
    const route = String(row.route ?? '').toUpperCase() as FerryRoute;
    if (!ROUTES.has(route)) {
      warnings.push(`DFDS: nieznana trasa „${row.route}” — pominięty.`);
      continue;
    }
    const vesselKey = String(row.vessel ?? '').trim().toLowerCase();
    const vessel = SHIP[vesselKey] ?? (vesselKey.startsWith('m/f ') ? String(row.vessel) : null);
    if (!vessel) {
      warnings.push(`DFDS: nieznany statek „${row.vessel}” — pominięty.`);
      continue;
    }
    const depM = String(row.departureLocal ?? '').match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
    const arrM = String(row.arrivalLocal ?? '').match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
    if (!depM || !arrM) {
      warnings.push(`DFDS ${route}: nieczytelne godziny.`);
      continue;
    }
    const tzDep = row.tzDep ?? (route === 'PLD-KPS' ? 'Europe/Tallinn' : 'Europe/Stockholm');
    const tzArr = row.tzArr ?? (route === 'PLD-KPS' ? 'Europe/Stockholm' : 'Europe/Tallinn');
    sailings.push({
      route,
      vessel,
      departureUtc: localToUtc(depM[1], depM[2], 0, tzDep),
      arrivalUtc: localToUtc(arrM[1], arrM[2], 0, tzArr),
    });
  }
  return { sailings, warnings };
}
