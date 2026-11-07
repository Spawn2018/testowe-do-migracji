/**
 * DP-117 + DP-118 / F7 #693 r1 — max_rows:
 * - route-check loads: range+order+filtr terminalnych (nie .limit(500));
 * - resolveStaleRisks: stronicowanie otwartych risk_signals + batch `.in`.
 * Etap: C4; źródło PLAN rejestr DP / #691.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  fetchRouteCheckLoadRowsPaged,
  ROUTE_CHECK_LOADS_PAGE_SIZE,
  ROUTE_CHECK_TERMINAL_STATUSES,
} from '../supabase/functions/_shared/here/routeCheckLoads.ts';
import {
  fetchOpenRiskIdDedupPaged,
  RISK_STALE_PAGE_SIZE,
  RISK_STALE_UPDATE_BATCH,
  supabaseStore,
} from '../supabase/functions/_shared/integrations/store.ts';

describe('DP-117 — route-check loads (max_rows)', () => {
  it('Edge nie używa .limit(500); woła fetchRouteCheckLoadRowsPaged', () => {
    const src = readFileSync('supabase/functions/route-check/index.ts', 'utf8');
    expect(src).toContain('fetchRouteCheckLoadRowsPaged');
    expect(src).not.toMatch(/\.limit\(\s*500\s*\)/);
  });

  it('2350 aktywnych = 3 strony; komplet id; filtr terminalnych', async () => {
    const calls: { not?: [string, string, string]; range: [number, number] }[] = [];
    const rows = Array.from({ length: 2350 }, (_, i) => ({ id: `l${String(i).padStart(4, '0')}` }));
    const q = {
      select: () => q,
      not: (col: string, op: string, val: string) => {
        calls.push({ not: [col, op, val], range: [-1, -1] });
        return q;
      },
      order: () => q,
      range: async (a: number, b: number) => {
        calls.push({ range: [a, b] });
        return { data: rows.slice(a, b + 1), error: null };
      },
    };
    const out = await fetchRouteCheckLoadRowsPaged(() => q as never);
    expect(calls.some((c) => c.not?.[0] === 'status' && c.not?.[2] === ROUTE_CHECK_TERMINAL_STATUSES)).toBe(true);
    expect(calls.filter((c) => c.range[0] >= 0).map((c) => c.range)).toEqual([
      [0, ROUTE_CHECK_LOADS_PAGE_SIZE - 1],
      [ROUTE_CHECK_LOADS_PAGE_SIZE, 2 * ROUTE_CHECK_LOADS_PAGE_SIZE - 1],
      [2 * ROUTE_CHECK_LOADS_PAGE_SIZE, 3 * ROUTE_CHECK_LOADS_PAGE_SIZE - 1],
    ]);
    expect(out).toHaveLength(2350);
    expect(out[2349]?.id).toBe('l2349');
  });

  it('page cap → throw (nie ciche obcięcie)', async () => {
    const q = {
      select: () => q,
      not: () => q,
      order: () => q,
      range: async () => ({
        data: Array.from({ length: ROUTE_CHECK_LOADS_PAGE_SIZE }, (_, i) => ({ id: `x${i}` })),
        error: null,
      }),
    };
    await expect(fetchRouteCheckLoadRowsPaged(() => q as never, { pageSize: 10 })).rejects.toThrow(
      /page cap exceeded/,
    );
  });
});

describe('DP-118 — resolveStaleRisks (max_rows)', () => {
  it('fetchOpenRiskIdDedupPaged: 1500 otwartych = 2 strony', async () => {
    const calls: [number, number][] = [];
    const rows = Array.from({ length: 1500 }, (_, i) => ({
      id: `r${i}`,
      dedup_key: `ROAD_EE:old:${i}`,
    }));
    const q = {
      select: () => q,
      like: () => q,
      is: () => q,
      order: () => q,
      range: async (a: number, b: number) => {
        calls.push([a, b]);
        return { data: rows.slice(a, b + 1), error: null };
      },
    };
    const out = await fetchOpenRiskIdDedupPaged(() => q as never, 'ROAD_EE:%');
    expect(calls).toEqual([
      [0, RISK_STALE_PAGE_SIZE - 1],
      [RISK_STALE_PAGE_SIZE, 2 * RISK_STALE_PAGE_SIZE - 1],
    ]);
    expect(out).toHaveLength(1500);
  });

  it('resolveStaleRisks zamyka >1000 poza keep; update w paczkach', async () => {
    const open = Array.from({ length: 1200 }, (_, i) => ({
      id: `id${i}`,
      dedup_key: `ROAD_EE:x:${i}`,
    }));
    const keep = open.slice(0, 5).map((r) => r.dedup_key);
    const selectCalls: [number, number][] = [];
    const updateBatches: string[][] = [];
    const selectQ = {
      select: () => selectQ,
      like: () => selectQ,
      is: () => selectQ,
      order: () => selectQ,
      range: async (a: number, b: number) => {
        selectCalls.push([a, b]);
        return { data: open.slice(a, b + 1), error: null };
      },
    };
    const updateQ = {
      update: () => updateQ,
      in: (_col: string, ids: string[]) => {
        updateBatches.push(ids);
        return updateQ;
      },
      is: () => updateQ,
      select: async () => ({
        data: updateBatches[updateBatches.length - 1]!.map((id) => ({ id })),
        error: null,
      }),
    };
    const sb = {
      from: (table: string) => {
        if (table !== 'risk_signals') throw new Error(table);
        return {
          select: () => selectQ,
          update: () => updateQ,
        };
      },
    };
    const store = supabaseStore(sb as never);
    const n = await store.resolveStaleRisks!('ROAD_EE:', keep);
    expect(selectCalls).toEqual([
      [0, RISK_STALE_PAGE_SIZE - 1],
      [RISK_STALE_PAGE_SIZE, 2 * RISK_STALE_PAGE_SIZE - 1],
    ]);
    expect(n).toBe(1195);
    expect(updateBatches.length).toBe(Math.ceil(1195 / RISK_STALE_UPDATE_BATCH));
    expect(updateBatches[0]).toHaveLength(RISK_STALE_UPDATE_BATCH);
    expect(updateBatches.flat()).toHaveLength(1195);
    expect(updateBatches.flat()).not.toContain('id0');
  });
});
