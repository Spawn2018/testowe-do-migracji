/**
 * @vitest-environment jsdom
 * #667 F — e2e pomarańczowych linii (jsdom + zachowanie PROD / SE-KAA).
 * #677 F7 r3 B1–B3: ZonesMap/Geofence w VITE_AUTH_MODE=supabase + mock RPC;
 * SE-KAA jako E22 + INLAND; brak POST przy komplecie 5 core; BN7 nie podnosi progu.
 * Playwright na buildzie VITE_AUTH_MODE=supabase: tests/i667-f-orange-maps.local.spec.ts
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { readFileSync } from 'node:fs';

beforeAll(() => {
  const proto = (globalThis as unknown as { SVGSVGElement?: { prototype: { createSVGRect?: () => DOMRect } } })
    .SVGSVGElement?.prototype;
  if (proto && typeof proto.createSVGRect !== 'function') {
    proto.createSVGRect = () => ({
      x: 0, y: 0, width: 0, height: 0,
      top: 0, right: 0, bottom: 0, left: 0,
      toJSON() { return {}; },
    }) as DOMRect;
  }
});

const { default: L } = await import('leaflet');
const { paintOrangeRoads, ORANGE_ROAD_STYLE } = await import('../src/components/map/orangeRoads');
const { DEMO_ROAD_LINES } = await import('../src/data/roadLinesDemo');
const { useTowerStore } = await import('../src/store/useTowerStore');
const { default: ZonesMap } = await import('../src/components/zones/ZonesMap');
const { GeofenceEditorMap } = await import('../src/components/map/GeofenceEditorMap');

const { rpc, getSession } = vi.hoisted(() => ({
  rpc: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc,
    auth: { getSession },
  }),
}));
vi.mock('../src/auth/config', () => ({
  SUPABASE_AUTH_ENABLED: true,
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-test',
}));

const {
  loadRoadLines,
  checkRoads,
  browserFetchLegCount,
  roadSpecFromRow,
  __resetRoadLinesCacheForTests,
  __setHereRoadsSessionMsForTests,
} = await import('../src/components/map/applyBasemap');
const { ROAD_KAA, ROAD_KAA_E22 } = await import('../supabase/functions/_shared/map/draw');
const {
  refreshRoadLegs,
  ROAD_CRON_REFRESH_MS,
  ROAD_LEGS,
} = await import('../supabase/functions/_shared/here/refreshRoadLegs.ts');
type RoadGeomRow = import('../supabase/functions/_shared/here/refreshRoadLegs.ts').RoadGeomRow;
type RoadRefreshStore = import('../supabase/functions/_shared/here/refreshRoadLegs.ts').RoadRefreshStore;
type LatLng = [number, number];

function orangeStrokeCount(root: ParentNode): number {
  return [...root.querySelectorAll('.leaflet-overlay-pane path')].filter((p) => {
    const stroke = (p.getAttribute('stroke') || '').toLowerCase();
    const style = (p.getAttribute('style') || '').toLowerCase();
    return stroke === '#e5a544' || /stroke:\s*#e5a544/.test(style);
  }).length;
}

function denseLine(from: LatLng, to: LatLng, n = 40): LatLng[] {
  const out: LatLng[] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    out.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]);
  }
  return out;
}

/** Gęsta linia przez via — ROAD_KAA / ROAD_KAA_E22 (minPoints 2000). */
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

const E22_CORRIDOR: LatLng[] = [
  [56.1646, 15.6308],
  [58.59, 16.18],
  [59.33, 18.05],
  [60.67, 17.14],
  [62.39, 17.31],
  [65.80539, 21.75914],
];

const INLAND_CORRIDOR: LatLng[] = [
  [56.1646, 15.6308],
  [58.59, 16.18],
  [59.61, 16.54], // Västerås — ROAD_KAA; za daleko od Sztokholmu E22
  [60.7, 17.1],
  [62.4, 17.4],
  [63.8, 20.2],
  [65.3, 21.5],
  [65.80539, 21.75914],
];

const SE_KAA_E22_LINE = denseVia(E22_CORRIDOR, 0.4);
const SE_KAA_INLAND_LINE = denseVia(INLAND_CORRIDOR, 0.4);
/** looseRoadOk: ≥200 pkt, odcinki ≤3 km, długość ≥80 km. */
const LOOSE_OK = denseLine([54.0, 18.0], [54.8, 19.2], 220);
const LOOSE_SE = denseVia(
  [[58.9, 17.9], [60.0, 17.5], [62.0, 17.3], [64.0, 20.0], [65.8, 21.7]],
  0.5,
);

function coreRoadsComplete() {
  return [
    {
      leg: 'PL-GDN',
      spec: 'loose',
      corridor_code: null,
      points: LOOSE_OK,
      browser_fetch: true,
      map_group: 'core',
      summary: '',
    },
    {
      leg: 'SE-NYN',
      spec: 'loose',
      corridor_code: null,
      points: LOOSE_SE,
      browser_fetch: true,
      map_group: 'core',
      summary: '',
    },
    {
      leg: 'PL-GDY',
      spec: 'loose',
      corridor_code: null,
      points: LOOSE_OK,
      browser_fetch: true,
      map_group: 'core',
      summary: '',
    },
    {
      leg: 'SE-KAA',
      spec: 'kaa',
      corridor_code: 'SE_E22',
      points: SE_KAA_E22_LINE,
      browser_fetch: true,
      map_group: 'core',
      summary: '',
    },
    {
      leg: 'SE-KAA-INLAND',
      spec: 'kaa',
      corridor_code: 'SE_KAA_INLAND',
      points: SE_KAA_INLAND_LINE,
      browser_fetch: true,
      map_group: 'core',
      summary: '',
    },
  ];
}

function bn7Placeholders() {
  return ['PL-TLL', 'PL-MUU', 'PL-PLD', 'FI-HEL', 'FI-VUO', 'SE-STO', 'SE-KPS'].map((leg) => ({
    leg,
    spec: 'loose',
    corridor_code: null,
    points: null as null,
    browser_fetch: false,
    map_group: 'bn7',
    summary: '— oczekuje na HERE',
  }));
}

describe('#667 F e2e — paintOrangeRoads + mapy (jsdom)', () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => { root?.unmount(); });
    host?.remove();
    document.querySelectorAll('.leaflet-container').forEach((n) => n.remove());
    vi.unstubAllEnvs();
    __resetRoadLinesCacheForTests();
  });

  it('paintOrangeRoads: ≥1 polilinia #E5A544; SE-KAA demo w DEMO_ROAD_LINES', () => {
    const el = document.createElement('div');
    el.style.width = '640px';
    el.style.height = '480px';
    document.body.appendChild(el);
    const map = L.map(el, { zoomControl: false }).setView([60, 18], 4);
    const roads = L.layerGroup().addTo(map);
    paintOrangeRoads(roads, DEMO_ROAD_LINES.map((l) => [...l]));
    expect(ORANGE_ROAD_STYLE.color.toLowerCase()).toBe('#e5a544');
    expect(roads.getLayers().length).toBeGreaterThanOrEqual(1);
    expect(roads.getLayers().length).toBe(DEMO_ROAD_LINES.length);
    for (const layer of roads.getLayers()) {
      expect((layer as L.Polyline).options.color?.toLowerCase()).toBe('#e5a544');
    }
    expect(orangeStrokeCount(el)).toBeGreaterThanOrEqual(1);
    expect(DEMO_ROAD_LINES.length).toBeGreaterThanOrEqual(3); // PL + SE-NYN + SE-KAA
    map.remove();
    el.remove();
  });

  it('B1 PROD: ZonesMap i GeofenceEditorMap ładują loadRoadLines (nie DEMO)', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    __resetRoadLinesCacheForTests();
    __setHereRoadsSessionMsForTests(5 * 60_000);
    rpc.mockReset();
    getSession.mockReset();
    // Jedna linia w RPC — DEMO ma 3; liczba pomarańczowych = 1 ⇒ gałąź PROD.
    const roads = [
      {
        leg: 'PL-GDY',
        spec: 'loose',
        corridor_code: null,
        points: LOOSE_OK,
        browser_fetch: true,
        map_group: 'core',
        summary: '',
      },
    ];
    rpc.mockResolvedValue({ data: { roads }, error: null });
    getSession.mockResolvedValue({ data: { session: null } });

    useTowerStore.setState({ theme: 'day' });
    host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '480px';
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root.render(createElement(ZonesMap, { mode: 'all', label: 'f-zones-prod', zones: [] }));
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    expect(host.querySelector('[data-zones-map="all"]')).toBeTruthy();
    expect(rpc).toHaveBeenCalled();
    expect(orangeStrokeCount(host)).toBe(1);
    expect(orangeStrokeCount(host)).not.toBe(DEMO_ROAD_LINES.length);

    await act(async () => { root.unmount(); });
    host.remove();
    document.querySelectorAll('.leaflet-container').forEach((n) => n.remove());

    __resetRoadLinesCacheForTests();
    rpc.mockClear();
    rpc.mockResolvedValue({ data: { roads }, error: null });

    host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '480px';
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root.render(createElement(GeofenceEditorMap, {
        lat: 52.1,
        lng: 17.0,
        radiusM: 500,
        hysteresisM: 50,
        onMove: () => undefined,
      }));
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    expect(host.querySelector('[data-geofence-map]')).toBeTruthy();
    expect(rpc).toHaveBeenCalled();
    // ≥1 pomarańcz z RPC; ≠ DEMO×3 (mutacja M5: gałąź demo).
    expect(orangeStrokeCount(host)).toBeGreaterThanOrEqual(1);
    expect(orangeStrokeCount(host)).toBeLessThan(DEMO_ROAD_LINES.length);
  });

  it('B1 mapPool PROD: acquireMap → loadRoadLines (1 linia, nie DEMO×3)', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    __resetRoadLinesCacheForTests();
    rpc.mockReset();
    getSession.mockReset();
    const roads = [
      {
        leg: 'PL-GDY',
        spec: 'loose',
        corridor_code: null,
        points: LOOSE_OK,
        browser_fetch: true,
        map_group: 'core',
        summary: '',
      },
    ];
    rpc.mockResolvedValue({ data: { roads }, error: null });
    getSession.mockResolvedValue({ data: { session: null } });

    const { acquireMap, releaseMap, __resetMapPool } = await import('../src/components/map/mapPool');
    __resetMapPool();
    host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '480px';
    document.body.appendChild(host);
    const entry = acquireMap(host, 'map');
    await act(async () => { await new Promise((r) => setTimeout(r, 400)); });
    expect(rpc).toHaveBeenCalled();
    expect(orangeStrokeCount(host)).toBe(1);
    expect(orangeStrokeCount(host)).not.toBe(DEMO_ROAD_LINES.length);
    releaseMap(entry, 'map');
    __resetMapPool();
  });
});

describe('#667 F e2e — SE-KAA E22 / INLAND (B2)', () => {
  beforeEach(() => {
    __resetRoadLinesCacheForTests();
    __setHereRoadsSessionMsForTests(5 * 60_000);
    rpc.mockReset();
    getSession.mockReset();
    getSession.mockResolvedValue({ data: { session: null } });
  });

  it('roadSpecFromRow kaa+SE_E22 → ROAD_KAA_E22; SE-KAA w accepted; INLAND vs E22', () => {
    expect(SE_KAA_E22_LINE.length).toBeGreaterThanOrEqual(2000);
    expect(roadSpecFromRow({ spec: 'kaa', corridor_code: 'SE_E22' })).toBe(ROAD_KAA_E22);
    expect(roadSpecFromRow({ spec: 'kaa', corridor_code: 'SE_KAA_INLAND' })).toBe(ROAD_KAA);

    const e22 = checkRoads([{
      leg: 'SE-KAA',
      spec: 'kaa',
      corridor_code: 'SE_E22',
      points: SE_KAA_E22_LINE,
      browser_fetch: true,
      map_group: 'core',
    }]);
    expect(e22.accepted).toHaveLength(1);
    expect(e22.rejected.some((r) => r.leg === 'SE-KAA')).toBe(false);

    const inlandAsE22 = checkRoads([{
      leg: 'SE-KAA',
      spec: 'kaa',
      corridor_code: 'SE_E22',
      points: SE_KAA_INLAND_LINE,
      browser_fetch: true,
      map_group: 'core',
    }]);
    expect(inlandAsE22.accepted).toHaveLength(0);
    expect(inlandAsE22.rejected.some((r) => r.leg === 'SE-KAA')).toBe(true);

    const inlandOk = checkRoads([{
      leg: 'SE-KAA-INLAND',
      spec: 'kaa',
      corridor_code: 'SE_KAA_INLAND',
      points: SE_KAA_INLAND_LINE,
      browser_fetch: true,
      map_group: 'core',
    }]);
    expect(inlandOk.accepted).toHaveLength(1);
    expect(inlandOk.rejected).toHaveLength(0);
  });

  it('loadRoadLines: SE-KAA w wyniku; PL-GDY nie wystarcza sam', async () => {
    const roads = [
      {
        leg: 'PL-GDY',
        spec: 'loose',
        corridor_code: null,
        points: LOOSE_OK,
        browser_fetch: true,
        map_group: 'core',
        summary: '',
      },
      {
        leg: 'SE-KAA',
        spec: 'kaa',
        corridor_code: 'SE_E22',
        points: SE_KAA_E22_LINE,
        browser_fetch: true,
        map_group: 'core',
        summary: '',
      },
      {
        leg: 'SE-KAA-INLAND',
        spec: 'kaa',
        corridor_code: 'SE_KAA_INLAND',
        points: null,
        browser_fetch: true,
        map_group: 'core',
        summary: '— oczekuje na HERE',
      },
    ];
    rpc.mockResolvedValue({ data: { roads }, error: null });

    const checked = checkRoads(roads);
    expect(checked.accepted).toHaveLength(2);
    expect(checked.rejected.some((r) => r.leg === 'SE-KAA-INLAND')).toBe(true);
    // Mutacja „pomiń SE-KAA” → accepted=1 (tylko PL-GDY).
    expect(checked.accepted.some((line) => line.length === SE_KAA_E22_LINE.length)).toBe(true);

    const lines = await loadRoadLines();
    expect(lines.length).toBe(2);
    expect(lines.some((line) => line.length === SE_KAA_E22_LINE.length)).toBe(true);
    expect(rpc).toHaveBeenCalled();
  });
});

describe('#667 F e2e — brak POST przy komplecie + BN7 (B3) + cron', () => {
  beforeEach(() => {
    __resetRoadLinesCacheForTests();
    __setHereRoadsSessionMsForTests(5 * 60_000);
    rpc.mockReset();
    getSession.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('B3: komplet 5 core + BN7 null → brak POST; BN7 nie podnosi progu', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });

    const roads = [...coreRoadsComplete(), ...bn7Placeholders()];
    expect(browserFetchLegCount(roads)).toBe(5);
    // Mutacja M4 (licz BN7) → 12.
    expect(browserFetchLegCount(roads)).toBeLessThan(roads.length);

    const checked = checkRoads(roads);
    expect(checked.accepted, `odrzucone: ${checked.rejected.map((r) => `${r.leg}:${r.why}`).join('; ')}`).toHaveLength(5);
    expect(checked.rejected).toHaveLength(7); // BN7 bez punktów — nie rysowane
    expect(checked.rejected.every((r) => bn7Placeholders().some((b) => b.leg === r.leg))).toBe(true);

    rpc.mockResolvedValue({ data: { roads }, error: null });
    const lines = await loadRoadLines();
    expect(lines).toHaveLength(5);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
  });

  it('wszystkie L.map / CorridorMap ładują loadRoadLines w PROD; TrackReplay bez własnego L.map', () => {
    const files = [
      'src/components/map/mapPool.ts',
      'src/components/map/CorridorMap.tsx',
      'src/components/map/GeofenceEditorMap.tsx',
      'src/components/zones/ZonesMap.tsx',
    ];
    for (const f of files) {
      const src = readFileSync(f, 'utf8');
      expect(src, f).toMatch(/loadRoadLines/);
      expect(src, f).toMatch(/paintOrangeRoads/);
      expect(src, f).toMatch(/VITE_AUTH_MODE/);
    }
    // TrackReplay dziedziczy warstwę z CorridorMap / mapPool — bez osobnego L.map dróg
    expect(readFileSync('src/components/map/TrackReplay.tsx', 'utf8')).not.toMatch(/L\.map\(/);
  });

  it('cron 21 d: attempted obejmuje SE-KAA (nie tylko liczba 5)', async () => {
    expect(ROAD_CRON_REFRESH_MS).toBe(21 * 864e5);
    expect(ROAD_CRON_REFRESH_MS).toBeLessThan(30 * 864e5);

    function geom(leg: string, ageMs: number, points: unknown = [[1, 2], [3, 4]]): RoadGeomRow {
      return {
        leg,
        fetched_at: new Date(Date.now() - ageMs).toISOString(),
        points,
        retry_after: null,
      };
    }
    const byLeg = new Map(ROAD_LEGS.map((l) => [l.leg, geom(l.leg, 25 * 864e5)]));
    const attemptedLegs: string[] = [];
    const s: RoadRefreshStore = {
      listGeometry: async () => [...byLeg.values()],
      async storeRoad(leg, points) {
        attemptedLegs.push(leg);
        byLeg.set(leg, {
          leg,
          fetched_at: new Date().toISOString(),
          points,
          retry_after: null,
        });
        return true;
      },
      loadCorridor: async () => ({
        code: 'x',
        pts: [[56.2, 15.6], [65.8, 21.7]] as LatLng[],
        via: [[60, 18]] as LatLng[],
        updatedAt: 0,
      }),
      monthSpend: async () => 0,
      noteRouting: async () => {},
    };
    const fetchFn = vi.fn(async () => new Response('nope', { status: 500 }));
    const r = await refreshRoadLegs(s, {
      fetch: fetchFn as unknown as typeof fetch,
      hereApiKey: 'k',
      maxAgeMs: ROAD_CRON_REFRESH_MS,
    });
    expect(r.attempted).toBe(5);
    expect(fetchFn.mock.calls.length).toBeGreaterThanOrEqual(5);
    // HTTP 500 → storeRoad(leg, null) — SE-KAA wśród prób, nie tylko attempted===5.
    expect(attemptedLegs).toContain('SE-KAA');
    expect(attemptedLegs).toContain('SE-KAA-INLAND');
    expect(attemptedLegs).toEqual(expect.arrayContaining([
      'PL-GDN', 'SE-NYN', 'PL-GDY', 'SE-KAA', 'SE-KAA-INLAND',
    ]));
  });
});
