/**
 * H-1 — kontrola trasy HERE (Routing v8, transportMode=truck).
 * Wyłączona, dopóki security_flags.H1_ROUTE_CHECK jest false (D-83).
 * Brak wymiarów zestawu nie jest uzupełniany. Wymiary przykładowe z H-0
 * nie występują w tej ścieżce.
 * Komunikat administracyjny województwa to „wymaga zezwolenia”, nie przeszkoda.
 * Ryzyko tylko dla konkretnego wiaduktu, mostu albo tunelu, z miejscem.
 * Myto (D-82) nie jest proszone ani pokazywane.
 */
import {
  HERE_BILLING_DEFAULTS,
  budgetLevel as billingLevel,
  marginalOverCost,
  routingAllows,
  type HereBillingParams,
} from './billing.ts';

/** @deprecated stawki w app_parameters (D-78); zostaje alias budżetu do odczytu. */
export const HERE_BUDGET_USD = HERE_BILLING_DEFAULTS.budgetUsd;
export const HERE_RAW_DAYS = 30;
const RECHECK_MS = HERE_RAW_DAYS * 24 * 60 * 60 * 1000;

export const CORRIDOR = {
  srem: [52.07391, 17.0246] as const,
  gdansk: [54.40372, 18.6813] as const,
  nynashamn: [58.90453, 17.95621] as const,
  gdynia: [54.53321, 18.54425] as const,
  karlskrona: [56.1646, 15.6308] as const,
  boden: [65.80539, 21.75914] as const,
};

const VOIVODESHIP: Record<string, string> = {
  '02': 'dolnośląskie',
  '04': 'kujawsko-pomorskie',
  '06': 'lubelskie',
  '08': 'lubuskie',
  '10': 'łódzkie',
  '12': 'małopolskie',
  '14': 'mazowieckie',
  '16': 'opolskie',
  '18': 'podkarpackie',
  '20': 'podlaskie',
  '22': 'pomorskie',
  '24': 'śląskie',
  '26': 'świętokrzyskie',
  '28': 'warmińsko-mazurskie',
  '30': 'wielkopolskie',
  '32': 'zachodniopomorskie',
};

export interface SetDims {
  heightM: number | null;
  widthM: number | null;
  lengthM: number | null;
  weightT: number | null;
  axleCount: number | null;
  axleLoadT: number | null;
}

export interface CompleteDims {
  heightM: number;
  widthM: number;
  lengthM: number;
  weightT: number;
  axleCount: number;
  axleLoadT: number;
}

export function numOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/** null, gdy brakuje któregokolwiek wymiaru. Nigdy nie wstawia wartości zastępczej. */
export function completeDims(d: SetDims): CompleteDims | null {
  const heightM = numOrNull(d.heightM);
  const widthM = numOrNull(d.widthM);
  const lengthM = numOrNull(d.lengthM);
  const weightT = numOrNull(d.weightT);
  const axleCount = numOrNull(d.axleCount);
  const axleLoadT = numOrNull(d.axleLoadT);
  if (heightM == null || widthM == null || lengthM == null || weightT == null || axleCount == null || axleLoadT == null) {
    return null;
  }
  if (heightM <= 0 || widthM <= 0 || lengthM <= 0 || weightT <= 0 || axleCount <= 0 || axleLoadT <= 0) return null;
  return { heightM, widthM, lengthM, weightT, axleCount, axleLoadT };
}

export function dimsKey(d: CompleteDims): string {
  return [d.heightM, d.widthM, d.lengthM, d.weightT, d.axleCount, d.axleLoadT].join('|');
}

export type LegName = 'PL' | 'SE';
export interface Leg {
  leg: LegName;
  origin: readonly [number, number];
  destination: readonly [number, number];
}

export function legsForRoute(route: string | null | undefined): Leg[] | null {
  if (route === 'GDN-NYN' || route === 'NYN-GDN') {
    return [
      { leg: 'PL', origin: CORRIDOR.srem, destination: CORRIDOR.gdansk },
      { leg: 'SE', origin: CORRIDOR.nynashamn, destination: CORRIDOR.boden },
    ];
  }
  if (route === 'GDY-KAA' || route === 'KAA-GDY') {
    return [
      { leg: 'PL', origin: CORRIDOR.srem, destination: CORRIDOR.gdynia },
      { leg: 'SE', origin: CORRIDOR.karlskrona, destination: CORRIDOR.boden },
    ];
  }
  return null;
}

export function needsRecheck(
  prev: { checkedAt: string; dimsKey: string } | null,
  now: Date,
  key: string,
): boolean {
  if (!prev) return true;
  if (prev.dimsKey !== key) return true;
  const at = Date.parse(prev.checkedAt);
  if (!Number.isFinite(at)) return true;
  return now.getTime() - at >= RECHECK_MS;
}

export function budgetAllows(
  spentUsd: number,
  moreTx: number,
  p: HereBillingParams = HERE_BILLING_DEFAULTS,
  currentRouteRequests = 0,
): boolean {
  if (moreTx <= 0) return spentUsd < p.budgetUsd;
  return routingAllows(spentUsd, 'routing', currentRouteRequests, moreTx, p);
}

export function budgetLevel(
  spentUsd: number,
  enabled: boolean,
  budgetUsd = HERE_BILLING_DEFAULTS.budgetUsd,
): 'off' | 'ok' | 'warn' | 'high' | 'stop' {
  return billingLevel(spentUsd, enabled, budgetUsd);
}

export interface PermitNote {
  kind: 'zezwolenie';
  area: string;
  stateCode: string | null;
  limitText: string;
  setText: string;
}

export interface Obstacle {
  kind: 'wiadukt' | 'most' | 'tunel';
  place: string;
  lat: number | null;
  lng: number | null;
  limitText: string;
  setText: string;
  critical: boolean;
}

export interface Classified {
  permits: PermitNote[];
  obstacles: Obstacle[];
  bk: string[];
}

interface NoticeDetail {
  type?: string;
  maxHeight?: number;
  maxWidth?: number;
  maxLength?: number;
  maxGrossWeight?: number;
  maxWeightPerAxle?: number;
}

interface Notice {
  code?: string;
  severity?: string;
  details?: NoticeDetail[];
}

interface Span {
  offset?: number;
  notices?: number[];
  names?: Array<{ value?: string }>;
  countryCode?: string;
  stateCode?: string;
  streetAttributes?: string[];
  attributes?: string[];
  truckAttributes?: string[];
}

function cm(m: number): number {
  return Math.round(m * 100);
}

function limitAndSet(detail: NoticeDetail | undefined, dims: CompleteDims): { limitText: string; setText: string } | null {
  if (!detail) return null;
  if (detail.maxHeight != null) return { limitText: `${detail.maxHeight} cm wysokości`, setText: `${cm(dims.heightM)} cm` };
  if (detail.maxWidth != null) return { limitText: `${detail.maxWidth} cm szerokości`, setText: `${cm(dims.widthM)} cm` };
  if (detail.maxLength != null) return { limitText: `${detail.maxLength} cm długości`, setText: `${cm(dims.lengthM)} cm` };
  if (detail.maxGrossWeight != null) {
    const t = Math.round((detail.maxGrossWeight / 1000) * 10) / 10;
    return { limitText: `${t} t masy`, setText: `${dims.weightT} t` };
  }
  if (detail.maxWeightPerAxle != null) {
    const t = Math.round((detail.maxWeightPerAxle / 1000) * 10) / 10;
    return { limitText: `${t} t na oś`, setText: `${dims.axleLoadT} t` };
  }
  return null;
}

function isAdminNotice(n: Notice): boolean {
  const code = (n.code ?? '').toLowerCase();
  if (code === 'violatedadminwidevehiclerestriction') return true;
  return (n.details ?? []).some((d) => (d.type ?? '').toLowerCase() === 'adminwiderestriction');
}

function spanAttrs(span: Span): string[] {
  return [...(span.streetAttributes ?? []), ...(span.attributes ?? []), ...(span.truckAttributes ?? [])]
    .map((x) => String(x).toLowerCase());
}

function spanName(span: Span): string {
  return (span.names ?? []).map((n) => n.value ?? '').filter(Boolean).join(' ').trim();
}

function structureKind(span: Span): Obstacle['kind'] | null {
  const name = spanName(span).toLowerCase();
  const attrs = spanAttrs(span);
  if (/wiadukt|viaduct/.test(name)) return 'wiadukt';
  if (attrs.includes('tunnel') || /tunel|tunnel/.test(name)) return 'tunel';
  if (attrs.includes('bridge') || /\bmost\b|\bbridge\b|\bbro\b/.test(name)) return 'most';
  return null;
}

const DEC = [
  62, -1, -1, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, -1, -1, -1, -1, -1, -1, -1,
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
  22, 23, 24, 25, -1, -1, -1, -1, 63, -1, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35,
  36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51,
];

function decodeChar(ch: string): number {
  const v = DEC[ch.charCodeAt(0) - 45];
  if (v == null || v < 0) throw new Error('zla polilinia');
  return v;
}

function toSigned(value: number): number {
  let v = value;
  if (v & 1) v = ~v;
  return v >> 1;
}

/** Dekoder flexible polyline (HERE, MIT). Zwraca [lat, lng]. */
export function decodeFlexiblePolyline(encoded: string): Array<[number, number]> {
  const values: number[] = [];
  let result = 0;
  let shift = 0;
  for (const ch of encoded) {
    const value = decodeChar(ch);
    result |= (value & 0x1f) << shift;
    if ((value & 0x20) === 0) {
      values.push(result);
      result = 0;
      shift = 0;
    } else shift += 5;
  }
  if (shift > 0 || values.length < 2) throw new Error('zla polilinia');
  const version = values[0];
  if (version !== 1) throw new Error('zla polilinia');
  let header = values[1];
  const precision = header & 15;
  header >>= 4;
  const third = header & 7;
  const factor = 10 ** precision;
  const out: Array<[number, number]> = [];
  let lat = 0;
  let lng = 0;
  const step = third ? 3 : 2;
  for (let i = 2; i + 1 < values.length; i += step) {
    lat += toSigned(values[i]);
    lng += toSigned(values[i + 1]);
    out.push([lat / factor, lng / factor]);
  }
  return out;
}

function pointAt(polyline: string | undefined, offset: number | undefined): { lat: number; lng: number } | null {
  if (!polyline || offset == null || offset < 0) return null;
  try {
    const pts = decodeFlexiblePolyline(polyline);
    const p = pts[offset];
    if (!p) return null;
    return { lat: p[0], lng: p[1] };
  } catch {
    return null;
  }
}

function voivodeship(code: string | undefined): string {
  if (!code) return 'ogólny limit administracyjny';
  const name = VOIVODESHIP[code];
  return name ? `województwo ${name}` : `województwo ${code}`;
}

export function classifySection(
  section: { notices?: Notice[]; spans?: Span[]; polyline?: string },
  dims: CompleteDims,
): Classified {
  const notices = section.notices ?? [];
  const spans = section.spans ?? [];
  const permits: PermitNote[] = [];
  const obstacles: Obstacle[] = [];
  const bk = new Set<string>();
  for (const span of spans) {
    for (const a of spanAttrs(span)) {
      const m = a.toUpperCase().match(/\bBK[1-4]\b/);
      if (m) bk.add(m[0]);
    }
  }
  notices.forEach((notice, idx) => {
    const detail = (notice.details ?? [])[0];
    const pair = limitAndSet(detail, dims);
    const linked = spans.filter((s) => (s.notices ?? []).includes(idx));
    if (isAdminNotice(notice)) {
      const states = [...new Set(linked.map((s) => s.stateCode).filter((x): x is string => !!x))];
      const areas = states.length ? states : [undefined];
      for (const code of areas) {
        permits.push({
          kind: 'zezwolenie',
          area: voivodeship(code),
          stateCode: code ?? null,
          limitText: pair?.limitText ?? 'limit administracyjny',
          setText: pair?.setText ?? 'zestaw',
        });
      }
      return;
    }
    const critical = (notice.severity ?? '').toLowerCase() === 'critical';
    for (const span of linked) {
      const kind = structureKind(span);
      const place = spanName(span);
      if (!kind || !place) continue;
      const geo = pointAt(section.polyline, span.offset);
      obstacles.push({
        kind,
        place,
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        limitText: pair?.limitText ?? 'ograniczenie',
        setText: pair?.setText ?? 'zestaw',
        critical,
      });
    }
  });
  return { permits, obstacles, bk: [...bk].sort() };
}

export function classifyHereRoute(body: unknown, dims: CompleteDims): Classified {
  const routes = (body as { routes?: Array<{ sections?: Array<{ notices?: Notice[]; spans?: Span[]; polyline?: string }> }> })?.routes ?? [];
  const acc: Classified = { permits: [], obstacles: [], bk: [] };
  const bk = new Set<string>();
  for (const route of routes) {
    for (const section of route.sections ?? []) {
      const part = classifySection(section, dims);
      acc.permits.push(...part.permits);
      acc.obstacles.push(...part.obstacles);
      part.bk.forEach((x) => bk.add(x));
    }
  }
  acc.bk = [...bk].sort();
  return acc;
}

export function ownSummary(r: Classified): string {
  const bk = r.bk.length ? ` Klasa drogi: ${r.bk.join(', ')}.` : '';
  if (r.obstacles.length === 0) {
    const perm = r.permits.length ? ` Wymaga zezwolenia: ${r.permits.length}.` : '';
    return `Kontrola trasy: brak przeszkody fizycznej.${perm}${bk}`;
  }
  const obs = r.obstacles.map((o) => `${o.kind} ${o.place} (${o.limitText} / zestaw ${o.setText})`).join('; ');
  const perm = r.permits.length ? ` Wymaga zezwolenia: ${r.permits.length}.` : '';
  return `Kontrola trasy: ${r.obstacles.length} przeszkód fizycznych — ${obs}.${perm}${bk}`;
}

export function buildRoutingUrl(args: {
  apiKey: string;
  origin: readonly [number, number];
  destination: readonly [number, number];
  dims: CompleteDims;
}): string {
  const q = new URLSearchParams();
  q.set('transportMode', 'truck');
  q.set('origin', `${args.origin[0]},${args.origin[1]}`);
  q.set('destination', `${args.destination[0]},${args.destination[1]}`);
  q.set('return', 'polyline,summary');
  q.set('spans', 'notices,names,length,streetAttributes,countryCode,stateCode,truckAttributes');
  q.set('departureTime', 'any');
  q.set('vehicle[height]', String(cm(args.dims.heightM)));
  q.set('vehicle[width]', String(cm(args.dims.widthM)));
  q.set('vehicle[length]', String(cm(args.dims.lengthM)));
  q.set('vehicle[grossWeight]', String(Math.round(args.dims.weightT * 1000)));
  q.set('vehicle[currentWeight]', String(Math.round(args.dims.weightT * 1000)));
  q.set('vehicle[axleCount]', String(args.dims.axleCount));
  q.set('vehicle[weightPerAxle]', String(Math.round(args.dims.axleLoadT * 1000)));
  q.set('lang', 'pl-PL');
  q.set('apiKey', args.apiKey);
  return `https://router.hereapi.com/v8/routes?${q.toString()}`;
}

export function stripHereRaw(body: unknown, apiKey: string): unknown {
  const text = JSON.stringify(body ?? null);
  const cleaned = apiKey ? text.split(apiKey).join('') : text;
  const parsed = JSON.parse(cleaned) as { routes?: Array<{ sections?: Array<Record<string, unknown>> }> };
  for (const route of parsed?.routes ?? []) {
    for (const section of route.sections ?? []) {
      delete section.polyline;
    }
  }
  return parsed;
}

export interface LoadRow {
  id: string;
  route: string | null;
  dims: SetDims;
}

export interface SaveRow {
  loadId: string;
  leg: LegName;
  checkedAt: string;
  dimsKey: string;
  status: 'ok' | 'bez_here' | 'blad';
  summary: string;
  permits: PermitNote[];
  obstacles: Obstacle[];
  raw: unknown | null;
}

export interface RouteCheckDb {
  enabled(): Promise<boolean>;
  loads(): Promise<LoadRow[]>;
  latest(loadId: string, leg: LegName): Promise<{ checkedAt: string; dimsKey: string } | null>;
  /** Koszt ponad darmowe pule (D-78). */
  monthSpendUsd(): Promise<number>;
  monthRoutingRequests(): Promise<number>;
  save(row: SaveRow): Promise<void>;
  noteUsage(requests: number): Promise<void>;
}

const BEZ = 'Bez danych HERE. Zostaje dotychczasowe wyliczenie.';

export async function runRouteCheck(deps: {
  db: RouteCheckDb;
  fetch: typeof fetch;
  apiKey: string | undefined;
  now: () => Date;
  billing?: HereBillingParams;
}): Promise<{ ok: true; mode: 'OFF' | 'LIVE' | 'BEZ_HERE'; reason: string; queried: number; skipped: number }> {
  const enabled = await deps.db.enabled();
  if (!enabled) {
    return { ok: true, mode: 'OFF', reason: 'wylaczone', queried: 0, skipped: 0 };
  }
  const key = deps.apiKey?.trim() ?? '';
  const rows = await deps.db.loads();
  const billing = deps.billing ?? HERE_BILLING_DEFAULTS;
  let spent = await deps.db.monthSpendUsd();
  let routeReq = await deps.db.monthRoutingRequests();
  let queried = 0;
  let skipped = 0;
  const now = deps.now();
  for (const row of rows) {
    const dims = completeDims(row.dims);
    const legs = legsForRoute(row.route);
    if (!dims || !legs) {
      skipped += 1;
      continue;
    }
    const keyDims = dimsKey(dims);
    for (const leg of legs) {
      const prev = await deps.db.latest(row.id, leg.leg);
      if (!needsRecheck(prev, now, keyDims)) continue;
      const base = {
        loadId: row.id,
        leg: leg.leg,
        checkedAt: now.toISOString(),
        dimsKey: keyDims,
        permits: [] as PermitNote[],
        obstacles: [] as Obstacle[],
        raw: null,
      };
      if (!key || !budgetAllows(spent, 1, billing, routeReq)) {
        await deps.db.save({ ...base, status: 'bez_here', summary: BEZ });
        continue;
      }
      const url = buildRoutingUrl({ apiKey: key, origin: leg.origin, destination: leg.destination, dims });
      let response: Response;
      try {
        response = await deps.fetch(url, { headers: { Accept: 'application/json' } });
      } catch {
        await deps.db.save({ ...base, status: 'bez_here', summary: BEZ });
        continue;
      }
      queried += 1;
      spent += marginalOverCost('routing', routeReq, 1, billing);
      routeReq += 1;
      await deps.db.noteUsage(1);
      if (!response.ok) {
        await deps.db.save({ ...base, status: 'bez_here', summary: BEZ });
        continue;
      }
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        await deps.db.save({ ...base, status: 'blad', summary: BEZ });
        continue;
      }
      const classified = classifyHereRoute(body, dims);
      await deps.db.save({
        ...base,
        status: 'ok',
        summary: ownSummary(classified),
        permits: classified.permits,
        obstacles: classified.obstacles,
        raw: stripHereRaw(body, key),
      });
    }
  }
  return {
    ok: true,
    mode: key ? 'LIVE' : 'BEZ_HERE',
    reason: key ? 'wymiarami_transportu' : 'brak_klucza',
    queried,
    skipped,
  };
}
