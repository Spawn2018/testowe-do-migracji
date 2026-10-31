/**
 * @vitest-environment jsdom
 * DP-13, DP-33, DP-34, DP-36 (rejestr drobnych poprawek): testy zachowania zamiast sprawdzania tekstu kodu.
 * Render ZonesMap i Harmonogram › Rejsy w jsdom; lista statków sesji przez wstrzyknięty loader.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

beforeAll(() => {
  const proto = (globalThis as unknown as { SVGSVGElement?: { prototype: { createSVGRect?: () => DOMRect } } })
    .SVGSVGElement?.prototype;
  if (proto && typeof proto.createSVGRect !== 'function') {
    proto.createSVGRect = () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0, toJSON() { return {}; } }) as DOMRect;
  }
  (globalThis as unknown as { CSS?: { escape?: (s: string) => string } }).CSS ??= { escape: (s: string) => s };
  Element.prototype.scrollIntoView ??= function scrollIntoView() { /* jsdom */ };
});

const { useTowerStore } = await import('../src/store/useTowerStore');
const { default: ZonesMap } = await import('../src/components/zones/ZonesMap');
const { DEMO_ROAD_LINES } = await import('../src/data/roadLinesDemo');
const { ferryLaneLines } = await import('../src/lib/map/ferryLanes');
const { SailingsPanel } = await import('../src/views/SailingsPanel');
const { createVesselsLoader, currentVesselGroups, VESSELS_FALLBACK } = await import('../src/lib/vesselGroups');
const { useVesselGroups } = await import('../src/lib/useVesselGroups');
const { sv } = await import('../src/i18n/sail7');

let host: HTMLDivElement;
let root: Root;
const mount = () => {
  host = document.createElement('div');
  host.style.width = '1200px';
  host.style.height = '800px';
  document.body.appendChild(host);
  root = createRoot(host);
};
const tick = (ms = 0) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

afterEach(() => {
  act(() => { root?.unmount(); });
  host?.remove();
  document.querySelectorAll('.leaflet-container').forEach((n) => n.remove());
});

describe('DP-13 · mapa Stref: tory promów ze wspólnego źródła', () => {
  it('mode=all: tory Polska–Szwecja i 4 przeprawy bałtyckie (przerywane) + drogi; mode=one: bez torów', async () => {
    useTowerStore.setState({ theme: 'day' });
    mount();
    await act(async () => { root.render(createElement(ZonesMap, { mode: 'all', label: 'all', zones: [] })); });
    await tick(250);
    const dashed = () => [...host.querySelectorAll('.leaflet-overlay-pane path')].filter((p) => p.getAttribute('stroke-dasharray') === '6 6');
    const solid = () => [...host.querySelectorAll('.leaflet-overlay-pane path')].filter((p) => p.getAttribute('stroke-dasharray') !== '6 6');
    expect(ferryLaneLines().length).toBeGreaterThan(2);
    expect(dashed()).toHaveLength(ferryLaneLines().length);
    expect(solid().length).toBeGreaterThanOrEqual(DEMO_ROAD_LINES.length);
    await act(async () => { root.render(createElement(ZonesMap, { mode: 'one', label: 'one', zone: { lat: 60, lng: 18, radiusM: 500 } })); });
    await tick(100);
    expect(dashed()).toHaveLength(0);
    expect(solid().length).toBeGreaterThanOrEqual(DEMO_ROAD_LINES.length);
  });
});

const visibleSailing = () => {
  const ids = [...host.querySelectorAll('[data-sailing]')].map((n) => n.getAttribute('data-sailing'));
  return useTowerStore.getState().sailings.find((s) => ids.includes(s.id))!;
};

describe('DP-33 · Harmonogram › Rejsy — zachowanie panelu (DP-3, DP-5)', () => {
  it('DP-3: rejs z flagą routeUnknown ma pigułkę „nieznana trasa”, inne nie', async () => {
    useTowerStore.setState({ role: 'HHL', locale: 'pl', sailingFocus: null });
    mount();
    await act(async () => { root.render(createElement(SailingsPanel, {})); });
    const s = visibleSailing();
    expect(s).toBeTruthy();
    expect(host.querySelectorAll('[data-route-unknown]')).toHaveLength(0);
    act(() => { useTowerStore.setState({ sailings: useTowerStore.getState().sailings.map((x) => (x.id === s.id ? { ...x, routeUnknown: true } : x)) }); });
    const pill = host.querySelector(`[data-sailing="${s.id}"] [data-route-unknown]`);
    expect(pill?.textContent).toBe(sv('pl', 'sv_route_unknown'));
    expect(host.querySelectorAll('[data-route-unknown]').length).toBeGreaterThan(0);
  });
  it('DP-5: „Dodaj rejs” z kodem spoza słownika — komunikat i bez zapisu', async () => {
    const addSailing = vi.fn(() => ({ ok: true as const }));
    useTowerStore.setState({ role: 'HHL', locale: 'pl', addSailing } as never);
    mount();
    await act(async () => { root.render(createElement(SailingsPanel, {})); });
    act(() => { (host.querySelector('[data-sail-new]') as HTMLButtonElement).click(); });
    const form = host.querySelector('[data-sail-form]') as HTMLFormElement;
    const route = form.querySelector('select[name="route"]') as HTMLSelectElement;
    route.add(new Option('GDN-KAA', 'GDN-KAA'));
    route.value = 'GDN-KAA';
    (form.querySelector('input[name="dep"]') as HTMLInputElement).value = '2026-11-20T10:00';
    (form.querySelector('input[name="arr"]') as HTMLInputElement).value = '2026-11-20T20:00';
    act(() => { form.requestSubmit(); });
    expect(addSailing).not.toHaveBeenCalled();
    expect(host.querySelector('[data-sail-error]')?.textContent).toBe(sv('pl', 'sv_route_unknown_err'));
  });
});

describe('DP-34 · panel Rejsów używa vesselSelectKey i sailingFocusPlan', () => {
  it('lista statków z bazy po otwarciu formularza: pole „Statek” montuje się od nowa i wybiera Wawel', async () => {
    const loader = createVesselsLoader(async () => [{ op: 'POLFERRIES', names: ['Nova Star', 'WAWEL'] }]);
    loader.reset();
    useTowerStore.setState({ role: 'HHL', locale: 'pl' });
    mount();
    await act(async () => { root.render(createElement(SailingsPanel, {})); });
    act(() => { (host.querySelector('[data-sail-new]') as HTMLButtonElement).click(); });
    expect((host.querySelector('select[name="vessel"]') as HTMLSelectElement).value).toBe('Wawel');
    await act(async () => { await loader.load(); });
    expect(currentVesselGroups()).not.toBe(VESSELS_FALLBACK);
    expect((host.querySelector('select[name="vessel"]') as HTMLSelectElement).value).toBe('WAWEL');
    loader.reset();
  });
  it('wejście z wiersza promu przy innym wybranym armatorze — filtr wraca do „Wszyscy”, rejs widoczny', async () => {
    useTowerStore.setState({ role: 'HHL', locale: 'pl', sailingFocus: null });
    mount();
    await act(async () => { root.render(createElement(SailingsPanel, {})); });
    const s = visibleSailing();
    const line = host.querySelector('[data-sail-line]') as HTMLSelectElement;
    act(() => { line.value = 'DFDS'; line.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(host.querySelector(`[data-sailing="${s.id}"]`)).toBeNull();
    act(() => { useTowerStore.getState().setSailingFocus(s.id); });
    await tick();
    expect((host.querySelector('[data-sail-line]') as HTMLSelectElement).value).toBe('ALL');
    expect(host.querySelector(`[data-sailing="${s.id}"]`)).not.toBeNull();
  });
});

describe('DP-36 · useVesselGroups subskrybuje listę sesji', () => {
  it('komponent przerysowuje się po load() (nowa lista), bez ręcznego odświeżenia', async () => {
    const loader = createVesselsLoader(async () => [{ op: 'STENA', names: ['Stena Test'] }]);
    loader.reset();
    let renders = 0;
    const Probe = () => { renders += 1; const g = useVesselGroups(); return createElement('span', { 'data-probe': g[0]?.names[0] ?? '' }); };
    mount();
    await act(async () => { root.render(createElement(Probe)); });
    expect(host.querySelector('[data-probe]')?.getAttribute('data-probe')).toBe(VESSELS_FALLBACK[0].names[0]);
    const before = renders;
    await act(async () => { await loader.load(); });
    expect(renders).toBeGreaterThan(before);
    expect(host.querySelector('[data-probe]')?.getAttribute('data-probe')).toBe('Stena Test');
    loader.reset();
  });
});

describe('DP-33 · DP-7 i DP-8 — zachowanie zamiast tekstu kodu', () => {
  it('DP-7: drawFerryLanes rysuje wszystkie tory, a skipLegs pomija przeprawy narysowane z HERE', async () => {
    const { default: L } = await import('leaflet');
    const { drawFerryLanes } = await import('../src/components/map/mapPool');
    const g = L.layerGroup();
    drawFerryLanes(g);
    expect(g.getLayers()).toHaveLength(ferryLaneLines().length);
    const g2 = L.layerGroup();
    drawFerryLanes(g2, new Set(['FERRY-GDN-NYN', 'FERRY-GDY-KAA']));
    expect(g2.getLayers()).toHaveLength(ferryLaneLines().length - 2);
  });
  it('DP-7: mapa korytarza i pula map korzystają z drawFerryLanes (podłączenie — lekka asercja źródła)', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('src/components/map/CorridorMap.tsx', 'utf8')).toMatch(/drawFerryLanes\(layers\.ferryLeg/);
    expect(readFileSync('src/components/map/mapPool.ts', 'utf8')).toMatch(/drawFerryLanes\(ferryLeg\)/);
  });
  it('DP-8: w paczce demo brak loadera bazy; formularz pokazuje listę zapasową wszystkich armatorów', async () => {
    const { vesselsLoader } = await import('../src/lib/vesselsLoad');
    expect(vesselsLoader).toBeNull();
    useTowerStore.setState({ role: 'HHL', locale: 'pl' });
    mount();
    await act(async () => { root.render(createElement(SailingsPanel, {})); });
    act(() => { (host.querySelector('[data-sail-new]') as HTMLButtonElement).click(); });
    const sel = host.querySelector('select[name="vessel"]') as HTMLSelectElement;
    expect(sel.querySelectorAll('optgroup')).toHaveLength(VESSELS_FALLBACK.length);
    expect(sel.value).toBe('Wawel');
  });
});

describe('DP-35 · reset() przywraca ostrzeżenie', () => {
  it('po reset() kolejny błąd daje drugie ostrzeżenie', async () => {
    const { createVesselsLoader, VESSELS_WARN } = await import('../src/lib/vesselGroups');
    const warn = vi.fn();
    const l = createVesselsLoader(async () => { throw new Error('x'); }, warn);
    const fail = () => l.load().catch(() => undefined);
    await fail(); await fail();
    expect(warn).toHaveBeenCalledTimes(1);
    l.reset();
    await fail();
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenLastCalledWith(VESSELS_WARN);
  });
});
