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

  it('Edge/refresh: SE-KAA ← SE_E22; SE-KAA-INLAND ← SE_KAA_INLAND (F7 r1 B3)', () => {
    expect(refresh).toMatch(/corridorCode: 'SE_E22'/);
    expect(refresh).toMatch(/corridorCode: 'SE_KAA_INLAND'/);
    expect(refresh).not.toMatch(/corridorInland:\s*true/);
    expect(refresh).not.toMatch(/CORRIDOR_KAA = 'SE_KAA_TRACK'/);
    expect(edge).toMatch(/refreshRoadLegs/);
  });

  it('front: spec ze słownika (DP-23); SE-KAA=E22; SE-KAA-INLAND=ROAD_KAA (F7 r1 B1)', () => {
    expect(apply).toMatch(/roadSpecFromRow|browserFetchLegCount/);
    expect(apply).toMatch(/'SE-KAA': ROAD_KAA_E22/);
    expect(apply).toMatch(/'SE-KAA-INLAND': ROAD_KAA/);
    expect(apply).toMatch(/checkRoads/);
  });
});

/** #667 E / DP-23 — słownik legów + BN7 w bazie. */
describe('#667 pomarańczowe drogi (krok E BN7 / DP-23)', () => {
  const mig = 'supabase/migrations/0355_667_here_road_legs_dict.sql';
  const refresh = readFileSync('supabase/functions/_shared/here/refreshRoadLegs.ts', 'utf8');
  const edge = readFileSync('supabase/functions/here-roads/index.ts', 'utf8');
  const apply = readFileSync('src/components/map/applyBasemap.ts', 'utf8');

  it('migracja 0355: here_road_legs + BN7 + FK zamiast IN', () => {
    expect(existsSync(mig)).toBe(true);
    const sql = readFileSync(mig, 'utf8');
    expect(sql).toMatch(/create table if not exists public\.here_road_legs/);
    expect(sql).toMatch(/here_road_geometry_leg_fkey/);
    expect(sql).toMatch(/drop constraint if exists here_road_geometry_leg_check/);
    for (const leg of ['PL-TLL', 'PL-MUU', 'PL-PLD', 'FI-HEL', 'FI-VUO', 'SE-STO', 'SE-KPS']) {
      expect(sql).toMatch(new RegExp(`'${leg}'`));
    }
    expect(sql).toMatch(/browser_fetch/);
    expect(sql).toMatch(/map_group/);
  });

  it('refresh/Edge: listLegs ze słownika; przeglądarka browserOnly', () => {
    expect(refresh).toMatch(/listLegs/);
    expect(refresh).toMatch(/browserOnly/);
    expect(edge).toMatch(/listLegs/);
    expect(edge).toMatch(/browserOnly:\s*true/);
  });

  it('front: roadSpecFromRow + próg browser_fetch (nie hardcodowany ROAD_LEGS=5)', () => {
    expect(apply).toMatch(/function roadSpecFromRow/);
    expect(apply).toMatch(/browserFetchLegCount/);
    expect(apply).not.toMatch(/const ROAD_LEGS = 5/);
  });
});

/** B2 zachowanie (jsdom) — tests/i667-b2-zones-roads.jsdom.test.ts (F7 r2). */

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

  it('migracja 0354: B5 SE_E22 = 30 pkt 0298 + origin/Luleå; DP-22 summary', () => {
    const m = 'supabase/migrations/0354_667_kaa_corridor_lulea.sql';
    expect(existsSync(m)).toBe(true);
    const sql = readFileSync(m, 'utf8');
    expect(sql).toMatch(/15\.6308,\s*56\.1646/);
    expect(sql).toMatch(/22\.053/);
    expect(sql).toMatch(/65\.606/);
    expect(sql).toMatch(/17\.50,\s*58\.95/); // Vagnhärad — #496 OFF_CORRIDOR
    expect(sql).toMatch(/15\.99,\s*56\.30/); // Brömsebro z 0298 (nie 16.10)
    expect(sql).toMatch(/map_display_state/);
    expect(sql).toMatch(/summary/);
    expect(sql).not.toMatch(/st_makepoint\(22\.1547/);
    expect(sql).toMatch(/st_makepoint\(22\.053/);
    const e22Pts = [...sql.matchAll(/st_makepoint\([^)]+\)/g)];
    // SE_E22 (30) + SE_KAA_INLAND (31) = 61
    expect(e22Pts.length).toBeGreaterThanOrEqual(60);
  });

  it('refreshRoadLegs: próg cron 21 d; job + SOURCE_DOWN HERE_ROADS sticky', () => {
    expect(refresh).toMatch(/ROAD_CRON_REFRESH_MS = 21 \* 864e5/);
    expect(jobs).toMatch(/runHereRoads/);
    expect(jobs).toMatch(/'here-roads': runHereRoads/);
    expect(jobs).toMatch(/'here-roads': 1380/);
    expect(jobs).toMatch(/ROAD_CRON_REFRESH_MS/);
    expect(jobs).toMatch(/SOURCE_DOWN:HERE_ROADS/);
    expect(sync).toMatch(/HERE_ROADS/);
    expect(sync).toMatch(/src === 'HERE_ROADS'/);
    expect(edge).toMatch(/isServiceRequest/);
    expect(edge).toMatch(/runJob\('here-roads'/);
  });
});
