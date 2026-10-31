/**
 * #667 F7 r5 uwaga 3 — runHereRoads bez hereMonthSpend: bez HERE, ostrzeżenie, SOURCE_DOWN przy brakujących legach.
 */
import { describe, expect, it, vi } from 'vitest';
import { runHereRoads, type JobDeps, type JobResult } from '../supabase/functions/_shared/integrations/jobs.ts';
import type { SyncStore } from '../supabase/functions/_shared/integrations/sync.ts';
import { ROAD_LEGS } from '../supabase/functions/_shared/here/refreshRoadLegs.ts';

const NOW = new Date('2026-10-31T00:00:00.000Z');

function storeWithoutSpend(): SyncStore & { risks: { dedup: string }[] } {
  const risks: { dedup: string }[] = [];
  const geom = ROAD_LEGS.map((l) => ({
    leg: l.leg,
    fetched_at: new Date(NOW.getTime() - 40 * 864e5).toISOString(),
    points: null as null,
    retry_after: null as null,
  }));
  return {
    risks,
    listHereRoadGeometry: async () => geom,
    storeHereRoad: async () => {},
    hereCorridorBundle: async (code) => ({
      code,
      pts: [[56.2, 15.6], [65.8, 21.7]] as [number, number][],
      via: [[60, 18]] as [number, number][],
      updatedAt: 0,
    }),
    // brak hereMonthSpend — runHereRoads → monthSpend null
    raiseRisk: async (r) => {
      risks.push(r);
      return true;
    },
    resolveRisks: async () => 0,
    recordRun: async () => {},
    lastRun: async () => null,
  } as unknown as SyncStore & { risks: { dedup: string }[] };
}

describe('#667 F7 r5 runHereRoads bez hereMonthSpend', () => {
  it('bez wołania HERE + ostrzeżenie + SOURCE_DOWN przy brakujących legach', async () => {
    const fetchFn = vi.fn();
    const s = storeWithoutSpend();
    const deps: JobDeps = {
      store: s,
      fetch: fetchFn as unknown as typeof fetch,
      env: { HERE_API_KEY: 'k' },
      now: () => NOW,
    };
    const r: JobResult = await runHereRoads(deps);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(r.ok).toBe(false);
    expect(r.warnings?.some((w) => /hereMonthSpend|wydatku HERE/i.test(w))).toBe(true);
    expect(s.risks.some((x) => x.dedup.startsWith('SOURCE_DOWN:HERE_ROADS'))).toBe(true);
    expect(String(r.reason ?? '')).toMatch(/Brak linii/);
  });
});
