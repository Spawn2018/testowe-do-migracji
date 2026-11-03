/**
 * @vitest-environment jsdom
 * Pakiet DP-A (rejestr drobnych poprawek, mapy) — testy zachowania w jsdom:
 *  - DP-41: mapa korytarza (`CorridorMap`, demo) faktycznie rysuje tory promów z `ferryLaneLines` (punkt w punkt,
 *    polilinie na mapie z elementem SVG) — zamiast sprawdzania tekstu kodu (`drawFerryLanes(` w źródle);
 *  - DP-71: demo SE-KAA — Karlskrona → Lyckeby → Jämjö → Brömsebro → Söderåkra (nie prosta przez ląd);
 *  - DP-72: demo PL-GDY (Śrem–Gdynia) i SE-KAA-INLAND (śródlądowa Karlskrona–Boden) jako osobne linie; karta GDY-KAA je rysuje;
 *  - DP-77: znaczniki miejsc (Śrem, Gdańsk, Nynäshamn, Boden) przy przybliżeniu < 5,5 mniejsze, dalej klikalne (podpis);
 *  - DP-78: tor Gdynia–Karlskrona bez poziomego odcinka nad szkierami — podejście do Karlskrony od południa, po wodzie.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { CircleMarker, LatLng as LLatLng, Polyline } from 'leaflet';

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
const { CorridorMap } = await import('../src/components/map/CorridorMap');
const { __poolEntryForTests, __resetMapPool, POI_RADIUS, poiRadius } = await import('../src/components/map/mapPool');
const { DEMO_ROAD_LEGS, DEMO_ROAD_LINES } = await import('../src/data/roadLinesDemo');
const { ferryLaneLines, WATER_GDY_KAA_LANE } = await import('../src/lib/map/ferryLanes');
const { networkScope, __resetDemoRoutesForTests } = await import('../src/lib/map/routeLegs');
const { haversineKm, lineHitsLand } = await import('../src/lib/map/draw');
const { routePorts } = await import('../src/lib/ferryCatalog');
const { buildSeedLoads } = await import('../src/data/seed');

type Pt = readonly [number, number];
const pts = (pl: Polyline): Pt[] => (pl.getLatLngs() as LLatLng[]).map((p) => [p.lat, p.lng] as const);
const demoLine = (leg: string) => DEMO_ROAD_LEGS.find((l) => l.leg === leg)!.line;

let host: HTMLDivElement | null = null;
let root: Root | null = null;
const initial = { ...useTowerStore.getState(), loads: buildSeedLoads() };
function mount(): void {
  host = document.createElement('div');
  host.style.cssText = 'width:900px;height:600px;position:relative';
  document.body.appendChild(host);
  root = createRoot(host);
}
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

/* jsdom nie liczy układu — mapa ma rozmiar 900 × 600 (Leaflet czyta clientWidth / clientHeight kontenera) */
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(900);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
});

afterEach(() => {
  vi.restoreAllMocks();
  if (root) act(() => { root!.unmount(); });
  root = null;
  host?.remove();
  host = null;
  document.querySelectorAll('.leaflet-container').forEach((n) => n.remove());
  __resetMapPool();
  __resetDemoRoutesForTests();
  useTowerStore.setState({ loads: initial.loads, sailings: initial.sailings, selectedLoadId: null, role: initial.role });
});

describe('DP-41 · mapa korytarza rysuje tory promów (zachowanie, nie tekst kodu)', () => {
  it('Mapa (demo): warstwa promu = dokładnie linie `ferryLaneLines` zakresu sieci, polilinie na mapie z elementem SVG', async () => {
    useTowerStore.setState({ theme: 'light', loads: initial.loads });
    mount();
    await act(async () => { root!.render(createElement(CorridorMap, { loads: [], slot: 'map' })); });
    await wait(50);
    const e = __poolEntryForTests()!;
    const lanes = e.layers.ferryLeg.getLayers() as Polyline[];
    const expected = ferryLaneLines(new Set(), networkScope().tracks);
    expect(lanes.map(pts)).toEqual(expected.map((l) => l.map(([lat, lng]) => [lat, lng])));
    for (const pl of lanes) {
      expect(e.map.hasLayer(pl)).toBe(true);
      expect(pl.getElement()?.tagName.toLowerCase()).toBe('path');
    }
  });

  it('karta transportu GDY-KAA (demo): tor Gdynia–Karlskrona z `WATER_GDY_KAA_LANE` i drogi PL-GDY, SE-KAA, SE-KAA-INLAND', async () => {
    const loads = initial.loads;
    const planned = loads.find((l) => l.code === 'SG-11')!;
    window.history.replaceState(null, '', `/#/?demoRoute=${planned.code}:GDY-KAA`);
    __resetDemoRoutesForTests();
    useTowerStore.setState({ theme: 'light', loads, selectedLoadId: planned.id });
    mount();
    await act(async () => { root!.render(createElement(CorridorMap, { loads: [], embedded: true, slot: 'drawer' })); });
    await wait(50);
    window.history.replaceState(null, '', '/');
    const e = __poolEntryForTests()!;
    expect((e.layers.ferryLeg.getLayers() as Polyline[]).map(pts)).toEqual([WATER_GDY_KAA_LANE.map(([lng, lat]) => [lat, lng])]);
    const roads = (e.layers.route.getLayers() as Polyline[]).map(pts);
    const want = ['PL-GDY', 'SE-KAA', 'SE-KAA-INLAND'].map((leg) => demoLine(leg).map(([lat, lng]) => [lat, lng]));
    expect(roads).toHaveLength(want.length);
    expect(roads).toEqual(expect.arrayContaining(want));
  });
});

const near = (line: readonly Pt[], lat: number, lng: number, km: number) => line.some(([a, b]) => haversineKm(a, b, lat, lng) < km);

describe('DP-71 · demo SE-KAA: Karlskrona → Söderåkra drogą E22, nie prostą przez ląd', () => {
  it('po Karlskronie kolejno Lyckeby, Jämjö, Brömsebro, potem Söderåkra; odcinki ≤ 20 km', () => {
    const line = demoLine('SE-KAA');
    const idx = (lat: number, lng: number) => line.findIndex(([a, b]) => haversineKm(a, b, lat, lng) < 3);
    const order = [[56.161, 15.63], [56.2, 15.65], [56.193, 15.843], [56.3, 16.0], [56.45, 16.07]].map(([a, b]) => idx(a, b));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    for (let i = order[0]; i < order[4]; i++) expect(haversineKm(line[i][0], line[i][1], line[i + 1][0], line[i + 1][1])).toBeLessThan(20);
  });
});

describe('DP-72 · demo: Śrem–Gdynia i śródlądowa Karlskrona–Boden', () => {
  it('PL-GDY: osobna linia Śrem → Gdynia (koniec przy terminalu Gdynia, nie Gdańsk)', () => {
    const gdy = demoLine('PL-GDY');
    expect(gdy).not.toBe(demoLine('PL-GDN'));
    expect(haversineKm(gdy[0][0], gdy[0][1], 52.07391, 17.0246)).toBeLessThan(1);
    const [lat, lng] = gdy[gdy.length - 1];
    expect(haversineKm(lat, lng, 54.53321, 18.54425)).toBeLessThan(1);
    expect(near(gdy, 54.4037, 18.6813, 3)).toBe(false);
  });
  it('SE-KAA-INLAND: Karlskrona → Boden przez Norrköping i Västerås (punkty awaryjne `ROAD_KAA`), bez Sztokholmu', () => {
    const inl = demoLine('SE-KAA-INLAND');
    expect(haversineKm(inl[0][0], inl[0][1], 56.1646, 15.6308)).toBeLessThan(3);
    const [lat, lng] = inl[inl.length - 1];
    expect(haversineKm(lat, lng, 65.80539, 21.75914)).toBeLessThan(1);
    expect(near(inl, 58.59, 16.18, 10)).toBe(true);
    expect(near(inl, 59.61, 16.54, 10)).toBe(true);
    expect(near(inl, 59.3293, 18.0686, 40)).toBe(false);
  });
  it('rdzeń demo (mapy stref) zawiera obie nowe linie', () => {
    expect(DEMO_ROAD_LINES).toContain(demoLine('PL-GDY'));
    expect(DEMO_ROAD_LINES).toContain(demoLine('SE-KAA-INLAND'));
  });
});

describe('DP-77 · znaczniki miejsc przy małym przybliżeniu', () => {
  it('Mapa: przy przybliżeniu 4 znaczniki mniejsze, od 5,5 jak dotąd; podpis i klikalność bez zmian', async () => {
    useTowerStore.setState({ theme: 'light', loads: initial.loads });
    mount();
    await act(async () => { root!.render(createElement(CorridorMap, { loads: [], slot: 'map' })); });
    await wait(50);
    const e = __poolEntryForTests()!;
    const pins = e.layers.poi.getLayers().filter((l): l is CircleMarker => l instanceof L.CircleMarker);
    expect(pins).toHaveLength(4);
    for (const p of pins) expect(String(p.getTooltip()?.getContent() ?? '')).not.toBe('');
    act(() => { e.map.setZoom(4, { animate: false }); });
    for (const p of pins) {
      expect(p.getRadius()).toBe(POI_RADIUS.low);
      expect(p.options.interactive).not.toBe(false);
      expect(p.getElement()?.classList.contains('leaflet-interactive')).toBe(true);
    }
    act(() => { e.map.setZoom(6, { animate: false }); });
    for (const p of pins) expect(p.getRadius()).toBe(POI_RADIUS.normal);
    expect(POI_RADIUS.low).toBeLessThan(POI_RADIUS.normal);
    expect(poiRadius(5.25)).toBe(POI_RADIUS.low);
    expect(poiRadius(5.5)).toBe(POI_RADIUS.normal);
  });
});

describe('DP-78 · tor Gdynia–Karlskrona przy Karlskronie', () => {
  const lane = WATER_GDY_KAA_LANE.map(([lng, lat]) => [lat, lng] as const);
  it('końce < 3 km od portów z katalogu; tor nie przecina lądu (kontury mapy)', () => {
    const [a, b] = routePorts('GDY-KAA')!;
    expect(haversineKm(lane[0][0], lane[0][1], a.lat, a.lng)).toBeLessThan(3);
    const [lat, lng] = lane[lane.length - 1];
    expect(haversineKm(lat, lng, b.lat, b.lng)).toBeLessThan(3);
    expect(lineHitsLand(WATER_GDY_KAA_LANE)).toBe(false);
  });
  it('w promieniu 15 km od Karlskrony bez poziomego odcinka: podejście od południa, na zachód od Tjurkö i Sturkö', () => {
    const [, b] = routePorts('GDY-KAA')!;
    const close = lane.filter(([lat, lng]) => haversineKm(lat, lng, b.lat, b.lng) < 15);
    expect(close.length).toBeGreaterThanOrEqual(3);
    for (const [, lng] of close) expect(lng).toBeLessThan(15.7);
    for (let i = 1; i < close.length; i++) {
      const dLatKm = Math.abs(close[i][0] - close[i - 1][0]) * 111;
      const dLngKm = Math.abs(close[i][1] - close[i - 1][1]) * 111 * Math.cos((close[i][0] * Math.PI) / 180);
      expect(dLatKm).toBeGreaterThan(dLngKm);
    }
  });
});
