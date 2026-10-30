import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** #667 A — pomarańczowa trasa drogowa na każdej mapie (mapPool PROD + edytor stref). */
describe('#667 pomarańczowe drogi (krok A)', () => {
  const pool = readFileSync('src/components/map/mapPool.ts', 'utf8');
  const orange = readFileSync('src/components/map/orangeRoads.ts', 'utf8');
  const corridor = readFileSync('src/components/map/CorridorMap.tsx', 'utf8');
  const geofence = readFileSync('src/components/map/GeofenceEditorMap.tsx', 'utf8');
  const zones = readFileSync('src/components/zones/ZonesMap.tsx', 'utf8');

  it('mapPool w PROD ładuje drogi przez applyBasemap (nie tylko demo)', () => {
    expect(pool).toMatch(/PROD_BUILD/);
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
