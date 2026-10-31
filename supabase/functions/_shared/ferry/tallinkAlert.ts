/**
 * BN3 — Tallink Alert (tallink.com): bloki CMS `data-analytics-group="Alert"`.
 *
 * Decyzja 59: jawne odwołanie + jednoznaczne dopasowanie (pełna pula statek/trasa/okno;
 * data+HH:MM z treści, Europe/Tallinn, ±30 min) → ODWOLANY; inaczej FERRY MEDIUM.
 * F7 #683 B1–B4; R2-B2: >1 HH:MM lub >1 data w treści → niejednoznaczne.
 * R3-B1: ODWOLANY tylko przy dacie sparsowanej z treści; Scheduler = wyłącznie wygaśnięcie.
 * R4-B1: auto-ODWOLANY tylko gdy w tym samym zdaniu co cancel: statek + 1×HH:MM + 1×data;
 *   bez wskazówek względnych/nierozpoznanych w całej treści (updated/tomorrow/dni tygodnia…).
 * R5: auto-ODWOLANY wyłącznie przy ścisłym wzorcu zdania (allowlist) — bez may/buffet/trasy z innego zdania.
 * R6 / decyzja 68: cała treść = dokładnie jedno zdanie wzorcowe (+ opcjonalnie zdania z listy przeprosin);
 *   opcjonalny sufiks „due to (a )?(technical fault|…)”; każde inne zdanie → ryzyko MEDIUM.
 * R7: stripTags całego bloku Alert (nie tylko CwsP); fallback bez auto przy braku Schedulera;
 *   bez OPAQUE/CONDITIONAL (`may` ≠ May); statek/trasa tylko z wzorca.
 * R8: zbalansowany Scheduler (zagnieżdżony → bez auto); `^` we wzorcach 1–2;
 *   decyzja 70: atrybuty tekstowe / komentarze HTML / from X to X → ryzyko.
 * Decyzja 69: wpis AUTO w operator_notices tylko przy ODWOLANY; przy ryzyku historią jest samo ryzyko.
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

const MONTH_NAMES =
  'January|February|March|April|May|June|July|August|September|October|November|December';

const CANCEL_RE = /\b(cancel(?:led|ed)?|call(?:ed)?\s+off|will\s+not\s+(?:sail|operate|depart)|odwo[lł]an|anulowan|tühistatud|tühistamine)\b/i;
const SUSPEND_SAILING_RE = /\bsuspended\b/i;
const SAILING_CTX_RE = /\b(sailing|departure|departing|voyage|vessel|route|ferry|shuttle)\b/i;
const RESUME_RE = /\b(?:is\s+not\s+cancel|not\s+cancelled|not\s+canceled|resum(?:e|es|ed|ing)|returns?\s+to|back\s+in\s+service|operates\s+as\s+planned)\b/i;
const CAMPAIGN_RE = /type\s*=\s*"campaign"|voucherid=|lower fares|book now|price-tag|last chance for/i;
const SHIP_NAME_ALT = String.raw`MyStar|Megastar|Victoria\s+I|Baltic\s*Queen|Silja\s*Europa`;
const PORT_NAME_ALT = String.raw`Tallinn|Helsinki|Stockholm`;
const DATE_CAPTURE = String.raw`(\d{1,2})\s+(${MONTH_NAMES})(?:\s+(\d{4}))?`;
/** F7 #683 R6 / decyzja 68: jedyny dozwolony sufiks przed kropką (prawdziwy Alert 28.10). */
const DUE_TO_SUFFIX = String.raw`(?:\s+due\s+to\s+(?:a\s+)?(?:technical\s+fault|technical\s+reasons|weather\s+conditions|storm|strong\s+winds))?`;
/** F7 #683 R6: zamknięta lista zdań neutralnych (dokładne dopasowanie całego zdania). */
const NEUTRAL_APOLOGY_RE =
  /^We\s+apologi[sz]e\s+for\s+(?:any\s+|the\s+)inconvenience\.?$/i;

export type TallinkAlertKind = 'ODWOLANY' | 'INFO' | 'IGNORE';

export interface TallinkAlert {
  kind: TallinkAlertKind;
  text: string;
  vessel: string | null;
  multiVessel: boolean;
  /** F7 #683 R2-B2: >1 różna HH:MM lub >1 data w treści — albo R4/R5: brak autoCancelOk. */
  multiTime: boolean;
  /** F7 #683 R5: auto-ODWOLANY tylko przy ścisłym wzorcu zdania (allowlist). */
  autoCancelOk: boolean;
  routes: FerryRoute[];
  /** Okno Scheduler (wyświetlanie CMS) — tylko do odrzucania wygasłych (R3-B1). */
  windowStartYmd: string | null;
  windowEndYmd: string | null;
  /** Data z treści Alertu (B2/R3-B1/R4-B1) — wymagana do automatycznego ODWOLANY. */
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

/** F7 #683 R8 / decyzja 70: komentarze HTML przed jakimkolwiek dopasowaniem (także niezamknięte). */
function stripHtmlComments(s: string): string {
  return s.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<!--[\s\S]*$/g, ' ');
}

function stripTags(s: string): string {
  return stripHtmlComments(s)
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&#038;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

/**
 * F7 #683 R8 / decyzja 70: niepusty tekst (≥ 2 słowa) w atrybucie
 * title|text|alt|aria-label|label|caption|heading|subtitle|description → bez auto.
 */
const ATTR_TEXT_NAMES =
  'title|text|alt|aria-label|label|caption|heading|subtitle|description';

function hasSignificantAttrText(html: string): boolean {
  const re = new RegExp(
    String.raw`\b(?:${ATTR_TEXT_NAMES})\s*=\s*(?:"([^"]*)"|'([^']*)')`,
    'gi',
  );
  for (const m of html.matchAll(re)) {
    const val = (m[1] ?? m[2] ?? '').trim();
    if (val.split(/\s+/).filter(Boolean).length >= 2) return true;
  }
  return false;
}

/**
 * F7 #683 R8-B1: elementy `<Scheduler>` zbalansowanym licznikiem tagów
 * (leniwy `*?` kończy na wewnętrznym `</Scheduler>`).
 */
function extractBalancedSchedulers(
  html: string,
): Array<{ attrs: string; body: string; nestedOrUnbalanced: boolean }> {
  const out: Array<{ attrs: string; body: string; nestedOrUnbalanced: boolean }> = [];
  const openRe = /<Scheduler\b([^>]*)>/gi;
  let m: RegExpExecArray | null;
  while ((m = openRe.exec(html)) !== null) {
    const attrs = m[1] ?? '';
    const startBody = m.index + m[0].length;
    let depth = 1;
    let i = startBody;
    let nested = false;
    let closed = false;
    while (i < html.length && depth > 0) {
      const nextOpen = html.slice(i).search(/<Scheduler\b/i);
      const nextClose = html.slice(i).search(/<\/Scheduler\s*>/i);
      if (nextClose < 0) break;
      if (nextOpen >= 0 && nextOpen < nextClose) {
        nested = true;
        depth += 1;
        i += nextOpen + 1;
        continue;
      }
      depth -= 1;
      if (depth === 0) {
        const closeAt = i + nextClose;
        const closeLen = html.slice(closeAt).match(/^<\/Scheduler\s*>/i)![0].length;
        const body = html.slice(startBody, closeAt);
        const openCount = (body.match(/<Scheduler\b/gi) ?? []).length;
        const closeCount = (body.match(/<\/Scheduler\s*>/gi) ?? []).length;
        out.push({
          attrs,
          body,
          nestedOrUnbalanced: nested || openCount !== closeCount,
        });
        openRe.lastIndex = closeAt + closeLen;
        closed = true;
        break;
      }
      i += nextClose + 1;
    }
    if (!closed) {
      // Niezamknięty Scheduler — reszta jako body, bez auto.
      out.push({
        attrs,
        body: html.slice(startBody),
        nestedOrUnbalanced: true,
      });
      break;
    }
  }
  return out;
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

function uniqueHmIn(text: string): string[] {
  return [...new Set(
    [...text.matchAll(/\b(?:at\s+)?(\d{1,2}):(\d{2})\b/gi)].map(
      (m) => `${String(Number(m[1])).padStart(2, '0')}:${m[2]}`,
    ),
  )];
}

function countRecognizedDates(text: string, year: number): string[] {
  const ymds: string[] = [];
  const pushYmd = (dayRaw: string, monRaw: string, yearRaw: string | undefined) => {
    const day = String(Number(dayRaw)).padStart(2, '0');
    const mon = MONTH[monRaw.toLowerCase()]!;
    const y = yearRaw ?? String(year);
    const ymd = `${y}-${mon}-${day}`;
    if (!ymds.includes(ymd)) ymds.push(ymd);
  };
  for (const m of text.matchAll(
    new RegExp(`\\b(?:on|today,?)\\s+(\\d{1,2})\\s+(${MONTH_NAMES})(?:\\s+(\\d{4}))?\\b`, 'gi'),
  )) {
    pushYmd(m[1]!, m[2]!, m[3]);
  }
  for (const m of text.matchAll(
    new RegExp(`\\b(\\d{1,2})\\s+(${MONTH_NAMES})\\s+(\\d{4})\\b`, 'gi'),
  )) {
    pushYmd(m[1]!, m[2]!, m[3]);
  }
  return ymds;
}

/** F7 #683 R5: zdania tylko po .!? — dwukropek nie wycina prefiksu („Please note: …”). */
function alertSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export type AutoCancelFields = {
  startYmd: string;
  endYmd: string;
  hm: string;
  vessel: string;
  routes: FerryRoute[];
};

function mapShipAlias(raw: string): string | null {
  const n = raw.trim().toLowerCase().replace(/\s+/g, ' ');
  for (const a of SHIP_ALIASES) {
    if (a.re.test(n)) return a.vessel;
  }
  return null;
}

function ymdFromDateParts(dayRaw: string, monRaw: string, yearRaw: string | undefined, year: number): string {
  const day = String(Number(dayRaw)).padStart(2, '0');
  const mon = MONTH[monRaw.toLowerCase()]!;
  const y = yearRaw ?? String(year);
  return `${y}-${mon}-${day}`;
}

function routeFromPorts(aRaw: string, bRaw: string): FerryRoute | null {
  const a = PORT_CODE[aRaw.toLowerCase()];
  const b = PORT_CODE[bRaw.toLowerCase()];
  if (!a || !b || a === b) return null;
  return `${a}-${b}` as FerryRoute;
}

/**
 * F7 #683 R5/R6: zdanie pasuje w całości do ścisłego wzorca allowlist
 * (statek + HH:MM + from/to + data + is/has been cancelled [+ due to …]; bez dodatkowego tekstu).
 * Mutacja: poluzowanie (dowolny tekst przed/po) albo zdjęcie `$` po sufiksie → test pada.
 */
function matchStrictAutoCancelSentence(sent: string, year: number): AutoCancelFields | null {
  const s = sent.trim().replace(/\s+/g, ' ');
  const ship = SHIP_NAME_ALT;
  const port = PORT_NAME_ALT;
  const date = DATE_CAPTURE;
  // R6: opcjonalny due-to, potem kropka; `$` obowiązkowe (mutacja: bez `$` → test pada).
  const cancelTail = String.raw`(?:is|has been)\s+cancel(?:led|ed)${DUE_TO_SUFFIX}\.?`;
  const patterns: RegExp[] = [
    // The MyStar 16:30 departure from Tallinn to Helsinki on 2 November is cancelled.
    new RegExp(
      String.raw`^(?:The\s+)?(${ship})\s+(\d{1,2}):(\d{2})\s+(?:departure|sailing)\s+from\s+(${port})\s+to\s+(${port})\s+on\s+(?:today,?\s+)?${date}\s+${cancelTail}$`,
      'i',
    ),
    // The MyStar 16:30 departure on 2 November from Tallinn to Helsinki is cancelled.
    new RegExp(
      String.raw`^(?:The\s+)?(${ship})\s+(\d{1,2}):(\d{2})\s+(?:departure|sailing)\s+on\s+(?:today,?\s+)?${date}\s+from\s+(${port})\s+to\s+(${port})\s+${cancelTail}$`,
      'i',
    ),
    // today, 2 November, the MyStar 16:30 departure from Tallinn to Helsinki is cancelled.
    new RegExp(
      String.raw`^(?:today,?\s+)?${date},?\s+(?:the\s+)?(${ship})\s+(\d{1,2}):(\d{2})\s+(?:departure|sailing)\s+from\s+(${port})\s+to\s+(${port})\s+${cancelTail}$`,
      'i',
    ),
  ];
  for (let i = 0; i < patterns.length; i++) {
    const m = s.match(patterns[i]!);
    if (!m) continue;
    if (i === 0) {
      const vessel = mapShipAlias(m[1]!);
      const hm = `${String(Number(m[2])).padStart(2, '0')}:${m[3]}`;
      const route = routeFromPorts(m[4]!, m[5]!);
      const ymd = ymdFromDateParts(m[6]!, m[7]!, m[8], year);
      if (!vessel || !route) return null;
      return { startYmd: ymd, endYmd: ymd, hm, vessel, routes: [route] };
    }
    if (i === 1) {
      const vessel = mapShipAlias(m[1]!);
      const hm = `${String(Number(m[2])).padStart(2, '0')}:${m[3]}`;
      const ymd = ymdFromDateParts(m[4]!, m[5]!, m[6], year);
      const route = routeFromPorts(m[7]!, m[8]!);
      if (!vessel || !route) return null;
      return { startYmd: ymd, endYmd: ymd, hm, vessel, routes: [route] };
    }
    // i === 2: date first
    const ymd = ymdFromDateParts(m[1]!, m[2]!, m[3], year);
    const vessel = mapShipAlias(m[4]!);
    const hm = `${String(Number(m[5])).padStart(2, '0')}:${m[6]}`;
    const route = routeFromPorts(m[7]!, m[8]!);
    if (!vessel || !route) return null;
    return { startYmd: ymd, endYmd: ymd, hm, vessel, routes: [route] };
  }
  return null;
}

function isNeutralApologySentence(sent: string): boolean {
  return NEUTRAL_APOLOGY_RE.test(sent.trim().replace(/\s+/g, ' '));
}

/**
 * F7 #683 R5–R7 (decyzja 68): auto-ODWOLANY tylko gdy cała treść = jedno zdanie wzorcowe
 * (+ opcjonalnie zdania z listy przeprosin). R7-B3: bez OPAQUE/CONDITIONAL/RESUME —
 * reguła zdań pokrywa wyjątki; `\bmay\b` nie może łapać miesiąca May.
 */
export function autoCancelFromCancelSentence(
  text: string,
  year: number,
): AutoCancelFields | null {
  const hits: AutoCancelFields[] = [];
  for (const sent of alertSentences(text)) {
    const hit = matchStrictAutoCancelSentence(sent, year);
    if (hit) {
      hits.push(hit);
      continue;
    }
    // R6-B1 / R7-B3: każde inne zdanie (poza listą przeprosin) → ryzyko MEDIUM.
    // Mutacja: bez ^/$ w NEUTRAL_APOLOGY_RE albo bez `$` po DUE_TO → testy R7 padają.
    if (!isNeutralApologySentence(sent)) return null;
  }
  if (hits.length !== 1) return null;
  return hits[0]!;
}

/** Data i opcjonalna godzina z treści Alertu (B2). R2-B2: wiele HH:MM/dat → multiTime. */
export function parseAlertContentDates(
  text: string,
  year: number,
): { startYmd: string; endYmd: string; hm: string | null; multiTime: boolean } | null {
  const hmUnique = uniqueHmIn(text);
  const multiHm = hmUnique.length > 1;
  const hm = hmUnique.length === 1 ? hmUnique[0]! : null;

  const ymds = countRecognizedDates(text, year);
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
    /** R7-B2: fallback bez roku Schedulera — nigdy auto-ODWOLANY. */
    allowAutoCancel = true,
  ) => {
    const kind = classify(text, body);
    if (kind === 'IGNORE') return;
    const yearHint = Number(dateStart?.slice(0, 4) ?? yearNow);
    const content = parseAlertContentDates(text, yearHint);
    // R5/R7: pola match tylko z allowlist; fallback → zawsze ryzyko (brak roku).
    const auto = (allowAutoCancel && kind === 'ODWOLANY')
      ? autoCancelFromCancelSentence(text, yearHint)
      : null;
    const contentStart = auto?.startYmd ?? null;
    const contentEnd = auto?.endYmd ?? null;
    const contentHm = auto?.hm ?? null;
    const autoCancelOk = auto != null;
    const multiTime = !autoCancelOk && kind === 'ODWOLANY'
      ? true
      : (content?.multiTime ?? false);
    const endForExpiry = contentEnd || content?.endYmd || dateEnd;
    if (endForExpiry && endForExpiry < today) return;
    // R7-B3: statek/trasa do match wyłącznie z wzorca; przy ryzyku puste
    // (reguła zdań pokrywa multiVessel / trasę w osobnym zdaniu).
    alerts.push({
      kind,
      text: text.slice(0, 800),
      vessel: autoCancelOk ? auto!.vessel : null,
      multiVessel: false,
      multiTime,
      autoCancelOk,
      routes: autoCancelOk ? auto!.routes : [],
      windowStartYmd: dateStart,
      windowEndYmd: dateEnd,
      contentStartYmd: contentStart,
      contentEndYmd: contentEnd,
      contentHm,
      sourceUrl: pageUrl,
    });
  };

  const blocks = extractBalancedSchedulers(decoded);
  // R7-B2: licz bloki Alert (także wygasłe) — nie uruchamiaj fallbacku przy Schedulerze z zeszłego roku.
  let schedulerAlertBlocks = 0;
  for (const block of blocks) {
    const { attrs, body, nestedOrUnbalanced } = block;
    if (!/data-analytics-group\s*=\s*"Alert"/i.test(body)
      && !/data-analytics-group\s*=\s*"Alert"/i.test(attrs)
      && !/data-analytics-group="Alert"/i.test(body)) continue;
    if (!/data-analytics-group="Alert"/i.test(body)) continue;
    schedulerAlertBlocks += 1;
    const dateStart = attrs.match(/dateStart\s*=\s*"(\d{4}-\d{2}-\d{2})"/i)?.[1] ?? null;
    const dateEnd = attrs.match(/dateEnd\s*=\s*"(\d{4}-\d{2}-\d{2})"/i)?.[1] ?? null;
    // R8-B1: zagnieżdżony/niezbalansowany Scheduler → bez auto.
    // Decyzja 70: znaczący tekst w atrybutach → bez auto.
    const allowAuto = !nestedOrUnbalanced && !hasSignificantAttrText(body);
    // R7-B1 / decyzja 68: cała treść Alertu po zdjęciu tagów (CwsH3/List/Text/goły tekst).
    // R8 / decyzja 70: komentarze HTML usuwane w stripTags.
    const text = stripTags(body).trim();
    if (!text) continue;
    pushAlert(text, body, dateStart, dateEnd, allowAuto);
  }
  if (schedulerAlertBlocks === 0) {
    const loose = [...decoded.matchAll(/data-analytics-group="Alert"[\s\S]{0,2500}/gi)];
    for (const m of loose) {
      const chunk = m[0];
      const text = stripTags(chunk).trim();
      if (!text) continue;
      pushAlert(text, chunk, null, null, false);
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
  if (alert.multiVessel || alert.multiTime || !alert.autoCancelOk) {
    return { kind: 'ambiguous', candidates: [] };
  }
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
