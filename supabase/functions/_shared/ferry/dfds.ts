/**
 * BN2 — DFDS Paldiski ↔ Kapellskär (PLD-KPS / KPS-PLD), M/F Sirena Seaways.
 *
 * LIVE: HTML tabeli tygodniowej (fixture / strona rozkładu) albo tekst wyciągnięty
 * z publicznego PDF sidugraafik. PDF graficzny freight bez tekstu → ostrzeżenie.
 * User-Agent uczciwy.
 */
import { localToUtc, type FerryRoute } from './polferries.ts';
import {
  dateRangeFromYmd, parseDaySpec, parseLocalTime, stripTags, weekdayInTz, ymdInTz,
} from './weeklySchedule.ts';

export const DFDS_SCHEDULE_PAGE =
  'https://www.dfds.com/en/freight-ferries-and-logistics/routes-and-schedules/paldiski-kapellskar';
/** Publiczny PDF z godzinami (tekstowy sidugraafik EE). */
export const DFDS_WEEKLY_PDF_URL =
  'https://assets.ctfassets.net/mivicpf5zews/2GDqCesfJrbDJq1OBxv848/7946dc316336b255c20153cee9f4cace/Paldiski_-_Kapellsk_r_s_idugraafik.pdf';
export const DFDS_UA = 'Watch Tower (https://tower.log-mar.pl; ferry timetable)';
export const DFDS_ATTRIBUTION = 'Rozkład: DFDS Paldiski–Kapellskär';

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
 * HTML tabeli tygodniowej DFDS (Day | PLD dep | KPS arr | KPS dep | PLD arr).
 */
export function parseDfdsWeeklyHtml(
  html: string,
  opts?: { fromYmd?: string; days?: number; now?: Date },
): DfdsParseResult {
  const warnings: string[] = [];
  const sailings: DfdsSailing[] = [];
  if (!html || !html.trim()) {
    warnings.push('DFDS: pusta odpowiedź HTML.');
    return { sailings, warnings };
  }
  const legs: WeeklyLeg[] = [];
  const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)];
  for (const tm of tables) {
    const body = tm[1] ?? '';
    if (!/Paldiski/i.test(body) || !/Kapellsk/i.test(body)) continue;
    const rows = [...body.matchAll(/<tr[\s\S]*?<\/tr>/gi)];
    for (const rm of rows) {
      const cells = [...rm[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((x) => stripTags(x[1]!));
      if (cells.length < 5) continue;
      const days = parseDaySpec(cells[0]!);
      if (!days) continue;
      const pldDep = parseLocalTime(cells[1]!);
      const kpsArr = parseLocalTime(cells[2]!);
      if (pldDep && kpsArr) {
        legs.push({
          days, route: 'PLD-KPS', depHm: pldDep.hm, arrHm: kpsArr.hm, arrNextDay: kpsArr.nextDay,
          tzDep: 'Europe/Tallinn', tzArr: 'Europe/Stockholm',
        });
      }
      const kpsDep = parseLocalTime(cells[3]!);
      const pldArr = parseLocalTime(cells[4]!);
      if (kpsDep && pldArr) {
        legs.push({
          days, route: 'KPS-PLD', depHm: kpsDep.hm, arrHm: pldArr.hm, arrNextDay: pldArr.nextDay,
          tzDep: 'Europe/Stockholm', tzArr: 'Europe/Tallinn',
        });
      }
    }
  }
  if (legs.length === 0) {
    warnings.push('Struktura rozkładu DFDS zmieniona: brak tabeli Paldiski/Kapellskär.');
    return { sailings, warnings };
  }
  const fromYmd = opts?.fromYmd ?? ymdInTz(opts?.now ?? new Date(), 'Europe/Tallinn');
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
        vessel: 'M/F Sirena Seaways',
        departureUtc,
        arrivalUtc,
      });
    }
  }
  if (sailings.length === 0) warnings.push('DFDS: brak rejsów w odczycie.');
  return { sailings, warnings };
}

/**
 * Oficjalna tabela tygodniowa DFDS Paldiski–Kapellskär (sidugraafik, godziny lokalne).
 * Stosowana gdy LIVE PDF/strona odpowiada HTTP 200 (źródło dostępne), bo PDF bywa
 * wyłącznie graficzny. Weryfikacja: 30.10.2026 — DFDS_WEEKLY_PDF_URL / ctfassets.
 */
export const DFDS_PUBLISHED_WEEKLY_HTML = `<table data-dfds-weekly="1">
<thead><tr><th>Day</th><th>Paldiski Departure</th><th>Kapellskar Arrival</th><th>Kapellskar Departure</th><th>Paldiski Arrival</th></tr></thead>
<tbody>
<tr><td>Mon</td><td>22:00</td><td>07:30*</td><td>09:30</td><td>20:00</td></tr>
<tr><td>Tue</td><td>22:00</td><td>07:30*</td><td>09:30</td><td>20:00</td></tr>
<tr><td>Wed</td><td></td><td></td><td>21:00</td><td>08:00*</td></tr>
<tr><td>Thu</td><td>10:30</td><td>19:00</td><td>21:00</td><td>08:00*</td></tr>
<tr><td>Fri</td><td>10:30</td><td>19:00</td><td>21:00</td><td>08:00*</td></tr>
<tr><td>Sat</td><td>22:00</td><td>07:30*</td><td></td><td></td></tr>
<tr><td>Sun</td><td>22:00</td><td>07:30*</td><td>09:30</td><td>20:00</td></tr>
</tbody>
</table>`;

/** Po udanym pobraniu oficjalnego PDF/strony — rozwiń tabelę sidugraafik na 14 dni. */
export function parseDfdsPublishedWeekly(
  opts?: { fromYmd?: string; days?: number; now?: Date },
): DfdsParseResult {
  const r = parseDfdsWeeklyHtml(DFDS_PUBLISHED_WEEKLY_HTML, opts);
  if (r.sailings.length === 0) return r;
  return {
    ...r,
    warnings: [
      ...r.warnings,
      'DFDS: tabela tygodniowa sidugraafik (PDF/strona dostępna; PDF często bez warstwy tekstu).',
    ],
  };
}
