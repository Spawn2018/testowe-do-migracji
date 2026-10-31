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
 * R8: zbalansowany Scheduler; `^` we wzorcach 1–2; decyzja 70 (czarna lista atrybutów) —
 *   zastąpiona decyzją 71.
 * R9 / decyzja 71: auto-ODWOLANY tylko przy dozwolonej strukturze HTML (allowlista tagów/
 *   atrybutów/encji; brak komentarzy/CDATA/PI); potem reguła zdań z decyzji 68.
 *   Dopisane do allowlisty względem F7 r9 (prawdziwy Alert 28.10 / fixture): `CwsSpan`,
 *   `timeStart`, `timeEnd`, `hideSpacing`.
 * R10: po usunięciu tagów brak surowego `<`/`>`; stos zamykających tagów; `-->` w regule 3;
 * Decyzja 72 (właściciel 31.10 14:58): spośród **wszystkich** niekampanijnych Alertów (po złączeniu
 *   stron) obowiązuje **najnowszy** (`dateStart`+`timeStart`, brak `timeStart`=00:00); bez grupowania
 *   po dniach okna (R12-B2). Starsze bez auto; remis / zła data / brak `dateStart` → ryzyko bez auto.
 *   72a: blok z datą+godziną późniejszą niż teraz nie bierze udziału w wyborze.
 *   72b: `data-analytics-group` w dowolnym cudzysłowie; kampania tylko `type="campaign"`; luźny Alert
 *   poza Schedulerem → brak auto dla wszystkich.
 *   72c: zdegradowany Alert zawsze podnosi ryzyko (nawet gdy inny wygrał auto).
 * F7 R12: atrybuty luźno (`["']…\1`); invalid_date przy złym formacie / braku dateStart / dateEnd<dateStart /
 *   zdublowanym atrybucie; dedupe po surowym `full` (R12-B3).
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
/** F7 #683 R12 / 72b: kampania tylko jawne `\btype=` na CwsAlert/Scheduler (nie data-type). */
const CAMPAIGN_TYPE_RE = /\btype\s*=\s*(["'])campaign\1/i;
const ALERT_GROUP_RE = /data-analytics-group\s*=\s*(["'])Alert\1/i;
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
  /** `timeStart` Schedulera (HH:MM); brak = 00:00 przy wyborze najnowszego (decyzja 72). */
  windowTimeStart: string | null;
  ordinal: number;
  isCampaign: boolean;
  /** F7 #683 R12 / 72b: luźny Alert poza Schedulerem → brak auto dla całej puli. */
  fromLoose: boolean;
  /** Surowy HTML bloku (dedupe HOME/HEL-TLL — R12-B3). */
  rawFull: string;
  filterReject: 'campaign' | 'empty' | 'expired' | 'invalid_date' | null;
  suppressedByNewer: boolean;
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

/**
 * F7 #683 R9 / decyzja 71 — dozwolone tagi (dokładna nazwa, wielkość liter bez znaczenia).
 * `CwsSpan` dopisane (prawdziwy Alert / fixture; F7 wymieniało `span`).
 */
const ALLOWED_ALERT_TAGS = new Set([
  'scheduler', 'cwssection', 'cwsp',
  'cwsh1', 'cwsh2', 'cwsh3', 'cwsh4', 'cwsh5', 'cwsh6',
  'br', 'strong', 'b', 'em', 'span', 'cwsspan',
]);

/**
 * F7 #683 R9 / decyzja 71 — dozwolone atrybuty.
 * `timeStart`/`timeEnd`/`hideSpacing` dopisane (prawdziwy Alert / fixture + wrapAlert).
 */
const ALLOWED_ALERT_ATTRS = new Set([
  'datestart', 'dateend', 'timestart', 'timeend',
  'data-analytics-group', 'class', 'classname',
  'weight', 'color', 'size', 'variant', 'hidespacing',
]);

const ALLOWED_ENTITY_RE =
  /^&(?:nbsp|#160|#xA0|amp|#39|rsquo|apos|quot);/i;

function decodeAllowedEntities(s: string): string {
  return s
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;|&apos;|&rsquo;/gi, "'")
    .replace(/&quot;/gi, '"');
}

function stripTags(s: string): string {
  // Komentarze tylko do treści ryzyka (bramka auto używa allowlisty surowej).
  return s
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<!--[\s\S]*$/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;|&#xA0;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * F7 #683 R9–R10 / decyzja 71: surowy HTML bloku Alert ma wyłącznie dozwoloną budowę.
 * R10-B1: po zdjęciu dopasowań tagów nie może zostać `<`/`>`.
 * R10-B2: stos tagów (zamykający = wierzchołek; bez atrybutów na close; `br` i `…/>` poza stosem).
 * Mutacje: dodanie tagu/atrybutu, zdjęcie reguły komentarzy/encji/stosu → testy padają.
 */
export function alertHtmlAllowsAutoCancel(rawHtml: string): boolean {
  // Reguła 3: komentarze / CDATA / PI / `-->` gdziekolwiek → brak auto (R10-B2: też `-->`).
  if (/<!--|-->|--!>|<!\[CDATA\[|<\?/i.test(rawHtml)) return false;

  // Reguła 4: tylko dozwolone encje.
  for (let i = 0; i < rawHtml.length; i++) {
    if (rawHtml[i] !== '&') continue;
    const m = rawHtml.slice(i).match(ALLOWED_ENTITY_RE);
    if (!m) return false;
    i += m[0].length - 1;
  }

  // Reguły 1–2: tagi i atrybuty + stos (R10-B2).
  const tagRe = /<\/?([a-zA-Z][\w-]*)\b([^>]*)\/?>/g;
  const matches = [...rawHtml.matchAll(tagRe)];
  // R10-B1: goły `<` / `>` (np. `<-`, `<1`, `<=`, `< CwsP`) → brak auto.
  if (/[<>]/.test(rawHtml.replace(tagRe, ''))) return false;

  let schedulerOpens = 0;
  const stack: string[] = [];
  for (const m of matches) {
    const name = m[1]!.toLowerCase();
    const isClose = m[0].startsWith('</');
    const selfClose = /\/>\s*$/.test(m[0]) || name === 'br';
    if (!ALLOWED_ALERT_TAGS.has(name)) return false;

    if (isClose) {
      // Zamykający bez atrybutów; musi pasować do wierzchołka stosu.
      if ((m[2] ?? '').trim() !== '') return false;
      if (stack.length === 0 || stack[stack.length - 1] !== name) return false;
      stack.pop();
      continue;
    }

    if (name === 'scheduler') schedulerOpens += 1;
    const attrChunk = m[2] ?? '';
    const attrRe =
      /([^\s="'<>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    for (const a of attrChunk.matchAll(attrRe)) {
      const an = a[1]!.toLowerCase();
      if (!ALLOWED_ALERT_ATTRS.has(an)) return false;
      const val = a[2] ?? a[3] ?? a[4];
      if (val != null && /[<>&]/.test(val)) return false;
    }
    if (!selfClose) stack.push(name);
  }
  if (stack.length !== 0) return false;
  // Dokładnie jeden zewnętrzny Scheduler (fallback bez Schedulera → brak auto).
  if (schedulerOpens !== 1) return false;
  return true;
}

/**
 * F7 #683 R8-B1 / R9: elementy `<Scheduler>` — pozycje z jednego `matchAll`, potem licznik.
 */
function extractBalancedSchedulers(
  html: string,
): Array<{ attrs: string; body: string; full: string }> {
  type Tok = { type: 'open' | 'close'; index: number; len: number; attrs: string };
  const tokens: Tok[] = [];
  for (const m of html.matchAll(/<\/?Scheduler\b([^>]*)>/gi)) {
    const isClose = /^<\s*\//.test(m[0]);
    tokens.push({
      type: isClose ? 'close' : 'open',
      index: m.index!,
      len: m[0].length,
      attrs: isClose ? '' : (m[1] ?? ''),
    });
  }
  const out: Array<{ attrs: string; body: string; full: string }> = [];
  let i = 0;
  while (i < tokens.length) {
    const open = tokens[i]!;
    if (open.type !== 'open') {
      i += 1;
      continue;
    }
    let depth = 1;
    let j = i + 1;
    let closed = false;
    while (j < tokens.length && depth > 0) {
      if (tokens[j]!.type === 'open') depth += 1;
      else depth -= 1;
      if (depth === 0) {
        const closeTok = tokens[j]!;
        const startBody = open.index + open.len;
        const body = html.slice(startBody, closeTok.index);
        const full = html.slice(open.index, closeTok.index + closeTok.len);
        out.push({ attrs: open.attrs, body, full });
        i = j + 1;
        closed = true;
        break;
      }
      j += 1;
    }
    if (!closed) {
      out.push({
        attrs: open.attrs,
        body: html.slice(open.index + open.len),
        full: html.slice(open.index),
      });
      break;
    }
  }
  return out;
}

function classify(text: string): TallinkAlertKind {
  if (RESUME_RE.test(text)) return 'INFO';
  if (SUSPEND_SAILING_RE.test(text)) {
    return SAILING_CTX_RE.test(text) ? 'ODWOLANY' : 'INFO';
  }
  if (CANCEL_RE.test(text)) return 'ODWOLANY';
  if (/technical fault|service (?:update|disruption)/i.test(text)) return 'INFO';
  return 'INFO';
}

export function isValidYmd(s: string | null | undefined): boolean {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const y = Number(s.slice(0, 4));
  const m = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function isStructuralCampaign(body: string, attrs: string): boolean {
  // 72b: tylko jawne `\btype=`, nie `data-type`.
  return CAMPAIGN_TYPE_RE.test(attrs)
    || /<CwsAlert\b[^>]*\btype\s*=\s*(["'])campaign\1/i.test(body)
    || /<Scheduler\b[^>]*\btype\s*=\s*(["'])campaign\1/i.test(body);
}

/** Luźny odczyt atrybutu w cudzysłowach `"`/`'`; wykrywa duplikaty (R12-B1). */
export function readQuotedAttr(
  attrs: string,
  name: string,
): { value: string | null; duplicate: boolean; present: boolean } {
  const re = new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, 'gi');
  const matches = [...attrs.matchAll(re)];
  if (matches.length === 0) return { value: null, duplicate: false, present: false };
  return {
    value: matches[0]![2] ?? null,
    duplicate: matches.length > 1,
    present: true,
  };
}

/** Czas Schedulera: ścisły `HH:MM` 00–23 (R12-B1). Brak atrybutu → null (traktuj jako 00:00). */
export function normalizeSchedulerHmStrict(
  raw: string | null,
  present: boolean,
): { hm: string | null; invalid: boolean } {
  if (!present) return { hm: null, invalid: false };
  if (!raw || !/^([01]\d|2[0-3]):[0-5]\d$/.test(raw.trim())) {
    return { hm: null, invalid: true };
  }
  return { hm: raw.trim(), invalid: false };
}

function tallinnPublishNowKey(now: Date): string {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Tallinn',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(now);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`;
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
  let ordinal = 0;

  const pushAlert = (
    text: string,
    body: string,
    attrs: string,
    rawFull: string,
    allowAutoCancel = true,
    fromLoose = false,
  ) => {
    const isCampaign = isStructuralCampaign(body, attrs);
    let filterReject: TallinkAlert['filterReject'] = isCampaign ? 'campaign' : null;

    const ds = readQuotedAttr(attrs, 'dateStart');
    const de = readQuotedAttr(attrs, 'dateEnd');
    const ts = readQuotedAttr(attrs, 'timeStart');
    const dateStart = ds.value;
    const dateEnd = de.value;
    const timeNorm = normalizeSchedulerHmStrict(ts.value, ts.present);

    // R12-B1: brak dateStart / zły format / duplikat / dateEnd<dateStart / zły timeStart.
    if (!fromLoose && !isCampaign) {
      if (!ds.present || !dateStart || !isValidYmd(dateStart)) {
        filterReject = filterReject ?? 'invalid_date';
      }
      if (de.present && (!dateEnd || !isValidYmd(dateEnd))) {
        filterReject = filterReject ?? 'invalid_date';
      }
      if (dateStart && isValidYmd(dateStart) && dateEnd && isValidYmd(dateEnd) && dateEnd < dateStart) {
        filterReject = filterReject ?? 'invalid_date';
      }
      if (ds.duplicate || de.duplicate || ts.duplicate || timeNorm.invalid) {
        filterReject = filterReject ?? 'invalid_date';
      }
    }
    if (fromLoose && !isCampaign) filterReject = filterReject ?? 'invalid_date';

    const startOk = !!(dateStart && isValidYmd(dateStart));
    const kind: TallinkAlertKind = isCampaign ? 'IGNORE' : classify(text);
    // Rok z okna Schedulera tylko gdy blisko teraz (R12-B2: 1000-01-01 nie może dać treści z roku 1000).
    const ys = startOk && dateStart ? Number(dateStart.slice(0, 4)) : yearNow;
    const yearHint = (ys >= yearNow - 1 && ys <= yearNow + 1) ? ys : yearNow;
    const content = text ? parseAlertContentDates(text, yearHint) : null;
    const auto = (allowAutoCancel && !filterReject && kind === 'ODWOLANY')
      ? autoCancelFromCancelSentence(text, yearHint)
      : null;
    let autoCancelOk = auto != null;
    const multiTime = !autoCancelOk && kind === 'ODWOLANY'
      ? true
      : (content?.multiTime ?? false);
    const endForExpiry = auto?.endYmd || content?.endYmd
      || (dateEnd && isValidYmd(dateEnd) ? dateEnd : null);
    if (!text) filterReject = filterReject ?? 'empty';
    if (endForExpiry && isValidYmd(endForExpiry) && endForExpiry < today) {
      filterReject = filterReject ?? 'expired';
    }
    if (filterReject) autoCancelOk = false;

    alerts.push({
      kind,
      text: text.slice(0, 800),
      vessel: autoCancelOk ? auto!.vessel : null,
      multiVessel: false,
      multiTime: filterReject && kind === 'ODWOLANY' ? true : multiTime,
      autoCancelOk,
      routes: autoCancelOk ? auto!.routes : [],
      windowStartYmd: dateStart,
      windowEndYmd: dateEnd,
      windowTimeStart: timeNorm.hm,
      ordinal: ordinal++,
      isCampaign,
      fromLoose,
      rawFull: rawFull.replace(/\s+/g, ' ').trim(),
      filterReject,
      suppressedByNewer: false,
      contentStartYmd: autoCancelOk ? (auto?.startYmd ?? null) : null,
      contentEndYmd: autoCancelOk ? (auto?.endYmd ?? null) : null,
      contentHm: autoCancelOk ? (auto?.hm ?? null) : null,
      sourceUrl: pageUrl,
    });
  };

  const blocks = extractBalancedSchedulers(decoded);
  let schedulerAlertBlocks = 0;
  for (const block of blocks) {
    const { attrs, body, full } = block;
    if (!ALERT_GROUP_RE.test(body) && !ALERT_GROUP_RE.test(attrs)) continue;
    schedulerAlertBlocks += 1;
    const allowAuto = alertHtmlAllowsAutoCancel(full);
    const text = stripTags(decodeAllowedEntities(body)).trim();
    pushAlert(text, body, attrs, full, allowAuto, false);
  }
  if (schedulerAlertBlocks === 0) {
    const loose = [...decoded.matchAll(/data-analytics-group\s*=\s*(["'])Alert\1[\s\S]{0,2500}/gi)];
    for (const m of loose) {
      const chunk = m[0]!;
      const text = stripTags(chunk).trim();
      pushAlert(text, chunk, '', chunk, false, true);
    }
  }

  // Wybór najnowszego po złączeniu stron — finalizeTallinkAlertsForStatus w jobs.ts.
  return { alerts, warnings };
}

/** Klucz chronologiczny: dateStart + timeStart (brak = 00:00). Zła data / kampania → null. */
export function alertPublishKey(a: TallinkAlert): string | null {
  if (a.isCampaign || a.filterReject === 'campaign') return null;
  if (a.filterReject === 'invalid_date') return null;
  if (!a.windowStartYmd || !isValidYmd(a.windowStartYmd)) return null;
  if (a.windowEndYmd && !isValidYmd(a.windowEndYmd)) return null;
  if (a.windowEndYmd && a.windowStartYmd && a.windowEndYmd < a.windowStartYmd) return null;
  return `${a.windowStartYmd}T${a.windowTimeStart ?? '00:00'}`;
}

/** Odduplikowanie: surowy HTML (R12-B3); przy kolizji `autoCancelOk = AND`. */
export function dedupeTallinkAlerts(alerts: TallinkAlert[]): TallinkAlert[] {
  const byFull = new Map<string, TallinkAlert>();
  for (const a of alerts) {
    const k = a.rawFull || `${a.windowStartYmd}|${a.windowEndYmd}|${a.windowTimeStart}|${a.text}`;
    const prev = byFull.get(k);
    if (!prev) {
      byFull.set(k, a);
      continue;
    }
    prev.autoCancelOk = prev.autoCancelOk && a.autoCancelOk;
    if (!prev.autoCancelOk) {
      prev.vessel = null;
      prev.routes = [];
      prev.contentStartYmd = null;
      prev.contentEndYmd = null;
      prev.contentHm = null;
      if (prev.kind === 'ODWOLANY') prev.multiTime = true;
    }
    if (a.filterReject && !prev.filterReject) prev.filterReject = a.filterReject;
  }
  return [...byFull.values()];
}

function demoteAlert(a: TallinkAlert): void {
  a.autoCancelOk = false;
  a.suppressedByNewer = true;
  a.vessel = null;
  a.routes = [];
  a.contentStartYmd = null;
  a.contentEndYmd = null;
  a.contentHm = null;
  if (a.kind === 'ODWOLANY') a.multiTime = true;
}

/**
 * F7 #683 R12 / decyzja 72: po złączeniu stron — najnowszy klucz globalnie (bez dni okna);
 * null klucz / remis / przyszły (72a) / trucizna luźna/kampania-serwisowa (72b) → bez auto.
 */
export function applyNewestAlertWins(alerts: TallinkAlert[], now: Date = new Date()): void {
  // 72b: luźny Alert albo kampania z treścią serwisową → brak auto dla wszystkich.
  const poison = alerts.some((a) => a.fromLoose)
    || alerts.some((a) => a.isCampaign && CANCEL_RE.test(a.text));
  if (poison) {
    for (const a of alerts) demoteAlert(a);
    return;
  }

  const nowKey = tallinnPublishNowKey(now);
  const nonCampaign: TallinkAlert[] = [];
  for (const a of alerts) {
    if (a.isCampaign || a.filterReject === 'campaign') continue;
    nonCampaign.push(a);
  }
  // 72a: blok z kluczem > teraz (jeszcze nieopublikowany) — poza wyborem, gdy istnieje
  // już opublikowany Alert; gdy są tylko przyszłe (wczesne ogłoszenie) — ranking wśród nich.
  const isFuture = (a: TallinkAlert): boolean => {
    const k = alertPublishKey(a);
    return k != null && k > nowKey;
  };
  const published = nonCampaign.filter((a) => !isFuture(a));
  const future = nonCampaign.filter((a) => isFuture(a));
  const pool = published.length > 0 ? published : future;
  if (published.length > 0) {
    for (const a of future) demoteAlert(a);
  }

  // R12-B1: jakikolwiek null klucz / filterReject → wszystkie bez auto (także length < 2).
  if (pool.some((a) => alertPublishKey(a) == null || a.filterReject)) {
    for (const a of pool) demoteAlert(a);
    return;
  }
  if (pool.length === 0) return;
  if (pool.length === 1) {
    // Pojedynczy z ważnym kluczem zostaje (o ile pushAlert nie zabił auto).
    return;
  }

  let bestKey = '';
  const winners: TallinkAlert[] = [];
  for (const a of pool) {
    const k = alertPublishKey(a)!;
    // Mutacja: k < bestKey (najstarszy) albo bez timeStart → testy padają.
    if (k > bestKey) {
      bestKey = k;
      winners.length = 0;
      winners.push(a);
    } else if (k === bestKey) {
      winners.push(a);
    }
  }
  if (winners.length !== 1) {
    for (const a of pool) demoteAlert(a);
    return;
  }
  const winner = winners[0]!;
  // Najnowszy niewzorcowy (Correction / zła allowlista) → bez ODWOLANY ze starszych.
  if (winner.kind !== 'ODWOLANY' || !winner.autoCancelOk || winner.filterReject) {
    for (const a of pool) demoteAlert(a);
    return;
  }
  for (const a of pool) {
    if (a !== winner) demoteAlert(a);
  }
}

/** Odduplikuj + wybierz najnowszy na połączonej puli (HOME + HEL-TLL). */
export function finalizeTallinkAlertsForStatus(
  alerts: TallinkAlert[],
  now: Date = new Date(),
): TallinkAlert[] {
  const deduped = dedupeTallinkAlerts(alerts);
  applyNewestAlertWins(deduped, now);
  return deduped;
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
