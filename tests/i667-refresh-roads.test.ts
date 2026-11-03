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
    monthSpend: async () => spend,
    noteRouting: async () => {},
  };
}

describe('#667 C refreshRoadLegs', () => {
  it('ma 5 legów i próg cron 6 d (DP-198)', () => {
    expect(ROAD_LEGS.map((l) => l.leg)).toEqual([
      'PL-GDN', 'SE-NYN', 'PL-GDY', 'SE-KAA', 'SE-KAA-INLAND',
    ]);
    expect(ROAD_CRON_REFRESH_MS).toBe(6 * 864e5);
    expect(ROAD_CRON_REFRESH_MS).toBeLessThan(7 * 864e5);
  });

  it('nie woła HERE gdy wszystkie legi świeższe niż 6 d', async () => {
    const fetchFn = vi.fn();
    const s = store(ROAD_LEGS.map((l) => geom(l.leg, 3 * 864e5)));
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

  it('stare wiersze bez punktów → missingLegs; HTTP 500 → retry_after (F7 r1 N1)', async () => {
    const fetchFn = vi.fn(async () => new Response('nope', { status: 500 }));
    const s = store(ROAD_LEGS.map((l) => geom(l.leg, 40 * 864e5, null)));
    const retries: string[] = [];
    const orig = s.storeRoad.bind(s);
    s.storeRoad = async (leg, points, summary, nowIso) => {
      if (nowIso) retries.push(leg);
      return orig(leg, points, summary, nowIso);
    };
    const r = await refreshRoadLegs(s, {
      fetch: fetchFn as unknown as typeof fetch,
      hereApiKey: 'k',
      maxAgeMs: ROAD_CRON_REFRESH_MS,
    });
    expect(r.attempted).toBe(5);
    expect(r.missingLegs.length).toBe(5);
    expect(r.warnings.some((w) => /HTTP 500/.test(w))).toBe(true);
    expect(retries).toHaveLength(5);
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

  it('F7 r4: brak hereMonthSpend (null) → bez wołania HERE + ostrzeżenie', async () => {
    const fetchFn = vi.fn();
    const s = store(ROAD_LEGS.map((l) => geom(l.leg, 40 * 864e5, null)));
    s.monthSpend = async () => null;
    const r = await refreshRoadLegs(s, {
      fetch: fetchFn as unknown as typeof fetch,
      hereApiKey: 'k',
      maxAgeMs: ROAD_CRON_REFRESH_MS,
    });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(r.skippedBudget).toBe(false);
    expect(r.attempted).toBe(0);
    expect(r.warnings.some((w) => /hereMonthSpend|wydatku HERE/i.test(w))).toBe(true);
    expect(r.missingLegs).toEqual(ROAD_LEGS.map((l) => l.leg));
  });

  /** #677 F7 r1 B1/B2 / BN7 #718 — BN7 poza browserOnly/cron (cron_fetch); pusty → ROAD_LEGS. */
  const BN7_OFF = {
    leg: 'PL-TLL',
    origin: '52.07,17.02',
    destination: '59.44,24.75',
    spec: 'loose' as const,
    summary: 'BN7 placeholder',
    browserFetch: false,
    mapGroup: 'bn7' as const,
    cronFetch: false,
  };

  it('F7 #677 B2 / BN7: cron_fetch false — brak fetch w browserOnly i cronie; poza missingLegs', async () => {
    const legs = [...ROAD_LEGS, BN7_OFF];
    const stale = [
      ...ROAD_LEGS.map((l) => geom(l.leg, 40 * 864e5, null)),
      geom('PL-TLL', 40 * 864e5, null),
    ];

    const fetchBrowser = vi.fn(async () => new Response('nope', { status: 500 }));
    const sBrowser = store(stale);
    sBrowser.listLegs = async () => legs;
    const browser = await refreshRoadLegs(sBrowser, {
      fetch: fetchBrowser as unknown as typeof fetch,
      hereApiKey: 'k',
      maxAgeMs: ROAD_CRON_REFRESH_MS,
      browserOnly: true,
    });
    expect(browser.attempted).toBe(5);
    expect(browser.missingLegs).toEqual(ROAD_LEGS.map((l) => l.leg));
    expect(browser.missingLegs).not.toContain('PL-TLL');

    const fetchCron = vi.fn(async () => new Response('nope', { status: 500 }));
    const sCron = store(stale);
    sCron.listLegs = async () => legs;
    const cron = await refreshRoadLegs(sCron, {
      fetch: fetchCron as unknown as typeof fetch,
      hereApiKey: 'k',
      maxAgeMs: ROAD_CRON_REFRESH_MS,
    });
    expect(cron.attempted).toBe(5);
    expect(cron.missingLegs).toEqual(ROAD_LEGS.map((l) => l.leg));
    expect(cron.missingLegs).not.toContain('PL-TLL');
  });

  it('F7 #677 B1: pusty listLegs → zapas ROAD_LEGS (nie stored:0 w ciszy)', async () => {
    const fetchFn = vi.fn(async () => new Response('nope', { status: 500 }));
    const s = store(ROAD_LEGS.map((l) => geom(l.leg, 40 * 864e5, null)));
    s.listLegs = async () => [];
    const r = await refreshRoadLegs(s, {
      fetch: fetchFn as unknown as typeof fetch,
      hereApiKey: 'k',
      maxAgeMs: ROAD_CRON_REFRESH_MS,
    });
    expect(r.attempted).toBe(5);
    expect(r.missingLegs).toEqual(ROAD_LEGS.map((l) => l.leg));
  });
});

describe('DP-197 / F7 #771 SE-NYN corridorDev', () => {
  const seNyn = ROAD_LEGS.find((l) => l.leg === 'SE-NYN')!;
  const e4Via = seNyn.viaPoints ?? [];

  /** Gęsta linia [lat,lng] przez punkty (jak i667-f7). */
  function denseVia(pts: readonly [number, number][], stepKm: number): [number, number][] {
    const hav = (a: [number, number], b: [number, number]) => {
      const R = 6371;
      const toR = (d: number) => (d * Math.PI) / 180;
      const dLat = toR(b[0] - a[0]);
      const dLng = toR(b[1] - a[1]);
      const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toR(a[0])) * Math.cos(toR(b[0])) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(h));
    };
    const out: [number, number][] = [];
    for (let i = 0; i < pts.length - 1; i += 1) {
      const [aLat, aLng] = pts[i]!;
      const [bLat, bLng] = pts[i + 1]!;
      const dist = hav(pts[i]!, pts[i + 1]!);
      const n = Math.max(1, Math.ceil(dist / stepKm));
      for (let k = 0; k < n; k += 1) {
        out.push([aLat + ((bLat - aLat) * k) / n, aLng + ((bLng - aLng) * k) / n]);
      }
    }
    out.push(pts[pts.length - 1]!);
    return out;
  }

  it('via E4 trafiają do URL (passThrough)', async () => {
    expect(e4Via.length).toBeGreaterThanOrEqual(5);
    expect(e4Via[0]).toEqual([59.322, 18.005]);
    const urls: string[] = [];
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      urls.push(String(input));
      return new Response('nope', { status: 500 });
    });
    const s: RoadRefreshStore = {
      listLegs: async () => [seNyn],
      listGeometry: async () => [geom('SE-NYN', 40 * 864e5, null)],
      storeRoad: async () => true,
      loadCorridor: async (code) => ({
        code,
        pts: denseVia([[58.9, 17.95], [65.81, 21.76]], 20),
        via: e4Via,
        updatedAt: 0,
      }),
      monthSpend: async () => 0,
      noteRouting: async () => {},
    };
    await refreshRoadLegs(s, {
      fetch: fetchFn as unknown as typeof fetch,
      hereApiKey: 'k',
      maxAgeMs: ROAD_CRON_REFRESH_MS,
    });
    expect(urls).toHaveLength(1);
    const u = decodeURIComponent(urls[0]!);
    expect(u).toMatch(/via=59\.322,18\.005!passThrough=true/);
    expect(u).toMatch(/via=59\.8767,17\.6953!passThrough=true/);
    expect(u).toMatch(/via=65\.606,22\.053!passThrough=true/);
  });

  it('brak korytarza → pominięcie (bez HERE)', async () => {
    const fetchFn = vi.fn();
    const s: RoadRefreshStore = {
      listLegs: async () => [seNyn],
      listGeometry: async () => [geom('SE-NYN', 40 * 864e5, null)],
      storeRoad: async () => true,
      loadCorridor: async (code) => ({ code, pts: [], via: [], updatedAt: 0 }),
      monthSpend: async () => 0,
      noteRouting: async () => {},
    };
    const r = await refreshRoadLegs(s, {
      fetch: fetchFn as unknown as typeof fetch,
      hereApiKey: 'k',
      maxAgeMs: ROAD_CRON_REFRESH_MS,
    });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(r.attempted).toBe(0);
    expect(r.warnings.some((w) => /SE-NYN: brak korytarza/.test(w))).toBe(true);
  });

  it('odchyłka od SE_E4 → storeRoad(null) + retry 24 h', async () => {
    const { encodeFlexiblePolyline } = await import(
      '../supabase/functions/_shared/here/flexPolyline.ts'
    );
    // Linia spełnia ROAD_SE (≥900 km + via); korytarz daleko na zachodzie → odchyłka.
    const goodLine = denseVia(
      [
        [58.90453, 17.95621], [59.195, 17.628], [58.90453, 17.95621], // pad km
        [59.322, 18.005], [59.8767, 17.6953], [60.67, 17.14],
        [61.73, 17.065], [62.39, 17.31], [63.81, 20.33],
        [65.606, 22.053], [65.80539, 21.75914],
      ],
      0.35,
    );
    expect(goodLine.length).toBeGreaterThan(2000);
    const poly = encodeFlexiblePolyline(goodLine);
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({
        routes: [{ sections: [{ polyline: poly }] }],
      }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    const corridorPts = denseVia([[58.9, 12.0], [62.0, 12.0], [65.8, 12.0]], 5);
    const nowMs = Date.parse('2026-11-03T16:00:00Z');
    const stored: Array<{ leg: string; points: unknown; nowIso?: string }> = [];
    const s: RoadRefreshStore = {
      listLegs: async () => [seNyn],
      listGeometry: async () => [geom('SE-NYN', 40 * 864e5, null)],
      storeRoad: async (leg, points, _summary, nowIso) => {
        stored.push({ leg, points, nowIso });
        return true;
      },
      loadCorridor: async (code) => ({
        code,
        pts: corridorPts,
        via: e4Via,
        updatedAt: 0,
      }),
      monthSpend: async () => 0,
      noteRouting: async () => {},
    };
    const r = await refreshRoadLegs(s, {
      fetch: fetchFn as unknown as typeof fetch,
      hereApiKey: 'k',
      maxAgeMs: ROAD_CRON_REFRESH_MS,
      nowMs,
    });
    expect(r.attempted).toBe(1);
    expect(r.stored).toBe(0);
    expect(r.warnings.some((w) => /SE-NYN: odchyłka od SE_E4/.test(w))).toBe(true);
    expect(stored).toHaveLength(1);
    expect(stored[0]!.points).toBeNull();
    expect(stored[0]!.nowIso).toBe(new Date(nowMs + 24 * 3600e3).toISOString());
  });
});
