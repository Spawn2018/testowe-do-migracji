/**
 * H-3 — przeszkody wzdłuż korytarza przez HERE Routing v8 (truck + wymiary D-83).
 * Bez Map Attributes. alternatives + notices/violations. Przepis ≠ przeszkoda (jak H-1).
 * Wyłączone, dopóki security_flags.H3_CORRIDOR_OBSTACLES jest false (D-83).
 * Liczone w puli tras (D-78). Brak crona. Myto (D-82) nie jest proszone.
 */
import {
  CORRIDOR,
  classifyHereRoute,
  completeDims,
  type CompleteDims,
  type Obstacle,
  type SetDims,
} from './routeCheck.ts';
import {
  HERE_BILLING_DEFAULTS,
  marginalOverCost,
  routingAllows,
  type HereBillingParams,
} from './billing.ts';

export const HERE_RAW_DAYS = 30;
const RECHECK_MS = HERE_RAW_DAYS * 24 * 60 * 60 * 1000;
const ALTERNATIVES = 3;

export type CorridorLegName = 'PL-GDN' | 'PL-GDY' | 'SE-NYN' | 'SE-KAA';

export interface CorridorLeg {
  leg: CorridorLegName;
  origin: readonly [number, number];
  destination: readonly [number, number];
}

export const CORRIDOR_LEGS: CorridorLeg[] = [
  { leg: 'PL-GDN', origin: CORRIDOR.srem, destination: CORRIDOR.gdansk },
  { leg: 'PL-GDY', origin: CORRIDOR.srem, destination: CORRIDOR.gdynia },
  { leg: 'SE-NYN', origin: CORRIDOR.nynashamn, destination: CORRIDOR.boden },
  { leg: 'SE-KAA', origin: CORRIDOR.karlskrona, destination: CORRIDOR.boden },
];

export type ObstacleKind = 'wiadukt' | 'most' | 'tunel' | 'ograniczenie';

export interface CorridorObstacle {
  linkId: string;
  kind: ObstacleKind;
  place: string;
  lat: number | null;
  lng: number | null;
  maxHeightCm: number | null;
  maxWidthCm: number | null;
  maxLengthCm: number | null;
  maxWeightKg: number | null;
  maxAxleKg: number | null;
}

export function needsCorridorRefresh(prev: { fetchedAt: string; status: string } | null, now: Date): boolean {
  if (!prev || prev.status !== 'ok') return true;
  const at = Date.parse(prev.fetchedAt);
  if (!Number.isFinite(at)) return true;
  return now.getTime() - at >= RECHECK_MS;
}

function cm(m: number): number {
  return Math.round(m * 100);
}

/** Routing v8 truck + wymiary + alternatives + notices (bez Map Attributes). */
export function buildCorridorRouteUrl(apiKey: string, leg: CorridorLeg, dims: CompleteDims): string {
  const q = new URLSearchParams();
  q.set('transportMode', 'truck');
  q.set('origin', `${leg.origin[0]},${leg.origin[1]}`);
  q.set('destination', `${leg.destination[0]},${leg.destination[1]}`);
  q.set('return', 'polyline,summary,actions');
  q.set('spans', 'notices,names,length,streetAttributes,countryCode,stateCode,truckAttributes');
  q.set('alternatives', String(ALTERNATIVES));
  q.set('departureTime', 'any');
  q.set('vehicle[height]', String(cm(dims.heightM)));
  q.set('vehicle[width]', String(cm(dims.widthM)));
  q.set('vehicle[length]', String(cm(dims.lengthM)));
  q.set('vehicle[grossWeight]', String(Math.round(dims.weightT * 1000)));
  q.set('vehicle[currentWeight]', String(Math.round(dims.weightT * 1000)));
  q.set('vehicle[axleCount]', String(dims.axleCount));
  q.set('vehicle[weightPerAxle]', String(Math.round(dims.axleLoadT * 1000)));
  q.set('lang', 'pl-PL');
  q.set('apiKey', apiKey);
  return `https://router.hereapi.com/v8/routes?${q.toString()}`;
}

function parseLimitCm(limitText: string): number | null {
  const m = limitText.match(/(\d+(?:[.,]\d+)?)\s*cm/i);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseLimitKg(limitText: string): number | null {
  const t = limitText.match(/(\d+(?:[.,]\d+)?)\s*t(?:\b|$)/i);
  if (t) {
    const n = Number(t[1].replace(',', '.'));
    return Number.isFinite(n) ? Math.round(n * 1000) : null;
  }
  const kg = limitText.match(/(\d+(?:[.,]\d+)?)\s*kg/i);
  if (!kg) return null;
  const n = Number(kg[1].replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function corridorObstacleFromRoute(o: Obstacle, idx: number): CorridorObstacle {
  const kind: ObstacleKind = o.kind;
  const height = /wysoko/i.test(o.limitText) ? parseLimitCm(o.limitText) : null;
  const width = /szeroko/i.test(o.limitText) ? parseLimitCm(o.limitText) : null;
  const length = /długo|dlugo/i.test(o.limitText) ? parseLimitCm(o.limitText) : null;
  const axle = /o[sś]/i.test(o.limitText) ? parseLimitKg(o.limitText) : null;
  const weight = !axle && /t\b|kg|mas/i.test(o.limitText) ? parseLimitKg(o.limitText) : null;
  return {
    linkId: `r${idx}-${o.kind}-${(o.place || 'x').slice(0, 40)}`,
    kind,
    place: o.place,
    lat: o.lat,
    lng: o.lng,
    maxHeightCm: height,
    maxWidthCm: width,
    maxLengthCm: length,
    maxWeightKg: weight,
    maxAxleKg: axle,
  };
}

export function obstaclesFromRouting(body: unknown, dims: CompleteDims): CorridorObstacle[] {
  const classified = classifyHereRoute(body, dims);
  return classified.obstacles.map((o, i) => corridorObstacleFromRoute(o, i));
}

export function corridorSummary(items: CorridorObstacle[]): string {
  if (items.length === 0) return 'Brak danych';
  const n = (k: ObstacleKind) => items.filter((i) => i.kind === k).length;
  return `Przeszkody wzdłuż korytarza: ${items.length}. Wiadukty ${n('wiadukt')}, mosty ${n('most')}, tunele ${n('tunel')}, ograniczenia ${n('ograniczenie')}.`;
}

export interface CorridorSave {
  leg: CorridorLegName;
  fetchedAt: string;
  status: 'ok' | 'bez_here' | 'blad';
  summary: string;
  replace: boolean;
  items: CorridorObstacle[];
  raw: unknown | null;
}

export interface CorridorDb {
  enabled(): Promise<boolean>;
  latest(leg: CorridorLegName): Promise<{ fetchedAt: string; status: string } | null>;
  /** Koszt ponad pule (D-78). */
  monthSpendUsd(): Promise<number>;
  /** Liczba zapytań routing+matching+attributes w bieżącym miesiącu. */
  monthRoutingRequests(): Promise<number>;
  /** Pierwszy komplet wymiarów zestawu (D-83). Bez uzupełnień. */
  probeDims(): Promise<SetDims | null>;
  save(row: CorridorSave): Promise<void>;
  noteUsage(service: 'routing', requests: number): Promise<void>;
  purgeRaw(): Promise<void>;
}

const BEZ = 'Brak danych';

async function getJson(fetchFn: typeof fetch, url: string): Promise<{ ok: boolean; status: number; body: unknown }> {
  let response: Response;
  try {
    response = await fetchFn(url, { headers: { Accept: 'application/json' } });
  } catch {
    return { ok: false, status: 0, body: null };
  }
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return { ok: response.ok, status: response.status, body };
}

export async function runCorridorObstacles(deps: {
  db: CorridorDb;
  fetch: typeof fetch;
  apiKey: string | undefined;
  now: () => Date;
  billing?: HereBillingParams;
}): Promise<{ ok: true; mode: 'OFF' | 'LIVE' | 'BEZ_HERE'; reason: string; queried: number; skipped: number }> {
  if ((await deps.db.enabled()) !== true) {
    return { ok: true, mode: 'OFF', reason: 'wylaczone', queried: 0, skipped: 0 };
  }
  await deps.db.purgeRaw();
  const key = deps.apiKey?.trim() ?? '';
  const now = deps.now();
  const billing = deps.billing ?? HERE_BILLING_DEFAULTS;
  const dimsRaw = await deps.db.probeDims();
  const dims = dimsRaw ? completeDims(dimsRaw) : null;
  let spent = await deps.db.monthSpendUsd();
  let routeReq = await deps.db.monthRoutingRequests();
  let queried = 0;
  let skipped = 0;

  if (!dims) {
    for (const leg of CORRIDOR_LEGS) {
      const prev = await deps.db.latest(leg.leg);
      if (!needsCorridorRefresh(prev, now)) {
        skipped += 1;
        continue;
      }
      await deps.db.save({
        leg: leg.leg,
        fetchedAt: now.toISOString(),
        status: 'bez_here',
        summary: BEZ,
        replace: false,
        items: [],
        raw: null,
      });
    }
    return { ok: true, mode: 'BEZ_HERE', reason: 'brak_wymiarow', queried: 0, skipped };
  }

  for (const leg of CORRIDOR_LEGS) {
    const prev = await deps.db.latest(leg.leg);
    if (!needsCorridorRefresh(prev, now)) {
      skipped += 1;
      continue;
    }
    const base = { leg: leg.leg, fetchedAt: now.toISOString(), items: [] as CorridorObstacle[], raw: null };
    if (!key || !routingAllows(spent, 'routing', routeReq, 1, billing)) {
      await deps.db.save({ ...base, status: 'bez_here', summary: BEZ, replace: false });
      continue;
    }
    const routeUrl = buildCorridorRouteUrl(key, leg, dims);
    const route = await getJson(deps.fetch, routeUrl);
    queried += 1;
    const add = marginalOverCost('routing', routeReq, 1, billing);
    spent += add;
    routeReq += 1;
    await deps.db.noteUsage('routing', 1);
    if (!route.ok || route.body == null) {
      await deps.db.save({ ...base, status: 'bez_here', summary: BEZ, replace: false });
      continue;
    }
    const items = obstaclesFromRouting(route.body, dims);
    await deps.db.save({
      ...base,
      status: 'ok',
      summary: corridorSummary(items),
      replace: true,
      items,
      raw: { zrodlo: 'routing-v8', alternatives: ALTERNATIVES, n: items.length },
    });
  }
  return { ok: true, mode: key ? 'LIVE' : 'BEZ_HERE', reason: key ? 'katalog' : 'brak_klucza', queried, skipped };
}
