/**
 * @vitest-environment jsdom
 * DP-76 (decyzje właściciela 31.10.2026): tory promów na WSZYSTKICH mapach — jeden styl zależny od motywu,
 * przerywany „6 6”, grubość 3: jasny motyw `#3A82BA` krycie 1, ciemny `#6BA8D6` krycie 0,9.
 * Zachowanie (jsdom), sparametryzowane motywem:
 *  - mapa korytarza (`CorridorMap` w trybie produkcyjnym; `loadFerryLines` dostaje 2 przeprawy z HERE z podmienionego klienta):
 *    tory z HERE (CorridorMap) i stałe tory (`mapPool.drawFerryLanes`) w warstwie promu;
 *  - mapa Stref (`ZonesMap` mode="all");
 *  - zmiana motywu na żywo przerysowuje tory na obu mapach.
 * Tory rozpoznawane po położeniu pierwszego punktu, nie po stylu ani klasie — własny styl w jednym miejscu wywala test.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { LatLng, Polyline } from 'leaflet';

/* przeprawy „z serwera” (HERE, `map_display_state.ferries`) — położenie inne niż stałe tory, żeby dało się je rozpoznać;
   końce przy portach i kroki < 150 km (przechodzą `checkFerries`) */
const HERE_FERRIES = vi.hoisted(() => [
  { leg: 'FERRY-GDN-NYN' as const, line: [[54.4, 18.67], [55.5, 18.9], [56.6, 19.0], [57.7, 18.6], [58.9, 17.95]] as [number, number][] },
  { leg: 'FERRY-GDY-KAA' as const, line: [[54.533, 18.54], [55.2, 17.6], [55.7, 16.6], [56.15, 15.62]] as [number, number][] },
]);

/* tryb produkcyjny: `loadFerryLines` (src/components/map/applyBasemap.ts) czyta `map_display_state` przez klienta Supabase —
   podmieniony klient zwraca 2 przeprawy (ten sam wzorzec co tests/i667-f-e2e-orange-roads.jsdom.test.ts) */
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ rpc, auth: { getSession: async () => ({ data: { session: null } }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } }),
}));
vi.mock('../src/auth/config', () => ({
  SUPABASE_AUTH_ENABLED: true,
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-test',
}));

beforeAll(() => {
  const proto = (globalThis as unknown as { SVGSVGElement?: { prototype: { createSVGRect?: () => DOMRect } } })
    .SVGSVGElement?.prototype;
  if (proto && typeof proto.createSVGRect !== 'function') {
    proto.createSVGRect = () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0, toJSON() { return {}; } }) as DOMRect;
  }
  (globalThis as unknown as { CSS?: { escape?: (s: string) => string } }).CSS ??= { escape: (s: string) => s };
  Element.prototype.scrollIntoView ??= function scrollIntoView() { /* jsdom */ };
});

const { default: L } = await import('leaflet');
const { useTowerStore } = await import('../src/store/useTowerStore');
const { default: ZonesMap } = await import('../src/components/zones/ZonesMap');
const { CorridorMap } = await import('../src/components/map/CorridorMap');
const { __resetMapPool } = await import('../src/components/map/mapPool');
const { __resetRoadLinesCacheForTests } = await import('../src/components/map/applyBasemap');
const { FERRY_LANE_STYLES, ferryLaneStyle, ferryLaneLines, HERE_FERRY_LEGS } = await import('../src/lib/map/ferryLanes');

type Theme = 'light' | 'dark';
type LaneStyle = { color?: string; weight?: number; opacity?: number; dashArray?: string | number[] };
/** Oczekiwane wartości z decyzji właściciela (przypięte — nie z kodu). */
const EXPECTED: Record<Theme, LaneStyle> = {
  light: { color: '#3A82BA', weight: 3, opacity: 1, dashArray: '6 6' },
  dark: { color: '#6BA8D6', weight: 3, opacity: 0.9, dashArray: '6 6' },
};
const other = (t: Theme): Theme => (t === 'light' ? 'dark' : 'light');

const styleOf = (pl: Polyline): LaneStyle => {
  const { color, weight, opacity, dashArray } = pl.options;
  return { color, weight, opacity, dashArray };
};
const key = (lat: number, lng: number) => `${lat},${lng}`;
const startKey = (pl: Polyline) => {
  const p = (pl.getLatLngs() as LatLng[])[0];
  return key(p.lat, p.lng);
};
const fixedStarts = (skip: ReadonlySet<string> = new Set()) => new Set(ferryLaneLines(skip).map((l) => key(l[0][0], l[0][1])));
const hereStarts = () => new Set(HERE_FERRIES.map((f) => key(f.line[0][0], f.line[0][1])));

let host: HTMLDivElement | null = null;
let root: Root | null = null;
const mount = () => {
  host = document.createElement('div');
  host.style.cssText = 'width:1200px;height:800px;position:relative';
  document.body.appendChild(host);
  root = createRoot(host);
};
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

afterEach(async () => {
  /* w jsdom mapa ma rozmiar 0 px — zapamiętanie widoku przy odkładaniu mapy do puli może rzucić; nie dotyczy torów */
  try { await act(async () => { root?.unmount(); }); } catch { /* jsdom */ }
  root = null;
  host?.remove();
  host = null;
  document.querySelectorAll('.leaflet-container').forEach((n) => n.remove());
  __resetMapPool();
  vi.unstubAllEnvs();
});

/** Polilinie utworzone przez L.polyline (spy), których pierwszy punkt należy do `starts` i które są na mapie. */
function lanesOn(spy: { mock: { results: { value: unknown }[] } }, starts: Set<string>): Polyline[] {
  return spy.mock.results
    .map((r) => r.value as Polyline)
    .filter((pl) => starts.has(startKey(pl)) && !!(pl as unknown as { _map?: unknown })._map);
}

function expectLanes(lanes: Polyline[], theme: Theme) {
  for (const pl of lanes) {
    expect(styleOf(pl)).toEqual(EXPECTED[theme]);
    const path = pl.getElement();
    expect(path?.getAttribute('stroke')).toBe(EXPECTED[theme].color);
    expect(path?.getAttribute('stroke-opacity')).toBe(String(EXPECTED[theme].opacity));
    expect(path?.getAttribute('stroke-dasharray')).toBe(EXPECTED[theme].dashArray);
  }
}

describe('DP-76 · styl torów promów zależny od motywu (wspólna funkcja)', () => {
  it('ferryLaneStyle: jasny → #3A82BA / 1, ciemny → #6BA8D6 / 0,9; oba „6 6”, grubość 3', () => {
    expect(ferryLaneStyle('light')).toEqual(EXPECTED.light);
    expect(ferryLaneStyle('dark')).toEqual(EXPECTED.dark);
    expect(FERRY_LANE_STYLES.light).toEqual(EXPECTED.light);
    expect(FERRY_LANE_STYLES.dark).toEqual(EXPECTED.dark);
  });
});

for (const theme of ['light', 'dark'] as const) {
  describe(`DP-76 · motyw ${theme}`, () => {
    it('mapa korytarza (produkcja): przeprawy z HERE i stałe tory w warstwie promu — styl motywu; zmiana motywu przerysowuje', async () => {
      vi.stubEnv('VITE_AUTH_MODE', 'supabase');
      __resetRoadLinesCacheForTests();
      rpc.mockReset();
      rpc.mockImplementation(async (fn: string) => (fn === 'map_display_state'
        ? { data: { ferries: HERE_FERRIES.map((f) => ({ leg: f.leg, points: f.line })), roads: [] }, error: null }
        : { data: null, error: null }));
      useTowerStore.setState({ theme });
      const spy = vi.spyOn(L, 'polyline');
      try {
        mount();
        await act(async () => { root!.render(createElement(CorridorMap, { loads: [], embedded: true, slot: 'kokpit' })); });
        /* basemapReady (ensureBasemap albo 1,5 s) → loadFerryLines */
        await wait(2200);
        /* przeprawy z HERE przyjęte (L56: `data-ferries`) */
        expect(host!.querySelector('.corridor-map-el')?.getAttribute('data-ferries')).toBe('FERRY-GDN-NYN: HERE · FERRY-GDY-KAA: HERE');
        const here = lanesOn(spy, hereStarts());
        const fixed = lanesOn(spy, fixedStarts(new Set(HERE_FERRY_LEGS)));
        expect(here).toHaveLength(HERE_FERRIES.length);
        expect(fixed).toHaveLength(ferryLaneLines(new Set(HERE_FERRY_LEGS)).length);
        expectLanes([...here, ...fixed], theme);
        /* zmiana motywu na żywo */
        await act(async () => { useTowerStore.setState({ theme: other(theme) }); });
        await wait(50);
        expectLanes([...here, ...fixed], other(theme));
      } finally {
        spy.mockRestore();
      }
    }, 15_000);

    it('mapa Stref (mode="all"): wszystkie tory w stylu motywu; zmiana motywu przerysowuje', async () => {
      useTowerStore.setState({ theme });
      const spy = vi.spyOn(L, 'polyline');
      try {
        mount();
        await act(async () => { root!.render(createElement(ZonesMap, { mode: 'all', label: 'all', zones: [] })); });
        await wait(250);
        const lanes = lanesOn(spy, fixedStarts());
        expect(lanes).toHaveLength(ferryLaneLines().length);
        expectLanes(lanes, theme);
        await act(async () => { useTowerStore.setState({ theme: other(theme) }); });
        await wait(50);
        expectLanes(lanes, other(theme));
      } finally {
        spy.mockRestore();
      }
    });
  });
}
