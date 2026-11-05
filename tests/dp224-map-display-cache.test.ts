/**
 * DP-224 (#817): cache wersji tras mapy + uproszczenie w migracji 0414.
 * Etap C2 / mapa — bez pełnego payloadu przy tej samej roads_version.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const applySrc = () => readFileSync('src/components/map/applyBasemap.ts', 'utf8');
const mig = () => readFileSync('supabase/migrations/0414_dp224_map_display_simplify.sql', 'utf8');

describe('DP-224 map_display_state cache / simplify', () => {
  it('migracja 0414: points_display, wersja, cron purge; bez purge w map_display_state', () => {
    const sql = mig();
    expect(sql).toMatch(/points_display/);
    expect(sql).toMatch(/roads_version/);
    expect(sql).toMatch(/roads_unchanged/);
    expect(sql).toMatch(/p_known_version/);
    expect(sql).toMatch(/tower-here-road-purge/);
    expect(sql).toMatch(/here_road_points_display_from_geom/);
    const start = sql.indexOf('create or replace function public.map_display_state');
    const end = sql.indexOf("comment on function public.map_display_state", start);
    const fn = sql.slice(start, end > start ? end : start + 2500);
    expect(fn).not.toMatch(/purge_here_road_geometry/);
  });

  it('klient: rpc z p_known_version + localStorage wt-map-roads-v1', () => {
    const src = applySrc();
    expect(src).toMatch(/p_known_version/);
    expect(src).toMatch(/roads_unchanged/);
    expect(src).toMatch(/wt-map-roads-v1/);
    expect(src).toMatch(/rpc\('map_display_state', args\)/);
    expect(src).toMatch(/__resetMapRoadsLocalCacheForTests/);
  });
});
