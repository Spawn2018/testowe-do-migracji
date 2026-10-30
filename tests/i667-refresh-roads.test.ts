import { describe, expect, it, vi } from 'vitest';
import {
  refreshRoadLegs,
  ROAD_CRON_REFRESH_MS,
  ROAD_LEGS,
  type RoadRefreshStore,
  type RoadGeomRow,
} from '../supabase/functions/_shared/here/refreshRoadLegs.ts';

function geom(leg: string, ageMs: number, points: unknown = [[1, 2], [3, 4]]): RoadGeomRow {
  return {
    leg,
    fetched_at: new Date(Date.now() - ageMs).toISOString(),
    points,
    retry_after: null,
  };
}

function store(rows: RoadGeomRow[], spend = 0): RoadRefreshStore & { stored: string[] } {
  const byLeg = new Map(rows.map((r) => [r.leg, { ...r }]));
  const stored: string[] = [];
  return {
    stored,
    listGeometry: async () => [...byLeg.values()],
    async storeRoad(leg, points, summary) {
      stored.push(leg);
      byLeg.set(leg, {
        leg,
        fetched_at: new Date().toISOString(),
        points,
        retry_after: null,
      });
      void summary;
      return true;
    },
    loadCorridor: async (code) => ({
      code,
      pts: [[56.2, 15.6], [65.8, 21.7]] as [number, number][],
      via: [[60, 18]] as [number, number][],
      updatedAt: 0,
    }),
    inlandCorridorCode: async () => 'SE_KAA_INLAND',
    monthSpend: async () => spend,
    noteRouting: async () => {},
  };
}

describe('#667 C refreshRoadLegs', () => {
  it('ma 5 legów i próg cron 21 d', () => {
    expect(ROAD_LEGS.map((l) => l.leg)).toEqual([
      'PL-GDN', 'SE-NYN', 'PL-GDY', 'SE-KAA', 'SE-KAA-INLAND',
    ]);
    expect(ROAD_CRON_REFRESH_MS).toBe(21 * 864e5);
  });

  it('nie woła HERE gdy wszystkie legi świeższe niż 21 d', async () => {
    const fetchFn = vi.fn();
    const s = store(ROAD_LEGS.map((l) => geom(l.leg, 7 * 864e5)));
    const r = await refreshRoadLegs(s, {
      fetch: fetchFn as unknown as typeof fetch,
      hereApiKey: 'k',
      maxAgeMs: ROAD_CRON_REFRESH_MS,
    });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(r.attempted).toBe(0);
    expect(r.missingLegs).toEqual([]);
    expect(r.skippedBudget).toBe(false);
  });

  it('stare wiersze bez punktów → missingLegs (SOURCE_DOWN po stronie joba)', async () => {
    const fetchFn = vi.fn(async () => new Response('nope', { status: 500 }));
    const s = store(ROAD_LEGS.map((l) => geom(l.leg, 40 * 864e5, null)));
    const r = await refreshRoadLegs(s, {
      fetch: fetchFn as unknown as typeof fetch,
      hereApiKey: 'k',
      maxAgeMs: ROAD_CRON_REFRESH_MS,
    });
    // HTTP 500 → bez zapisu; punkty zostają puste
    expect(r.attempted).toBe(5);
    expect(r.missingLegs.length).toBe(5);
    expect(r.warnings.some((w) => /HTTP 500/.test(w))).toBe(true);
  });

  it('budżet wyczerpany + brak punktów → skippedBudget + missing', async () => {
    const fetchFn = vi.fn();
    const s = store(ROAD_LEGS.map((l) => geom(l.leg, 40 * 864e5, null)), 100);
    const r = await refreshRoadLegs(s, {
      fetch: fetchFn as unknown as typeof fetch,
      hereApiKey: 'k',
      maxAgeMs: ROAD_CRON_REFRESH_MS,
    });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(r.skippedBudget).toBe(true);
    expect(r.missingLegs).toEqual(ROAD_LEGS.map((l) => l.leg));
  });
});
