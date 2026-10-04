/**
 * H-3 — przeszkody wzdłuż korytarza (HERE Map Attributes, pas 3 km).
 * Wyłączone, dopóki security_flags.H3_CORRIDOR_OBSTACLES jest false (D-83).
 * Przy wyłączeniu nie woła HERE i nie uzupełnia pustych wymiarów.
 * Wymiary przykładowe z H-0 nie występują. Podświetlenie jest osobno, przy odczycie,
 * i tylko gdy flaga jest włączona oraz transport ma komplet wymiarów.
 * Odświeżenie nogi co najwyżej co 30 dni. Surowa odpowiedź gaśnie po 30 dniach.
 * Myto (D-82) nie jest proszone. Brak crona.
 */
import { CORRIDOR, HERE_BUDGET_USD, HERE_TRUCK_TX_USD, decodeFlexiblePolyline } from './routeCheck.ts';

export const HERE_RAW_DAYS = 30;
export const CORRIDOR_BAND_M = 3000;
export const HERE_ATTRIBUTES_TX_USD = 0.01;
const RECHECK_MS = HERE_RAW_DAYS * 24 * 60 * 60 * 1000;
const STEP_KM = 8;
const CHUNK = 6;

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

function kmBetween(a: readonly [number, number], b: readonly [number, number]): number {
  const r = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLng = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function resampleCorridor(points: Array<[number, number]>, stepKm = STEP_KM): Array<[number, number]> {
  if (points.length === 0) return [];
  const out: Array<[number, number]> = [points[0]];
  let acc = 0;
  let prev = points[0];
  for (let i = 1; i < points.length; i++) {
    acc += kmBetween(prev, points[i]);
    prev = points[i];
    if (acc >= stepKm) {
      out.push(points[i]);
      acc = 0;
    }
  }
  const last = points[points.length - 1];
  const tail = out[out.length - 1];
  if (tail[0] !== last[0] || tail[1] !== last[1]) out.push(last);
  return out;
}

export function chunkCorridor(points: Array<[number, number]>, size = CHUNK): Array<Array<[number, number]>> {
  if (points.length < 2) return [];
  const out: Array<Array<[number, number]>> = [];
  const step = Math.max(1, size - 1);
  for (let i = 0; i < points.length - 1; i += step) {
    const slice = points.slice(i, i + size);
    if (slice.length >= 2) out.push(slice);
    if (i + size >= points.length) break;
  }
  return out;
}

export function buildCorridorRouteUrl(apiKey: string, leg: CorridorLeg): string {
  const q = new URLSearchParams();
  q.set('transportMode', 'truck');
  q.set('origin', `${leg.origin[0]},${leg.origin[1]}`);
  q.set('destination', `${leg.destination[0]},${leg.destination[1]}`);
  q.set('return', 'polyline');
  q.set('departureTime', 'any');
  q.set('apiKey', apiKey);
  return `https://router.hereapi.com/v8/routes?${q.toString()}`;
}

function layersFor(wide: boolean): { layers: string; attributes: string } {
  if (wide) {
    return {
      layers: 'TRUCK_RESTR_FCn,ROAD_GEOM_FCn,ROAD_NAME_FCn',
      attributes: 'LINK_ID,HEIGHT_RESTRICTION,WIDTH_RESTRICTION,LENGTH_RESTRICTION,WEIGHT_RESTRICTION,MAX_WEIGHT_PER_AXLE;LINK_ID,BRIDGE,TUNNEL,LAT,LON;LINK_ID,NAME',
    };
  }
  return {
    layers: 'TRUCK_RESTR_FC1,TRUCK_RESTR_FC2,TRUCK_RESTR_FC3,ROAD_GEOM_FC1,ROAD_GEOM_FC2,ROAD_GEOM_FC3,ROAD_NAME_FC1,ROAD_NAME_FC2,ROAD_NAME_FC3',
    attributes: 'LINK_ID,HEIGHT_RESTRICTION,WIDTH_RESTRICTION,LENGTH_RESTRICTION,WEIGHT_RESTRICTION,MAX_WEIGHT_PER_AXLE;LINK_ID,HEIGHT_RESTRICTION,WIDTH_RESTRICTION,LENGTH_RESTRICTION,WEIGHT_RESTRICTION,MAX_WEIGHT_PER_AXLE;LINK_ID,HEIGHT_RESTRICTION,WIDTH_RESTRICTION,LENGTH_RESTRICTION,WEIGHT_RESTRICTION,MAX_WEIGHT_PER_AXLE;LINK_ID,BRIDGE,TUNNEL,LAT,LON;LINK_ID,BRIDGE,TUNNEL,LAT,LON;LINK_ID,BRIDGE,TUNNEL,LAT,LON;LINK_ID,NAME;LINK_ID,NAME;LINK_ID,NAME',
  };
}

export function buildAttributesUrl(apiKey: string, points: Array<[number, number]>, wide: boolean): string {
  const coords = points.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join(',');
  const spec = layersFor(wide);
  const q = [
    `layers=${encodeURIComponent(spec.layers)}`,
    `attributes=${encodeURIComponent(spec.attributes)}`,
    `in=corridor:${coords};r=${CORRIDOR_BAND_M}`,
    `apiKey=${encodeURIComponent(apiKey)}`,
  ].join('&');
  return `https://smap.hereapi.com/v8/maps/attributes?${q}`;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  return null;
}

function linkOf(row: Record<string, unknown>): string | null {
  const id = row.LINK_ID ?? row.linkId ?? row.link_id;
  if (id == null || id === '') return null;
  return String(id);
}

export function collectAttributeRows(body: unknown): Array<Record<string, string>> {
  const out: Array<Record<string, string>> = [];
  const visit = (node: unknown, layer: string) => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item, layer);
      return;
    }
    const rec = asRecord(node);
    if (!rec) return;
    const next = typeof rec.layerId === 'string' ? rec.layerId : typeof rec.layer === 'string' ? rec.layer : layer;
    const attrs = asRecord(rec.attributes);
    if (attrs) visit(attrs, next);
    if (linkOf(rec)) {
      const flat: Record<string, string> = { __layer: next };
      for (const [k, v] of Object.entries(rec)) {
        if (v == null || typeof v === 'object') continue;
        flat[k] = String(v);
      }
      out.push(flat);
      return;
    }
    for (const v of Object.values(rec)) {
      if (v && typeof v === 'object') visit(v, next);
    }
  };
  visit(body, '');
  return out;
}

function field(row: Record<string, string>, names: string[]): string | null {
  for (const name of names) {
    const v = row[name];
    if (v != null && v !== '' && v.toLowerCase() !== 'null') return v;
  }
  return null;
}

export function parseCm(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(cm|m)?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = (m[2] || '').toLowerCase();
  if (unit === 'm' || s.includes('.')) return Math.round(n * 100);
  return Math.round(n);
}

export function parseKg(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(kg|t)?$/i);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = (m[2] || '').toLowerCase();
  if (unit === 't' || s.includes('.') || (unit === '' && n < 1000)) return Math.round(n * 1000);
  return Math.round(n);
}

function yes(v: string | null): boolean {
  const s = (v ?? '').trim().toLowerCase();
  return s === 'y' || s === '1' || s === 'true' || s === 't';
}

export function hereShapePoint(lat: string | null, lon: string | null): { lat: number; lng: number } | null {
  if (!lat || !lon) return null;
  const latN = Number(lat.split(',')[0]);
  const lngN = Number(lon.split(',')[0]);
  if (!Number.isFinite(latN) || !Number.isFinite(lngN)) return null;
  const latD = Math.abs(latN) > 180 ? latN / 1e5 : latN;
  const lngD = Math.abs(lngN) > 180 ? lngN / 1e5 : lngN;
  if (Math.abs(latD) > 90 || Math.abs(lngD) > 180) return null;
  return { lat: Math.round(latD * 1e5) / 1e5, lng: Math.round(lngD * 1e5) / 1e5 };
}

function kindOf(name: string, bridge: boolean, tunnel: boolean): ObstacleKind | null {
  const n = name.toLowerCase();
  if (/wiadukt|viaduct|viadukt/.test(n)) return 'wiadukt';
  if (tunnel || /tunel|tunnel/.test(n)) return 'tunel';
  if (bridge || /\bmost\b|\bbridge\b|\bbro\b/.test(n)) return 'most';
  return null;
}

export function obstaclesFromAttributes(bodies: unknown[]): CorridorObstacle[] {
  const merged = new Map<string, Record<string, string>>();
  for (const body of bodies) {
    for (const row of collectAttributeRows(body)) {
      const id = row.LINK_ID || row.linkId || row.link_id;
      if (!id) continue;
      const prev = merged.get(id) ?? { LINK_ID: id };
      for (const [k, v] of Object.entries(row)) {
        if (k.startsWith('__')) continue;
        if (v && v.toLowerCase() !== 'null') prev[k] = v;
      }
      merged.set(id, prev);
    }
  }
  const out: CorridorObstacle[] = [];
  for (const [linkId, row] of merged) {
    const placeName = field(row, ['NAME', 'ST_NAME', 'STREET_NAME', 'OFFICIAL_NAME', 'BASE_NAME']) ?? '';
    const geo = hereShapePoint(field(row, ['LAT', 'LATITUDE']), field(row, ['LON', 'LONGITUDE', 'LNG']));
    const bridge = yes(field(row, ['BRIDGE']));
    const tunnel = yes(field(row, ['TUNNEL']));
    const kind = kindOf(placeName, bridge, tunnel);
    const maxHeightCm = parseCm(field(row, ['HEIGHT_RESTRICTION']));
    const maxWidthCm = parseCm(field(row, ['WIDTH_RESTRICTION']));
    const maxLengthCm = parseCm(field(row, ['LENGTH_RESTRICTION']));
    const maxWeightKg = parseKg(field(row, ['WEIGHT_RESTRICTION']));
    const maxAxleKg = parseKg(field(row, ['MAX_WEIGHT_PER_AXLE']));
    const hasLimit = maxHeightCm != null || maxWidthCm != null || maxLengthCm != null || maxWeightKg != null || maxAxleKg != null;
    const finalKind = kind ?? (hasLimit ? 'ograniczenie' : null);
    if (!finalKind) continue;
    const place = placeName || (geo ? `odcinek ${geo.lat.toFixed(5)}, ${geo.lng.toFixed(5)}` : 'odcinek bez nazwy');
    out.push({
      linkId,
      kind: finalKind,
      place,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      maxHeightCm,
      maxWidthCm,
      maxLengthCm,
      maxWeightKg,
      maxAxleKg,
    });
  }
  out.sort((a, b) => a.linkId.localeCompare(b.linkId));
  return out;
}

export function corridorSummary(items: CorridorObstacle[]): string {
  if (items.length === 0) return 'Brak danych';
  const n = (k: ObstacleKind) => items.filter((i) => i.kind === k).length;
  return `Przeszkody wzdłuż korytarza: ${items.length}. Wiadukty ${n('wiadukt')}, mosty ${n('most')}, tunele ${n('tunel')}, ograniczenia ${n('ograniczenie')}.`;
}

export function polylineFromRoute(body: unknown): Array<[number, number]> | null {
  const routes = (body as { routes?: Array<{ sections?: Array<{ polyline?: string }> }> })?.routes ?? [];
  const encoded = routes[0]?.sections?.[0]?.polyline;
  if (!encoded) return null;
  try {
    const pts = decodeFlexiblePolyline(encoded);
    return pts.length >= 2 ? pts : null;
  } catch {
    return null;
  }
}

function tileLimited(status: number, body: unknown): boolean {
  if (status === 413) return true;
  const text = JSON.stringify(body ?? '').toLowerCase();
  return text.includes('tile') && (text.includes('limit') || text.includes('too many') || text.includes('150'));
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
  monthSpendUsd(): Promise<number>;
  save(row: CorridorSave): Promise<void>;
  noteUsage(service: 'routing' | 'attributes', requests: number, usd: number): Promise<void>;
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
}): Promise<{ ok: true; mode: 'OFF' | 'LIVE' | 'BEZ_HERE'; reason: string; queried: number; skipped: number }> {
  if ((await deps.db.enabled()) !== true) {
    return { ok: true, mode: 'OFF', reason: 'wylaczone', queried: 0, skipped: 0 };
  }
  await deps.db.purgeRaw();
  const key = deps.apiKey?.trim() ?? '';
  const now = deps.now();
  let spent = await deps.db.monthSpendUsd();
  let queried = 0;
  let skipped = 0;
  for (const leg of CORRIDOR_LEGS) {
    const prev = await deps.db.latest(leg.leg);
    if (!needsCorridorRefresh(prev, now)) {
      skipped += 1;
      continue;
    }
    const base = { leg: leg.leg, fetchedAt: now.toISOString(), items: [] as CorridorObstacle[], raw: null };
    if (!key || spent + HERE_TRUCK_TX_USD > HERE_BUDGET_USD) {
      await deps.db.save({ ...base, status: 'bez_here', summary: BEZ, replace: false });
      continue;
    }
    const routeUrl = buildCorridorRouteUrl(key, leg);
    const route = await getJson(deps.fetch, routeUrl);
    queried += 1;
    spent += HERE_TRUCK_TX_USD;
    await deps.db.noteUsage('routing', 1, HERE_TRUCK_TX_USD);
    const points = route.ok ? polylineFromRoute(route.body) : null;
    if (!points) {
      await deps.db.save({ ...base, status: 'bez_here', summary: BEZ, replace: false });
      continue;
    }
    const chunks = chunkCorridor(resampleCorridor(points));
    const bodies: unknown[] = [];
    let failed = false;
    for (const chunk of chunks) {
      if (spent + HERE_ATTRIBUTES_TX_USD > HERE_BUDGET_USD) {
        failed = true;
        break;
      }
      let call = await getJson(deps.fetch, buildAttributesUrl(key, chunk, true));
      queried += 1;
      spent += HERE_ATTRIBUTES_TX_USD;
      await deps.db.noteUsage('attributes', 1, HERE_ATTRIBUTES_TX_USD);
      if (!call.ok && tileLimited(call.status, call.body) && spent + HERE_ATTRIBUTES_TX_USD <= HERE_BUDGET_USD) {
        call = await getJson(deps.fetch, buildAttributesUrl(key, chunk, false));
        queried += 1;
        spent += HERE_ATTRIBUTES_TX_USD;
        await deps.db.noteUsage('attributes', 1, HERE_ATTRIBUTES_TX_USD);
      }
      if (!call.ok || call.body == null) {
        failed = true;
        break;
      }
      bodies.push(call.body);
    }
    if (failed) {
      await deps.db.save({ ...base, status: 'blad', summary: BEZ, replace: false });
      continue;
    }
    const items = obstaclesFromAttributes(bodies);
    await deps.db.save({
      ...base,
      status: 'ok',
      summary: corridorSummary(items),
      replace: true,
      items,
      raw: { zrodlo: 'map-attributes', n: items.length },
    });
  }
  return { ok: true, mode: key ? 'LIVE' : 'BEZ_HERE', reason: key ? 'katalog' : 'brak_klucza', queried, skipped };
}
