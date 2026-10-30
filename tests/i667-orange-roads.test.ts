import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** #667 A — pomarańczowa trasa drogowa na każdej mapie (mapPool PROD + edytor stref). */
describe('#667 pomarańczowe drogi (krok A)', () => {
  const pool = readFileSync('src/components/map/mapPool.ts', 'utf8');
  const orange = readFileSync('src/components/map/orangeRoads.ts', 'utf8');
  const corridor = readFileSync('src/components/map/CorridorMap.tsx', 'utf8');
  const geofence = readFileSync('src/components/map/GeofenceEditorMap.tsx', 'utf8');
  const zones = readFileSync('src/components/zones/ZonesMap.tsx', 'utf8');

  it('mapPool w PROD ładuje drogi przez applyBasemap (nie tylko demo)', () => {
    expect(pool).toMatch(/VITE_AUTH_MODE !== 'supabase'/);
    expect(pool).toMatch(/loadRoadLines/);
    expect(pool).toMatch(/paintOrangeRoads/);
    expect(pool).toMatch(/orangeRoads/);
    expect(pool).not.toMatch(/here_road_geometry/);
  });

  it('wspólny helper paintOrangeRoads + styl #E5A544 (osobny plik — paczka demo)', () => {
    expect(orange).toMatch(/export function paintOrangeRoads/);
    expect(orange).toMatch(/ORANGE_ROAD_STYLE/);
    expect(orange).toMatch(/#E5A544/);
  });

  it('CorridorMap, GeofenceEditorMap i ZonesMap używają paintOrangeRoads; demo ZonesMap bez applyBasemap', () => {
    expect(corridor).toMatch(/paintOrangeRoads/);
    expect(geofence).toMatch(/paintOrangeRoads/);
    expect(geofence).toMatch(/loadRoadLines/);
    expect(zones).toMatch(/paintOrangeRoads/);
    expect(zones).toMatch(/orangeRoads/);
  });
});

/** #667 B — SE-KAA (E22) + SE-KAA-INLAND z korytarzy #627, nie pusty TRACK. */
describe('#667 pomarańczowe drogi (krok B SE-KAA dual)', () => {
  const edge = readFileSync('supabase/functions/here-roads/index.ts', 'utf8');
  const refresh = readFileSync('supabase/functions/_shared/here/refreshRoadLegs.ts', 'utf8');
  const apply = readFileSync('src/components/map/applyBasemap.ts', 'utf8');
  const mig = 'supabase/migrations/0352_667_se_kaa_dual_here.sql';

  it('migracja 0352: leg SE-KAA-INLAND + here_store_road', () => {
    expect(existsSync(mig)).toBe(true);
    const sql = readFileSync(mig, 'utf8');
    expect(sql).toMatch(/SE-KAA-INLAND/);
    expect(sql).toMatch(/here_road_geometry_leg_check/);
    expect(sql).toMatch(/here_store_road/);
  });

  it('Edge/refresh: SE-KAA ← SE_E22; SE-KAA-INLAND ← inland corridor', () => {
    expect(refresh).toMatch(/corridorCode: 'SE_E22'/);
    expect(refresh).toMatch(/SE-KAA-INLAND/);
    expect(refresh).toMatch(/corridorInland: true/);
    expect(refresh).not.toMatch(/CORRIDOR_KAA = 'SE_KAA_TRACK'/);
    expect(edge).toMatch(/stena_se_inland_corridor_code/);
    expect(edge).toMatch(/refreshRoadLegs/);
  });

  it('front: ROAD_LEGS=5 i SPEC SE-KAA-INLAND', () => {
    expect(apply).toMatch(/ROAD_LEGS = 5/);
    expect(apply).toMatch(/'SE-KAA-INLAND': ROAD_KAA/);
  });
});

/** #667 C — cron before purge 30 d + SOURCE_DOWN HERE_ROADS. */
describe('#667 pomarańczowe drogi (krok C cron HERE)', () => {
  const refresh = readFileSync('supabase/functions/_shared/here/refreshRoadLegs.ts', 'utf8');
  const jobs = readFileSync('supabase/functions/_shared/integrations/jobs.ts', 'utf8');
  const sync = readFileSync('supabase/functions/_shared/integrations/sync.ts', 'utf8');
  const edge = readFileSync('supabase/functions/here-roads/index.ts', 'utf8');
  const mig = 'supabase/migrations/0353_667_here_roads_cron.sql';

  it('migracja 0353: tower-here-roads raz na dobę', () => {
    expect(existsSync(mig)).toBe(true);
    const sql = readFileSync(mig, 'utf8');
    expect(sql).toMatch(/tower-here-roads/);
    expect(sql).toMatch(/tower_cron_here_roads_invoke/);
    expect(sql).toMatch(/\/functions\/v1\/here-roads/);
    expect(sql).toMatch(/15 4 \* \* \*/);
  });

  it('refreshRoadLegs: próg cron 21 d; job + SOURCE_DOWN HERE_ROADS sticky', () => {
    expect(refresh).toMatch(/ROAD_CRON_REFRESH_MS = 21 \* 864e5/);
    expect(jobs).toMatch(/runHereRoads/);
    expect(jobs).toMatch(/'here-roads': runHereRoads/);
    expect(jobs).toMatch(/'here-roads': 1440/);
    expect(jobs).toMatch(/ROAD_CRON_REFRESH_MS/);
    expect(jobs).toMatch(/SOURCE_DOWN:HERE_ROADS/);
    expect(sync).toMatch(/HERE_ROADS/);
    expect(sync).toMatch(/src === 'HERE_ROADS'/);
    expect(edge).toMatch(/isServiceRequest/);
    expect(edge).toMatch(/runJob\('here-roads'/);
  });
});
