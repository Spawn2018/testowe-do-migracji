/**
 * TOWER — rozkład i status Stena Line Gdynia ↔ Karlskrona (publiczny JSON AEM).
 *
 * Źródło (sprawdzone 01.10.2026):
 *   https://www.stenalinetravel.com/routes/gdynia-karlskrona/_jcr_content.timetable.{GDKA|KAGD}.{YYYY-MM-DD}.json
 * robots.txt (stenalinetravel): Disallow tylko /book, /staffconnector, /sitecore-services… —
 * ścieżka rozkładu jest dozwolona. User-Agent uczciwy (jak Polferries).
 * Brak formalnej zgody armatora — D-18 zostaje; odczyt jak II-5.
 *
 * Godziny lokalne: GDKA = Europe/Warsaw, KAGD = Europe/Stockholm.
 * Nazwy statków w JSON: „Stena Ebba” → w bazie „M/F Stena Ebba”.
 */

import { localToUtc, type FerryRoute, type FerryStatus } from './polferries.ts';

export const STENA_ROUTE_PAGE = 'https://www.stenalinetravel.com/routes/gdynia-karlskrona';
export const STENA_ATTRIBUTION = 'Status rejsów: Stena Line (stenalinetravel.com)';

/** Kody trasy w JSON Stena → nasze kody. */
export const STENA_ROUTE: Record<string, FerryRoute> = {
  GDKA: 'GDY-KAA',
  KAGD: 'KAA-GDY',
};

const VESSEL_BY_NAME: Record<string, string> = {
  'stena ebba': 'M/F Stena Ebba',
  'stena spirit': 'M/F Stena Spirit',
  'stena estelle': 'M/F Stena Estelle',
};

const TZ_BY_ROUTE: Record<string, string> = {
  GDKA: 'Europe/Warsaw',
  KAGD: 'Europe/Stockholm',
};

export interface StenaSailing {
  route: FerryRoute;
  vessel: string;
  date: string;
  departureUtc: string;
  arrivalUtc: string;
  status: FerryStatus;
  expectedDepartureUtc: string;
  expectedArrivalUtc: string;
  rawStatus: string;
  ferryCode: string;
}

export interface StenaParseResult {
  sailings: StenaSailing[];
  warnings: string[];
}

export function stenaTimetableUrl(routeCode: 'GDKA' | 'KAGD', dateYmd: string): string {
  return `${STENA_ROUTE_PAGE}/_jcr_content.timetable.${routeCode}.${dateYmd}.json`;
}

function mapVessel(name: string, code: string): string | null {
  const byName = VESSEL_BY_NAME[name.trim().toLowerCase()];
  if (byName) return byName;
  const byCode: Record<string, string> = {
    EBBA: 'M/F Stena Ebba', SPIR: 'M/F Stena Spirit', ESTE: 'M/F Stena Estelle',
  };
  return byCode[code?.toUpperCase()] ?? null;
}

function mapStatus(raw: string | null | undefined): FerryStatus | null {
  const t = (raw ?? '').trim().toLowerCase();
  if (!t) return null;
  if (/cancel|odwoł|odwol|anul/.test(t)) return 'ODWOLANY';
  if (/delay|opóźn|opozn|late/.test(t)) return 'OPOZNIONY';
  if (/^on\s*time$|^planowo$|^departed$|^wypłyn|^wyplet/.test(t)) return 'ZAPLANOWANY';
  return null;
}

/** Lokalny ISO bez strefy → UTC. */
function localIsoToUtc(localIso: string, tz: string): string {
  const m = localIso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (!m) throw new Error(`nieczytelna data lokalna: ${localIso}`);
  return localToUtc(m[1], m[2], 0, tz);
}

/**
 * Parser odpowiedzi JSON AEM (tablica rejsów na jeden dzień i jedną trasę).
 * Zmiana struktury → ostrzeżenie, nigdy cicha pusta lista bez powodu.
 */
export function parseStenaTimetable(
  json: unknown,
  opts: { routeCode?: 'GDKA' | 'KAGD'; dateYmd?: string } = {},
): StenaParseResult {
  const warnings: string[] = [];
  const sailings: StenaSailing[] = [];
  if (!Array.isArray(json)) {
    warnings.push('Struktura rozkładu Stena zmieniona: oczekiwano tablicy rejsów. Parser wymaga aktualizacji.');
    return { sailings, warnings };
  }
  if (json.length === 0) {
    warnings.push(`Stena ${opts.routeCode ?? '?'}: brak rejsów na ${opts.dateYmd ?? 'dzień'} — możliwy pusty dzień albo zmiana API.`);
    return { sailings, warnings };
  }
  json.forEach((row, i) => {
    if (!row || typeof row !== 'object') {
      warnings.push(`Stena: nieczytelny wpis nr ${i + 1} — pominięty.`);
      return;
    }
    const r = row as Record<string, unknown>;
    const routeCode = String(r.routeCode ?? opts.routeCode ?? '');
    const route = STENA_ROUTE[routeCode];
    if (!route) {
      warnings.push(`Stena: nieznany kod trasy „${routeCode}” — pominięty.`);
      return;
    }
    const ferryName = String(r.ferryName ?? '');
    const ferryCode = String(r.ferryCode ?? '');
    const vessel = mapVessel(ferryName, ferryCode);
    if (!vessel) {
      warnings.push(`Stena ${route}: nieznany statek „${ferryName || ferryCode}” — pominięty.`);
      return;
    }
    const depLocal = String(r.localDepartureTime ?? '');
    const arrLocal = String(r.localArrivalTime ?? '');
    if (!depLocal || !arrLocal) {
      warnings.push(`Stena ${route}: brak godzin w wpisie ${ferryName} — pominięty.`);
      return;
    }
    const tz = TZ_BY_ROUTE[routeCode] ?? 'Europe/Warsaw';
    let departureUtc: string;
    let arrivalUtc: string;
    try {
      departureUtc = localIsoToUtc(depLocal, tz);
      arrivalUtc = localIsoToUtc(arrLocal, tz);
    } catch {
      warnings.push(`Stena ${route}: nieparsowalne godziny ${depLocal} / ${arrLocal}.`);
      return;
    }
    const rawStatus = String(r.status ?? '');
    const status = mapStatus(rawStatus);
    if (!status) {
      warnings.push(`Nieznany status rejsu Stena ${ferryName} ${depLocal}: „${rawStatus}". Bez automatycznej zmiany — do weryfikacji HHL.`);
    }
    const expDep = r.estimatedLocalDepartureTime ? String(r.estimatedLocalDepartureTime) : depLocal;
    const expArr = r.estimatedLocalArrivalTime ? String(r.estimatedLocalArrivalTime) : arrLocal;
    let expectedDepartureUtc = departureUtc;
    let expectedArrivalUtc = arrivalUtc;
    try {
      expectedDepartureUtc = localIsoToUtc(expDep, tz);
      expectedArrivalUtc = localIsoToUtc(expArr, tz);
    } catch { /* zostaw plan */ }
    const date = depLocal.slice(0, 10);
    sailings.push({
      route, vessel, date, ferryCode,
      departureUtc, arrivalUtc,
      expectedDepartureUtc, expectedArrivalUtc,
      status: status ?? 'NIEZNANY',
      rawStatus,
    });
  });
  return { sailings, warnings };
}

/** Daty YYYY-MM-DD od `from` włącznie, `days` dni (UTC kalendarzowe — wystarczy do pobrania). */
export function dateRangeYmd(from: Date, days: number): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  for (let i = 0; i < days; i++) {
    const x = new Date(d.getTime() + i * 864e5);
    out.push(x.toISOString().slice(0, 10));
  }
  return out;
}
