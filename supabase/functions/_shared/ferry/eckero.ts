/**
 * BN2 — Eckerö Line (pasażerski TLLA-HEL) + Finbo Cargo (MUU-VUO).
 *
 * LIVE: HTML https://www.eckeroline.com/timetable (tabele tygodniowe Finlandia / Finbo).
 * User-Agent uczciwy; awaria struktury → SOURCE_DOWN:ECKERO_SCHEDULE.
 * Parser JSON (fixture) zostaje dla testów znormalizowanych.
 */
import { localToUtc, type FerryRoute } from './polferries.ts';
import {
  dateRangeFromYmd, parseDaySpec, parseLocalTime, parseSeasonRanges, stripTags,
  weekdayInTz, ymdInRanges, ymdInTz, type YmdRange,
} from './weeklySchedule.ts';

export const ECKERO_SCHEDULE_PAGE = 'https://www.eckeroline.com/timetable';
export const FINBO_SCHEDULE_PAGE = 'https://www.finbocargo.com/';
export const ECKERO_UA = 'Watch Tower (https://tower.log-mar.pl; ferry timetable)';
export const ECKERO_ATTRIBUTION = 'Rozkład: Eckerö Line / Finbo Cargo (eckeroline.com/timetable)';

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

type WeeklyLeg = {
  days: Set<number>;
  vessel: string;
  route: FerryRoute;
  depHm: string;
  arrHm: string;
  arrNextDay: boolean;
  tzDep: string;
  tzArr: string;
  /** F7 #661: tylko daty w zakresie sezonu (np. Finbo bez 24.12–5.01). */
  ranges: YmdRange[];
};

/**
 * HTML eckeroline.com/timetable — tabele Finlandia (Terminal A) i Finbo (Muuga↔Vuosaari).
 * Rozwijane na `days` dni od `fromYmd` (domyślnie dziś Tallinn).
 */
export function parseEckeroTimetableHtml(
  html: string,
  opts?: { fromYmd?: string; days?: number; now?: Date },
): EckeroParseResult {
  const warnings: string[] = [];
  const sailings: EckeroSailing[] = [];
  if (!html || !html.trim()) {
    warnings.push('Eckerö: pusta odpowiedź HTML.');
    return { sailings, warnings };
  }
  const legs: WeeklyLeg[] = [];
  legs.push(...parseFinlandiaTables(html, warnings));
  legs.push(...parseFinboTables(html, warnings));
  if (legs.length === 0) {
    warnings.push('Struktura rozkładu Eckerö zmieniona: brak tabel Finlandia/Finbo.');
    return { sailings, warnings };
  }
  const fromYmd = opts?.fromYmd ?? ymdInTz(opts?.now ?? new Date(), 'Europe/Tallinn');
  const days = opts?.days ?? 14;
  const dates = dateRangeFromYmd(fromYmd, days);
  for (const leg of legs) {
    for (const ymd of dates) {
      if (!ymdInRanges(ymd, leg.ranges)) continue;
      if (!leg.days.has(weekdayInTz(ymd, leg.tzDep))) continue;
      const depUtc = localToUtc(ymd, leg.depHm, 0, leg.tzDep);
      const arrUtc = localToUtc(ymd, leg.arrHm, leg.arrNextDay ? 1 : 0, leg.tzArr);
      if (Date.parse(arrUtc) <= Date.parse(depUtc)) {
        // przyjazd „tego samego dnia” ale wcześniejszy = kolejny dzień
        sailings.push({
          route: leg.route,
          vessel: leg.vessel,
          departureUtc: depUtc,
          arrivalUtc: localToUtc(ymd, leg.arrHm, 1, leg.tzArr),
        });
      } else {
        sailings.push({ route: leg.route, vessel: leg.vessel, departureUtc: depUtc, arrivalUtc: arrUtc });
      }
    }
  }
  if (sailings.length === 0) {
    warnings.push('Eckerö/Finbo: brak rejsów w odczycie.');
  }
  return { sailings, warnings };
}

function parseFinlandiaTables(html: string, warnings: string[]): WeeklyLeg[] {
  const legs: WeeklyLeg[] = [];
  // Blok z nagłówkiem Finlandia + zakres 2026… — bierzemy tabele 7-kolumnowe (HEL↔TLL × 2 kierunki)
  // i 4-kolumnowe (mobile). Szukamy wierszy z strong = odjazd.
  const chunks = html.split(/M\/?s\s+Finlandia/i);
  if (chunks.length < 2) return legs;
  for (let c = 1; c < chunks.length; c++) {
    const chunk = chunks[c]!;
    if (!/2026|2027/.test(chunk.slice(0, 400))) continue;
    const ranges = parseSeasonRanges(chunk.slice(0, 500));
    const tableEnd = chunk.indexOf('</table>');
    if (tableEnd < 0) continue;
    const table = chunk.slice(0, tableEnd);
    if (/Vuosaari|Muuga|Finbo/i.test(table.slice(0, 800))) continue;
    const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)];
    for (const rm of rows) {
      const cells = [...rm[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((x) => stripTags(x[1]!));
      if (cells.length < 4) continue;
      const daySpec = cells[0]!;
      if (!parseDaySpec(daySpec)) continue;
      const days = parseDaySpec(daySpec)!;
      // 7 kolumn: day | HEL dep | → | TLL arr | TLL dep | → | HEL arr
      if (cells.length >= 7) {
        const helDep = parseLocalTime(cells[1]!);
        const tllArr = parseLocalTime(cells[3]!);
        if (helDep && tllArr) {
          legs.push({
            days, vessel: 'M/F Finlandia', route: 'HELA-TLL',
            depHm: helDep.hm, arrHm: tllArr.hm, arrNextDay: tllArr.nextDay,
            tzDep: 'Europe/Helsinki', tzArr: 'Europe/Tallinn', ranges,
          });
        }
        const tllDep = parseLocalTime(cells[4]!);
        const helArr = parseLocalTime(cells[6]!);
        if (tllDep && helArr) {
          legs.push({
            days, vessel: 'M/F Finlandia', route: 'TLLA-HEL',
            depHm: tllDep.hm, arrHm: helArr.hm, arrNextDay: helArr.nextDay,
            tzDep: 'Europe/Tallinn', tzArr: 'Europe/Helsinki', ranges,
          });
        }
        continue;
      }
      // 4 kolumny mobile: day | HEL | arrow | TLL — kierunek ze strzałki w HTML
      if (cells.length >= 4) {
        const arrowCell = rm[0].match(/&(r|l)arr;|→|←|→|←/i)?.[0] ?? '';
        const left = parseLocalTime(cells[1]!);
        const right = parseLocalTime(cells[3]!);
        if (!left || !right) continue;
        const toTallinn = /rarr|→/i.test(arrowCell) || (!/larr|←/i.test(arrowCell) && !!rm[0].match(/<strong>[\s\S]*?<\/strong>/i));
        // strong na odjeździe: jeśli strong w cells[1] → HEL→TLL
        const strongLeft = /<strong>/i.test(
          [...rm[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)][1]?.[1] ?? '',
        );
        if (strongLeft || toTallinn) {
          legs.push({
            days, vessel: 'M/F Finlandia', route: 'HELA-TLL',
            depHm: left.hm, arrHm: right.hm, arrNextDay: right.nextDay,
            tzDep: 'Europe/Helsinki', tzArr: 'Europe/Tallinn', ranges,
          });
        } else {
          legs.push({
            days, vessel: 'M/F Finlandia', route: 'TLLA-HEL',
            depHm: right.hm, arrHm: left.hm, arrNextDay: left.nextDay,
            tzDep: 'Europe/Tallinn', tzArr: 'Europe/Helsinki', ranges,
          });
        }
      }
    }
  }
  if (legs.length === 0) warnings.push('Eckerö Finlandia: nie odczytano wierszy tygodniowych.');
  return legs;
}

function parseFinboTables(html: string, warnings: string[]): WeeklyLeg[] {
  const legs: WeeklyLeg[] = [];
  const chunks = html.split(/M\/?s\s+Finbo\s+Cargo/i);
  for (let c = 1; c < chunks.length; c++) {
    const chunk = chunks[c]!;
    if (!/2026/.test(chunk.slice(0, 500))) continue;
    // F7 #661: „Jan 6 – Dec 23” × sezony → przerwa 24.12–5.01 bez rejsów.
    const ranges = parseSeasonRanges(chunk.slice(0, 800));
    const tableEnd = chunk.indexOf('</table>');
    if (tableEnd < 0) continue;
    const table = chunk.slice(0, tableEnd);
    if (!/Vuosaari|Muuga/i.test(table)) continue;
    const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/gi)];
    for (const rm of rows) {
      const cells = [...rm[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((x) => stripTags(x[1]!));
      if (cells.length < 7) continue;
      const days = parseDaySpec(cells[0]!);
      if (!days) continue;
      const vuoDep = parseLocalTime(cells[1]!);
      const muuArr = parseLocalTime(cells[3]!);
      if (vuoDep && muuArr) {
        legs.push({
          days, vessel: 'M/F Finbo Cargo', route: 'VUO-MUU',
          depHm: vuoDep.hm, arrHm: muuArr.hm, arrNextDay: muuArr.nextDay,
          tzDep: 'Europe/Helsinki', tzArr: 'Europe/Tallinn', ranges,
        });
      }
      const muuDep = parseLocalTime(cells[4]!);
      const vuoArr = parseLocalTime(cells[6]!);
      if (muuDep && vuoArr) {
        legs.push({
          days, vessel: 'M/F Finbo Cargo', route: 'MUU-VUO',
          depHm: muuDep.hm, arrHm: vuoArr.hm, arrNextDay: vuoArr.nextDay,
          tzDep: 'Europe/Tallinn', tzArr: 'Europe/Helsinki', ranges,
        });
      }
    }
    break; // pierwsza aktualna tabela 2026
  }
  if (legs.length === 0) warnings.push('Eckerö Finbo: nie odczytano wierszy 2026.');
  return legs;
}
