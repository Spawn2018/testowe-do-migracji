/**
 * BN2 / #666 — DFDS Paldiski ↔ Kapellskär (PLD-KPS / KPS-PLD), M/F Sirena Seaways.
 *
 * Źródło główne: publiczny `/api/timetable` strony frachtowej („Dynamic schedule”).
 * Zapas: PDF sezonowy ze strony (link „Download seasonal schedule”), potem HTML
 * tabeli tygodniowej / stary PDF sidugraafik. User-Agent uczciwy.
 */
import { localToUtc, type FerryRoute } from './polferries.ts';
import {
  dateRangeFromYmd, parseDaySpec, parseLocalTime, stripTags, weekdayInTz, ymdInTz,
} from './weeklySchedule.ts';

export const DFDS_SCHEDULE_PAGE =
  'https://www.dfds.com/en/freight-ferries-and-logistics/routes-and-schedules/paldiski-kapellskar';
/** Publiczny endpoint Dynamic schedule (Next.js `/api/timetable`). */
export const DFDS_TIMETABLE_API = 'https://www.dfds.com/api/timetable';
/** Terminale frachtowe z Contentful (B2BTimetableSection). */
export const DFDS_TERMINAL_PLD = 'EEPLN';
export const DFDS_TERMINAL_KPS = 'SEKPS';
/** Publiczny PDF z godzinami (tekstowy sidugraafik EE — zapas, gdy brak linku ze strony). */
export const DFDS_WEEKLY_PDF_URL =
  'https://assets.ctfassets.net/z860498abl84/Gy4OYoQ6LuDjJU4BuGKun/f8fe25019414d460662df90e830c3ba6/Schedule_Paldiski_-_Kapellsk%C3%A4r.pdf';
export const DFDS_UA = 'Watch Tower (https://tower.log-mar.pl; ferry timetable)';
export const DFDS_ATTRIBUTION = 'Rozkład: DFDS Paldiski–Kapellskär';

const SHIP: Record<string, string> = {
  'sirena seaways': 'M/F Sirena Seaways',
  sirena: 'M/F Sirena Seaways',
};

const ROUTES = new Set<FerryRoute>(['PLD-KPS', 'KPS-PLD']);
const TERMINAL_ROUTE: Record<string, FerryRoute> = {
  [`${DFDS_TERMINAL_PLD}>${DFDS_TERMINAL_KPS}`]: 'PLD-KPS',
  [`${DFDS_TERMINAL_KPS}>${DFDS_TERMINAL_PLD}`]: 'KPS-PLD',
};

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

/** URL Dynamic schedule (tydzień + kierunek). */
export function dfdsTimetableUrl(opts: {
  portOfLoading: string;
  portOfDischarge: string;
  dateFromIso: string;
  dateToIso: string;
}): string {
  const q = new URLSearchParams({
    dateFrom: opts.dateFromIso,
    dateTo: opts.dateToIso,
    portOfLoading: opts.portOfLoading,
    portOfDischarge: opts.portOfDischarge,
  });
  return `${DFDS_TIMETABLE_API}?${q.toString()}`;
}

/** Okna tygodniowe (pon–niedz UTC) pokrywające horyzont od `now`. */
export function dfdsWeekWindows(now: Date, daysAhead: number): { dateFromIso: string; dateToIso: string }[] {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const dow = start.getUTCDay();
  const monday = new Date(start);
  monday.setUTCDate(monday.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  const horizon = new Date(start);
  horizon.setUTCDate(horizon.getUTCDate() + Math.max(0, daysAhead));
  const out: { dateFromIso: string; dateToIso: string }[] = [];
  for (let d = new Date(monday); d <= horizon; d.setUTCDate(d.getUTCDate() + 7)) {
    const from = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
    const to = new Date(from);
    to.setUTCDate(to.getUTCDate() + 6);
    to.setUTCHours(23, 59, 59, 999);
    out.push({ dateFromIso: from.toISOString(), dateToIso: to.toISOString() });
  }
  return out;
}

function normalizeVessel(name: string): string | null {
  const key = name.trim().toLowerCase();
  if (!key) return null;
  if (SHIP[key]) return SHIP[key]!;
  if (key.startsWith('m/f ')) return name.trim();
  return SHIP[key.replace(/^m\/f\s+/, '')] ?? null;
}

function isoToUtc(iso: string): string | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

/**
 * #666 — odpowiedź `/api/timetable` (tablica rejsów z terminalami EEPLN/SEKPS).
 */
export function parseDfdsTimetableApi(raw: unknown): DfdsParseResult {
  const warnings: string[] = [];
  const sailings: DfdsSailing[] = [];
  if (!Array.isArray(raw)) {
    warnings.push('Struktura rozkładu DFDS Dynamic zmieniona: oczekiwano tablicy.');
    return { sailings, warnings };
  }
  if (raw.length === 0) {
    warnings.push('DFDS Dynamic: brak rejsów w odczycie.');
    return { sailings, warnings };
  }
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i] as Record<string, unknown> | null;
    if (!row || typeof row !== 'object') {
      warnings.push(`DFDS Dynamic: nieczytelny rejs nr ${i + 1}.`);
      continue;
    }
    const load = String(row.portOfLoading ?? '').toUpperCase();
    const disc = String(row.portOfDischarge ?? '').toUpperCase();
    const route = TERMINAL_ROUTE[`${load}>${disc}`];
    if (!route) {
      warnings.push(`DFDS Dynamic: nieznana trasa ${load}→${disc} — pominięty.`);
      continue;
    }
    const vessel = normalizeVessel(String(row.vehicleName ?? ''));
    if (!vessel) {
      warnings.push(`DFDS Dynamic: nieznany statek „${row.vehicleName}” — pominięty.`);
      continue;
    }
    const departureUtc = isoToUtc(String(row.scheduledDeparture ?? ''));
    const arrivalUtc = isoToUtc(String(row.scheduledArrival ?? ''));
    if (!departureUtc || !arrivalUtc) {
      warnings.push(`DFDS Dynamic ${route}: nieczytelne godziny.`);
      continue;
    }
    sailings.push({ route, vessel, departureUtc, arrivalUtc });
  }
  if (sailings.length === 0 && warnings.length === 0) {
    warnings.push('DFDS Dynamic: brak rejsów w odczycie.');
  }
  return { sailings, warnings };
}

/** Link „Download seasonal schedule” ze strony frachtowej (PDF może się zmieniać). */
export function extractDfdsSeasonalPdfUrl(html: string): string | null {
  if (!html) return null;
  const m = html.match(/https:\/\/(?:assets|images)\.ctfassets\.net\/[^"'\\\s>]+\.pdf/i);
  if (!m) return null;
  const url = m[0]!.replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
  if (!/Paldiski|Kapellsk|Schedule/i.test(url)) return null;
  return url;
}

/** Bez duplikatów trasa + odjazd (pierwszeństwo pierwszego źródła). */
export function mergeDfdsSailings(primary: DfdsSailing[], secondary: DfdsSailing[]): DfdsSailing[] {
  const seen = new Set(primary.map((s) => `${s.route}|${s.departureUtc}`));
  const out = [...primary];
  for (const s of secondary) {
    const k = `${s.route}|${s.departureUtc}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
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
 * F7 #661 B1 — wyłącznie fixture testowy (nie używać w jobie przy HTTP 200).
 * Job bierze tylko faktycznie sparsowaną treść HTML/PDF.
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

/** Fixture: rozwiń DFDS_PUBLISHED_WEEKLY_HTML (tylko testy). */
export function parseDfdsPublishedWeekly(
  opts?: { fromYmd?: string; days?: number; now?: Date },
): DfdsParseResult {
  return parseDfdsWeeklyHtml(DFDS_PUBLISHED_WEEKLY_HTML, opts);
}
