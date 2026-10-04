import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  buildAttributesUrl,
  buildCorridorRouteUrl,
  chunkCorridor,
  corridorSummary,
  CORRIDOR_LEGS,
  needsCorridorRefresh,
  obstaclesFromAttributes,
  parseCm,
  parseKg,
  resampleCorridor,
  runCorridorObstacles,
  type CorridorDb,
  type CorridorSave,
} from '../supabase/functions/_shared/here/corridorObstacles';

const POLY = 'BFoz5xJ67i1B1B7PzIhaxL7Y';

function db(over: Partial<CorridorDb> = {}): { db: CorridorDb; saved: CorridorSave[] } {
  const saved: CorridorSave[] = [];
  return {
    saved,
    db: {
      enabled: async () => true,
      latest: async () => null,
      monthSpendUsd: async () => 0,
      save: async (row) => { saved.push(row); },
      noteUsage: async () => undefined,
      purgeRaw: async () => undefined,
      ...over,
    },
  };
}

describe('H-3 przeszkody wzdłuż korytarza', () => {
  it('nie zawiera wymiarów przykładowych z H-0 i nie włącza H-1', () => {
    const src = readFileSync('supabase/functions/_shared/here/corridorObstacles.ts', 'utf8');
    expect(src).not.toMatch(/4\.2/);
    expect(src).not.toContain('52 t');
    expect(src).not.toMatch(/6 osi/);
    const sql = readFileSync('supabase/migrations/0154_h3_corridor_obstacles.sql', 'utf8');
    expect(sql).toMatch(/'H3_CORRIDOR_OBSTACLES', false/);
    expect(sql).not.toMatch(/cron\.schedule/);
    expect(sql).not.toMatch(/net\.http_post/);
    expect(sql).not.toMatch(/H1_ROUTE_CHECK',\s*true/);
    expect(sql).not.toMatch(/resend/i);
    expect(sql).not.toMatch(/road-se/);
    expect(sql).not.toMatch(/update security_flags/);
  });

  it('flaga wyłączona: zero zapytań HERE, nawet z kluczem', async () => {
    const fetch = vi.fn();
    const purge = vi.fn();
    const box = db({ enabled: async () => false, purgeRaw: purge });
    const res = await runCorridorObstacles({
      db: box.db,
      fetch,
      apiKey: 'klucz-testowy',
      now: () => new Date('2026-10-04T18:00:00Z'),
    });
    expect(res).toMatchObject({ mode: 'OFF', reason: 'wylaczone', queried: 0 });
    expect(fetch).not.toHaveBeenCalled();
    expect(purge).not.toHaveBeenCalled();
    expect(box.saved).toHaveLength(0);
  });

  it('świeży katalog nie jest odświeżany przed 30 dniami', () => {
    const now = new Date('2026-10-04T12:00:00Z');
    expect(needsCorridorRefresh(null, now)).toBe(true);
    expect(needsCorridorRefresh({ fetchedAt: '2026-10-01T12:00:00Z', status: 'ok' }, now)).toBe(false);
    expect(needsCorridorRefresh({ fetchedAt: '2026-08-01T12:00:00Z', status: 'ok' }, now)).toBe(true);
    expect(needsCorridorRefresh({ fetchedAt: '2026-10-04T11:00:00Z', status: 'blad' }, now)).toBe(true);
  });

  it('jednostki HERE: centymetry całkowite i kilogramy, tony przy liczbie poniżej 1000', () => {
    expect(parseCm('420')).toBe(420);
    expect(parseCm('4.2 m')).toBe(420);
    expect(parseKg('40000')).toBe(40000);
    expect(parseKg('40')).toBe(40000);
    expect(parseKg('11.5 t')).toBe(11500);
  });

  it('pas dzieli się na odcinki, a pusta odpowiedź to brak danych', () => {
    const pts: Array<[number, number]> = [[52, 17], [52.2, 17.2], [53, 18]];
    const chunks = chunkCorridor(resampleCorridor(pts, 20), 6);
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.every((c) => c.length >= 2)).toBe(true);
    expect(corridorSummary([])).toBe('Brak danych');
    expect(obstaclesFromAttributes([{ geometries: [] }])).toEqual([]);
  });

  it('z odpowiedzi HERE zostają most, wiadukt, tunel i limit masy', () => {
    const items = obstaclesFromAttributes([
      {
        geometries: [
          { layerId: 'ROAD_GEOM_FC1', attributes: { LINK_ID: '1', BRIDGE: 'Y', LAT: '5210000', LON: '1700000' } },
          { layerId: 'ROAD_NAME_FC1', attributes: { LINK_ID: '1', NAME: 'Most na Warcie' } },
          { layerId: 'TRUCK_RESTR_FC1', attributes: { LINK_ID: '1', HEIGHT_RESTRICTION: '410', WEIGHT_RESTRICTION: '40000' } },
          { layerId: 'ROAD_GEOM_FC2', attributes: { LINK_ID: '2', TUNNEL: 'Y', LAT: '54.4', LON: '18.6' } },
          { layerId: 'ROAD_NAME_FC2', attributes: { LINK_ID: '2', NAME: 'Tunel pod Martwą Wisłą' } },
          { layerId: 'TRUCK_RESTR_FC2', attributes: { LINK_ID: '2', HEIGHT_RESTRICTION: '450' } },
          { layerId: 'ROAD_NAME_FC1', attributes: { LINK_ID: '3', NAME: 'Wiadukt S5' } },
          { layerId: 'TRUCK_RESTR_FC1', attributes: { LINK_ID: '3', HEIGHT_RESTRICTION: '400' } },
          { layerId: 'TRUCK_RESTR_FC3', attributes: { LINK_ID: '4', WEIGHT_RESTRICTION: '20' } },
          { layerId: 'ROAD_GEOM_FC1', attributes: { LINK_ID: '5', BRIDGE: 'N', TUNNEL: 'N' } },
        ],
      },
    ]);
    const byId = Object.fromEntries(items.map((i) => [i.linkId, i]));
    expect(byId['1']).toMatchObject({ kind: 'most', place: 'Most na Warcie', maxHeightCm: 410, maxWeightKg: 40000, lat: 52.1, lng: 17 });
    expect(byId['2']).toMatchObject({ kind: 'tunel', place: 'Tunel pod Martwą Wisłą', maxHeightCm: 450 });
    expect(byId['3']).toMatchObject({ kind: 'wiadukt', maxHeightCm: 400 });
    expect(byId['4']).toMatchObject({ kind: 'ograniczenie', maxWeightKg: 20000 });
    expect(byId['5']).toBeUndefined();
  });

  it('brak klucza nie woła HERE i nie zapisuje przeszkód', async () => {
    const fetch = vi.fn();
    const box = db();
    const res = await runCorridorObstacles({
      db: box.db,
      fetch,
      apiKey: '   ',
      now: () => new Date('2026-10-04T18:00:00Z'),
    });
    expect(res).toMatchObject({ mode: 'BEZ_HERE', queried: 0, skipped: 0 });
    expect(fetch).not.toHaveBeenCalled();
    expect(box.saved).toHaveLength(4);
    expect(box.saved.every((s) => s.status === 'bez_here' && s.replace === false && s.items.length === 0)).toBe(true);
    expect(box.saved.every((s) => s.summary === 'Brak danych')).toBe(true);
  });

  it('świeże nogi są pomijane', async () => {
    const fetch = vi.fn();
    const box = db({
      latest: async () => ({ fetchedAt: '2026-10-04T00:00:00Z', status: 'ok' }),
    });
    const res = await runCorridorObstacles({
      db: box.db,
      fetch,
      apiKey: 'klucz-testowy',
      now: () => new Date('2026-10-04T18:00:00Z'),
    });
    expect(res.skipped).toBe(4);
    expect(res.queried).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
    expect(box.saved).toHaveLength(0);
  });

  it('wyczerpany budżet nie woła HERE', async () => {
    const fetch = vi.fn();
    const box = db({ monthSpendUsd: async () => 100 });
    await runCorridorObstacles({
      db: box.db,
      fetch,
      apiKey: 'klucz-testowy',
      now: () => new Date('2026-10-04T18:00:00Z'),
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(box.saved.every((s) => s.status === 'bez_here' && s.replace === false)).toBe(true);
  });

  it('trasa ciężarówki nie niesie wymiarów zestawu, a katalog zapisuje tylko własne podsumowanie', async () => {
    const fetch = vi.fn(async (url: string) => {
      expect(url).not.toContain('vehicle[');
      expect(url).not.toContain('klucz-testowy-w-ciele');
      if (url.includes('router.hereapi.com')) {
        return new Response(JSON.stringify({ routes: [{ sections: [{ polyline: POLY }] }] }), { status: 200 });
      }
      return new Response(JSON.stringify({
        geometries: [
          { layerId: 'ROAD_GEOM_FC1', attributes: { LINK_ID: '9', BRIDGE: 'Y', LAT: '50.10228', LON: '8.69821' } },
          { layerId: 'ROAD_NAME_FC1', attributes: { LINK_ID: '9', NAME: 'Most testowy' } },
          { layerId: 'TRUCK_RESTR_FC1', attributes: { LINK_ID: '9', HEIGHT_RESTRICTION: '400' } },
        ],
      }), { status: 200 });
    });
    const box = db();
    const res = await runCorridorObstacles({
      db: box.db,
      fetch: fetch as unknown as typeof fetch,
      apiKey: 'klucz-testowy',
      now: () => new Date('2026-10-04T18:00:00Z'),
    });
    expect(res.queried).toBeGreaterThan(0);
    expect(box.saved.filter((s) => s.status === 'ok')).toHaveLength(4);
    for (const row of box.saved) {
      expect(row.replace).toBe(true);
      expect(row.items.map((i) => i.kind)).toEqual(['most']);
      expect(JSON.stringify(row.raw)).not.toContain('klucz-testowy');
      expect(row.raw).toEqual({ zrodlo: 'map-attributes', n: 1 });
    }
    const routeUrl = buildCorridorRouteUrl('klucz-testowy', CORRIDOR_LEGS[0]);
    expect(routeUrl).toContain('transportMode=truck');
    expect(routeUrl).not.toContain('vehicle%5Bheight%5D');
    expect(routeUrl).not.toContain('vehicle[height]');
    const attr = decodeURIComponent(buildAttributesUrl('klucz-testowy', [[52.07, 17.02], [54.4, 18.68]], true));
    expect(attr).toContain('r=3000');
    expect(attr).toContain('TRUCK_RESTR_FCn');
  });
});
