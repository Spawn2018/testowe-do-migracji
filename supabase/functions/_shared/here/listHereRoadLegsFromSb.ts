/**
 * #667 E / DP-56 — wspólne listowanie `here_road_legs` (store + Edge `listLegs`).
 * Błąd zapytania → throw (bez cichego fail-open); pusty słownik → zapas ROAD_LEGS.
 */
import { ROAD_LEGS, type RoadLegDef } from './refreshRoadLegs.ts';
import { legDefFromRow, type HereRoadLegRow } from './legDefFromRow.ts';

type LegsQuery = {
  select(cols: string): LegsQuery;
  eq(col: string, val: unknown): LegsQuery;
  order(col: string): PromiseLike<{ data: HereRoadLegRow[] | null; error: { message: string } | null }>;
};

export type HereRoadLegsSb = {
  from(table: string): LegsQuery;
};

export async function listHereRoadLegsFromSb(sb: HereRoadLegsSb): Promise<RoadLegDef[]> {
  const r = await sb
    .from('here_road_legs')
    .select(
      'leg,origin_lat,origin_lng,dest_lat,dest_lng,spec,summary,corridor_code,browser_fetch,map_group,via_points,min_km,max_km,cron_fetch',
    )
    .eq('active', true)
    .order('sort_order');
  if (r.error) throw new Error(`here_road_legs: ${r.error.message}`);
  const rows = r.data ?? [];
  if (rows.length === 0) return [...ROAD_LEGS];
  return rows.map((row) => legDefFromRow(row));
}
