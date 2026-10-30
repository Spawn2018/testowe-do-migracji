/**
 * BN2 — rozkład Viking Line (TLLA-HEL / HELA-TLL, Terminal A / Katajanokka).
 *
 * LIVE: HTML sales.vikingline.com/timetable/helsinki-tallinn/ (tabele sezonowe).
 * Imperva może zwrócić 403 — wtedy SOURCE_DOWN (bez obchodzenia zabezpieczeń).
 * Parser JSON (fixture) zostaje dla testów znormalizowanych.
 */
import { localToUtc, type FerryRoute } from './polferries.ts';
import {
  dateRangeFromYmd, parseDaySpec, parseLocalTime, stripTags, weekdayInTz, ymdInTz,
} from './weeklySchedule.ts';

export const VIKING_SCHEDULE_PAGE =
  'https://www.sales.vikingline.com/timetable/helsinki-tallinn/';
export const VIKING_UA = 'Watch Tower (https://tower.log-mar.pl; ferry timetable)';
export const VIKING_ATTRIBUTION = 'Rozkład: Viking Line (sales.vikingline.com)';

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

type WeeklyLeg = {
  days: Set<number>;
  route: FerryRoute;
  depHm: string;
  arrHm: string;
  arrNextDay: boolean;
  tzDep: string;
  tzArr: string;
};

/**
 * HTML tabel sezonowych Viking (Departure / Arrival / Day / Ship).
 * `data-route="helsinki-tallinn"` → HELA-TLL; `tallinn-helsinki` → TLLA-HEL.
 * Bez atrybutu: kolejność sekcji Helsinki–Tallinn, potem Tallinn–Helsinki.
 */
export function parseVikingTimetableHtml(
  html: string,
  opts?: { fromYmd?: string; days?: number; now?: Date },
): VikingParseResult {
  const warnings: string[] = [];
  const sailings: VikingSailing[] = [];
  if (!html || !html.trim()) {
    warnings.push('Viking: pusta odpowiedź HTML.');
    return { sailings, warnings };
  }
  if (/Pardon Our Interruption|imperva|Just a moment/i.test(html) && !/<table/i.test(html)) {
    warnings.push('Viking: strona zablokowana (ochrona antybot) — brak tabeli rozkładu.');
    return { sailings, warnings };
  }
  const legs: WeeklyLeg[] = [];
  const tables = [...html.matchAll(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi)];
  let fallbackIdx = 0;
  for (const tm of tables) {
    const attrs = tm[1] ?? '';
    const body = tm[2] ?? '';
    if (!/Departure|Odjazd|Lähtö/i.test(body) || !/Day|Päivä|Dzień/i.test(body)) continue;
    let route: FerryRoute | null = null;
    if (/data-route\s*=\s*["']helsinki-tallinn["']/i.test(attrs) || /helsinki\s*[–-]\s*tallinn/i.test(attrs)) {
      route = 'HELA-TLL';
    } else if (/data-route\s*=\s*["']tallinn-helsinki["']/i.test(attrs)) {
      route = 'TLLA-HEL';
    } else {
      route = fallbackIdx === 0 ? 'HELA-TLL' : 'TLLA-HEL';
      fallbackIdx += 1;
    }
    const tzDep = route === 'HELA-TLL' ? 'Europe/Helsinki' : 'Europe/Tallinn';
    const tzArr = route === 'HELA-TLL' ? 'Europe/Tallinn' : 'Europe/Helsinki';
    const rows = [...body.matchAll(/<tr[\s\S]*?<\/tr>/gi)];
    for (const rm of rows) {
      const cells = [...rm[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((x) => stripTags(x[1]!));
      if (cells.length < 3) continue;
      if (/^departure$/i.test(cells[0]!) || /^ship$/i.test(cells[3] ?? '')) continue;
      const dep = parseLocalTime(cells[0]!);
      const arr = parseLocalTime(cells[1]!);
      const days = parseDaySpec(cells[2]!);
      const shipRaw = (cells[3] ?? 'viking xprs').toLowerCase();
      if (!dep || !arr || !days) continue;
      if (!/xprs|viking/i.test(shipRaw) && cells[3]) {
        warnings.push(`Viking: nieznany statek „${cells[3]}” — pominięty.`);
        continue;
      }
      legs.push({
        days, route, depHm: dep.hm, arrHm: arr.hm, arrNextDay: arr.nextDay, tzDep, tzArr,
      });
    }
  }
  if (legs.length === 0) {
    warnings.push('Struktura rozkładu Viking zmieniona: brak tabel Departure/Arrival/Day.');
    return { sailings, warnings };
  }
  const fromYmd = opts?.fromYmd ?? ymdInTz(opts?.now ?? new Date(), 'Europe/Helsinki');
  const dates = dateRangeFromYmd(fromYmd, opts?.days ?? 14);
  for (const leg of legs) {
    for (const ymd of dates) {
      if (!leg.days.has(weekdayInTz(ymd, leg.tzDep))) continue;
      const departureUtc = localToUtc(ymd, leg.depHm, 0, leg.tzDep);
      let arrivalUtc = localToUtc(ymd, leg.arrHm, leg.arrNextDay ? 1 : 0, leg.tzArr);
      if (Date.parse(arrivalUtc) <= Date.parse(departureUtc)) {
        arrivalUtc = localToUtc(ymd, leg.arrHm, 1, leg.tzArr);
      }
      sailings.push({
        route: leg.route,
        vessel: 'M/F Viking XPRS',
        departureUtc,
        arrivalUtc,
      });
    }
  }
  if (sailings.length === 0) warnings.push('Viking: brak rejsów w odczycie.');
  return { sailings, warnings };
}
