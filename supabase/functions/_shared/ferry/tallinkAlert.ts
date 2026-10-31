/**
 * BN3 — Tallink Alert (tallink.com): bloki CMS `data-analytics-group="Alert"`.
 *
 * Decyzja 59: jawne odwołanie + jednoznaczne dopasowanie (pełna pula statek/trasa/okno;
 * data+HH:MM z treści, Europe/Tallinn, ±30 min) → ODWOLANY; inaczej FERRY MEDIUM.
 * F7 #683 B1–B4; R2-B2: >1 HH:MM lub >1 data w treści → niejednoznaczne.
 * R3-B1: ODWOLANY tylko przy dacie sparsowanej z treści; Scheduler = wyłącznie wygaśnięcie.
 * Kampanie pomijane. User-Agent uczciwy; bez obchodzenia.
 */
import type { FerryRoute } from './polferries.ts';

export const TALLINK_HOME_URL = 'https://www.tallink.com/';
/** DP-98: URL HEL–TLL bywa 404 — job nadal woła HOME+HEL; ostrzeżenie osobno w rejestrze. */
export const TALLINK_HEL_TLL_URL = 'https://www.tallink.com/en/helsinki-tallinn';
export const TALLINK_ALERT_UA = 'Watch Tower (https://tower.log-mar.pl; ferry timetable)';
export const TALLINK_ALERT_ATTRIBUTION = 'Komunikat: Tallink (tallink.com)';

const SHIP_ALIASES: Array<{ re: RegExp; vessel: string }> = [
  { re: /\bmystar\b/i, vessel: 'M/F MyStar' },
  { re: /\bmegastar\b/i, vessel: 'M/F Megastar' },
  { re: /\bvictoria\s+i\b/i, vessel: 'M/F Victoria I' },
  { re: /\bbaltic\s*queen\b/i, vessel: 'M/F Baltic Queen' },
  { re: /\bsilja\s*europa\b/i, vessel: 'M/F Silja Europa' },
];

const PORT_CODE: Record<string, string> = {
  tallinn: 'TLL', helsinki: 'HEL', stockholm: 'STO',
};

const MONTH: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

const CANCEL_RE = /\b(cancel(?:led|ed)?|call(?:ed)?\s+off|will\s+not\s+(?:sail|operate|depart)|odwo[lł]an|anulowan|tühistatud|tühistamine)\b/i;
const SUSPEND_SAILING_RE = /\bsuspended\b/i;
const SAILING_CTX_RE = /\b(sailing|departure|departing|voyage|vessel|route|ferry|shuttle)\b/i;
const RESUME_RE = /\b(?:is\s+not\s+cancel|not\s+cancelled|not\s+canceled|resum(?:e|es|ed|ing)|returns?\s+to|back\s+in\s+service|operates\s+as\s+planned)\b/i;
const CAMPAIGN_RE = /type\s*=\s*"campaign"|voucherid=|lower fares|book now|price-tag|last chance for/i;

export type TallinkAlertKind = 'ODWOLANY' | 'INFO' | 'IGNORE';

export interface TallinkAlert {
  kind: TallinkAlertKind;
  text: string;
  vessel: string | null;
  multiVessel: boolean;
  /** F7 #683 R2-B2: >1 różna HH:MM lub >1 data w treści. */
  multiTime: boolean;
  routes: FerryRoute[];
  /** Okno Scheduler (wyświetlanie CMS) — tylko do odrzucania wygasłych (R3-B1). */
  windowStartYmd: string | null;
  windowEndYmd: string | null;
  /** Data z treści Alertu (B2/R3-B1) — wymagana do automatycznego ODWOLANY. */
  contentStartYmd: string | null;
  contentEndYmd: string | null;
  /** Godzina lokalna Tallinn HH:MM z treści (±30 min). */
  contentHm: string | null;
  sourceUrl: string;
}

export interface TallinkAlertParseResult {
  alerts: TallinkAlert[];
  warnings: string[];
}

export function decodeTallinkCmsHtml(raw: string): string {
  return raw
    .replace(/\\u003c/gi, '<')
    .replace(/\\u003e/gi, '>')
    .replace(/\\u0026/gi, '&')
    .replace(/\\u0027/gi, "'")
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\//g, '/');
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&#038;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

function vesselsIn(text: string): { vessel: string | null; multi: boolean } {
  const found: string[] = [];
  for (const a of SHIP_ALIASES) {
    if (a.re.test(text) && !found.includes(a.vessel)) found.push(a.vessel);
  }
  if (found.length > 1) return { vessel: null, multi: true };
  if (found.length === 1) return { vessel: found[0]!, multi: false };
  return { vessel: null, multi: false };
}

function routesIn(text: string): FerryRoute[] {
  const fromTo = text.match(
    /\bfrom\s+(tallinn|helsinki|stockholm)\s+to\s+(tallinn|helsinki|stockholm)\b/i,
  );
  if (fromTo) {
    const a = PORT_CODE[fromTo[1]!.toLowerCase()];
    const b = PORT_CODE[fromTo[2]!.toLowerCase()];
    if (a && b && a !== b) return [`${a}-${b}` as FerryRoute];
  }
  const out = new Set<FerryRoute>();
  const dash: Array<{ re: RegExp; routes: FerryRoute[] }> = [
    { re: /tallinn\s*[–\-—]\s*helsinki|helsinki\s*[–\-—]\s*tallinn|tal\s*[–\-—]\s*hel|hel\s*[–\-—]\s*tal/i, routes: ['TLL-HEL', 'HEL-TLL'] },
    { re: /tallinn\s*[–\-—]\s*stockholm|stockholm\s*[–\-—]\s*tallinn|tal\s*[–\-—]\s*sto|sto\s*[–\-—]\s*tal/i, routes: ['TLL-STO', 'STO-TLL'] },
  ];
  for (const a of dash) {
    if (a.re.test(text)) for (const r of a.routes) out.add(r);
  }
  return [...out];
}

function classify(text: string, blockHtml: string): TallinkAlertKind {
  if (CAMPAIGN_RE.test(blockHtml) || CAMPAIGN_RE.test(text)) return 'IGNORE';
  if (RESUME_RE.test(text)) return 'INFO';
  if (SUSPEND_SAILING_RE.test(text)) {
    return SAILING_CTX_RE.test(text) ? 'ODWOLANY' : 'INFO';
  }
  if (CANCEL_RE.test(text)) return 'ODWOLANY';
  if (/technical fault|service (?:update|disruption)/i.test(text)) return 'INFO';
  return 'INFO';
}

function tallinnYmd(d: Date): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Tallinn', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g('year')}-${g('month')}-${g('day')}`;
}

export function tallinnYmdHm(departureIso: string): { ymd: string; hm: string } {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Tallinn',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(departureIso));
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return { ymd: `${g('year')}-${g('month')}-${g('day')}`, hm: `${g('hour')}:${g('minute')}` };
}

function hmToMin(hm: string): number {
  const [h, m] = hm.split(':').map((x) => Number(x));
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Data i opcjonalna godzina z treści Alertu (B2). R2-B2: wiele HH:MM/dat → multiTime. */
export function parseAlertContentDates(
  text: string,
  year: number,
): { startYmd: string; endYmd: string; hm: string | null; multiTime: boolean } | null {
  const hmAll = [...text.matchAll(/\b(?:at\s+)?(\d{1,2}):(\d{2})\b/gi)].map(
    (m) => `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`,
  );
  const hmUnique = [...new Set(hmAll)];
  const multiHm = hmUnique.length > 1;
  const hm = hmUnique.length === 1 ? hmUnique[0]! : null;

  const monthNames =
    'January|February|March|April|May|June|July|August|September|October|November|December';
  const ymds: string[] = [];
  const pushYmd = (dayRaw: string, monRaw: string, yearRaw: string | undefined) => {
    const day = String(Number(dayRaw)).padStart(2, '0');
    const mon = MONTH[monRaw.toLowerCase()]!;
    const y = yearRaw ?? String(year);
    const ymd = `${y}-${mon}-${day}`;
    if (!ymds.includes(ymd)) ymds.push(ymd);
  };
  for (const m of text.matchAll(
    new RegExp(`\\b(?:on|today,?)\\s+(\\d{1,2})\\s+(${monthNames})(?:\\s+(\\d{4}))?\\b`, 'gi'),
  )) {
    pushYmd(m[1]!, m[2]!, m[3]);
  }
  for (const m of text.matchAll(
    new RegExp(`\\b(\\d{1,2})\\s+(${monthNames})\\s+(\\d{4})\\b`, 'gi'),
  )) {
    pushYmd(m[1]!, m[2]!, m[3]);
  }
  const multiDate = ymds.length > 1;
  const multiTime = multiHm || multiDate;
  if (ymds.length === 0) {
    if (!hm && !multiTime) return null;
    return { startYmd: '', endYmd: '', hm: multiTime ? null : hm, multiTime };
  }
  const ymd = ymds[0]!;
  return {
    startYmd: multiTime ? '' : ymd,
    endYmd: multiTime ? '' : ymd,
    hm: multiTime ? null : hm,
    multiTime,
  };
}

/** Czy odejście pasuje do Alertu — Europe/Tallinn; tylko data z treści (R3-B1); ±30 min przy HH:MM. */
export function departureMatchesAlert(departureIso: string, alert: TallinkAlert): boolean {
  const { ymd, hm } = tallinnYmdHm(departureIso);
  // F7 #683 R3-B1: bez contentStartYmd → brak dopasowania (nie używaj okna Schedulera).
  const start = alert.contentStartYmd;
  const end = alert.contentEndYmd;
  if (!start) return false;
  if (ymd < start) return false;
  if (end && ymd > end) return false;
  if (alert.contentHm) {
    if (Math.abs(hmToMin(hm) - hmToMin(alert.contentHm)) > 30) return false;
  }
  return true;
}

export function parseTallinkAlerts(
  html: string,
  pageUrl = TALLINK_HOME_URL,
  now: Date = new Date(),
): TallinkAlertParseResult {
  const warnings: string[] = [];
  if (!html || html.length < 40) {
    warnings.push('Tallink Alert: pusta odpowiedź HTML.');
    return { alerts: [], warnings };
  }
  const decoded = decodeTallinkCmsHtml(html);
  const today = tallinnYmd(now);
  const yearNow = Number(today.slice(0, 4));
  const alerts: TallinkAlert[] = [];

  const pushAlert = (
    text: string,
    body: string,
    dateStart: string | null,
    dateEnd: string | null,
  ) => {
    const kind = classify(text, body);
    if (kind === 'IGNORE') return;
    const content = parseAlertContentDates(text, Number(dateStart?.slice(0, 4) ?? yearNow));
    const contentStart = content?.startYmd || null;
    const contentEnd = content?.endYmd || null;
    const endForExpiry = contentEnd || dateEnd;
    if (endForExpiry && endForExpiry < today) return;
    const ships = vesselsIn(text);
    alerts.push({
      kind,
      text: text.slice(0, 800),
      vessel: ships.vessel,
      multiVessel: ships.multi,
      multiTime: content?.multiTime ?? false,
      routes: routesIn(text),
      windowStartYmd: dateStart,
      windowEndYmd: dateEnd,
      contentStartYmd: contentStart,
      contentEndYmd: contentEnd,
      contentHm: content?.hm ?? null,
      sourceUrl: pageUrl,
    });
  };

  const blocks = [...decoded.matchAll(
    /<Scheduler\b([^>]*)>([\s\S]*?)<\/Scheduler>/gi,
  )];
  for (const m of blocks) {
    const attrs = m[1] ?? '';
    const body = m[2] ?? '';
    if (!/data-analytics-group\s*=\s*"Alert"/i.test(body)
      && !/data-analytics-group\s*=\s*"Alert"/i.test(attrs)
      && !/data-analytics-group="Alert"/i.test(body)) continue;
    if (!/data-analytics-group="Alert"/i.test(body)) continue;
    const dateStart = attrs.match(/dateStart\s*=\s*"(\d{4}-\d{2}-\d{2})"/i)?.[1] ?? null;
    const dateEnd = attrs.match(/dateEnd\s*=\s*"(\d{4}-\d{2}-\d{2})"/i)?.[1] ?? null;
    const paras = [...body.matchAll(/<CwsP\b[^>]*>([\s\S]*?)<\/CwsP>/gi)]
      .map((p) => stripTags(p[1] ?? ''))
      .filter(Boolean);
    const text = paras.join(' ').trim();
    if (!text) continue;
    pushAlert(text, body, dateStart, dateEnd);
  }
  if (alerts.length === 0) {
    const loose = [...decoded.matchAll(/data-analytics-group="Alert"[\s\S]{0,2500}/gi)];
    for (const m of loose) {
      const chunk = m[0];
      const text = stripTags(
        [...chunk.matchAll(/<CwsP\b[^>]*>([\s\S]*?)<\/CwsP>/gi)]
          .map((p) => p[1] ?? '')
          .join(' '),
      );
      if (!text) continue;
      pushAlert(text, chunk, null, null);
    }
  }
  return { alerts, warnings };
}

export interface TallinkAlertMatchCandidate {
  id: string;
  vesselName: string;
  route: string;
  departureAt: string;
  status: string;
  source: string;
}

export type TallinkAlertMatch =
  | { kind: 'match'; sailing: TallinkAlertMatchCandidate }
  | { kind: 'already_cancelled'; sailing: TallinkAlertMatchCandidate }
  | { kind: 'manual_only'; sailing: TallinkAlertMatchCandidate }
  | { kind: 'ambiguous'; candidates: TallinkAlertMatchCandidate[] }
  | { kind: 'beyond_horizon' }
  | { kind: 'none' };

/**
 * Jednoznaczność na pełnej puli (B1). ODWOLANY/RECZNIE liczą się do puli.
 */
export function matchTallinkAlertSailings(
  alert: TallinkAlert,
  sailings: TallinkAlertMatchCandidate[],
): TallinkAlertMatch {
  if (alert.multiVessel || alert.multiTime) return { kind: 'ambiguous', candidates: [] };
  // F7 #683 R3-B1: bez daty w treści → ryzyko MEDIUM (nie dopasowuj do daty okna Schedulera).
  if (!alert.contentStartYmd) return { kind: 'ambiguous', candidates: [] };

  const start = alert.contentStartYmd;
  if (alert.vessel) {
    const vesselSails = sailings.filter((s) => s.vesselName === alert.vessel);
    if (vesselSails.length > 0) {
      const lastMs = Math.max(...vesselSails.map((s) => Date.parse(s.departureAt)));
      const lastYmd = tallinnYmdHm(new Date(lastMs).toISOString()).ymd;
      if (start > lastYmd) return { kind: 'beyond_horizon' };
    }
  }

  const pool = sailings.filter((s) => {
    if (alert.vessel && s.vesselName !== alert.vessel) return false;
    if (alert.routes.length && !alert.routes.includes(s.route as FerryRoute)) return false;
    if (!departureMatchesAlert(s.departureAt, alert)) return false;
    if (!alert.vessel && alert.routes.length === 0) return false;
    return true;
  });

  if (pool.length === 0) return { kind: 'none' };
  if (pool.length > 1) return { kind: 'ambiguous', candidates: pool };
  const only = pool[0]!;
  if (only.status === 'ODWOLANY') return { kind: 'already_cancelled', sailing: only };
  if (only.source === 'RECZNIE') return { kind: 'manual_only', sailing: only };
  return { kind: 'match', sailing: only };
}
