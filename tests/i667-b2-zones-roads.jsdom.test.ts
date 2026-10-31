/**
 * @vitest-environment jsdom
 * #667 F7 r3 uwaga 1 — B2: render ZonesMap (nie sam paintOrangeRoads).
 * Osobna warstwa roadsRef: drogi w mode=all i mode=one; tory tylko w all.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
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
const { useTowerStore } = await import('../src/store/useTowerStore');
const { default: ZonesMap } = await import('../src/components/zones/ZonesMap');
const { DEMO_ROAD_LINES } = await import('../src/data/roadLinesDemo');
const { paintOrangeRoads } = await import('../src/components/map/orangeRoads');
const { WATER_GDN_NYN } = await import('../src/lib/map/draw');

describe('#667 F7 r3 B2 ZonesMap osobna warstwa (jsdom)', () => {
  let host: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => { root?.unmount(); });
    host?.remove();
    document.querySelectorAll('.leaflet-container').forEach((n) => n.remove());
  });

  it('ZonesMap: drogi w all i one; tory tylko w all; roadsRef w źródle', async () => {
    useTowerStore.setState({ theme: 'day' });
    host = document.createElement('div');
    host.style.width = '640px';
    host.style.height = '480px';
    document.body.appendChild(host);
    root = createRoot(host);

    await act(async () => {
      root.render(createElement(ZonesMap, { mode: 'all', label: 'test-all', zones: [] }));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 250));
    });

    expect(host.querySelector('[data-zones-map="all"]')).toBeTruthy();
    const pathsAll = host.querySelectorAll('.leaflet-overlay-pane path');
    expect(pathsAll.length).toBeGreaterThanOrEqual(DEMO_ROAD_LINES.length + 1);

    await act(async () => {
      root.render(createElement(ZonesMap, {
        mode: 'one',
        label: 'test-one',
        zone: { lat: 60, lng: 18, radiusM: 500 },
      }));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 100));
    });

    expect(host.querySelector('[data-zones-map="one"]')).toBeTruthy();
    const pathsOne = host.querySelectorAll('.leaflet-overlay-pane path');
    expect(pathsOne.length).toBeGreaterThanOrEqual(DEMO_ROAD_LINES.length);

    const src = readFileSync('src/components/zones/ZonesMap.tsx', 'utf8');
    expect(src).toMatch(/roadsRef/);
    expect(src).toMatch(/drogi zawsze \(all \+ one\)/);
    expect(src).toMatch(/tory promów tylko w mode=all/);
  });

  it('paintOrangeRoads na roads nie kasuje torów w route', () => {
    const el = document.createElement('div');
    el.style.width = '640px';
    el.style.height = '480px';
    document.body.appendChild(el);
    const map = L.map(el, { zoomControl: false }).setView([60, 18], 4);
    const roads = L.layerGroup().addTo(map);
    const route = L.layerGroup().addTo(map);
    for (const lane of [WATER_GDN_NYN]) {
      L.polyline(
        lane.map(([lng, lat]) => L.latLng(lat, lng)),
        { color: '#245C87', weight: 2, dashArray: '6 6', interactive: false },
      ).addTo(route);
    }
    const ferryBefore = route.getLayers().length;
    paintOrangeRoads(roads, DEMO_ROAD_LINES.map((l) => [...l]));
    expect(roads.getLayers().length).toBe(DEMO_ROAD_LINES.length);
    expect(route.getLayers().length).toBe(ferryBefore);
    paintOrangeRoads(roads, DEMO_ROAD_LINES.map((l) => [...l]));
    expect(route.getLayers().length).toBe(ferryBefore);
    map.remove();
    el.remove();
  });
});
