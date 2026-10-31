/**
 * @vitest-environment jsdom
 * DP-76 (decyzja właściciela 31.10.2026): tory promów na WSZYSTKICH mapach — jeden styl, jasnoniebieski przerywany.
 * Zachowanie (jsdom): mapa korytarza (pula `mapPool` → warstwa `ferryLeg`, ta sama dla Kokpitu, Mapy, szuflady i telefonu)
 * i mapa Stref (`ZonesMap` mode="all") rysują tory z tym samym kolorem, grubością, przezroczystością i przerywaniem —
 * ze wspólnej stałej `FERRY_LANE_STYLE`. Tory Stref rozpoznawane po położeniu (pierwszy punkt), nie po stylu,
 * więc własny styl w jednym komponencie wywala test.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { LatLng, Polyline } from 'leaflet';

beforeAll(() => {
  const proto = (globalThis as unknown as { SVGSVGElement?: { prototype: { createSVGRect?: () => DOMRect } } })
    .SVGSVGElement?.prototype;
  if (proto && typeof proto.createSVGRect !== 'function') {
    proto.createSVGRect = () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0, toJSON() { return {}; } }) as DOMRect;
  }
});

const { default: L } = await import('leaflet');
const { useTowerStore } = await import('../src/store/useTowerStore');
const { default: ZonesMap } = await import('../src/components/zones/ZonesMap');
const { acquireMap, releaseMap } = await import('../src/components/map/mapPool');
const { FERRY_LANE_STYLE, ferryLaneLines } = await import('../src/lib/map/ferryLanes');

type LaneStyle = { color?: string; weight?: number; opacity?: number; dashArray?: string | number[] };
const styleOf = (pl: Polyline): LaneStyle => {
  const { color, weight, opacity, dashArray } = pl.options;
  return { color, weight, opacity, dashArray };
};
const startKey = (pl: Polyline) => {
  const p = (pl.getLatLngs() as LatLng[])[0];
  return `${p.lat},${p.lng}`;
};
const laneStarts = () => new Set(ferryLaneLines().map((l) => `${l[0][0]},${l[0][1]}`));

let host: HTMLDivElement | null = null;
let root: Root | null = null;
afterEach(() => {
  act(() => { root?.unmount(); });
  root = null;
  host?.remove();
  host = null;
  document.querySelectorAll('.leaflet-container').forEach((n) => n.remove());
});

const held: ReturnType<typeof acquireMap>[] = [];
afterAll(() => { for (const e of held.splice(0)) releaseMap(e, 'mapa'); });

/** Mapa korytarza: style torów z warstwy promu wspólnej mapy (Kokpit/Mapa/szuflada/telefon). */
function corridorLaneStyles(theme: 'light' | 'dark'): { styles: LaneStyle[]; svg: Element[] } {
  useTowerStore.setState({ theme });
  const el = document.createElement('div');
  el.style.width = '1200px';
  el.style.height = '800px';
  document.body.appendChild(el);
  const entry = acquireMap(el, 'mapa');
  const lanes = entry.layers.ferryLeg.getLayers().filter((l): l is Polyline => l instanceof L.Polyline);
  const styles = lanes.map(styleOf);
  const svg = lanes.map((pl) => pl.getElement()).filter((n): n is Element => !!n);
  /* mapy zwalniane dopiero po wszystkich testach: druga mapa przy zajętej puli powstaje od nowa (w jsdom ponowne użycie
     mapy z puli liczy środek z rozmiaru 0 px) */
  held.push(entry);
  return { styles, svg };
}

/** Mapa Stref (mode="all"): style polilinii, których pierwszy punkt = początek toru promowego. */
async function zonesLaneStyles(theme: 'light' | 'dark'): Promise<{ styles: LaneStyle[]; svg: Element[] }> {
  useTowerStore.setState({ theme });
  const spy = vi.spyOn(L, 'polyline');
  host = document.createElement('div');
  host.style.width = '1200px';
  host.style.height = '800px';
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(createElement(ZonesMap, { mode: 'all', label: 'all', zones: [] })); });
  await act(async () => { await new Promise((r) => setTimeout(r, 250)); });
  const starts = laneStarts();
  const lanes = spy.mock.results.map((r) => r.value as Polyline).filter((pl) => starts.has(startKey(pl)));
  spy.mockRestore();
  return { styles: lanes.map(styleOf), svg: lanes.map((pl) => pl.getElement()).filter((n): n is Element => !!n) };
}

describe('DP-76 · tory promów: jeden styl na mapie korytarza i mapie Stref', () => {
  it('wspólna stała: jasnoniebieski (kolor korytarza #6BA8D6) i przerywany „6 6”', () => {
    expect(FERRY_LANE_STYLE.color).toBe('#6BA8D6');
    expect(FERRY_LANE_STYLE.dashArray).toBe('6 6');
  });

  for (const theme of ['light', 'dark'] as const) {
    it(`motyw ${theme}: mapa korytarza i mapa Stref rysują wszystkie tory tym samym stylem ze wspólnej stałej`, async () => {
      const expected: LaneStyle = {
        color: FERRY_LANE_STYLE.color,
        weight: FERRY_LANE_STYLE.weight,
        opacity: FERRY_LANE_STYLE.opacity,
        dashArray: FERRY_LANE_STYLE.dashArray,
      };
      const corridor = corridorLaneStyles(theme);
      const zones = await zonesLaneStyles(theme);
      expect(corridor.styles).toHaveLength(ferryLaneLines().length);
      expect(zones.styles).toHaveLength(ferryLaneLines().length);
      for (const s of [...corridor.styles, ...zones.styles]) expect(s).toEqual(expected);
      /* to samo w narysowanym SVG (Leaflet → stroke / stroke-dasharray) */
      for (const p of [...corridor.svg, ...zones.svg]) {
        expect(p.getAttribute('stroke')).toBe(FERRY_LANE_STYLE.color);
        expect(p.getAttribute('stroke-dasharray')).toBe(FERRY_LANE_STYLE.dashArray);
      }
      expect(corridor.svg).toHaveLength(ferryLaneLines().length);
      expect(zones.svg).toHaveLength(ferryLaneLines().length);
    });
  }
});
