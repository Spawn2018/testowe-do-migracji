/**
 * #667 E / DP-44 — wspólne mapowanie wiersza `here_road_legs` → RoadLegDef
 * (Edge `here-roads` + store crona). BN7 (#718): via / min/max / cron_fetch / dict.
 */
import type { LatLng } from '../map/draw.ts';
import type { RoadLegDef, RoadLegSpecKind } from './refreshRoadLegs.ts';

export type HereRoadLegRow = {
  leg?: unknown;
  origin_lat?: unknown;
  origin_lng?: unknown;
  dest_lat?: unknown;
  dest_lng?: unknown;
  spec?: unknown;
  summary?: unknown;
  corridor_code?: unknown;
  browser_fetch?: unknown;
  map_group?: unknown;
  via_points?: unknown;
  min_km?: unknown;
  max_km?: unknown;
  cron_fetch?: unknown;
};

function parseVia(raw: unknown): LatLng[] {
  if (!Array.isArray(raw)) return [];
  const out: LatLng[] = [];
  for (const p of raw) {
    if (!Array.isArray(p) || p.length < 2) continue;
    const lat = Number(p[0]);
    const lng = Number(p[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) out.push([lat, lng]);
  }
  return out;
}

export function legDefFromRow(row: HereRoadLegRow): RoadLegDef {
  const specRaw = String(row.spec ?? 'loose');
  const spec: RoadLegSpecKind =
    specRaw === 'pl' || specRaw === 'se' || specRaw === 'kaa' || specRaw === 'loose' || specRaw === 'dict'
      ? specRaw
      : 'loose';
  const minKm = row.min_km != null ? Number(row.min_km) : undefined;
  const maxKm = row.max_km != null ? Number(row.max_km) : undefined;
  return {
    leg: String(row.leg),
    origin: `${Number(row.origin_lat)},${Number(row.origin_lng)}`,
    destination: `${Number(row.dest_lat)},${Number(row.dest_lng)}`,
    spec,
    summary: String(row.summary ?? ''),
    corridorCode: row.corridor_code != null ? String(row.corridor_code) : undefined,
    browserFetch: row.browser_fetch !== false,
    mapGroup: row.map_group === 'bn7' ? 'bn7' : 'core',
    viaPoints: parseVia(row.via_points),
    minKm: Number.isFinite(minKm) ? minKm : undefined,
    maxKm: Number.isFinite(maxKm) ? maxKm : undefined,
    cronFetch: row.cron_fetch !== false,
  };
}
