/**
 * BN2 — rozkład Tallink (booking.tallink.com /api/timetables).
 *
 * Źródło (sprawdzone 30.10.2026): GET /api/timetables?from=tal&to=hel&… (F7 #660: bez
 * strony booking — readText i tak nie niesie ciastek). User-Agent uczciwy.
 * Godziny lokalne bez strefy; TAL = Europe/Tallinn, HEL = Europe/Helsinki, STO = Europe/Stockholm.
 *
 * Terminal D (pier DTER) → TLL-HEL / HEL-TLL; inne pier Tallinna → ostrzeżenie (Viking/Eckerö osobno).
 */
import { localToUtc, type FerryRoute } from './polferries.ts';

export const TALLINK_BOOKING = 'https://booking.tallink.com';
export const TALLINK_UA = 'Watch Tower (https://tower.log-mar.pl; ferry timetable)';
export const TALLINK_ATTRIBUTION = 'Rozkład: Tallink (booking.tallink.com)';

const SHIP: Record<string, string> = {
  MYSTAR: 'M/F MyStar',
  MEGASTAR: 'M/F Megastar',
  VICTORIA: 'M/F Victoria I',
  BALTICQUEEN: 'M/F Baltic Queen',
  /** booking.tallink.com na TLL↔STO (CRUISE/SHUTTLE) zwraca shipCode „QUEEN”, nie BALTICQUEEN. */
  QUEEN: 'M/F Baltic Queen',
  SILJAEUROPA: 'M/F Silja Europa',
  REGALPRINCESS: 'M/F Regal Princess',
};

const CITY_ROUTE: Record<string, FerryRoute> = {
  'TAL>HEL': 'TLL-HEL',
  'HEL>TAL': 'HEL-TLL',
  'TAL>STO': 'TLL-STO',
  'STO>TAL': 'STO-TLL',
};

const TZ_FROM: Record<string, string> = {
  TAL: 'Europe/Tallinn',
  HEL: 'Europe/Helsinki',
  STO: 'Europe/Stockholm',
};

export interface TallinkSailing {
  route: FerryRoute;
  vessel: string;
  departureUtc: string;
  arrivalUtc: string;
  shipCode: string;
  pierFrom: string;
  pierTo: string;
  sailId: number | null;
}

export interface TallinkParseResult {
  sailings: TallinkSailing[];
  warnings: string[];
}

export function tallinkTimetableUrl(opts: {
  from: 'tal' | 'hel' | 'sto';
  to: 'tal' | 'hel' | 'sto';
  dateFrom: string;
  dateTo: string;
  voyageType?: 'SHUTTLE' | 'CRUISE';
}): string {
  const q = new URLSearchParams({
    locale: 'en',
    country: 'EE',
    from: opts.from,
    to: opts.to,
    oneWay: 'true',
    dateFrom: opts.dateFrom,
    dateTo: opts.dateTo,
    voyageType: opts.voyageType ?? 'SHUTTLE',
    includeOvernight: 'false',
    searchFutureSails: 'true',
  });
  return `${TALLINK_BOOKING}/api/timetables?${q}`;
}

function mapRoute(cityFrom: string, cityTo: string, pierFrom: string, pierTo: string): FerryRoute | null {
  const key = `${cityFrom.toUpperCase()}>${cityTo.toUpperCase()}`;
  const base = CITY_ROUTE[key];
  if (!base) return null;
  // Tallink shuttle TLL↔HEL = Terminal D po stronie Tallinna (DTER / D).
  // TAL→HEL: pierFrom=D…; HEL→TAL: pierFrom=LSA2 (Helsinki), pierTo=D… — filtr na pier Tallinna.
  if (base === 'TLL-HEL' && pierFrom && !/^D/i.test(pierFrom)) return null;
  if (base === 'HEL-TLL' && pierTo && !/^D/i.test(pierTo)) return null;
  return base;
}

function localIsoToUtc(localIso: string, tz: string): string | null {
  const m = String(localIso).match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  if (!m) return null;
  return localToUtc(m[1], m[2], 0, tz);
}

/**
 * Parser odpowiedzi /api/timetables. Zmiana struktury → ostrzeżenie, nigdy cicha pustka.
 */
export function parseTallinkTimetable(json: unknown): TallinkParseResult {
  const warnings: string[] = [];
  const sailings: TallinkSailing[] = [];
  if (!json || typeof json !== 'object' || !('trips' in json)) {
    warnings.push('Struktura rozkładu Tallink zmieniona: brak pola trips. Parser wymaga aktualizacji.');
    return { sailings, warnings };
  }
  const trips = (json as { trips?: Record<string, unknown> }).trips;
  if (!trips || typeof trips !== 'object') {
    warnings.push('Struktura rozkładu Tallink zmieniona: trips nie jest obiektem.');
    return { sailings, warnings };
  }
  const days = Object.keys(trips);
  if (days.length === 0) {
    warnings.push('Tallink: brak dni w trips — możliwa awaria albo pusty zakres dat.');
    return { sailings, warnings };
  }
  for (const day of days) {
    const block = trips[day] as { outwards?: unknown[]; returns?: unknown[] } | null;
    if (!block || typeof block !== 'object') {
      warnings.push(`Tallink ${day}: nieczytelny dzień — pominięty.`);
      continue;
    }
    const legs = [...(Array.isArray(block.outwards) ? block.outwards : []), ...(Array.isArray(block.returns) ? block.returns : [])];
    for (let i = 0; i < legs.length; i++) {
      const row = legs[i];
      if (!row || typeof row !== 'object') {
        warnings.push(`Tallink ${day}: nieczytelny rejs nr ${i + 1}.`);
        continue;
      }
      const r = row as Record<string, unknown>;
      // isDisabled = brak miejsc / rejs już wyszedł w booking — nadal wpis do rozkładu.
      const cityFrom = String(r.cityFrom ?? '').toUpperCase();
      const cityTo = String(r.cityTo ?? '').toUpperCase();
      const pierFrom = String(r.pierFrom ?? '');
      const pierTo = String(r.pierTo ?? '');
      const route = mapRoute(cityFrom, cityTo, pierFrom, pierTo);
      if (!route) {
        const tallinnPier = cityFrom === 'TAL' ? pierFrom : cityTo === 'TAL' ? pierTo : '';
        if (CITY_ROUTE[`${cityFrom}>${cityTo}`] && tallinnPier && !/^D/i.test(tallinnPier)) {
          warnings.push(`Tallink ${day}: pier Tallinna ${tallinnPier} poza Terminalem D — pominięty (nie Tallink D↔T2).`);
        }
        continue;
      }
      const shipCode = String(r.shipCode ?? '').toUpperCase();
      const vessel = SHIP[shipCode];
      if (!vessel) {
        warnings.push(`Tallink ${route}: nieznany statek „${shipCode || r.shipCode}” — pominięty.`);
        continue;
      }
      const tzDep = TZ_FROM[cityFrom] ?? 'Europe/Tallinn';
      const tzArr = TZ_FROM[cityTo] ?? 'Europe/Helsinki';
      const depUtc = localIsoToUtc(String(r.departureIsoDate ?? ''), tzDep);
      const arrUtc = localIsoToUtc(String(r.arrivalIsoDate ?? ''), tzArr);
      if (!depUtc || !arrUtc) {
        warnings.push(`Tallink ${route}: nieczytelne godziny ${r.departureIsoDate}/${r.arrivalIsoDate}.`);
        continue;
      }
      sailings.push({
        route,
        vessel,
        departureUtc: depUtc,
        arrivalUtc: arrUtc,
        shipCode,
        pierFrom,
        pierTo,
        sailId: typeof r.sailId === 'number' ? r.sailId : null,
      });
    }
  }
  if (sailings.length === 0 && warnings.every((w) => !/Struktura|awaria/i.test(w))) {
    warnings.push('Tallink: 0 rejsów po filtrze Terminal D — sprawdź pierFrom albo zakres dat.');
  }
  return { sailings, warnings };
}
