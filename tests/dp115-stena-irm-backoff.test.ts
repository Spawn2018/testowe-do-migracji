/**
 * DP-115 / F7 #689 r1 — Stena IRM backoff po 403/429:
 * persist `stena_irm_backoff_until` w integration_runs (jak streak Tallink),
 * żeby zimny start Edge nie podnosił SOURCE_DOWN co przebieg.
 * Etap: C4 / BN3 AIS; źródło PLAN rejestr DP-115.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearStenaIrmBackoff,
  runFerryAis,
  STENA_IRM_BACKOFF_MS,
  type JobDeps,
  type JobResult,
  type SyncStore,
} from '../supabase/functions/_shared/integrations/jobs';
import type { DbSailing, RiskInput, SailingInsert, SailingPatch } from '../supabase/functions/_shared/integrations/sync';

const NOW = new Date('2026-11-07T19:00:00Z');
const SPIRIT = 'v-spirit';

class MemStore implements SyncStore {
  risks: (RiskInput & { loadId?: string })[] = [];
  runs: { job: string; at: string; ok: boolean; result: JobResult }[] = [];
  vesselPositions: { vesselId: string; lat: number; lon: number; observedAt: string; source?: string }[] = [];
  async projectId() { return 'p1'; }
  async vessels() {
    return [{ id: SPIRIT, name: 'M/F Stena Spirit', mmsi: 219031605, imo: 7907661 }];
  }
  async sailingsSince() { return [] as DbSailing[]; }
  async insertSailings(_rows: SailingInsert[]) { /* no-op */ }
  async updateSailing(_id: string, _patch: SailingPatch) { return false; }
  async raiseRisk(r: RiskInput & { loadId?: string }) {
    if (this.risks.some((x) => x.dedup === r.dedup)) return false;
    this.risks.push(r);
    return true;
  }
  async resolveRisks(prefix: string) {
    const n = this.risks.filter((r) => r.dedup.startsWith(prefix)).length;
    this.risks = this.risks.filter((r) => !r.dedup.startsWith(prefix));
    return n;
  }
  async latestPositions() { return []; }
  async lastRun(job: string) {
    return this.runs.filter((r) => r.job === job).at(-1)?.at ?? null;
  }
  async recentJobResults(job: string, limit: number) {
    return this.runs.filter((r) => r.job === job).slice(-limit).reverse().map((r) => r.result);
  }
  async recordRun(job: string, ok: boolean, result: JobResult) {
    this.runs.push({ job, at: NOW.toISOString(), ok, result });
  }
  async saveVesselPosition(vesselId: string, fix: { lat: number; lon: number; timestampUtc: string; source?: string }) {
    this.vesselPositions.push({
      vesselId, lat: fix.lat, lon: fix.lon, observedAt: fix.timestampUtc, source: fix.source,
    });
  }
}

function deps(store: MemStore, irmStatus: number, now = NOW): { d: JobDeps; irmHits: { n: number } } {
  const irmHits = { n: 0 };
  const d: JobDeps = {
    store,
    now: () => now,
    env: {},
    fetch: (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('irm.stenalinefreight.com')) {
        irmHits.n += 1;
        return new Response('blocked', { status: irmStatus });
      }
      if (url.includes('digitraffic.fi')) {
        return new Response(JSON.stringify({ type: 'FeatureCollection', features: [] }), { status: 200 });
      }
      return new Response('missing', { status: 404 });
    }) as typeof fetch,
  };
  return { d, irmHits };
}

describe('DP-115 — Stena IRM backoff (Edge cold start)', () => {
  beforeEach(() => {
    clearStenaIrmBackoff();
  });

  it('eksportuje STENA_IRM_BACKOFF_MS = 15 min', () => {
    expect(STENA_IRM_BACKOFF_MS).toBe(15 * 60_000);
  });

  it('403 → SOURCE_DOWN + stena_irm_backoff_until w wyniku', async () => {
    const st = new MemStore();
    const { d, irmHits } = deps(st, 403);
    const r = await runFerryAis(d);
    expect(r.ok).toBe(true);
    expect(irmHits.n).toBe(1);
    expect(st.risks.some((x) => x.dedup.startsWith('SOURCE_DOWN:STENA_IRM:'))).toBe(true);
    expect(r.stena_irm_backoff_until).toBe(
      new Date(NOW.getTime() + STENA_IRM_BACKOFF_MS).toISOString(),
    );
  });

  it('zimny start w oknie: hydrate z integration_runs → bez HTTP i bez nowego ryzyka', async () => {
    const st = new MemStore();
    const first = deps(st, 403);
    const r1 = await runFerryAis(first.d);
    await st.recordRun('ferry-ais', r1.ok, r1);
    expect(first.irmHits.n).toBe(1);
    expect(st.risks).toHaveLength(1);

    clearStenaIrmBackoff();
    const second = deps(st, 403);
    const r2 = await runFerryAis(second.d);
    expect(second.irmHits.n).toBe(0);
    expect(st.risks).toHaveLength(1);
    expect(r2.stena_irm_backoff_until).toBe(r1.stena_irm_backoff_until);
    expect(r2.warnings ?? []).toHaveLength(0);
  });

  it('po wygaśnięciu okna (zimny start) → ponowny HTTP 403 i SOURCE_DOWN', async () => {
    const st = new MemStore();
    const t0 = NOW;
    const first = deps(st, 403, t0);
    const r1 = await runFerryAis(first.d);
    await st.recordRun('ferry-ais', r1.ok, r1);

    clearStenaIrmBackoff();
    const after = new Date(t0.getTime() + STENA_IRM_BACKOFF_MS + 1_000);
    st.risks = [];
    const second = deps(st, 403, after);
    const r2 = await runFerryAis(second.d);
    expect(second.irmHits.n).toBe(1);
    expect(st.risks.some((x) => x.dedup.startsWith('SOURCE_DOWN:STENA_IRM:'))).toBe(true);
    expect(r2.stena_irm_backoff_until).toBe(
      new Date(after.getTime() + STENA_IRM_BACKOFF_MS).toISOString(),
    );
  });

  it('429 zachowuje się jak 403 (backoff + persist)', async () => {
    const st = new MemStore();
    const { d, irmHits } = deps(st, 429);
    const r = await runFerryAis(d);
    expect(irmHits.n).toBe(1);
    expect(st.risks.some((x) => x.dedup.startsWith('SOURCE_DOWN:STENA_IRM:'))).toBe(true);
    expect(r.stena_irm_backoff_until).toBeTruthy();
    await st.recordRun('ferry-ais', r.ok, r);
    clearStenaIrmBackoff();
    const again = deps(st, 429);
    await runFerryAis(again.d);
    expect(again.irmHits.n).toBe(0);
  });
});
