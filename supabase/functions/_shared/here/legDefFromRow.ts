/**
 * #667 E / DP-44 — wspólne mapowanie wiersza `here_road_legs` → RoadLegDef
 * (Edge `here-roads` + store crona).
 */
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
};

export function legDefFromRow(row: HereRoadLegRow): RoadLegDef {
  const specRaw = String(row.spec ?? 'loose');
  const spec: RoadLegSpecKind =
    specRaw === 'pl' || specRaw === 'se' || specRaw === 'kaa' || specRaw === 'loose'
      ? specRaw
      : 'loose';
  return {
    leg: String(row.leg),
    origin: `${Number(row.origin_lat)},${Number(row.origin_lng)}`,
    destination: `${Number(row.dest_lat)},${Number(row.dest_lng)}`,
    spec,
    summary: String(row.summary ?? ''),
    corridorCode: row.corridor_code != null ? String(row.corridor_code) : undefined,
    browserFetch: row.browser_fetch !== false,
    mapGroup: row.map_group === 'bn7' ? 'bn7' : 'core',
  };
}
