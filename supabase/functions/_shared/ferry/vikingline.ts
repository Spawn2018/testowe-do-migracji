/**
 * BN2 / #666 — rozkład Viking Line (TLLA-HEL / HELA-TLL, Terminal A / Katajanokka).
 *
 * LIVE (#666 A): strony Viking Line Cargo (HTML, robots: all) — źródło główne.
 * Zapas: sales.vikingline.com (Imperva 403 możliwy). SOURCE_DOWN tylko gdy oba zawiodą.
 * Parser JSON (fixture) zostaje dla testów znormalizowanych.
 */
import { localToUtc, type FerryRoute } from './polferries.ts';
import {
  addDaysYmd, dateRangeFromYmd, parseDaySpec, parseLocalTime, parseSeasonRanges, stripTags,
  weekdayInTz, ymdInRanges, ymdInTz, type YmdRange,
} from './weeklySchedule.ts';

/** Zapas — strona sprzedaży (często 403 Imperva). */
export const VIKING_SCHEDULE_PAGE =
  'https://www.sales.vikingline.com/timetable/helsinki-tallinn/';
/** #666 A — rozkład frachtowy HEL⇄TLL (źródło główne). */
export const VIKING_CARGO_HEL_TLL_PAGE =
  'https://www.vikingline.com/viking-line-cargo/routes-timetables/helsinki-tallinn/';
/**
 * #666 A — HEL–Mariehamn–STO. W katalogu nie ma trasy Viking HEL–STO —
 * pobieramy tylko gdy kiedyś wejdzie do FERRY_ROUTES (#640).
 */
export const VIKING_CARGO_HEL_STO_PAGE =
  'https://www.vikingline.com/viking-line-cargo/routes-timetables/helsinki-mariehamn-stockholm/';
export const VIKING_UA = 'Watch Tower (https://tower.log-mar.pl; ferry timetable)';
export const VIKING_ATTRIBUTION = 'Rozkład: Viking Line Cargo (vikingline.com)';

const SHIP: Record<string, string> = {
  'viking xprs': 'M/F Viking XPRS',
  xprs: 'M/F Viking XPRS',
  'viking cinderella/gabriella': 'M/F Viking Cinderella',
  'viking cinderella': 'M/F Viking Cinderella',
  cinderella: 'M/F Viking Cinderella',
  gabriella: 'M/F Gabriella',
  'm/s viking cinderella': 'M/F Viking Cinderella',
  'm/s gabriella': 'M/F Gabriella',
  'm/s viking xprs': 'M/F Viking XPRS',
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

function resolveShip(raw: string | undefined): string | null {
  const key = String(raw ?? 'viking xprs').trim().toLowerCase();
  if (SHIP[key]) return SHIP[key]!;
  if (key.startsWith('m/f ') || key.startsWith('m/s ')) {
    return key.replace(/^m\/s\s+/i, 'M/F ').replace(/^m\/f\s+/i, 'M/F ');
  }
  if (/xprs/i.test(key)) return 'M/F Viking XPRS';
  if (/cinderella/i.test(key)) return 'M/F Viking Cinderella';
  if (/gabriella/i.test(key)) return 'M/F Gabriella';
  if (/viking/i.test(key)) return `M/F ${String(raw).trim()}`;
  return null;
}

/** Godzina z tabeli Cargo: `*` = przypis (kabina / fracht), nie „dzień+1”. */
function parseCargoTime(raw: string): { hm: string; nextDay: boolean } | null {
  return parseLocalTime(raw.replace(/\*/g, ' '));
}

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
    const vessel = resolveShip(row.vessel);
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
  ranges: YmdRange[];
  vessel: string;
};

type PlannedLeg = {
  route: FerryRoute;
  depHm: string;
  arrHm: string;
};

type PlannedDay = {
  ymds: string[];
  legs: PlannedLeg[];
};

function routeFromLabel(text: string): FerryRoute | null {
  const t = text.toLowerCase().replace(/[–—]/g, '-');
  if (/tallinn\s*-?\s*helsinki/.test(t)) return 'TLLA-HEL';
  if (/helsinki\s*-?\s*tallinn/.test(t)) return 'HELA-TLL';
  return null;
}

/** F7 #668 r4: ostatnia etykieta trasy w kawałku (najbliższa tabeli) — nie pierwsza Tallinn–Helsinki w elemencie. */
function lastRouteFromLabel(text: string): FerryRoute | null {
  const t = text.toLowerCase().replace(/[–—]/g, '-');
  const hits: { i: number; r: FerryRoute }[] = [];
  for (const [re, r] of [
    [/tallinn\s*-?\s*helsinki/gi, 'TLLA-HEL' as FerryRoute],
    [/helsinki\s*-?\s*tallinn/gi, 'HELA-TLL' as FerryRoute],
  ] as const) {
    let m: RegExpExecArray | null;
    const copy = new RegExp(re.source, re.flags);
    while ((m = copy.exec(t)) != null) hits.push({ i: m.index, r });
  }
  if (hits.length === 0) return null;
  hits.sort((a, b) => a.i - b.i);
  return hits[hits.length - 1]!.r;
}

function lastDetailsChunk(before: string): string | null {
  const re = /<details\b[^>]*>/gi;
  let last = -1;
  let m: RegExpExecArray | null;
  while ((m = re.exec(before)) != null) last = m.index;
  return last >= 0 ? before.slice(last) : null;
}

function hmToMin(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function nearestVesselForRoute(
  legs: WeeklyLeg[],
  route: FerryRoute,
  depHm: string,
  ymd: string,
): string | null {
  const candidates = legs.filter((l) => l.route === route && ymdInRanges(ymd, l.ranges));
  if (candidates.length === 0) return null;
  const exact = candidates.find((l) => l.depHm === depHm);
  if (exact) return exact.vessel;
  const target = hmToMin(depHm);
  let best = candidates[0]!;
  let bestDiff = Infinity;
  for (const c of candidates) {
    const d = Math.abs(hmToMin(c.depHm) - target);
    if (d < bestDiff) {
      bestDiff = d;
      best = c;
    }
  }
  return best.vessel;
}

function exceptionRoutesForYmd(planned: PlannedDay[], ymd: string): Set<FerryRoute> {
  const out = new Set<FerryRoute>();
  for (const day of planned) {
    if (!day.ymds.includes(ymd)) continue;
    for (const leg of day.legs) out.add(leg.route);
  }
  return out;
}

function pad2(n: string): string {
  return n.padStart(2, '0');
}

/**
 * Wyjątki „Planned changes in timetable”: w te dni tylko godziny z wyjątku.
 * Daty bez roku biorą rok z kontekstu (Christmas 2026 / pełna data w bloku).
 * Nie mylić z godzinami „arrival at 23.10” — nagłówek dnia = data + „Timetable from”.
 */
export function parseVikingPlannedChanges(html: string, fallbackYear: number): PlannedDay[] {
  const text = stripTags(html).replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
  const idx = text.search(/Planned changes in timetable/i);
  if (idx < 0) return [];
  const chunk = text.slice(idx, idx + 8000);
  let yearHint = fallbackYear;
  const xmas = chunk.match(/Christmas\s+(\d{4})/i);
  if (xmas) yearHint = Number(xmas[1]);

  // Nagłówki dni zaczynają się od „… Timetable from Helsinki” (kierunek powrotny jest w tym samym bloku).
  // Dzięki temu „arrival at 23.10 Timetable from Tallinn” nie staje się osobnym dniem.
  const reHead =
    /(?<!\d)(\d{1,2}\.\d{1,2}(?:\.\d{4})?(?:\s*[–\-]\s*\d{1,2}\.\d{1,2}\.\d{4})?)\s*Timetable from Helsinki/gi;
  const heads: { start: number; dateRaw: string }[] = [];
  let hm: RegExpExecArray | null;
  while ((hm = reHead.exec(chunk)) != null) {
    heads.push({ start: hm.index, dateRaw: hm[1]!.replace(/\s+/g, '') });
  }
  const out: PlannedDay[] = [];
  for (let i = 0; i < heads.length; i++) {
    const head = heads[i]!;
    const end = i + 1 < heads.length ? heads[i + 1]!.start : chunk.length;
    const body = chunk.slice(head.start, end);
    const fullY = head.dateRaw.match(/\.(\d{4})(?:$|[^\d])/);
    if (fullY) yearHint = Number(fullY[1]);
    const ymds = expandPlannedDateToken(head.dateRaw, yearHint);
    if (!ymds.length) continue;
    const legs: PlannedLeg[] = [];
    const helPart = body.match(/Timetable from Helsinki to Tallinn:\s*([\s\S]*?)(?=Timetable from Tallinn|$)/i);
    const tllPart = body.match(
      /Timetable from Tallinn to Helsinki:\s*([\s\S]*?)(?=Timetable from Helsinki|\*\s*Sailing for|Related|Planned dockings|$)/i,
    );
    for (const [part, route] of [
      [helPart?.[1] ?? '', 'HELA-TLL' as FerryRoute],
      [tllPart?.[1] ?? '', 'TLLA-HEL' as FerryRoute],
    ] as const) {
      const pairs = [...part.matchAll(
        /Sailing at\s+(\d{1,2}[.:]\d{2})\*?\s*,?\s*arrival at\s+(\d{1,2}[.:]\d{2})/gi,
      )];
      for (const p of pairs) {
        const dep = parseCargoTime(p[1]!);
        const arr = parseCargoTime(p[2]!);
        if (!dep || !arr) continue;
        legs.push({ route, depHm: dep.hm, arrHm: arr.hm });
      }
    }
    if (legs.length) out.push({ ymds, legs });
  }
  return out;
}

function expandPlannedDateToken(raw: string, yearHint: number): string[] {
  const range = raw.match(
    /^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?\s*[–\-]\s*(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
  );
  if (range) {
    const y2 = Number(range[6]);
    const y1 = range[3] ? Number(range[3]) : y2;
    const from = `${y1}-${pad2(range[2]!)}-${pad2(range[1]!)}`;
    const to = `${y2}-${pad2(range[5]!)}-${pad2(range[4]!)}`;
    const out: string[] = [];
    for (let ymd = from; ymd <= to; ymd = addDaysYmd(ymd, 1)) out.push(ymd);
    return out;
  }
  const one = raw.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/);
  if (!one) return [];
  const y = one[3] ? Number(one[3]) : yearHint;
  return [`${y}-${pad2(one[2]!)}-${pad2(one[1]!)}`];
}

function pushUtcSailing(
  sailings: VikingSailing[],
  route: FerryRoute,
  vessel: string,
  ymd: string,
  depHm: string,
  arrHm: string,
  arrNextDay: boolean,
): void {
  const tzDep = route === 'HELA-TLL' ? 'Europe/Helsinki' : 'Europe/Tallinn';
  const tzArr = route === 'HELA-TLL' ? 'Europe/Tallinn' : 'Europe/Helsinki';
  const departureUtc = localToUtc(ymd, depHm, 0, tzDep);
  let arrivalUtc = localToUtc(ymd, arrHm, arrNextDay ? 1 : 0, tzArr);
  if (Date.parse(arrivalUtc) <= Date.parse(departureUtc)) {
    arrivalUtc = localToUtc(ymd, arrHm, 1, tzArr);
  }
  sailings.push({ route, vessel, departureUtc, arrivalUtc });
}

/**
 * HTML tabel sezonowych Viking (Cargo lub sales): Departure / Arrival / Day / Ship.
 * `data-route` albo etykieta Helsinki–Tallinn / Tallinn–Helsinki → HELA-TLL / TLLA-HEL.
 * #666 A: wyjątki „Planned changes” zastępują tydzień w te dni; `*` w godzinie = przypis.
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
    const idx = tm.index ?? 0;
    /* F7 #668 r3: sezon = ostatnie otwarcie c-accordion__item przed tabelą (nie pierwszy w prefiksie).
       Przy strukturze akordeonu bez seasonAll z wcześniejszych elementów. */
    const before = html.slice(0, idx);
    const itemOpenRe = /<(?:details|div)\b[^>]*\bc-accordion__item\b[^>]*>/gi;
    let lastOpenIdx = -1;
    let openM: RegExpExecArray | null;
    while ((openM = itemOpenRe.exec(before)) != null) lastOpenIdx = openM.index;
    const hasAccordion = lastOpenIdx >= 0;
    /* F7 #668 r4: zapas bez akordeonu = ostatnie <details> (nie pierwsze w prefiksie). */
    const accordionChunk = hasAccordion
      ? before.slice(lastOpenIdx)
      : lastDetailsChunk(before);
    const fromChunk = accordionChunk ? parseSeasonRanges(accordionChunk) : [];
    const picked = hasAccordion ? fromChunk : parseSeasonRanges(before);
    if (picked.length === 0) {
      warnings.push('Struktura rozkładu Viking zmieniona: tabela bez rozpoznanego sezonu — pominięta.');
      continue;
    }
    const ranges: YmdRange[] = [picked[picked.length - 1]!];
    /* F7 #668 r4: attrs → nagłówek tabeli → ostatnia etykieta w kawałku (nie pierwsza Tallinn–HEL). */
    let route: FerryRoute | null =
      routeFromLabel(attrs) ??
      routeFromLabel(body.slice(0, 240)) ??
      (accordionChunk ? lastRouteFromLabel(accordionChunk) : null);
    if (!route) {
      if (/data-route\s*=\s*["']helsinki-tallinn["']/i.test(attrs)) route = 'HELA-TLL';
      else if (/data-route\s*=\s*["']tallinn-helsinki["']/i.test(attrs)) route = 'TLLA-HEL';
      else {
        route = fallbackIdx % 2 === 0 ? 'HELA-TLL' : 'TLLA-HEL';
        fallbackIdx += 1;
      }
    } else {
      fallbackIdx += 1;
    }
    const tzDep = route === 'HELA-TLL' ? 'Europe/Helsinki' : 'Europe/Tallinn';
    const tzArr = route === 'HELA-TLL' ? 'Europe/Tallinn' : 'Europe/Helsinki';
    const rows = [...body.matchAll(/<tr[\s\S]*?<\/tr>/gi)];
    for (const rm of rows) {
      const cells = [...rm[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((x) => stripTags(x[1]!));
      if (cells.length < 3) continue;
      if (/^departure$/i.test(cells[0]!) || /^ship$/i.test(cells[3] ?? '')) continue;
      if (/helsinki|tallinn/i.test(cells[0]!) && cells.length === 1) continue;
      const dep = parseCargoTime(cells[0]!);
      const arr = parseCargoTime(cells[1]!);
      const days = parseDaySpec(cells[2]!);
      const vessel = resolveShip(cells[3] ?? 'viking xprs');
      if (!dep || !arr || !days) continue;
      if (!vessel) {
        if (cells[3]) warnings.push(`Viking: nieznany statek „${cells[3]}” — pominięty.`);
        continue;
      }
      legs.push({
        days, route, depHm: dep.hm, arrHm: arr.hm, arrNextDay: false, tzDep, tzArr, ranges, vessel,
      });
    }
  }
  if (legs.length === 0) {
    warnings.push('Struktura rozkładu Viking zmieniona: brak tabel Departure/Arrival/Day.');
    return { sailings, warnings };
  }
  const fromYmd = opts?.fromYmd ?? ymdInTz(opts?.now ?? new Date(), 'Europe/Helsinki');
  const yearHint = Number(fromYmd.slice(0, 4));
  const planned = parseVikingPlannedChanges(html, yearHint);
  const dates = dateRangeFromYmd(fromYmd, opts?.days ?? 14);
  for (const leg of legs) {
    for (const ymd of dates) {
      /* F7 #668 r4: wyjątek wycina tylko kierunek wymieniony w „Planned changes”, nie całą dobę. */
      if (exceptionRoutesForYmd(planned, ymd).has(leg.route)) continue;
      if (!ymdInRanges(ymd, leg.ranges)) continue;
      if (!leg.days.has(weekdayInTz(ymd, leg.tzDep))) continue;
      pushUtcSailing(sailings, leg.route, leg.vessel, ymd, leg.depHm, leg.arrHm, leg.arrNextDay);
    }
  }
  for (const day of planned) {
    for (const ymd of day.ymds) {
      if (!dates.includes(ymd)) continue;
      for (const leg of day.legs) {
        /* F7 #668 N6/r3 + r4: ta sama godzina; inaczej najbliższa godzina tej trasy; brak → ostrzeżenie. */
        const fromTable = nearestVesselForRoute(legs, leg.route, leg.depHm, ymd);
        if (!fromTable) {
          warnings.push(
            `Viking Planned changes: brak statku w tabeli sezonowej dla ${leg.route} ${leg.depHm} (${ymd}).`,
          );
          continue;
        }
        pushUtcSailing(sailings, leg.route, fromTable, ymd, leg.depHm, leg.arrHm, false);
      }
    }
  }
  if (sailings.length === 0) warnings.push('Viking: brak rejsów w odczycie.');
  return { sailings, warnings };
}
