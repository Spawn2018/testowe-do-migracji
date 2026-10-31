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

describe('#677 F7 B1 Edge listLegs — brak cichego fail-open', () => {
  it('here-roads listLegs: if (r.error) throw + zapas ROAD_LEGS', () => {
    const edge = readFileSync('supabase/functions/here-roads/index.ts', 'utf8');
    expect(edge).toMatch(/if \(r\.error\) throw/);
    expect(edge).toMatch(/rows\.length === 0\) return \[\.\.\.ROAD_LEGS\]/);
    expect(edge).toMatch(/legDefFromRow/);
  });
});
