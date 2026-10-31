/**
 * BN3 — Tallink Alert (tallink.com): bloki CMS `data-analytics-group="Alert"`.
 *
 * Decyzja 59 (właściciel): jawna treść odwołania + jednoznaczne dopasowanie rejsu
 * (statek + trasa/okno Scheduler) → ODWOLANY; inaczej ryzyko FERRY MEDIUM.
 * Kampanie (type=campaign / voucher) pomijane. User-Agent uczciwy; bez obchodzenia.
 */
import type { FerryRoute } from './polferries.ts';

export const TALLINK_HOME_URL = 'https://www.tallink.com/';
export const TALLINK_HEL_TLL_URL = 'https://www.tallink.com/en/helsinki-tallinn';
export const TALLINK_ALERT_UA = 'Watch Tower (https://tower.log-mar.pl; ferry timetable)';
export const TALLINK_ALERT_ATTRIBUTION = 'Komunikat: Tallink (tallink.com)';

const SHIP_ALIASES: Array<{ re: RegExp; vessel: string }> = [
  { re: /\bmystar\b/i, vessel: 'M/F MyStar' },
  { re: /\bmegastar\b/i, vessel: 'M/F Megastar' },
  { re: /\bvictoria\s*i?\b/i, vessel: 'M/F Victoria I' },
  { re: /\bbaltic\s*queen\b|\bqueen\b/i, vessel: 'M/F Baltic Queen' },
  { re: /\bsilja\s*europa\b/i, vessel: 'M/F Silja Europa' },
];

const ROUTE_ALIASES: Array<{ re: RegExp; routes: FerryRoute[] }> = [
  { re: /tallinn\s*[–\-—]\s*helsinki|helsinki\s*[–\-—]\s*tallinn|tal\s*[–\-—]\s*hel|hel\s*[–\-—]\s*tal/i, routes: ['TLL-HEL', 'HEL-TLL'] },
  { re: /tallinn\s*[–\-—]\s*stockholm|stockholm\s*[–\-—]\s*tallinn|tal\s*[–\-—]\s*sto|sto\s*[–\-—]\s*tal/i, routes: ['TLL-STO', 'STO-TLL'] },
];

const CANCEL_RE = /\b(cancel(?:led|ed)?|call(?:ed)?\s+off|will\s+not\s+(?:sail|operate|depart)|suspended|odwo[lł]an|anulowan|tühistatud|tühistamine)\b/i;
const CAMPAIGN_RE = /type\s*=\s*"campaign"|voucherid=|lower fares|book now|price-tag|last chance for/i;

export type TallinkAlertKind = 'ODWOLANY' | 'INFO' | 'IGNORE';

export interface TallinkAlert {
  kind: TallinkAlertKind;
  text: string;
  vessel: string | null;
  routes: FerryRoute[];
  /** Okno Scheduler (UTC midnight lokalne daty CMS — dzień kalendarzowy). */
  windowStartYmd: string | null;
  windowEndYmd: string | null;
  sourceUrl: string;
}

export interface TallinkAlertParseResult {
  alerts: TallinkAlert[];
  warnings: string[];
}

/** Odkoduj typowe escapes z JSON CMS osadzonego w HTML Next/WP. */
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

function vesselsIn(text: string): string | null {
  for (const a of SHIP_ALIASES) {
    if (a.re.test(text)) return a.vessel;
  }
  return null;
}

function routesIn(text: string): FerryRoute[] {
  const out = new Set<FerryRoute>();
  for (const a of ROUTE_ALIASES) {
    if (a.re.test(text)) for (const r of a.routes) out.add(r);
  }
  return [...out];
}

function classify(text: string, blockHtml: string): TallinkAlertKind {
  if (CAMPAIGN_RE.test(blockHtml) || CAMPAIGN_RE.test(text)) return 'IGNORE';
  if (CANCEL_RE.test(text)) return 'ODWOLANY';
  // Serwisowy komunikat (usterka / powrót na trasę) — bez statusu; ryzyko tylko przy ODWOLANY niejednoznacznym.
  if (/technical fault|resume operating|returns to the .+ route|service (?:update|disruption)/i.test(text)) {
    return 'INFO';
  }
  return 'INFO';
}

/**
 * Parser Alertów Tallink z HTML strony (również z escapowanym CMS JSON).
 * `pageUrl` — URL użyty do source_url / atrybucji.
 */
export function parseTallinkAlerts(html: string, pageUrl = TALLINK_HOME_URL): TallinkAlertParseResult {
  const warnings: string[] = [];
  if (!html || html.length < 40) {
    warnings.push('Tallink Alert: pusta odpowiedź HTML.');
    return { alerts: [], warnings };
  }
  const decoded = decodeTallinkCmsHtml(html);
  const alerts: TallinkAlert[] = [];
  // Scheduler otacza Alert — bierzemy okno dat + treść Alert.
  const blocks = [...decoded.matchAll(
    /<Scheduler\b([^>]*)>([\s\S]*?)<\/Scheduler>/gi,
  )];
  for (const m of blocks) {
    const attrs = m[1] ?? '';
    const body = m[2] ?? '';
    if (!/data-analytics-group\s*=\s*"Alert"/i.test(body) && !/data-analytics-group\s*=\s*"Alert"/i.test(attrs)) {
      // Alert bywa wewnątrz Scheduler
      if (!/data-analytics-group="Alert"/i.test(body)) continue;
    }
    if (!/data-analytics-group="Alert"/i.test(body)) continue;
    const dateStart = attrs.match(/dateStart\s*=\s*"(\d{4}-\d{2}-\d{2})"/i)?.[1] ?? null;
    const dateEnd = attrs.match(/dateEnd\s*=\s*"(\d{4}-\d{2}-\d{2})"/i)?.[1] ?? null;
    const paras = [...body.matchAll(/<CwsP\b[^>]*>([\s\S]*?)<\/CwsP>/gi)]
      .map((p) => stripTags(p[1] ?? ''))
      .filter(Boolean);
    const text = paras.join(' ').trim();
    if (!text) continue;
    const kind = classify(text, body);
    if (kind === 'IGNORE') continue;
    alerts.push({
      kind,
      text: text.slice(0, 800),
      vessel: vesselsIn(text),
      routes: routesIn(text),
      windowStartYmd: dateStart,
      windowEndYmd: dateEnd,
      sourceUrl: pageUrl,
    });
  }
  // Zapas: Alert bez Scheduler (rzadkie)
  if (alerts.length === 0) {
    const loose = [...decoded.matchAll(
      /data-analytics-group="Alert"[\s\S]{0,2500}/gi,
    )];
    for (const m of loose) {
      const chunk = m[0];
      const text = stripTags(
        [...chunk.matchAll(/<CwsP\b[^>]*>([\s\S]*?)<\/CwsP>/gi)]
          .map((p) => p[1] ?? '')
          .join(' '),
      );
      if (!text) continue;
      const kind = classify(text, chunk);
      if (kind === 'IGNORE') continue;
      alerts.push({
        kind,
        text: text.slice(0, 800),
        vessel: vesselsIn(text),
        routes: routesIn(text),
        windowStartYmd: null,
        windowEndYmd: null,
        sourceUrl: pageUrl,
      });
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

/** Czy odejście rejsu (UTC) wpada w okno YMD Scheduler (dzień kalendarzowy, bez strefy — jak CMS). */
export function departureInAlertWindow(
  departureIso: string,
  startYmd: string | null,
  endYmd: string | null,
): boolean {
  if (!startYmd && !endYmd) return true;
  const d = departureIso.slice(0, 10);
  if (startYmd && d < startYmd) return false;
  if (endYmd && d > endYmd) return false;
  return true;
}

/**
 * Jednoznaczne dopasowanie (decyzja 59): dokładnie jeden rejs.
 * Wymaga statku albo (trasa + okno); RECZNIE / już ODWOLANY pomijane.
 */
export function matchTallinkAlertSailings(
  alert: TallinkAlert,
  sailings: TallinkAlertMatchCandidate[],
): { match: TallinkAlertMatchCandidate | null; ambiguous: boolean; candidates: TallinkAlertMatchCandidate[] } {
  const cands = sailings.filter((s) => {
    if (s.status === 'ODWOLANY' || s.source === 'RECZNIE') return false;
    if (alert.vessel && s.vesselName !== alert.vessel) return false;
    if (alert.routes.length && !alert.routes.includes(s.route as FerryRoute)) return false;
    if (!departureInAlertWindow(s.departureAt, alert.windowStartYmd, alert.windowEndYmd)) return false;
    // Bez statku i bez trasy — za słabe do AUTO (tylko ryzyko).
    if (!alert.vessel && alert.routes.length === 0) return false;
    return true;
  });
  if (cands.length === 1) return { match: cands[0]!, ambiguous: false, candidates: cands };
  if (cands.length > 1) return { match: null, ambiguous: true, candidates: cands };
  return { match: null, ambiguous: false, candidates: cands };
}
