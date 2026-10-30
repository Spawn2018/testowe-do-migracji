/**
 * #667 F7 r2 uwaga 1 — B2: test zachowania (jsdom), nie regex źródeł.
 * Osobna warstwa dróg: paintOrangeRoads nie kasuje torów na `route`.
 * Środowisko jsdom bez tests/setup.ts (projekt vitest „jsdom”).
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import L from 'leaflet';
import { paintOrangeRoads } from '../src/components/map/orangeRoads';
import { DEMO_ROAD_LINES } from '../src/data/roadLinesDemo';
import { WATER_GDN_NYN } from '../src/lib/map/draw';

beforeAll(() => {
  // Leaflet w jsdom: createSVGRect bywa brakujące.
  const proto = SVGSVGElement?.prototype as SVGSVGElement & {
    createSVGRect?: () => DOMRect;
  };
  if (proto && typeof proto.createSVGRect !== 'function') {
    proto.createSVGRect = () => ({
      x: 0, y: 0, width: 0, height: 0,
      top: 0, right: 0, bottom: 0, left: 0,
      toJSON() { return {}; },
    }) as DOMRect;
  }
});

describe('#667 F7 r2 B2 ZonesMap osobna warstwa (jsdom)', () => {
  let el: HTMLDivElement;
  let map: L.Map;

  afterEach(() => {
    map?.remove();
    el?.remove();
  });

  it('paintOrangeRoads na roads nie kasuje torów w route (mode all i one)', () => {
    el = document.createElement('div');
    el.style.width = '640px';
    el.style.height = '480px';
    document.body.appendChild(el);
    map = L.map(el, { zoomControl: false }).setView([60, 18], 4);

    const roads = L.layerGroup().addTo(map);
    const route = L.layerGroup().addTo(map);

    for (const lane of [WATER_GDN_NYN]) {
      L.polyline(
        lane.map(([lng, lat]) => L.latLng(lat, lng)),
        { color: '#245C87', weight: 2, dashArray: '6 6', interactive: false },
      ).addTo(route);
    }
    const ferryBefore = route.getLayers().length;
    expect(ferryBefore).toBeGreaterThan(0);

    // jak ZonesMap mode=all / mode=one: drogi zawsze na roadsRef
    paintOrangeRoads(roads, DEMO_ROAD_LINES.map((l) => [...l]));
    expect(roads.getLayers().length).toBe(DEMO_ROAD_LINES.length);
    expect(route.getLayers().length).toBe(ferryBefore);

    paintOrangeRoads(roads, DEMO_ROAD_LINES.map((l) => [...l]));
    expect(roads.getLayers().length).toBe(DEMO_ROAD_LINES.length);
    expect(route.getLayers().length).toBe(ferryBefore);
  });
});
