/**
 * #677 F7 r1 B2 — testy zachowania słownika BN7 / roadSpecFromRow / browserFetchLegCount.
 * Mutacje M1–M4 z F7 mają padać (nie tylko grep w źródle).
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

vi.mock('leaflet', () => ({ default: {} }));
vi.mock('../src/auth/config', () => ({
  SUPABASE_AUTH_ENABLED: true,
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-test',
}));

const {
  browserFetchLegCount,
  acceptedBrowserFetchCount,
  checkRoads,
  roadSpecFromRow,
} = await import('../src/components/map/applyBasemap');
const { ROAD_KAA, ROAD_KAA_E22 } = await import('../supabase/functions/_shared/map/draw');
type LatLng = [number, number];

function denseVia(pts: readonly LatLng[], stepKm: number): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i < pts.length - 1; i += 1) {
    const [aLat, aLng] = pts[i]!;
    const [bLat, bLng] = pts[i + 1]!;
    const dLat = bLat - aLat;
    const dLng = bLng - aLng;
    const dist = Math.hypot(dLat * 111, dLng * 111 * Math.cos((aLat * Math.PI) / 180));
    const n = Math.max(1, Math.ceil(dist / stepKm));
    for (let k = 0; k < n; k += 1) {
      out.push([aLat + (dLat * k) / n, aLng + (dLng * k) / n]);
    }
  }
  out.push(pts[pts.length - 1]!);
  return out;
}

describe('#677 F7 B2 roadSpecFromRow / checkRoads kaa', () => {
  const inlandCorridor: LatLng[] = [
    [56.1646, 15.6308],
    [58.59, 16.18],
    [59.61, 16.54], // Västerås — ROAD_KAA; za daleko od Sztokholmu E22
    [60.7, 17.1],
    [62.4, 17.4],
    [63.8, 20.2],
    [65.3, 21.5],
    [65.80539, 21.75914],
  ];

  it('kaa+SE_E22 → ROAD_KAA_E22; kaa+SE_KAA_INLAND → ROAD_KAA', () => {
    expect(roadSpecFromRow({ spec: 'kaa', corridor_code: 'SE_E22' })).toBe(ROAD_KAA_E22);
    expect(roadSpecFromRow({ spec: 'kaa', corridor_code: 'SE_KAA_INLAND' })).toBe(ROAD_KAA);
    expect(roadSpecFromRow({ spec: 'kaa', corridor_code: null })).toBe(ROAD_KAA);
  });

  it('linia śródlądowa: SE_E22 odrzuca, SE_KAA_INLAND przyjmuje', () => {
    const line = denseVia(inlandCorridor, 0.4);
    const e22 = checkRoads([{
      leg: 'SE-KAA',
      spec: 'kaa',
      corridor_code: 'SE_E22',
      points: line,
      browser_fetch: true,
      map_group: 'core',
    }]);
    const inland = checkRoads([{
      leg: 'SE-KAA-INLAND',
      spec: 'kaa',
      corridor_code: 'SE_KAA_INLAND',
      points: line,
      browser_fetch: true,
      map_group: 'core',
    }]);
    expect(e22.accepted).toHaveLength(0);
    expect(e22.rejected.some((r) => r.leg === 'SE-KAA')).toBe(true);
    expect(inland.accepted).toHaveLength(1);
    expect(inland.rejected).toHaveLength(0);
  });
});

describe('#677 F7 B2 browserFetchLegCount', () => {
  it('12 wierszy (5 core + 7 BN7) → 5', () => {
    const core = ['PL-GDN', 'SE-NYN', 'PL-GDY', 'SE-KAA', 'SE-KAA-INLAND'].map((leg) => ({
      leg,
      browser_fetch: true,
      map_group: 'core',
    }));
    const bn7 = ['PL-TLL', 'PL-MUU', 'PL-PLD', 'FI-HEL', 'FI-VUO', 'SE-STO', 'SE-KPS'].map((leg) => ({
      leg,
      browser_fetch: false,
      map_group: 'bn7',
    }));
    expect(browserFetchLegCount([...core, ...bn7])).toBe(5);
  });

  it('BN7 z browser_fetch true nadal poza progiem (map_group)', () => {
    const rows = [
      { leg: 'PL-GDN', browser_fetch: true, map_group: 'core' },
      { leg: 'PL-TLL', browser_fetch: true, map_group: 'bn7' },
    ];
    expect(browserFetchLegCount(rows)).toBe(1);
  });
});

describe('DP-43 acceptedBrowserFetchCount', () => {
  it('BN7 z punktami nie liczy się do przyjętych browser_fetch', () => {
    const line = denseVia(
      [[54.0, 18.0], [54.4, 18.5], [54.8, 19.2]],
      0.4,
    );
    const rows = [
      {
        leg: 'PL-GDN',
        spec: 'loose',
        corridor_code: null,
        points: line,
        browser_fetch: true,
        map_group: 'core',
        summary: '',
      },
      {
        leg: 'PL-TLL',
        spec: 'loose',
        corridor_code: null,
        points: line,
        browser_fetch: true,
        map_group: 'bn7',
        summary: '',
      },
      {
        leg: 'SE-NYN',
        spec: 'loose',
        corridor_code: null,
        points: null,
        browser_fetch: true,
        map_group: 'core',
        summary: 'brak',
      },
    ];
    expect(checkRoads(rows).accepted.length).toBe(2);
    expect(acceptedBrowserFetchCount(rows)).toBe(1);
    expect(browserFetchLegCount(rows)).toBe(2);
  });
});

describe('DP-56 / DP-57 — listLegs error + CORS', () => {
  function fakeSb(result: { data: unknown; error: { message: string } | null }) {
    const chain = {
      select() {
        return chain;
      },
      eq() {
        return chain;
      },
      order() {
        return Promise.resolve(result);
      },
    };
    return { from: () => chain };
  }

  it('DP-56: listHereRoadLegsFromSb — {error} → rejects (Edge listLegs)', async () => {
    const { listHereRoadLegsFromSb } = await import(
      '../supabase/functions/_shared/here/listHereRoadLegsFromSb.ts'
    );
    await expect(
      listHereRoadLegsFromSb(fakeSb({ data: null, error: { message: 'db-down' } })),
    ).rejects.toThrow(/here_road_legs: db-down/);
  });

  it('DP-56: store listHereRoadLegs — {error} → rejects', async () => {
    const { supabaseStore } = await import(
      '../supabase/functions/_shared/integrations/store.ts'
    );
    await expect(
      supabaseStore(fakeSb({ data: null, error: { message: 'rpc-fail' } }) as never).listHereRoadLegs!(),
    ).rejects.toThrow(/here_road_legs: rpc-fail/);
  });

  it('DP-56: pusty słownik → zapas ROAD_LEGS (nie ciche [])', async () => {
    const { listHereRoadLegsFromSb } = await import(
      '../supabase/functions/_shared/here/listHereRoadLegsFromSb.ts'
    );
    const { ROAD_LEGS } = await import(
      '../supabase/functions/_shared/here/refreshRoadLegs.ts'
    );
    const legs = await listHereRoadLegsFromSb(fakeSb({ data: [], error: null }));
    expect(legs).toEqual([...ROAD_LEGS]);
  });

  it('DP-56/57: Edge używa listHereRoadLegsFromSb; try/catch + corsHeaders przy wyjątku', () => {
    const edge = readFileSync('supabase/functions/here-roads/index.ts', 'utf8');
    expect(edge).toMatch(/listHereRoadLegsFromSb/);
    expect(edge).toMatch(/try\s*\{[\s\S]*refreshRoadLegs[\s\S]*\}\s*catch/);
    expect(edge).toMatch(/ok:\s*false,\s*reason/);
    expect(edge).toMatch(/corsHeaders\(\)/);
  });
});
