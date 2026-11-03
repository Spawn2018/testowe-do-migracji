/**
 * @vitest-environment jsdom
 * DP-175 (F7 #740, BN9-c6 pkt 6) — Mapa w PROD z legami BN7 bez punktów (np. przed pierwszym `cron_fetch` albo pusty
 * odczyt HERE): rysuje rdzeń Polska–Szwecja, wszystkie 6 torów i dopisek „Trasa orientacyjna…”, bez błędu
 * i bez pustych linii BN7. Dane wymyślone (G-09).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { LatLng as LLatLng, Polyline } from 'leaflet';

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
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  const proto = (globalThis as unknown as { SVGSVGElement?: { prototype: { createSVGRect?: () => DOMRect } } })
    .SVGSVGElement?.prototype;
  if (proto && typeof proto.createSVGRect !== 'function') {
    proto.createSVGRect = () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0, toJSON() { return {}; } }) as DOMRect;
  }
  (globalThis as unknown as { CSS?: { escape?: (s: string) => string } }).CSS ??= { escape: (s: string) => s };
  Element.prototype.scrollIntoView ??= function scrollIntoView() { /* jsdom */ };
});

const { useTowerStore } = await import('../src/store/useTowerStore');
const { CorridorMap } = await import('../src/components/map/CorridorMap');
const { __poolEntryForTests, __resetMapPool, acquireMap, drawCorridorLines, NETWORK_LINES, releaseMap } = await import('../src/components/map/mapPool');
const { __resetRoadLinesCacheForTests } = await import('../src/components/map/applyBasemap');
const { BN7_LEGS, CORE_LEGS } = await import('../src/lib/map/routeLegs');
const { I18N_ALL } = await import('../src/i18n/messages');

type Pt = readonly [number, number];
const first = (pl: Polyline): Pt => {
  const p = (pl.getLatLngs() as LLatLng[])[0];
  return [p.lat, p.lng];
};
const routeLayers = () => __poolEntryForTests()!.layers.route.getLayers() as Polyline[];
const laneLayers = () => __poolEntryForTests()!.layers.ferryLeg.getLayers() as Polyline[];

function dense(from: Pt, n = 240): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i += 1) out.push([from[0] + (0.8 * i) / n, from[1] + (1.2 * i) / n]);
  return out;
}
/* rdzeń z punktami (≥200 pkt, krok ≤3 km); legi BN7 — bez punktów (pusta tablica / null) */
const START: Record<string, Pt> = {
  'PL-GDN': [52.0, 17.0], 'PL-GDY': [52.1, 17.1], 'SE-NYN': [58.9, 17.9], 'SE-KAA': [56.16, 15.63], 'SE-KAA-INLAND': [56.2, 15.7],
};
const ROADS = [
  ...Object.entries(START).map(([leg, a]) => ({ leg, spec: 'loose', corridor_code: null, points: dense(a), browser_fetch: true, map_group: 'core', summary: '' })),
  ...[...BN7_LEGS].map((leg, i) => ({ leg, spec: 'loose', corridor_code: null, points: i % 2 ? null : [], browser_fetch: false, map_group: 'bn7', summary: '' })),
];
const ROUTE_LEGS = [
  { route: 'GDN-NYN', pre: 'PL-GDN', post: 'SE-NYN' }, { route: 'GDY-KAA', pre: 'PL-GDY', post: 'SE-KAA' },
  { route: 'TLL-HEL', pre: 'PL-TLL', post: 'FI-HEL' }, { route: 'MUU-VUO', pre: 'PL-MUU', post: 'FI-VUO' },
  { route: 'TLL-STO', pre: 'PL-TLL', post: 'SE-STO' }, { route: 'PLD-KPS', pre: 'PL-PLD', post: 'SE-KPS' },
];

let host: HTMLDivElement | null = null;
let root: Root | null = null;
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

afterEach(() => {
  if (root) act(() => { root!.unmount(); });
  root = null;
  host?.remove();
  host = null;
  document.querySelectorAll('.leaflet-container').forEach((n) => n.remove());
  __resetMapPool();
  __resetRoadLinesCacheForTests();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function prod(): void {
  vi.stubEnv('VITE_AUTH_MODE', 'supabase');
  __resetRoadLinesCacheForTests();
  rpc.mockReset();
  rpc.mockResolvedValue({ data: { roads: ROADS, route_legs: ROUTE_LEGS }, error: null });
  useTowerStore.setState({ theme: 'light' });
  host = document.createElement('div');
  host.style.cssText = 'width:900px;height:600px;position:relative';
  document.body.appendChild(host);
}

describe('DP-175 · Mapa PROD: legi BN7 bez punktów', () => {
  it('pula mapy (`NETWORK_LINES`): tylko rdzeń (5 linii z punktami), 6 torów, bez pustych linii', async () => {
    prod();
    const e = acquireMap(host!, 'map', { ...NETWORK_LINES, routes: [...NETWORK_LINES.routes] });
    await drawCorridorLines(e, { ...NETWORK_LINES, routes: [...NETWORK_LINES.routes] }, true);
    expect(routeLayers().map(first)).toEqual(Object.values(START));
    expect(routeLayers().every((l) => (l.getLatLngs() as LLatLng[]).length > 1)).toBe(true);
    expect(laneLayers()).toHaveLength(6);
    expect([...CORE_LEGS].sort()).toEqual(Object.keys(START).sort());
    releaseMap(e, 'map');
  });

  it('CorridorMap (strona Mapa): rdzeń, 6 torów i dopisek „Trasa orientacyjna…”, bez błędu w konsoli', async () => {
    prod();
    const err = vi.spyOn(console, 'error');
    root = createRoot(host!);
    await act(async () => { root!.render(createElement(CorridorMap, { loads: [], slot: 'map' })); });
    await wait(300);
    expect(routeLayers().map(first)).toEqual(Object.values(START));
    expect(laneLayers()).toHaveLength(6);
    expect(host!.querySelector('[data-route-note="baltic"]')?.textContent).toBe(I18N_ALL.pl.bn9c5_route_note);
    const mapErrors = err.mock.calls.filter((c) => /leaflet|polyline|latlng|route/i.test(String(c[0])));
    expect(mapErrors).toEqual([]);
  });
});
