/**
 * @vitest-environment jsdom
 * BN9-c5 (#718 BN7 §4) — linie tras BN7: filtr na karcie transportu, Mapie/Kokpicie i mapach stref.
 *  - karta TLL-HEL → tylko PL-TLL + FI-HEL + tor TLL-HEL; GDY-KAA → PL-GDY + SE-KAA + SE-KAA-INLAND (decyzja 36);
 *  - Mapa: rdzeń i korytarze aktywnych transportów; bez aktywnych bałtyckich — brak torów bałtyckich i dopisku;
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
  __poolEntryForTests, __resetMapPool, acquireMap, corridorBoundsOf, corridorPadding, drawCorridorLines, releaseMap,
} = await import('../src/components/map/mapPool');
const { __resetRoadLinesCacheForTests } = await import('../src/components/map/applyBasemap');
const { ORANGE_ROAD_STYLE } = await import('../src/components/map/orangeRoads');
const { DEMO_ROAD_LEGS, DEMO_ROAD_LINES } = await import('../src/data/roadLinesDemo');
const { WATER_TRACKS_EXTRA, extraWaterTracksFor } = await import('../src/lib/map/ferryLines');
const { ferryLaneLines } = await import('../src/lib/map/ferryLanes');
const { WATER_GDN_NYN } = await import('../src/lib/map/draw');
const {
  __resetDemoRoutesForTests, BN7_LEGS, baselineScope, coreLegsOnly, corridorScope, demoRouteOverrides, legsOfRoute, routeOfLoad,
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
    /* zapas „rdzeń” tylko dla trasy nieznanej (null) */
    expect([...corridorScope([null], [], false).tracks]).toEqual(['GDN-NYN', 'GDY-KAA']);
    expect([...corridorScope([], [], false).tracks]).toEqual(['GDN-NYN', 'GDY-KAA']);
    expect([...corridorScope(['XXX-YYY'], [], false).tracks]).toEqual([]);
    expect(legsOfRoute(null)).toEqual([]);
    expect(legsOfRoute('XXX-YYY')).toEqual([]);
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

  it('F7 #740 W2: ręczny zoom nie jest nadpisywany przy zmianie tras w tych samych torach; nowy tor bez ruchu użytkownika — kadr', async () => {
    const { loads, active } = demoLoads();
    /* jsdom bez układu: mapa 0×0 daje przybliżenie 19 i przycięcie do maxZoom podkładu (`setMaxZoom` → zoomstart, jak
       ruch użytkownika) — rozmiar jak w przeglądarce */
    const cw = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(900);
    const ch = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
    mount();
    await act(async () => { root!.render(createElement(CorridorMap, { loads: [], slot: 'map' })); });
    await wait(50);
    const map = __poolEntryForTests()!.map;
    const fit = vi.spyOn(map, 'fitBounds');
    /* ta sama rodzina torów (GDN-NYN) — inna lista transportów: bez kadru */
    await act(async () => { useTowerStore.setState({ loads: loads.filter((l) => l.id !== active.id) }); });
    await wait(20);
    expect(fit).not.toHaveBeenCalled();
    /* nowy tor (TLL-HEL) bez ruchu użytkownika — kadr */
    await act(async () => {
      useTowerStore.setState({
        loads: loads.map((l) => (l.id === active.id ? { ...l, sailingId: 'bn7-w2' } : l)),
        sailings: [...useTowerStore.getState().sailings, {
          id: 'bn7-w2', vessel: 'Finlandia', route: 'TLL-HEL', departureAt: '2026-09-24T08:00:00Z', arrivalAt: '2026-09-24T10:00:00Z',
          delayedDepartureAt: null, delayedArrivalAt: null, status: 'ZAPLANOWANY', source: 'ECKERO',
        }],
      });
    });
    await wait(20);
    expect(fit).toHaveBeenCalledTimes(1);
    /* użytkownik przybliżył mapę — zmiana torów nie kadruje */
    act(() => { map.fire('zoomstart'); });
    await act(async () => { useTowerStore.setState({ loads }); });
    await wait(20);
    expect(fit).toHaveBeenCalledTimes(1);
    fit.mockRestore();
    cw.mockRestore();
    ch.mockRestore();
  });

  it('Mapa bez aktywnych bałtyckich: rdzeń jak dotąd (3 linie demo, 2 tory), brak torów bałtyckich i dopisku', async () => {
    demoLoads();
    mount();
    await act(async () => { root!.render(createElement(CorridorMap, { loads: [], slot: 'map' })); });
    await wait(50);
    expect(routeFirsts()).toEqual(DEMO_ROAD_LINES.map((l) => l[0]));
    expect(laneFirsts()).toHaveLength(2);
    const baltic = Object.values(WATER_TRACKS_EXTRA).map((l) => l[0].join(','));
    expect(laneFirsts().some((p) => baltic.includes(p.join(',')))).toBe(false);
    expect(host!.querySelector('[data-route-note]')).toBeNull();
  });

  it('Mapa z aktywnym transportem TLL-HEL: rdzeń + PL-TLL/FI-HEL i tor TLL-HEL, dopisek; po wyjściu — znów rdzeń', async () => {
    const { active } = demoLoads();
    window.history.replaceState(null, '', `/#/?demoRoute=${active.code}:TLL-HEL`);
    __resetDemoRoutesForTests();
    mount();
    await act(async () => { root!.render(createElement(CorridorMap, { loads: [], slot: 'map' })); });
    await wait(50);
    window.history.replaceState(null, '', '/');
    expect(routeFirsts()).toEqual([...DEMO_ROAD_LINES.map((l) => l[0]), demoLine('PL-TLL')[0], demoLine('FI-HEL')[0]]);
    expect(laneFirsts()).toHaveLength(3);
    expect(laneFirsts()[2]).toEqual(WATER_TRACKS_EXTRA['TLL-HEL'][0]);
    expect(host!.querySelector('[data-route-note="baltic"]')?.textContent).toBe(NOTE);
    /* ta sama mapa z puli w karcie transportu GDN-NYN — bez linii bałtyckich poprzedniego widoku */
    act(() => { root!.unmount(); });
    root = createRoot(host!);
    __resetDemoRoutesForTests();
    useTowerStore.setState({ selectedLoadId: demoLoads().planned.id });
    await act(async () => { root!.render(createElement(CorridorMap, { loads: [], embedded: true, slot: 'drawer' })); });
    await wait(50);
    expect(routeFirsts()).toEqual([DEMO_ROAD_LINES[0][0], DEMO_ROAD_LINES[1][0]]);
    expect(laneFirsts()).toHaveLength(1);
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
  async function prodPool(slot: 'drawer' | 'map', spec: { routes: string[]; baseline: boolean }) {
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

  it('Mapa: bez aktywnych bałtyckich — tylko rdzeń (5 legów), brak BN7 i torów bałtyckich', async () => {
    const e = await prodPool('map', { routes: ['GDN-NYN'], baseline: true });
    expect(routeFirsts()).toEqual(starts(['PL-GDN', 'PL-GDY', 'SE-NYN', 'SE-KAA', 'SE-KAA-INLAND']));
    expect(laneFirsts()).toHaveLength(2);
    releaseMap(e, 'map');
  });

  it('Mapa z aktywnym PLD-KPS: rdzeń + PL-PLD + SE-KPS (bez pozostałych BN7)', async () => {
    const e = await prodPool('map', { routes: ['GDN-NYN', 'PLD-KPS'], baseline: true });
    expect(routeFirsts()).toEqual(starts(['PL-GDN', 'PL-GDY', 'SE-NYN', 'SE-KAA', 'SE-KAA-INLAND', 'PL-PLD', 'SE-KPS']));
    expect(laneFirsts()).toHaveLength(3);
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
