/**
 * @vitest-environment jsdom
 * BN9-c5 (#718 BN7 §4) — linie tras BN7: filtr na karcie transportu, Mapie/Kokpicie i mapach stref.
 *  - karta TLL-HEL → tylko PL-TLL + FI-HEL + tor TLL-HEL; GDY-KAA → PL-GDY + SE-KAA + SE-KAA-INLAND (decyzja 36);
 *  - Mapa i Kokpit (decyzja 88): cała sieć zawsze — rdzeń, wszystkie legi BN7 i tory bałtyckie, dopisek, kadr całej sieci;
 *  - F7 r2 #740 R2-W1: programowy kadr (zmiana rozmiaru, `setMaxZoom`) nie udaje ruchu użytkownika;
 *  - mapa stref bez legów BN7 (także gdy serwer poda ich punkty po `cron_fetch`);
 *  - regresja GDN-NYN: linie PL/SE bez zmian (te same geometrie, styl #E5A544, tor GDN-NYN).
 * Linie rozpoznawane po pierwszym punkcie (nie po klasie ani liczbie).
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
const { default: ZonesMap } = await import('../src/components/zones/ZonesMap');
const {
  __poolEntryForTests, __resetMapPool, acquireMap, corridorBoundsOf, corridorPadding, drawCorridorLines, NETWORK_LINES, releaseMap,
} = await import('../src/components/map/mapPool');
const { isProgrammatic, programmatic } = await import('../src/components/map/programmaticMove');
const { __resetRoadLinesCacheForTests } = await import('../src/components/map/applyBasemap');
const { ORANGE_ROAD_STYLE } = await import('../src/components/map/orangeRoads');
const { DEMO_ROAD_LEGS, DEMO_ROAD_LINES } = await import('../src/data/roadLinesDemo');
const { WATER_TRACKS_EXTRA, extraWaterTracksFor } = await import('../src/lib/map/ferryLines');
const { ferryLaneLines } = await import('../src/lib/map/ferryLanes');
const { WATER_GDN_NYN } = await import('../src/lib/map/draw');
const {
  __resetDemoRoutesForTests, BN7_LEGS, baselineScope, CORE_LEGS, coreLegsOnly, corridorScope, demoRouteOverrides, legsOfRoute,
  networkScope, routeOfLoad,
} = await import('../src/lib/map/routeLegs');
const { BN9C5_EN, I18N_ALL } = await import('../src/i18n/messages');
const { buildSeedLoads } = await import('../src/data/seed');

type Pt = readonly [number, number];
const first = (pl: Polyline): Pt => {
  const p = (pl.getLatLngs() as LLatLng[])[0];
  return [p.lat, p.lng];
};
const demoLine = (leg: string) => DEMO_ROAD_LEGS.find((l) => l.leg === leg)!.line;
const routeFirsts = (): Pt[] => (__poolEntryForTests()!.layers.route.getLayers() as Polyline[]).map(first);
const laneFirsts = (): Pt[] => (__poolEntryForTests()!.layers.ferryLeg.getLayers() as Polyline[]).map(first);
const NOTE = 'Trasa orientacyjna (HERE, bez wymiarów ładunku) — nie zastępuje trasy z zezwolenia.';

let host: HTMLDivElement | null = null;
let root: Root | null = null;
function mount(): void {
  host = document.createElement('div');
  host.style.cssText = 'width:900px;height:600px;position:relative';
  document.body.appendChild(host);
  root = createRoot(host);
}
const wait = (ms: number) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const initial = { ...useTowerStore.getState(), loads: buildSeedLoads() };

afterEach(() => {
  if (root) act(() => { root!.unmount(); });
  root = null;
  host?.remove();
  host = null;
  document.querySelectorAll('.leaflet-container').forEach((n) => n.remove());
  __resetMapPool();
  __resetDemoRoutesForTests();
  __resetRoadLinesCacheForTests();
  vi.unstubAllEnvs();
  useTowerStore.setState({ loads: initial.loads, sailings: initial.sailings, selectedLoadId: null, role: initial.role });
});

describe('BN9-c5 · reguła legów trasy (czysta)', () => {
  it('TLL-HEL → PL-TLL + FI-HEL; GDY-KAA → PL-GDY + SE-KAA + SE-KAA-INLAND; GDN-NYN → PL-GDN + SE-NYN', () => {
    expect(legsOfRoute('TLL-HEL')).toEqual(['PL-TLL', 'FI-HEL']);
    expect(legsOfRoute('GDY-KAA')).toEqual(['PL-GDY', 'SE-KAA', 'SE-KAA-INLAND']);
    expect(legsOfRoute('GDN-NYN')).toEqual(['PL-GDN', 'SE-NYN']);
    expect(legsOfRoute('MUU-VUO')).toEqual(['PL-MUU', 'FI-VUO']);
    expect(legsOfRoute('TLL-STO')).toEqual(['PL-TLL', 'SE-STO']);
    expect(legsOfRoute('PLD-KPS')).toEqual(['PL-PLD', 'SE-KPS']);
    /* Terminal A — rodzina toru (zapas), bez wiersza w `route_legs` */
    expect(legsOfRoute('TLLA-HEL')).toEqual(['PL-TLL', 'FI-HEL']);
  });
  it('`route_legs` z bazy wygrywa nad zapasem; INLAND dopisywany przy SE-KAA także z bazy', () => {
    const rows = [{ route: 'GDY-KAA', pre: 'PL-GDY', post: 'SE-KAA' }, { route: 'TLL-HEL', pre: 'PL-TLL', post: 'FI-HEL' }];
    expect(legsOfRoute('GDY-KAA', rows)).toEqual(['PL-GDY', 'SE-KAA', 'SE-KAA-INLAND']);
    expect(legsOfRoute('TLL-HEL', [{ route: 'TLL-HEL', pre: 'PL-X', post: null }])).toEqual(['PL-X']);
  });
  it('Q-18: trasy powrotne bez linii (legi, tor); nieznana trasa — pusto', () => {
    for (const r of ['HEL-TLL', 'KAA-GDY', 'NYN-GDN', 'KPS-PLD', 'STO-TLL', 'VUO-MUU']) {
      expect(legsOfRoute(r), r).toEqual([]);
      /* F7 #740 W1: karta na trasie powrotnej — pusty zakres (bez dróg i torów), nie rdzeń */
      const sc = corridorScope([r], [], false);
      expect([...sc.legs], r).toEqual([]);
      expect([...sc.tracks], r).toEqual([]);
    }
    /* zapas „rdzeń” dla trasy nieznanej (null) i nierozpoznanej */
    expect([...corridorScope([null], [], false).tracks]).toEqual(['GDN-NYN', 'GDY-KAA']);
    expect([...corridorScope([], [], false).tracks]).toEqual(['GDN-NYN', 'GDY-KAA']);
    expect([...corridorScope(['XXX-YYY'], [], false).tracks]).toEqual(['GDN-NYN', 'GDY-KAA']);
    expect(legsOfRoute(null)).toEqual([]);
    expect(legsOfRoute('XXX-YYY')).toEqual([]);
  });
  it('F7 r2 #740 R2-D1: trasa wyjazdowa spoza katalogu (bez toru) → rdzeń, nie pusty zakres; powrotna dalej pusto', () => {
    /* Gdynia → Nynäshamn: kierunek PL → SE, bez wpisu w katalogu i bez toru */
    const core = baselineScope();
    expect(corridorScope(['GDY-NYN'], [], false).key).toBe(core.key);
    /* z rozpoznaną trasą z torem — tylko ona (zapasu rdzenia nie ma) */
    expect([...corridorScope(['GDY-NYN', 'TLL-HEL'], [], false).tracks]).toEqual(['TLL-HEL']);
    /* powrotna + nieznana: powrotna jest rozpoznana — pusto (Q-18) */
    expect([...corridorScope(['HEL-TLL', 'XXX-YYY'], [], false).tracks]).toEqual([]);
  });
  it('decyzja 88: `networkScope` — rdzeń + 7 legów BN7, wszystkie 6 torów, linia bałtycka', () => {
    const n = networkScope();
    expect([...n.legs].sort()).toEqual([...CORE_LEGS, ...BN7_LEGS].sort());
    expect([...n.tracks].sort()).toEqual(['GDN-NYN', 'GDY-KAA', 'MUU-VUO', 'PLD-KPS', 'TLL-HEL', 'TLL-STO']);
    expect(n.baltic).toBe(true);
    /* legi z `route_legs` pod inną nazwą też w sieci */
    expect(networkScope([{ route: 'TLL-HEL', pre: 'PL-TLL2', post: 'FI-HEL' }]).legs.has('PL-TLL2')).toBe(true);
  });
  it('karta (bez rdzenia): TLL-HEL → legi PL-TLL, FI-HEL i tor TLL-HEL = extraWaterTracksFor([route])', () => {
    const s = corridorScope(['TLL-HEL'], [], false);
    expect([...s.legs].sort()).toEqual(['FI-HEL', 'PL-TLL']);
    expect([...s.tracks]).toEqual(['TLL-HEL']);
    expect(s.baltic).toBe(true);
    const lanes = ferryLaneLines(new Set(), s.tracks);
    expect(lanes).toHaveLength(1);
    expect(lanes[0]).toEqual(extraWaterTracksFor(['TLL-HEL'])[0].line.map(([a, b]) => [a, b]));
  });
  it('Mapa/Kokpit (z rdzeniem): bez tras bałtyckich = rdzeń; z TLL-HEL — rdzeń + PL-TLL/FI-HEL i tor TLL-HEL', () => {
    const core = baselineScope();
    expect([...core.legs].sort()).toEqual(['PL-GDN', 'PL-GDY', 'SE-KAA', 'SE-KAA-INLAND', 'SE-NYN']);
    expect(core.baltic).toBe(false);
    expect(corridorScope(['GDN-NYN', 'GDY-KAA']).key).toBe(core.key);
    expect(corridorScope([]).key).toBe(core.key);
    const s = corridorScope(['GDN-NYN', 'TLL-HEL']);
    expect([...s.legs].filter((l) => BN7_LEGS.has(l)).sort()).toEqual(['FI-HEL', 'PL-TLL']);
    expect([...s.tracks].sort()).toEqual(['GDN-NYN', 'GDY-KAA', 'TLL-HEL']);
  });
  it('mapy stref: `coreLegsOnly` odcina wszystkie 7 legów BN7', () => {
    const rows = [...BN7_LEGS, 'PL-GDN', 'SE-NYN', 'PL-GDY', 'SE-KAA', 'SE-KAA-INLAND'].map((leg) => ({ leg }));
    expect(coreLegsOnly(rows).map((r) => r.leg)).toEqual(['PL-GDN', 'SE-NYN', 'PL-GDY', 'SE-KAA', 'SE-KAA-INLAND']);
    /* F7 #740 D3: lista dozwolonych — nowy, nieznany leg też poza mapą stref */
    expect(coreLegsOnly([{ leg: 'LT-NEW' }, { leg: 'PL-GDN' }]).map((r) => r.leg)).toEqual(['PL-GDN']);
  });
  it('trasa transportu: rejs przypisany, statek o godzinie rejsu, armator statku; demo — trasa z adresu', () => {
    const sailings = [{ id: 's1', vessel: 'Finlandia', route: 'TLL-HEL', departureAt: '2026-09-23T08:00:00Z' }];
    expect(routeOfLoad({ sailingId: 's1', ferry: { vessel: null, departureAt: null } }, sailings)).toBe('TLL-HEL');
    expect(routeOfLoad({ ferry: { vessel: 'Finlandia', departureAt: '2026-09-23T08:00:00Z' } }, sailings)).toBe('TLL-HEL');
    expect(routeOfLoad({ ferry: { vessel: 'M/F Wawel', departureAt: null } }, [])).toBe('GDN-NYN');
    expect(routeOfLoad({ ferry: { vessel: null, departureAt: null } }, [])).toBeNull();
    const over = demoRouteOverrides('http://h/#/?now=2026-09-23T14%3A32%3A00Z&demoRoute=SG-11:TLL-HEL,SG-17:PLD-KPS,X:zle');
    expect([...over]).toEqual([['SG-11', 'TLL-HEL'], ['SG-17', 'PLD-KPS']]);
    expect(routeOfLoad({ code: 'SG-11', ferry: { vessel: 'M/F Wawel', departureAt: null } }, [], undefined, over)).toBe('TLL-HEL');
  });
  it('F7 #740 D2: niska mapa z wysokimi nakładkami — marginesy przycięte (zostaje ≥ 80 px na trasę)', () => {
    host = document.createElement('div');
    host.className = 'corridor-map-root';
    host.style.cssText = 'width:360px;height:150px;position:relative';
    document.body.appendChild(host);
    const e = acquireMap(host, 'drawer');
    const note = document.createElement('div');
    note.setAttribute('data-map-bottom', '');
    host.appendChild(note);
    Object.defineProperty(host, 'clientHeight', { configurable: true, value: 150 });
    Object.defineProperty(e.el, 'clientHeight', { configurable: true, value: 150 });
    Object.defineProperty(note, 'offsetHeight', { configurable: true, value: 120 });
    Object.defineProperty(note, 'offsetTop', { configurable: true, value: 20 });
    Object.defineProperty(note, 'offsetParent', { configurable: true, value: host });
    const pad = corridorPadding(e.map);
    const v = pad.paddingTopLeft[1] + pad.paddingBottomRight[1];
    expect(v).toBeLessThanOrEqual(150 - 80);
    releaseMap(e, 'drawer');
  });

  it('kadr: bez tras bałtyckich bez zmian; z TLL-HEL obejmuje tor i drogę FI (Jyväskylä), PLD-KPS — Paldiski', () => {
    const core = corridorBoundsOf();
    expect(corridorBoundsOf(new Set(['GDN-NYN', 'GDY-KAA']))).toBe(core);
    const b = corridorBoundsOf(new Set(['GDN-NYN', 'TLL-HEL']));
    expect(b.getEast()).toBeGreaterThanOrEqual(25.75);
    expect(b.contains([60.153, 24.915])).toBe(true);
    expect(b.contains(core)).toBe(true);
    expect(core.getEast()).toBeLessThan(24);
    expect(corridorBoundsOf(new Set(['PLD-KPS'])).contains([59.3327, 24.0804])).toBe(true);
    /* decyzja 88: kadr Mapy/Kokpitu = cała sieć — Śrem, Gdańsk, Boden, Tallinn, Helsinki, Kapellskär, Paldiski, Bauska */
    const net = corridorBoundsOf(networkScope().tracks);
    for (const p of [[52.07391, 17.0246], [54.352, 18.6466], [65.80539, 21.75914], [59.443, 24.77], [60.153, 24.915],
      [59.721, 19.065], [59.335, 24.083], [56.41, 24.19], [62.24, 25.75]] as [number, number][]) {
      expect(net.contains(p), p.join(',')).toBe(true);
    }
  });
  it('F7 r2 #740 R2-W1: `programmatic` — znacznik na czas wywołania (zagnieżdżenie, wyjątek)', () => {
    const m = {};
    expect(isProgrammatic(m)).toBe(false);
    programmatic(m, () => {
      programmatic(m, () => expect(isProgrammatic(m)).toBe(true));
      expect(isProgrammatic(m)).toBe(true);
    });
    expect(isProgrammatic(m)).toBe(false);
    expect(() => programmatic(m, () => { throw new Error('x'); })).toThrow('x');
    expect(isProgrammatic(m)).toBe(false);
  });
  it('dopisek PL w słowniku; EN (BN9C5_EN) z tymi samymi kluczami, bez polskich liter, niepodpięte (8A)', () => {
    expect(I18N_ALL.pl.bn9c5_route_note).toBe(NOTE);
    expect(Object.keys(BN9C5_EN)).toEqual(['bn9c5_route_note']);
    for (const v of Object.values(BN9C5_EN)) expect(/[ąćęłńóśźż]/i.test(v), v).toBe(false);
    expect(I18N_ALL.en.bn9c5_route_note).toBeUndefined();
  });
  it('dane demo: rdzeń = dokładnie DEMO_ROAD_LINES; legi BN7 oznaczone jako przykład', () => {
    const core = baselineScope();
    const seen = new Set<unknown>();
    const lines = DEMO_ROAD_LEGS.filter((l) => core.legs.has(l.leg) && !seen.has(l.line) && seen.add(l.line)).map((l) => l.line);
    expect(lines).toEqual([...DEMO_ROAD_LINES]);
    for (const l of DEMO_ROAD_LEGS) expect(!!l.example, l.leg).toBe(BN7_LEGS.has(l.leg));
  });
});

/** Pierwszy aktywny transport demo (okno śledzenia) i transport przed oknem (karta: cała trasa). */
function demoLoads() {
  if (useTowerStore.getState().loads.length === 0) useTowerStore.setState({ loads: buildSeedLoads() });
  const loads = useTowerStore.getState().loads;
  const active = loads.find((l) => l.code === 'SG-17')!;
  const planned = loads.find((l) => l.code === 'SG-11')!;
  return { loads, active, planned };
}

describe('BN9-c5 · karta transportu i Mapa (demo, CorridorMap)', () => {
  it('karta TLL-HEL: tylko PL-TLL + FI-HEL i tor TLL-HEL; dopisek przy linii', async () => {
    const { loads, planned } = demoLoads();
    useTowerStore.setState({
      theme: 'light',
      loads: loads.map((l) => (l.id === planned.id ? { ...l, sailingId: 'bn7-s1' } : l)),
      sailings: [...useTowerStore.getState().sailings, {
        id: 'bn7-s1', vessel: 'Finlandia', route: 'TLL-HEL', departureAt: '2026-09-24T08:00:00Z', arrivalAt: '2026-09-24T10:00:00Z',
        delayedDepartureAt: null, delayedArrivalAt: null, status: 'ZAPLANOWANY', source: 'ECKERO',
      }],
      selectedLoadId: planned.id,
    });
    mount();
    await act(async () => { root!.render(createElement(CorridorMap, { loads: [], embedded: true, slot: 'drawer' })); });
    await wait(50);
    expect(routeFirsts()).toEqual([demoLine('PL-TLL')[0], demoLine('FI-HEL')[0]]);
    expect(laneFirsts()).toEqual([WATER_TRACKS_EXTRA['TLL-HEL'][0]]);
    const style = (__poolEntryForTests()!.layers.route.getLayers()[0] as Polyline).options;
    expect(style.color).toBe(ORANGE_ROAD_STYLE.color);
    expect(host!.querySelector('[data-route-note="baltic"]')?.textContent).toBe(NOTE);
  });

  it('karta PLD-KPS (demo przez `demoRoute`): PL-PLD + SE-KPS i tor PLD-KPS', async () => {
    const { planned } = demoLoads();
    window.history.replaceState(null, '', `/#/?demoRoute=${planned.code}:PLD-KPS`);
    __resetDemoRoutesForTests();
    useTowerStore.setState({ selectedLoadId: planned.id });
    mount();
    await act(async () => { root!.render(createElement(CorridorMap, { loads: [], embedded: true, slot: 'drawer' })); });
    await wait(50);
    window.history.replaceState(null, '', '/');
    expect(routeFirsts()).toEqual([demoLine('PL-PLD')[0], demoLine('SE-KPS')[0]]);
    expect(laneFirsts()).toEqual([WATER_TRACKS_EXTRA['PLD-KPS'][0]]);
  });

  it('regresja GDN-NYN: karta — linie PL i SE jak dotąd (te same geometrie) i tor GDN-NYN; bez dopisku', async () => {
    const { planned } = demoLoads();
    expect(planned.ferry.vessel).toMatch(/Wawel|Nova Star/);
    useTowerStore.setState({ selectedLoadId: planned.id });
    mount();
    await act(async () => { root!.render(createElement(CorridorMap, { loads: [], embedded: true, slot: 'drawer' })); });
    await wait(50);
    expect(routeFirsts()).toEqual([DEMO_ROAD_LINES[0][0], DEMO_ROAD_LINES[1][0]]);
    expect(laneFirsts()).toEqual([[WATER_GDN_NYN[0][1], WATER_GDN_NYN[0][0]]]);
    expect(host!.querySelector('[data-route-note]')).toBeNull();
  });

  it('F7 #740 W1: karta na trasie powrotnej (HEL-TLL) — bez dróg i torów; kadr jak rdzeń (nie szara mapa)', async () => {
    const { planned } = demoLoads();
    window.history.replaceState(null, '', `/#/?demoRoute=${planned.code}:HEL-TLL`);
    __resetDemoRoutesForTests();
    useTowerStore.setState({ selectedLoadId: planned.id });
    mount();
    await act(async () => { root!.render(createElement(CorridorMap, { loads: [], embedded: true, slot: 'drawer' })); });
    await wait(50);
    window.history.replaceState(null, '', '/');
    expect(routeFirsts()).toEqual([]);
    expect(laneFirsts()).toEqual([]);
    expect(host!.querySelector('[data-route-note]')).toBeNull();
    const z = __poolEntryForTests()!.map.getZoom();
    expect(Number.isFinite(z)).toBe(true);
  });

  /** ResizeObserver z jsdom nie istnieje — atrapa z ręcznym wywołaniem (jak zmiana rozmiaru w przeglądarce). */
  function stubResize(): { fire: () => void } {
    const cbs: (() => void)[] = [];
    vi.stubGlobal('ResizeObserver', class {
      constructor(cb: () => void) { cbs.push(cb); }
      observe() { /* atrapa */ }
      unobserve() { /* atrapa */ }
      disconnect() { /* atrapa */ }
    });
    return { fire: () => { for (const cb of cbs) cb(); } };
  }

  it('F7 r2 #740 R2-W1: kadr po zmianie rozmiaru (i `zoomstart` z kadru) nie jest ruchem użytkownika; kółko — jest', async () => {
    demoLoads();
    const ro = stubResize();
    let w = 900;
    const cw = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => w);
    const ch = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
    mount();
    await act(async () => { root!.render(createElement(CorridorMap, { loads: [], slot: 'map' })); });
    await wait(50);
    const e = __poolEntryForTests()!;
    const fit = vi.spyOn(e.map, 'fitBounds');
    w = 1200;
    act(() => { ro.fire(); });
    await wait(50);
    /* kadr całej sieci po zmianie rozmiaru (E1) — programowy */
    expect(fit).toHaveBeenCalled();
    expect(e.el.dataset.userMoved).toBe('0');
    /* sam `zoomstart` (wysyła go `fitBounds` i `setMaxZoom`) nie jest interakcją */
    act(() => { e.map.fire('zoomstart'); e.map.setMaxZoom(18); });
    expect(e.el.dataset.userMoved).toBe('0');
    /* kółko myszy — ruch użytkownika */
    act(() => { e.map.getContainer().dispatchEvent(new Event('wheel')); });
    expect(e.el.dataset.userMoved).toBe('1');
    fit.mockRestore();
    cw.mockRestore();
    ch.mockRestore();
    vi.unstubAllGlobals();
  });

  it('F7 r2 #740 R2-W1: karta — po zmianie rozmiaru i `setMaxZoom` nowy tor daje kadr; po prawdziwym przeciągnięciu — nie', async () => {
    const { loads, planned } = demoLoads();
    const ro = stubResize();
    let w = 520;
    const cw = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => w);
    const ch = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(340);
    useTowerStore.setState({
      selectedLoadId: planned.id,
      sailings: [...useTowerStore.getState().sailings, {
        id: 'bn7-r2', vessel: 'Finlandia', route: 'TLL-HEL', departureAt: '2026-09-24T08:00:00Z', arrivalAt: '2026-09-24T10:00:00Z',
        delayedDepartureAt: null, delayedArrivalAt: null, status: 'ZAPLANOWANY', source: 'ECKERO',
      }],
    });
    mount();
    await act(async () => { root!.render(createElement(CorridorMap, { loads: [], embedded: true, slot: 'drawer' })); });
    await wait(50);
    const e = __poolEntryForTests()!;
    const fit = vi.spyOn(e.map, 'fitBounds');
    w = 600;
    act(() => { ro.fire(); programmatic(e.map, () => e.map.setMaxZoom(17)); e.map.fire('zoomstart'); });
    await wait(30);
    expect(e.el.dataset.userMoved).toBe('0');
    const before = fit.mock.calls.length;
    /* nowy tor (karta GDN-NYN → TLL-HEL) bez ruchu użytkownika — kadr */
    await act(async () => { useTowerStore.setState({ loads: loads.map((l) => (l.id === planned.id ? { ...l, sailingId: 'bn7-r2' } : l)) }); });
    await wait(30);
    expect(routeFirsts()).toEqual([demoLine('PL-TLL')[0], demoLine('FI-HEL')[0]]);
    expect(fit.mock.calls.length).toBe(before + 1);
    /* prawdziwe przeciągnięcie — kolejna zmiana toru nie kadruje */
    act(() => { e.map.fire('dragstart'); });
    expect(e.el.dataset.userMoved).toBe('1');
    await act(async () => { useTowerStore.setState({ loads }); });
    await wait(30);
    expect(routeFirsts()).toEqual([DEMO_ROAD_LINES[0][0], DEMO_ROAD_LINES[1][0]]);
    expect(fit.mock.calls.length).toBe(before + 1);
    fit.mockRestore();
    cw.mockRestore();
    ch.mockRestore();
    vi.unstubAllGlobals();
  });

  /** Decyzja 88: rdzeń (3 linie demo) i 7 legów BN7 (przykład), 6 torów; dopisek „Trasa orientacyjna…”. */
  const networkFirsts = (): Pt[] => [...DEMO_ROAD_LINES.map((l) => l[0]), ...[...BN7_LEGS].map((leg) => demoLine(leg)[0])];
  function expectNetwork(): void {
    expect(routeFirsts()).toEqual(networkFirsts());
    expect(laneFirsts()).toHaveLength(6);
    for (const id of Object.keys(WATER_TRACKS_EXTRA) as (keyof typeof WATER_TRACKS_EXTRA)[]) {
      expect(laneFirsts(), id).toContainEqual(WATER_TRACKS_EXTRA[id][0]);
    }
    expect(host!.querySelector('[data-route-note="baltic"]')?.textContent).toBe(NOTE);
  }

  it('decyzja 88: Mapa bez aktywnych transportów bałtyckich — rdzeń, wszystkie legi BN7 i tory bałtyckie, dopisek', async () => {
    demoLoads();
    mount();
    await act(async () => { root!.render(createElement(CorridorMap, { loads: [], slot: 'map' })); });
    await wait(50);
    expectNetwork();
    /* kadr całej sieci (z Bałtykiem) */
    expect(__poolEntryForTests()!.map.getBounds().isValid()).toBe(true);
  });

  it('decyzja 88: Kokpit — to samo; ta sama mapa z puli w karcie GDN-NYN — tylko swój korytarz', async () => {
    demoLoads();
    mount();
    await act(async () => { root!.render(createElement(CorridorMap, { loads: [], embedded: true, slot: 'kokpit' })); });
    await wait(50);
    expectNetwork();
    act(() => { root!.unmount(); });
    root = createRoot(host!);
    useTowerStore.setState({ selectedLoadId: demoLoads().planned.id });
    await act(async () => { root!.render(createElement(CorridorMap, { loads: [], embedded: true, slot: 'drawer' })); });
    await wait(50);
    expect(routeFirsts()).toEqual([DEMO_ROAD_LINES[0][0], DEMO_ROAD_LINES[1][0]]);
    expect(laneFirsts()).toEqual([[WATER_GDN_NYN[0][1], WATER_GDN_NYN[0][0]]]);
    expect(host!.querySelector('[data-route-note]')).toBeNull();
  });
});

/* ---------- PROD: legi z `map_display_state` (po `cron_fetch=true` BN7 ma punkty) ---------- */

function dense(from: Pt, to: Pt, n = 240): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i += 1) out.push([from[0] + ((to[0] - from[0]) * i) / n, from[1] + ((to[1] - from[1]) * i) / n]);
  return out;
}
/* `loose` (≥200 pkt, krok ≤3 km, ≥80 km) — każdy leg z innym początkiem, żeby rozpoznać go po pierwszym punkcie */
const START: Record<string, Pt> = {
  'PL-GDN': [52.0, 17.0], 'PL-GDY': [52.1, 17.1], 'SE-NYN': [58.9, 17.9], 'SE-KAA': [56.16, 15.63], 'SE-KAA-INLAND': [56.2, 15.7],
  'PL-TLL': [52.2, 17.2], 'PL-MUU': [52.3, 17.3], 'PL-PLD': [52.4, 17.4], 'FI-HEL': [60.15, 24.9], 'FI-VUO': [60.2, 25.2],
  'SE-STO': [59.35, 18.1], 'SE-KPS': [59.72, 19.06],
};
const ROADS = Object.entries(START).map(([leg, a]) => ({
  leg, spec: 'loose', corridor_code: null, points: dense(a, [a[0] + 0.8, a[1] + 1.2]), browser_fetch: !BN7_LEGS.has(leg),
  map_group: BN7_LEGS.has(leg) ? 'bn7' : 'core', summary: '',
}));
const ROUTE_LEGS = [
  { route: 'GDN-NYN', pre: 'PL-GDN', post: 'SE-NYN' }, { route: 'GDY-KAA', pre: 'PL-GDY', post: 'SE-KAA' },
  { route: 'TLL-HEL', pre: 'PL-TLL', post: 'FI-HEL' }, { route: 'MUU-VUO', pre: 'PL-MUU', post: 'FI-VUO' },
  { route: 'TLL-STO', pre: 'PL-TLL', post: 'SE-STO' }, { route: 'PLD-KPS', pre: 'PL-PLD', post: 'SE-KPS' },
];
const starts = (legs: string[]) => legs.map((l) => START[l]);

describe('BN9-c5 · PROD: legi BN7 z punktami nie trafiają na mapy spoza zakresu', () => {
  async function prodPool(slot: 'drawer' | 'map', spec: { routes: string[]; baseline: boolean; network?: boolean }) {
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    __resetRoadLinesCacheForTests();
    rpc.mockReset();
    rpc.mockResolvedValue({ data: { roads: ROADS, route_legs: ROUTE_LEGS }, error: null });
    useTowerStore.setState({ theme: 'light' });
    host = document.createElement('div');
    host.style.cssText = 'width:640px;height:480px;position:relative';
    document.body.appendChild(host);
    const e = acquireMap(host, slot, spec);
    await drawCorridorLines(e, spec, true);
    return e;
  }

  it('karta GDY-KAA → PL-GDY + SE-KAA + SE-KAA-INLAND (decyzja 36), tor GDY-KAA', async () => {
    const e = await prodPool('drawer', { routes: ['GDY-KAA'], baseline: false });
    expect(routeFirsts()).toEqual(starts(['PL-GDY', 'SE-KAA', 'SE-KAA-INLAND']));
    expect(laneFirsts()).toHaveLength(1);
    releaseMap(e, 'drawer');
  });

  it('karta TLL-HEL → PL-TLL + FI-HEL, tor TLL-HEL', async () => {
    const e = await prodPool('drawer', { routes: ['TLL-HEL'], baseline: false });
    expect(routeFirsts()).toEqual(starts(['PL-TLL', 'FI-HEL']));
    expect(laneFirsts()).toEqual([WATER_TRACKS_EXTRA['TLL-HEL'][0]]);
    releaseMap(e, 'drawer');
  });

  it('decyzja 88: Mapa/Kokpit (`NETWORK_LINES`) — wszystkie 12 legów (rdzeń i BN7) i 6 torów, bez transportów', async () => {
    const e = await prodPool('map', { ...NETWORK_LINES, routes: [...NETWORK_LINES.routes] });
    expect(routeFirsts()).toEqual(starts(Object.keys(START)));
    expect(laneFirsts()).toHaveLength(6);
    releaseMap(e, 'map');
  });

  it('mapa stref (ZonesMap mode=all): bez legów BN7 i bez torów bałtyckich', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    __resetRoadLinesCacheForTests();
    rpc.mockReset();
    rpc.mockResolvedValue({ data: { roads: ROADS, route_legs: ROUTE_LEGS }, error: null });
    const spy = vi.spyOn(L, 'polyline');
    mount();
    await act(async () => { root!.render(createElement(ZonesMap, { mode: 'all', label: 'all', zones: [] })); });
    await wait(300);
    const made = spy.mock.results.map((r) => r.value as Polyline);
    spy.mockRestore();
    const solid = made.filter((p) => p.options.color === ORANGE_ROAD_STYLE.color && !p.options.dashArray).map(first);
    const dashed = made.filter((p) => p.options.dashArray === '6 6');
    expect(solid).toEqual(starts(['PL-GDN', 'PL-GDY', 'SE-NYN', 'SE-KAA', 'SE-KAA-INLAND']));
    for (const leg of BN7_LEGS) expect(solid, leg).not.toContainEqual(START[leg]);
    expect(dashed).toHaveLength(2);
  });
});
