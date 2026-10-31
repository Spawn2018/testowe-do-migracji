/**
 * @vitest-environment jsdom
 * #667 F — e2e pomarańczowych linii (jsdom + zachowanie PROD / SE-KAA).
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
  __resetRoadLinesCacheForTests,
  __setHereRoadsSessionMsForTests,
} = await import('../src/components/map/applyBasemap');
const {
  refreshRoadLegs,
  ROAD_CRON_REFRESH_MS,
  ROAD_LEGS,
} = await import('../supabase/functions/_shared/here/refreshRoadLegs.ts');
type RoadGeomRow = import('../supabase/functions/_shared/here/refreshRoadLegs.ts').RoadGeomRow;
type RoadRefreshStore = import('../supabase/functions/_shared/here/refreshRoadLegs.ts').RoadRefreshStore;

function orangeStrokeCount(root: ParentNode): number {
  return [...root.querySelectorAll('.leaflet-overlay-pane path')].filter((p) => {
    const stroke = (p.getAttribute('stroke') || '').toLowerCase();
    const style = (p.getAttribute('style') || '').toLowerCase();
    return stroke === '#e5a544' || /stroke:\s*#e5a544/.test(style);
  }).length;
}

function denseLine(from: [number, number], to: [number, number], n = 40): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    out.push([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t]);
  }
  return out;
}

/** Demo Karlskrona→Sztokholm (E22) — ta sama linia co DEMO_ROAD_LINES[2]. */
const SE_KAA_E22_LINE: [number, number][] = DEMO_ROAD_LINES[2]!.map(([lat, lng]) => [lat, lng]);

describe('#667 F e2e — paintOrangeRoads + mapy (jsdom)', () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => { root?.unmount(); });
    host?.remove();
    document.querySelectorAll('.leaflet-container').forEach((n) => n.remove());
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

  it('ZonesMap i GeofenceEditorMap: ≥1 pomarańczowa polilinia na mapie', async () => {
    useTowerStore.setState({ theme: 'day' });
    host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '480px';
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root.render(createElement(ZonesMap, { mode: 'all', label: 'f-zones', zones: [] }));
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(host.querySelector('[data-zones-map="all"]')).toBeTruthy();
    expect(orangeStrokeCount(host)).toBeGreaterThanOrEqual(1);

    await act(async () => {
      root.render(createElement(GeofenceEditorMap, {
        lat: 52.1,
        lng: 17.0,
        radiusM: 500,
        hysteresisM: 50,
        onMove: () => undefined,
      }));
    });
    await act(async () => { await new Promise((r) => setTimeout(r, 300)); });
    expect(host.querySelector('[data-geofence-map]')).toBeTruthy();
    expect(orangeStrokeCount(host)).toBeGreaterThanOrEqual(1);
  });
});

describe('#667 F e2e — SE-KAA w loadRoadLines (PROD mock)', () => {
  beforeEach(() => {
    __resetRoadLinesCacheForTests();
    __setHereRoadsSessionMsForTests(5 * 60_000);
    rpc.mockReset();
    getSession.mockReset();
    getSession.mockResolvedValue({ data: { session: null } });
  });

  it('map_display_state zawiera SE-KAA z punktami; loadRoadLines przyjmuje luźny leg', async () => {
    // looseRoadOk: ≥200 pkt, odcinki ≤3 km, długość ≥80 km
    const looseOk = denseLine([54.0, 18.0], [54.8, 19.2], 220);
    const roads = [
      {
        leg: 'PL-GDY',
        spec: 'loose',
        corridor_code: null,
        points: looseOk,
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
    expect(roads.some((r) => r.leg === 'SE-KAA' && Array.isArray(r.points) && r.points!.length >= 2)).toBe(true);
    rpc.mockResolvedValue({ data: { roads }, error: null });

    const checked = checkRoads(roads);
    expect(checked.accepted.length).toBeGreaterThanOrEqual(1);
    expect(checked.rejected.some((r) => r.leg === 'SE-KAA-INLAND')).toBe(true);

    const lines = await loadRoadLines();
    expect(lines.length).toBeGreaterThanOrEqual(1);
    expect(rpc).toHaveBeenCalled();
  });
});

describe('#667 F e2e — mapy PROD + cron przed purge', () => {
  it('wszystkie L.map / CorridorMap ładują loadRoadLines w PROD (nie tylko demo)', () => {
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
    }
    // TrackReplay dziedziczy warstwę z CorridorMap / mapPool — bez osobnego L.map dróg
    expect(readFileSync('src/components/map/TrackReplay.tsx', 'utf8')).not.toMatch(/L\.map\(/);
  });

  it('cron 21 d odświeża legi 25 d (przed purge 30 d) — attempted obejmuje SE-KAA', async () => {
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
    const s: RoadRefreshStore = {
      listGeometry: async () => [...byLeg.values()],
      async storeRoad(leg, points) {
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
        pts: [[56.2, 15.6], [65.8, 21.7]] as [number, number][],
        via: [[60, 18]] as [number, number][],
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
    // Cron woła HERE przy 25 d (przed purge 30 d). attempted=5 = wszystkie core, w tym SE-KAA.
    expect(r.attempted).toBe(5);
    expect(fetchFn.mock.calls.length).toBeGreaterThanOrEqual(5);
  });
});
