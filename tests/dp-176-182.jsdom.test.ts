/**
 * @vitest-environment jsdom
 * DP-176 — Kokpit: ciaśniejszy kadr mini-mapy całej sieci (decyzja 88). Mini-mapa 727 × 360 (Kokpit 1920): margines
 * 12 px — większe przybliżenie, cała sieć (Śrem – Boden, Bałtyk, Finlandia) w kadrze, bez Islandii. DP-191: dopisku
 * „Trasa orientacyjna…” już nie ma (bez wariantu „dopisek z boku”). Mapa i karta transportu — kadr bez zmian.
 * DP-182 — Awizacja: rozkład wczytany po otwarciu okna — start dociągany do armatora przypiętego rejsu, dopóki
 * użytkownik sam nie zmienił armatora. Dane wymyślone (G-09).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';

beforeAll(() => {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as unknown as { CSS?: { escape?: (s: string) => string } }).CSS ??= { escape: (s: string) => s };
  Element.prototype.scrollIntoView ??= function scrollIntoView() { /* jsdom */ };
});

const { default: L } = await import('leaflet');
const {
  __resetMapPool, acquireMap, corridorBoundsOf, corridorPadding, fitCorridor, framePadding, KOKPIT_PADDING, NETWORK_LINES, releaseMap,
} = await import('../src/components/map/mapPool');
const { isProgrammatic } = await import('../src/components/map/programmaticMove');
const { networkScope } = await import('../src/lib/map/routeLegs');
const { useTowerStore } = await import('../src/store/useTowerStore');
const { AwizacjaModal } = await import('../src/components/drawer/AwizacjaModal');
type Sailing = import('../src/types').Sailing;
type Load = import('../src/types').Load;
type MapSlot = import('../src/components/map/mapPool').MapSlot;

/* ---------- DP-176 ---------- */
const W = 727;
const H = 360;
let host: HTMLDivElement | null = null;
const spies: { mockRestore: () => void }[] = [];

afterEach(() => {
  for (const s of spies.splice(0)) s.mockRestore();
  host?.remove();
  host = null;
  document.querySelectorAll('.leaflet-container').forEach((n) => n.remove());
  __resetMapPool();
});

function setSize(w: number, h: number): void {
  spies.push(vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(w));
  spies.push(vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(h));
}
/** Nakładka na mapie w pozycji `box` (offset* jak w przeglądarce; jsdom ich nie liczy). */
function addOverlay(className: string, box: { top: number; left: number; width: number; height: number }): HTMLElement {
  const el = document.createElement('div');
  el.className = className;
  host!.appendChild(el);
  for (const [k, v] of Object.entries({ offsetTop: box.top, offsetLeft: box.left, offsetWidth: box.width, offsetHeight: box.height, offsetParent: host })) {
    Object.defineProperty(el, k, { configurable: true, value: v });
  }
  return el;
}
function open(slot: MapSlot, w = W, h = H) {
  setSize(w, h);
  host = document.createElement('div');
  host.className = 'corridor-map-root';
  document.body.appendChild(host);
  const e = acquireMap(host, slot, NETWORK_LINES);
  e.map.invalidateSize({ animate: false });
  return e;
}
const NET = () => corridorBoundsOf(networkScope().tracks);
const zoomFor = (map: L.Map, p: ReturnType<typeof corridorPadding>) =>
  map.getBoundsZoom(NET(), false, L.point(p.paddingTopLeft).add(p.paddingBottomRight));

describe('DP-176 · Kokpit: ciaśniejszy kadr całej sieci (DP-191: bez dopisku „Trasa orientacyjna…”)', () => {
  it('Kokpit 727 × 360: margines 12 px, przybliżenie nie mniejsze niż przy marginesie Mapy (4), sieć w kadrze, bez Islandii', () => {
    const e = open('kokpit');
    const fit = vi.spyOn(e.map, 'fitBounds');
    let programmaticFit = false;
    fit.mockImplementation(function (this: L.Map, ...args: Parameters<L.Map['fitBounds']>) {
      programmaticFit = isProgrammatic(e.map);
      fit.mockRestore();
      return e.map.fitBounds(...args);
    });
    fitCorridor(e.map);
    /* #740 R2-W1: kadr dalej ruchem programowym */
    expect(programmaticFit).toBe(true);
    const pad = framePadding(e.map);
    expect(pad.paddingTopLeft).toEqual([KOKPIT_PADDING, KOKPIT_PADDING]);
    expect(pad.paddingBottomRight).toEqual([KOKPIT_PADDING, KOKPIT_PADDING]);
    const z = e.map.getZoom();
    expect(z).toBe(zoomFor(e.map, pad));
    /* przybliżenie nie mniejsze niż przy marginesie Mapy (24 px); przed DP-176 ok. 3 (morze od Islandii po Ural) — teraz 4 */
    expect(z).toBeGreaterThanOrEqual(zoomFor(e.map, corridorPadding(e.map)));
    expect(z).toBeGreaterThanOrEqual(4);
    expect(z).toBeLessThanOrEqual(4.5);
    const view = e.map.getBounds();
    /* cała sieć w kadrze: Śrem, Boden, Tallinn, Helsinki, Paldiski, Jyväskylä */
    expect(view.contains(NET())).toBe(true);
    /* bez Islandii (najdalej na wschód ok. −13,5°; Reykjavík −21,9°) i bez połowy Rosji; DP-191: bez dopisku sieć
       stoi na środku kadru (wcześniej z lewej, obok dopisku), więc z zachodu widać więcej Morza Norweskiego */
    expect(view.getWest()).toBeGreaterThan(-13.5);
    expect(view.getEast() - view.getWest()).toBeLessThan(70);
    releaseMap(e, 'kokpit');
  });

  it('DP-191: pozostałość `.bn7-note` w DOM nie zmienia kadru Kokpitu (margines 12 px, bez wariantu „dopisek z boku”)', () => {
    const e = open('kokpit');
    addOverlay('note bn7-note', { top: 12, left: W - 56 - 340, width: 340, height: 44 });
    expect(framePadding(e.map).paddingTopLeft).toEqual([KOKPIT_PADDING, KOKPIT_PADDING]);
    expect(framePadding(e.map).paddingBottomRight).toEqual([KOKPIT_PADDING, KOKPIT_PADDING]);
    releaseMap(e, 'kokpit');
  });

  it('Kokpit: inne nakładki liczone jak dotąd — u góry margines górny, na dole margines dolny (12 px + nakładka)', () => {
    const e = open('kokpit', 358, H);
    addOverlay('note po-mapnote', { top: 6, left: 6, width: 358 - 66, height: 50 }).setAttribute('data-map-bottom', '');
    expect(framePadding(e.map).paddingTopLeft).toEqual([KOKPIT_PADDING, KOKPIT_PADDING + 56]);
    addOverlay('mapkey', { top: H - 40, left: 6, width: 200, height: 30 });
    expect(framePadding(e.map).paddingBottomRight).toEqual([KOKPIT_PADDING, KOKPIT_PADDING + 40]);
    fitCorridor(e.map);
    expect(e.map.getBounds().contains(NET())).toBe(true);
    releaseMap(e, 'kokpit');
  });

  it('Mapa i karta transportu: kadr bez zmian (`corridorPadding`, margines 24 px)', () => {
    for (const slot of ['map', 'drawer'] as const) {
      const e = open(slot);
      expect(framePadding(e.map)).toEqual(corridorPadding(e.map));
      expect(framePadding(e.map).paddingTopLeft).toEqual([24, 24]);
      if (slot === 'map') {
        fitCorridor(e.map);
        expect(e.map.getZoom()).toBe(zoomFor(e.map, corridorPadding(e.map)));
      }
      releaseMap(e, slot);
      host?.remove();
      for (const s of spies.splice(0)) s.mockRestore();
      __resetMapPool();
    }
  });

  it('ta sama mapa z puli: Kokpit → Mapa — Mapa wraca do swojego kadru', () => {
    const k = open('kokpit');
    fitCorridor(k.map);
    const zk = k.map.getZoom();
    releaseMap(k, 'kokpit');
    const m = acquireMap(host!, 'map', NETWORK_LINES);
    expect(m).toBe(k);
    fitCorridor(m.map);
    expect(m.map.getZoom()).toBe(zoomFor(m.map, corridorPadding(m.map)));
    expect(framePadding(m.map).paddingTopLeft).toEqual([24, 24]);
    expect(m.map.getZoom()).toBeLessThanOrEqual(zk);
    releaseMap(m, 'map');
  });
});

/* ---------- DP-182 ---------- */
let root: Root | null = null;
let mhost: HTMLDivElement | null = null;
const initial = useTowerStore.getState();

describe('DP-182 · Awizacja: armator startowy po wczytaniu rozkładu', () => {
  afterEach(() => {
    if (root) act(() => { root!.unmount(); });
    root = null;
    mhost?.remove();
    mhost = null;
    useTowerStore.setState({ loads: initial.loads, sailings: initial.sailings, role: initial.role, locale: initial.locale });
  });

  const T0 = Date.parse('2099-03-10T06:00:00+02:00');
  const iso = (ms: number) => new Date(ms).toISOString();
  const S = (p: Partial<Sailing> & Pick<Sailing, 'id' | 'route' | 'departureAt'>): Sailing => ({
    vessel: 'Statek', arrivalAt: p.departureAt, delayedDepartureAt: null, delayedArrivalAt: null,
    status: 'ZAPLANOWANY', source: 'RECZNIE', ...p,
  } as Sailing);
  const st = S({ id: 'st1', route: 'GDY-KAA', vessel: 'Stena Spirit', source: 'STENA', operator: 'Stena Line', departureAt: iso(T0 + 15 * 36e5), arrivalAt: iso(T0 + 25 * 36e5) });
  const pf = S({ id: 'pf1', route: 'GDN-NYN', vessel: 'Wawel', source: 'POLFERRIES', operator: 'Polferries', departureAt: iso(T0 + 15 * 36e5), arrivalAt: iso(T0 + 33 * 36e5) });
  const load = (): Load => {
    const l = initial.loads[0];
    return {
      ...l, plannedLoadDate: '2099-03-10', sailingId: 'st1', ferry: { ...l.ferry, vessel: null, departureAt: null },
      awizacja: { ...l.awizacja, loadWindowStart: undefined, loadWindowEnd: undefined },
    } as Load;
  };
  const opSel = () => mhost!.querySelector<HTMLSelectElement>('[data-awiz-operator]')!;
  async function openBeforeSailings(l: Load) {
    useTowerStore.setState({ role: 'HHL', locale: 'pl', loads: [l, ...initial.loads.slice(1)], sailings: [] });
    mhost = document.createElement('div');
    document.body.appendChild(mhost);
    root = createRoot(mhost);
    await act(async () => { root!.render(createElement(AwizacjaModal, { load: l, onClose: () => undefined })); });
  }

  it('okno otwarte przed wczytaniem rejsów → po wczytaniu przypiętego rejsu Steny start = Stena', async () => {
    await openBeforeSailings(load());
    expect(opSel().value).toBe('POLFERRIES');
    await act(async () => { useTowerStore.setState({ sailings: [pf, st] }); });
    expect(opSel().value).toBe('STENA');
    expect(mhost!.querySelector<HTMLSelectElement>('[data-awiz-sailing]')!.value).toBe('st1');
    /* jednorazowo: późniejsze odświeżenie rozkładu nie rusza armatora */
    await act(async () => { useTowerStore.setState({ sailings: [pf, { ...st }] }); });
    expect(opSel().value).toBe('STENA');
  });

  it('ręczna zmiana armatora przed wczytaniem rejsów — bez nadpisania po wczytaniu', async () => {
    await openBeforeSailings(load());
    act(() => {
      opSel().value = 'TALLINK';
      opSel().dispatchEvent(new Event('change', { bubbles: true }));
    });
    const chosen = opSel().value;
    expect(chosen).toBe('TALLINK');
    await act(async () => { useTowerStore.setState({ sailings: [pf, st] }); });
    expect(opSel().value).toBe(chosen);
  });
});
