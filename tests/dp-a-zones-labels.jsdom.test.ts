/**
 * @vitest-environment jsdom
 * Pakiet DP-A — DP-74: mapa wszystkich stref (`ZonesMap` mode="all", strefy demo). Kadr ze wszystkimi miejscami stref
 * i ich etykietami (Śrem w kadrze, etykieta Boden nieucięta), etykiety bez nachodzenia na siebie i bez zasłaniania
 * Sztokholmu i Kopenhagi. Rozmiar mapy podany jawnie (jsdom nie liczy układu): komputer 400 × 300, telefon 360 × 300.
 * Rozmiar etykiety — zapas `LABEL_BOX` (jsdom nie mierzy), położenie odczytane z marginesów elementu etykiety.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { Map as LMap } from 'leaflet';

let W = 400;
const H = 300;
beforeAll(() => {
  const proto = (globalThis as unknown as { SVGSVGElement?: { prototype: { createSVGRect?: () => DOMRect } } })
    .SVGSVGElement?.prototype;
  if (proto && typeof proto.createSVGRect !== 'function') {
    proto.createSVGRect = () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0, toJSON() { return {}; } }) as DOMRect;
  }
  /* Leaflet bierze rozmiar mapy z clientWidth / clientHeight kontenera */
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return W; } });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get() { return H; } });
});

const { default: L } = await import('leaflet');
/* jak w przeglądarce: krok przybliżenia `zoomSnap` 0,25 (bez 3D Leaflet zaokrągla do całego poziomu) */
(L.Browser as { any3d: boolean }).any3d = true;
const { useTowerStore } = await import('../src/store/useTowerStore');
const { default: ZonesMap } = await import('../src/components/zones/ZonesMap');
const { LABEL_BOX, LABEL_PLACE } = await import('../src/components/zones/zoneLabels');
const { demoZonesNow } = await import('../src/lib/p8cDemo');

let host: HTMLDivElement | null = null;
let root: Root | null = null;
afterEach(() => {
  act(() => { root?.unmount(); });
  host?.remove();
  document.querySelectorAll('.leaflet-container').forEach((n) => n.remove());
  W = 400;
});

type Rect = { x0: number; y0: number; x1: number; y1: number; name: string };
const inside = (r: Rect, x: number, y: number) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
const overlap = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

async function renderAll(width: number): Promise<{ map: LMap; labels: Rect[]; points: Map<string, { x: number; y: number }> }> {
  W = width;
  useTowerStore.setState({ theme: 'light' });
  const spy = vi.spyOn(L, 'map');
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root!.render(createElement(ZonesMap, { mode: 'all', zones: demoZonesNow(), label: 'Strefy' })); });
  const map = spy.mock.results[0].value as LMap;
  spy.mockRestore();
  const labels: Rect[] = [];
  const points = new Map<string, { x: number; y: number }>();
  map.eachLayer((l) => {
    if (!(l instanceof L.Marker)) return;
    const el = l.getElement()!;
    const name = el.querySelector('b')?.textContent ?? '';
    const p = map.latLngToContainerPoint(l.getLatLng());
    points.set(name, p);
    const x0 = p.x + parseFloat(el.style.marginLeft);
    const y0 = p.y + parseFloat(el.style.marginTop);
    labels.push({ x0, y0, x1: x0 + LABEL_BOX.w, y1: y0 + LABEL_BOX.h, name });
  });
  return { map, labels, points };
}

describe('DP-74 · mapa wszystkich stref: kadr z etykietami, etykiety bez kolizji', () => {
  for (const width of [400, 360]) {
    it(`szerokość ${width} px: wszystkie miejsca i etykiety w kadrze (Śrem, Boden), bez nakładania i bez Sztokholmu / Kopenhagi pod etykietą`, async () => {
      const { map, labels, points } = await renderAll(width);
      expect([...points.keys()].sort()).toEqual(['Boden', 'Gdańsk i Gdynia', 'Karlskrona', 'Nynäshamn', 'Śrem']);
      /* Śrem i Boden w kadrze (wcześniej Śrem poza kadrem) */
      for (const [name, p] of points) {
        expect(p.x, name).toBeGreaterThanOrEqual(0);
        expect(p.x, name).toBeLessThanOrEqual(W);
        expect(p.y, name).toBeGreaterThanOrEqual(0);
        expect(p.y, name).toBeLessThanOrEqual(H);
      }
      /* etykiety całe w mapie (Boden nieucięta), poza przyciskami „+ / −” w lewym górnym rogu (do 48 × 80 px) */
      for (const r of labels) {
        expect(r.x0, r.name).toBeGreaterThanOrEqual(0);
        expect(r.x1, r.name).toBeLessThanOrEqual(W);
        expect(r.y0, r.name).toBeGreaterThanOrEqual(0);
        expect(r.y1, r.name).toBeLessThanOrEqual(H);
        expect(overlap(r, { x0: 0, y0: 0, x1: 48, y1: 80, name: 'zoom' }), r.name).toBe(false);
      }
      /* etykiety nie nachodzą na siebie */
      for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) expect(overlap(labels[i], labels[j]), `${labels[i].name} / ${labels[j].name}`).toBe(false);
      }
      /* Sztokholm i Kopenhaga nie są zasłonięte */
      for (const [city, ll] of [['Sztokholm', [59.3293, 18.0686]], ['Kopenhaga', [55.6761, 12.5683]]] as const) {
        const c = map.latLngToContainerPoint(ll as [number, number]);
        for (const r of labels) expect(inside(r, c.x, c.y), `${city} pod etykietą ${r.name}`).toBe(false);
      }
    });
  }

  it('kierunki etykiet: Nynäshamn w prawo (nad morzem), Karlskrona w lewo nad punktem, Boden w lewo', () => {
    expect(LABEL_PLACE.Nynäshamn).toBe('right');
    expect(LABEL_PLACE.Karlskrona).toBe('left-up');
    expect(LABEL_PLACE.Boden).toBe('left');
  });
});
