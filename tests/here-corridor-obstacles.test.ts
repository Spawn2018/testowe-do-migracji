import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  buildCorridorRouteUrl,
  corridorSummary,
  CORRIDOR_LEGS,
  needsCorridorRefresh,
  obstaclesFromRouting,
  runCorridorObstacles,
  type CorridorDb,
  type CorridorSave,
} from '../supabase/functions/_shared/here/corridorObstacles';
import type { CompleteDims } from '../supabase/functions/_shared/here/routeCheck';

const DIMS: CompleteDims = {
  heightM: 4.5, widthM: 3.4, lengthM: 28, weightT: 60, axleCount: 8, axleLoadT: 10,
};

function db(over: Partial<CorridorDb> = {}): { db: CorridorDb; saved: CorridorSave[]; notes: Array<{ s: string; n: number }> } {
  const saved: CorridorSave[] = [];
  const notes: Array<{ s: string; n: number }> = [];
  return {
    saved,
    notes,
    db: {
      enabled: async () => true,
      latest: async () => null,
      monthSpendUsd: async () => 0,
      monthRoutingRequests: async () => 0,
      probeDims: async () => DIMS,
      save: async (row) => { saved.push(row); },
      noteUsage: async (service, requests) => { notes.push({ s: service, n: requests }); },
      purgeRaw: async () => undefined,
      ...over,
    },
  };
}

describe('H-3 przeszkody wzdłuż korytarza (Routing v8)', () => {
  it('nie zawiera Map Attributes ani stawek w kodzie i nie włącza H-1', () => {
    const src = readFileSync('supabase/functions/_shared/here/corridorObstacles.ts', 'utf8');
    expect(src).not.toMatch(/maps\/attributes/);
    expect(src).not.toMatch(/HERE_ATTRIBUTES/);
    expect(src).not.toMatch(/smap\.hereapi/);
    expect(src).not.toMatch(/4\.2/);
    expect(src).not.toContain('52 t');
    expect(src).toMatch(/alternatives/);
    const sql = readFileSync('supabase/migrations/0154_h3_corridor_obstacles.sql', 'utf8');
    expect(sql).toMatch(/'H3_CORRIDOR_OBSTACLES', false/);
    expect(sql).not.toMatch(/cron\.schedule/);
    const mig = readFileSync('supabase/migrations/0170_d78_here_pools_h3_routing.sql', 'utf8');
    expect(mig).toMatch(/H3_CORRIDOR_OBSTACLES/);
    expect(mig).toMatch(/HERE_ROUTES_FREE/);
  });

  it('flaga wyłączona: zero zapytań HERE, nawet z kluczem i wymiarami', async () => {
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

  it('bez wymiarów: bez HERE, status bez_here', async () => {
    const fetch = vi.fn();
    const box = db({ probeDims: async () => null });
    const res = await runCorridorObstacles({
      db: box.db,
      fetch,
      apiKey: 'klucz',
      now: () => new Date('2026-10-04T18:00:00Z'),
    });
    expect(res).toMatchObject({ mode: 'BEZ_HERE', reason: 'brak_wymiarow', queried: 0 });
    expect(fetch).not.toHaveBeenCalled();
    expect(box.saved).toHaveLength(CORRIDOR_LEGS.length);
    expect(box.saved.every((s) => s.status === 'bez_here')).toBe(true);
  });

  it('świeży katalog nie jest odświeżany przed 30 dniami', () => {
    const now = new Date('2026-10-04T12:00:00Z');
    expect(needsCorridorRefresh(null, now)).toBe(true);
    expect(needsCorridorRefresh({ fetchedAt: '2026-10-01T12:00:00Z', status: 'ok' }, now)).toBe(false);
    expect(needsCorridorRefresh({ fetchedAt: '2026-08-01T12:00:00Z', status: 'ok' }, now)).toBe(true);
    expect(needsCorridorRefresh({ fetchedAt: '2026-10-04T11:00:00Z', status: 'blad' }, now)).toBe(true);
  });

  it('URL to Routing v8 truck z alternatives i wymiarami, bez attributes', () => {
    const url = buildCorridorRouteUrl('K', CORRIDOR_LEGS[0], DIMS);
    expect(url).toContain('router.hereapi.com/v8/routes');
    expect(url).toContain('transportMode=truck');
    expect(url).toContain('alternatives=3');
    expect(url).toContain('spans=');
    expect(url).toContain('vehicle%5Bheight%5D=450');
    expect(url).not.toContain('attributes');
    expect(url).not.toContain('smap.hereapi');
  });

  it('przepis administracyjny nie trafia do przeszkód (jak H-1)', () => {
    const body = {
      routes: [{
        sections: [{
          notices: [{
            code: 'violatedAdminWideVehicleRestriction',
            details: [{ type: 'adminWideRestriction', maxHeight: 4 }],
          }],
          spans: [{ offset: 0, notices: [0], names: [{ value: 'województwo' }], stateCode: '30' }],
          polyline: 'BFoz5xJ67i1B1B7PzIhaxL7Y',
        }],
      }],
    };
    expect(obstaclesFromRouting(body, DIMS)).toEqual([]);
  });

  it('most z limitem trafia do katalogu', () => {
    const body = {
      routes: [{
        sections: [{
          notices: [{
            code: 'violatedVehicleRestriction',
            severity: 'critical',
            details: [{ type: 'maxHeight', maxHeight: 4 }],
          }],
          spans: [{
            offset: 0,
            notices: [0],
            names: [{ value: 'Most na Warcie' }],
            streetAttributes: ['bridge'],
          }],
          polyline: 'BFoz5xJ67i1B1B7PzIhaxL7Y',
        }],
      }],
    };
    const items = obstaclesFromRouting(body, DIMS);
    expect(items.length).toBeGreaterThanOrEqual(1);
    expect(items[0].kind).toBe('most');
    expect(items[0].place).toMatch(/Most/);
  });

  it('podsumowanie liczy rodzaje', () => {
    expect(corridorSummary([])).toBe('Brak danych');
    expect(corridorSummary([
      { linkId: '1', kind: 'most', place: 'A', lat: null, lng: null, maxHeightCm: 400, maxWidthCm: null, maxLengthCm: null, maxWeightKg: null, maxAxleKg: null },
      { linkId: '2', kind: 'wiadukt', place: 'B', lat: null, lng: null, maxHeightCm: null, maxWidthCm: null, maxLengthCm: null, maxWeightKg: null, maxAxleKg: null },
    ])).toMatch(/Przeszkody wzdłuż korytarza: 2/);
  });

  it('LIVE: jedno zapytanie routing na nogę, bez attributes', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({
      routes: [{ sections: [{ notices: [], spans: [], polyline: 'BFoz5xJ67i1B1B7PzIhaxL7Y' }] }],
    }), { status: 200 }));
    const box = db();
    const res = await runCorridorObstacles({
      db: box.db,
      fetch: fetch as unknown as typeof globalThis.fetch,
      apiKey: 'klucz',
      now: () => new Date('2026-10-04T18:00:00Z'),
    });
    expect(res.mode).toBe('LIVE');
    expect(res.queried).toBe(CORRIDOR_LEGS.length);
    expect(box.notes.every((n) => n.s === 'routing')).toBe(true);
    expect(box.notes).toHaveLength(CORRIDOR_LEGS.length);
    for (const call of fetch.mock.calls) {
      expect(String(call[0])).toContain('router.hereapi.com');
      expect(String(call[0])).not.toContain('attributes');
    }
  });
});
