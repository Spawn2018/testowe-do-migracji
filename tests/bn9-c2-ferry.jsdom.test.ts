/**
 * @vitest-environment jsdom
 * BN9-c2 (#573) — ekrany po BN4: marker promu Bałtyku z trasą rejsu (dymek, kierunek bez COG), pozycja szacowana
 * dla tras bałtyckich i pasek śledzenia w karcie transportu „Na promie”. Dane wymyślone (G-09).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { AisPosition } from '../src/lib/ais';
import type { SailingMapRow } from '../src/lib/ferry/estimate';
import { bearing, estimateFerryPositions } from '../src/lib/ferry/estimate';
import { withEstimates } from '../src/lib/aisDb';
import {
  ferryBarOn, ferryMarkerHeading, ferryMarkerName, ferryTrackInfo, ferryTrackingLines, loadSailing, voyageOfVessel, voyagePortName,
  voyageRouteText, withVoyages,
  type FerryTrackInfo,
} from '../src/lib/bn9c2Ferry';
import { TrackingBar } from '../src/components/drawer/TrackingBar';
import { trackingStateLines } from '../src/lib/trackingStateText';
import { BN9C2_EN, I18N_ALL, t, tp } from '../src/i18n/messages';
import { formatOpsDateTime } from '../src/lib/time';
import type { Load, Sailing } from '../src/types';

const TLL_D = { lat: 59.44, lon: 24.775 };
const HEL_T2 = { lat: 60.154, lon: 24.914 };
const STO = { lat: 59.35, lon: 18.105 };
const GDN = { lat: 54.40372, lon: 18.6813 };
const NYN = { lat: 58.90453, lon: 17.95621 };
const at = (iso: string) => Date.parse(iso);

function row(p: Partial<SailingMapRow> = {}): SailingMapRow {
  return {
    sailing_id: 's-mega', vessel_id: 'v-mega', vessel_name: 'M/F Megastar', mmsi: 276829000, route: 'TLL-HEL', status: 'ZAPLANOWANY',
    departure_at: '2026-11-01T08:00:00Z', arrival_at: '2026-11-01T10:00:00Z', departed_at: null, arrived_at: null,
    dep_port: 'TLL_D', arr_port: 'HEL_T2', dep_lat: TLL_D.lat, dep_lon: TLL_D.lon, arr_lat: HEL_T2.lat, arr_lon: HEL_T2.lon,
    ais_lat: 59.6, ais_lon: 24.85, ais_observed_at: '2026-11-01T08:10:00Z',
    ...p,
  };
}
const mega: AisPosition = { mmsi: '276829000', vesselId: 'v-mega', name: 'M/F Megastar', lat: 59.6, lng: 24.85, ts: '2026-11-01T08:10:00Z', source: 'db' };
const liveSail = { vessel: 'NS', depPort: 'GDN' };

describe('BN9-c2 — trasa rejsu w dymku markera promu', () => {
  it('nazwy portów z kodów bazy (terminal pominięty, Terminal A zachowany); kod spoza katalogu bez zmian', () => {
    expect(voyagePortName('pl', 'TLL_D')).toBe('Tallinn');
    expect(voyagePortName('pl', 'HEL_T2')).toBe('Helsinki');
    expect(voyagePortName('pl', 'TLL_A')).toBe('Tallinn A');
    expect(voyagePortName('pl', 'GDN')).toBe('Gdańsk');
    expect(voyagePortName('pl', 'XYZ_9')).toBe('XYZ_9');
    expect(voyageRouteText('pl', { depPort: 'TLL_D', arrPort: 'HEL_T2' })).toBe('Tallinn → Helsinki');
  });

  it('rejs statku: trwający przed najbliższym; odwołany i zakończony pomijane; rozpoznanie po MMSI i nazwie', () => {
    const now = at('2026-11-01T09:00:00Z');
    const rows = [
      row({ sailing_id: 'next', departure_at: '2026-11-01T12:00:00Z', arrival_at: '2026-11-01T14:00:00Z', route: 'HEL-TLL', dep_port: 'HEL_T2', arr_port: 'TLL_D' }),
      row({ sailing_id: 'now' }),
      row({ sailing_id: 'old', departure_at: '2026-11-01T04:00:00Z', arrival_at: '2026-11-01T06:00:00Z' }),
    ];
    expect(voyageOfVessel(rows, mega, now)?.sailingId).toBe('now');
    expect(voyageOfVessel(rows.filter((r) => r.sailing_id !== 'now'), mega, now)?.sailingId).toBe('next');
    expect(voyageOfVessel([row({ status: 'ODWOLANY' }), row({ sailing_id: 'a', arrived_at: '2026-11-01T08:50:00Z' })], mega, now)).toBeNull();
    /* inny vessel_id, ten sam MMSI / ta sama nazwa bez „M/F” */
    expect(voyageOfVessel([row({ vessel_id: 'x' })], mega, now)?.sailingId).toBe('s-mega');
    expect(voyageOfVessel([row({ vessel_id: 'x', mmsi: null, vessel_name: 'Megastar' })], mega, now)?.sailingId).toBe('s-mega');
    expect(voyageOfVessel([row({ vessel_id: 'x', mmsi: 1, vessel_name: 'Star' })], mega, now)).toBeNull();
  });

  it('opóźniony rejs: wypłynął (departed_at), nie dopłynął, po planowym przypłynięciu — nadal TLL→HEL, nie powrót', () => {
    const now = at('2026-11-01T10:30:00Z');
    const rows = [
      row({ sailing_id: 'tam', departed_at: '2026-11-01T08:20:00Z', arrived_at: null }),
      row({ sailing_id: 'powrot', departure_at: '2026-11-01T12:00:00Z', arrival_at: '2026-11-01T14:00:00Z', route: 'HEL-TLL', dep_port: 'HEL_T2', arr_port: 'TLL_D' }),
    ];
    const v = voyageOfVessel(rows, mega, now);
    expect(v?.sailingId).toBe('tam');
    const [m] = withVoyages([mega], rows, now);
    expect(ferryMarkerName(m, 'pl')).toBe('M/F Megastar · Tallinn → Helsinki');
    expect(ferryMarkerHeading(m, liveSail)).toBeLessThan(15);
    /* bez potwierdzonego wypłynięcia po planowym przypłynięciu — rejs uznany za zakończony (jak dotąd) */
    expect(voyageOfVessel([{ ...rows[0], departed_at: null }, rows[1]], mega, now)?.sailingId).toBe('powrot');
  });

  it('dymek: „M/F Megastar · Tallinn → Helsinki”; bez wiersza rejsu — tekst jak dotąd', () => {
    const [m] = withVoyages([mega], [row()], at('2026-11-01T09:00:00Z'));
    expect(ferryMarkerName(m, 'pl')).toBe('M/F Megastar · Tallinn → Helsinki');
    const [bare] = withVoyages([mega], [], at('2026-11-01T09:00:00Z'));
    expect(bare.voyage).toBeUndefined();
    expect(ferryMarkerName(bare, 'pl')).toBe('M/F Megastar');
    expect(ferryMarkerName({ ...bare, name: '' }, 'pl')).toBe('276829000');
  });

  it('mapa: nazwa z trasą w każdym dymku promu (zwykły, nieaktualny, szacowany); rejs z tego samego RPC ferry_sailings_map', () => {
    const m = readFileSync('src/components/map/CorridorMap.tsx', 'utf8');
    expect(m).toContain('const name = ferryMarkerName(p, loc);');
    expect(m).toContain('.bindTooltip(esc(`${name} · ${est}`)');
    expect(m).toContain('const tip = esc(stale');
    expect(m).not.toContain('p.name || p.mmsi');
    const db = readFileSync('src/lib/aisDb.ts', 'utf8');
    expect(db).toContain('withVoyages(withEstimates(markersFromTrack(res.data), sailRows, nowMs), sailRows, nowMs)');
    expect(db.match(/sb\.rpc\(/g)?.length).toBe(2);
  });
});

describe('BN9-c2 — kierunek strzałki bez COG', () => {
  const now = at('2026-11-01T09:00:00Z');
  it('TLL→HEL: namiar port wyjścia → port przypłynięcia (na północ), nie zakodowane 20°', () => {
    const [m] = withVoyages([mega], [row()], now);
    const h = ferryMarkerHeading(m, liveSail);
    expect(h).toBe(Math.round(bearing(TLL_D.lat, TLL_D.lon, HEL_T2.lat, HEL_T2.lon)));
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(15);
  });
  it('STO→TLL (powrót): na wschód', () => {
    const [m] = withVoyages([mega], [row({ route: 'STO-TLL', dep_port: 'STO', arr_port: 'TLL_D', dep_lat: STO.lat, dep_lon: STO.lon, arr_lat: TLL_D.lat, arr_lon: TLL_D.lon })], now);
    const h = ferryMarkerHeading(m, liveSail);
    expect(h).toBeGreaterThan(60);
    expect(h).toBeLessThan(110);
  });
  it('COG z AIS zawsze wygrywa', () => {
    const [m] = withVoyages([{ ...mega, cog: 137 }], [row()], now);
    expect(ferryMarkerHeading(m, liveSail)).toBe(137);
  });
  it('DP-141: GDN-NYN / GDY-KAA (i powroty) z wierszem rejsu — namiar portów; statek bez rejsu — reguła 20° / 200°', () => {
    const gdn = row({ route: 'GDN-NYN', dep_port: 'GDN', arr_port: 'NYN', dep_lat: GDN.lat, dep_lon: GDN.lon, arr_lat: NYN.lat, arr_lon: NYN.lon });
    const ns: AisPosition = { ...mega, vesselId: 'NS', name: 'M/F Nova Star', mmsi: '311000787' };
    const [withV] = withVoyages([ns], [{ ...gdn, vessel_id: 'NS', vessel_name: 'M/F Nova Star', mmsi: 311000787 }], now);
    expect(withV.voyage?.route).toBe('GDN-NYN');
    const north = Math.round(bearing(GDN.lat, GDN.lon, NYN.lat, NYN.lon));
    expect(north).toBeGreaterThan(340);
    /* niezależnie od rozkładu demo (liveSail) — kierunek rejsu */
    expect(ferryMarkerHeading(withV, { vessel: 'NS', depPort: 'GDN' })).toBe(north);
    expect(ferryMarkerHeading(withV, { vessel: 'NS', depPort: 'NYN' })).toBe(north);
    const back = { ...withV, voyage: { ...withV.voyage!, route: 'NYN-GDN', depPort: 'NYN', arrPort: 'GDN', depLat: NYN.lat, depLng: NYN.lon, arrLat: GDN.lat, arrLng: GDN.lon } };
    const south = ferryMarkerHeading(back, liveSail);
    expect(south).toBeGreaterThan(160);
    expect(south).toBeLessThan(200);
    const GDY = { lat: 54.533, lon: 18.54 };
    const KAA = { lat: 56.155, lon: 15.62 };
    const kaa = { ...withV, voyage: { ...withV.voyage!, route: 'KAA-GDY', depPort: 'KAA', arrPort: 'GDY', depLat: KAA.lat, depLng: KAA.lon, arrLat: GDY.lat, arrLng: GDY.lon } };
    expect(ferryMarkerHeading(kaa, { vessel: 'NS', depPort: 'NYN' })).toBe(Math.round(bearing(KAA.lat, KAA.lon, GDY.lat, GDY.lon)));
    /* bez wiersza rejsu — reguła sprzed BN9-c2 */
    expect(ferryMarkerHeading(mega, liveSail)).toBe(20);
    expect(ferryMarkerHeading({ ...mega, vesselId: 'NS' }, { vessel: 'NS', depPort: 'NYN' })).toBe(200);
    expect(ferryMarkerHeading({ ...mega, vesselId: 'NS' }, { vessel: 'NS', depPort: 'GDN' })).toBe(20);
    /* dymek GDN-NYN z pełnymi nazwami */
    expect(ferryMarkerName(withV, 'pl')).toBe('M/F Nova Star · Gdańsk → Nynäshamn');
  });
});

describe('BN9-c2 — pozycja szacowana dla tras bałtyckich', () => {
  it('TLL→HEL: szacunek, marker przerywany z rejsem i tym samym dopiskiem o ostatnim AIS', () => {
    const now = at('2026-11-01T09:00:00Z');
    const [e] = estimateFerryPositions([row()], now);
    expect(e.lat).toBeCloseTo((TLL_D.lat + HEL_T2.lat) / 2, 3);
    const [m] = withVoyages(withEstimates([mega], [row()], now), [row()], now);
    expect(m.estimated).toEqual({ lastAisTs: '2026-11-01T08:10:00Z' });
    expect(m.voyage?.sailingId).toBe('s-mega');
    /* kierunek szacowanego = namiar odcinka (estimate.ts), ten sam co bez COG */
    expect(ferryMarkerHeading(m, liveSail)).toBe(e.heading);
    /* dopisek jak dla każdej pozycji szacowanej (#429 C): „szacowana z rozkładu · ostatni AIS …” */
    const tip = `${ferryMarkerName(m, 'pl')} · ${t('pl', 'i429_est_tip').replace('{d}', formatOpsDateTime(m.estimated!.lastAisTs))}`;
    expect(tip).toBe(`M/F Megastar · Tallinn → Helsinki · szacowana z rozkładu · ostatni AIS ${formatOpsDateTime('2026-11-01T08:10:00Z')}`);
  });
  it('TLL→STO (przez Mariehamn): szacunek na odcinku; STO→TLL (powrót, Q-18) — bez szacunku', () => {
    const now = at('2026-11-01T09:00:00Z');
    const out = row({ route: 'TLL-STO', arr_port: 'STO', arr_lat: STO.lat, arr_lon: STO.lon, arrival_at: '2026-11-02T08:00:00Z' });
    const [e] = estimateFerryPositions([out], now);
    expect(e).toBeDefined();
    expect(e.lng).toBeLessThan(TLL_D.lon);
    expect(e.lng).toBeGreaterThan(STO.lon);
    const back = row({ route: 'STO-TLL', dep_port: 'STO', arr_port: 'TLL_D', dep_lat: STO.lat, dep_lon: STO.lon, arr_lat: TLL_D.lat, arr_lon: TLL_D.lon, ais_lat: 59.4, ais_lon: 19.5 });
    expect(estimateFerryPositions([back], now)).toEqual([]);
  });
  it('szacunek bez kodów PL/SE: estimate.ts nie zna portów, korzysta z isOutbound i współrzędnych z wiersza', () => {
    const src = readFileSync('src/lib/ferry/estimate.ts', 'utf8');
    expect(src).not.toMatch(/'GDN'|'NYN'|'GDY'|'KAA'/);
  });
});

/* ---------- pasek śledzenia na promie ---------- */

const NOW = '2026-11-01T09:15:00Z';
function ferryLoad(over: Partial<Load> = {}): Load {
  return {
    id: 'l-bn9c2', code: 'SG-91', itemType: 'SG', dims: { L: 1, W: 1, H: 1, weight: 1 }, qty: 1,
    status: 'ON_FERRY', stage: 'FERRY', progress: 0.5,
    plannedLoadDate: '2026-10-31', plannedDeliverDate: '2026-11-04', carrierId: 'scx',
    resources: {
      driverName: 'A', driverPhone: '+48111', tractorPlate: 'TST 1', trailerPlate: 'TST 2', escort: false, escortPlate: null,
      trackingRef: 'https://emtrack.eu/app/', trailerSwap: false, tractorDeliveryPlate: null,
    },
    awizacja: {} as Load['awizacja'],
    ferry: { vessel: 'Megastar', departureAt: '2026-11-01T08:00:00Z', arrivalAt: '2026-11-01T10:00:00Z', bookingRef: null, status: 'ONBOARD' },
    pricing: {} as Load['pricing'], etaSegments: [], etaBoden: null, etaConfidence: 'LOW', etaEarliestHours: 0, etaLatestHours: 0,
    etaReasons: [], etaMethod: 'test', etaUpdatedAt: NOW, lat: 0, lng: 0, heading: 0,
    /* lokalizator naczepy milczy od 9 h */
    silentMinutes: 540,
    sequenceOrder: 1, sequenceRisk: false, delayed: false, docMissing: false, permitFits: null, hhlOrderNo: 'H1', carrierOrderNo: 'C1',
    ...over,
  } as Load;
}

let root: Root | null = null;
let host: HTMLDivElement | null = null;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});
function renderBar(load: Load, ferry: FerryTrackInfo | null | undefined, width = 1440): HTMLElement {
  host = document.createElement('div');
  host.style.width = `${width}px`;
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => { root!.render(createElement(TrackingBar, { load, events: [], locale: 'pl', nowIso: NOW, ferry })); });
  return host.querySelector('[data-tracking-bar]') as HTMLElement;
}
const info = (pos: FerryTrackInfo['pos']): FerryTrackInfo => ({ vessel: 'Megastar', route: 'Tallinn → Helsinki', pos });
const NOTE = 'lokalizator naczepy na promie zwykle milknie';

describe('BN9-c2 — pasek śledzenia na promie (karta transportu)', () => {
  it('świeży AIS: „Na promie · statek · trasa” i „pozycja statku z AIS 5 min temu”, bez „ostatnia pozycja 9 h temu”', () => {
    const bar = renderBar(ferryLoad(), info({ kind: 'ais', ts: '2026-11-01T09:10:00Z' }));
    expect(bar.getAttribute('data-tracking-bar')).toBe('on');
    expect(bar.getAttribute('data-trk-ferry')).toBe('ais');
    expect(bar.querySelector('b')?.textContent).toBe('Na promie · Megastar · Tallinn → Helsinki');
    expect(bar.querySelector('span:not(.trk-mk)')?.textContent).toBe(`pozycja statku z AIS 5 min temu · ${NOTE}`);
    expect(bar.textContent).not.toContain('ostatnia pozycja');
  });
  it('pozycja szacowana: „pozycja szacowana z rozkładu · ostatni AIS {godzina}”; bez AIS — „brak AIS”', () => {
    const bar = renderBar(ferryLoad(), info({ kind: 'est', lastAisTs: '2026-11-01T08:10:00Z' }));
    expect(bar.getAttribute('data-trk-ferry')).toBe('est');
    expect(bar.textContent).toContain(`pozycja szacowana z rozkładu · ostatni AIS ${formatOpsDateTime('2026-11-01T08:10:00Z')} · ${NOTE}`);
    act(() => root!.render(createElement(TrackingBar, { load: ferryLoad(), events: [], locale: 'pl', nowIso: NOW, ferry: info({ kind: 'est', lastAisTs: null }) })));
    expect(host!.textContent).toContain(`pozycja szacowana z rozkładu · brak AIS · ${NOTE}`);
  });
  it('brak pozycji statku + dopisek o lokalizatorze; bez statku i trasy — sam „Na promie”', () => {
    const bar = renderBar(ferryLoad(), { vessel: null, route: null, pos: { kind: 'none' } });
    expect(bar.getAttribute('data-trk-ferry')).toBe('none');
    expect(bar.querySelector('b')?.textContent).toBe('Na promie');
    expect(bar.textContent).toContain(`brak pozycji statku · ${NOTE}`);
  });
  it('telefon 390 px: ten sam tekst (pasek bez osobnego układu telefonu, zawija się w CSS .trk)', () => {
    const bar = renderBar(ferryLoad(), info({ kind: 'ais', ts: '2026-11-01T09:10:00Z' }), 390);
    expect(bar.querySelector('b')?.textContent).toBe('Na promie · Megastar · Tallinn → Helsinki');
  });
  it('regresja: bez danych promu albo poza etapem promu — dotychczasowy pasek „Śledzenie trwa … · ostatnia pozycja”', () => {
    const plain = renderBar(ferryLoad(), null);
    expect(plain.getAttribute('data-trk-ferry')).toBeNull();
    expect(plain.querySelector('b')?.textContent).toContain(tp('pl', 'p4b_trk_on_last', { ago: '' }).trim());
    act(() => root!.render(createElement(TrackingBar, { load: ferryLoad({ status: 'IN_TRANSIT_SE', stage: 'SE' as Load['stage'] }), events: [], locale: 'pl', nowIso: NOW, ferry: info({ kind: 'none' }) })));
    expect(host!.textContent).not.toContain('Na promie');
  });
  it('PDF / jedna linia (trackingStateLines): ten sam tekst co pasek, gdy dostaje dane promu; bez nich — bez zmian', () => {
    const f = info({ kind: 'ais', ts: '2026-11-01T09:10:00Z' });
    expect(trackingStateLines(ferryLoad(), [], 'pl', NOW, 'HHL', null, f)).toEqual(ferryTrackingLines(f, 'pl', NOW));
    expect(trackingStateLines(ferryLoad(), [], 'pl', NOW, 'HHL', null).head).toContain('ostatnia pozycja');
  });
});

describe('BN9-c2 — dane paska z pozycji AIS i rejsu (ferryTrackInfo)', () => {
  const positions: AisPosition[] = [
    { ...mega, source: 'seed', name: 'Megastar', ts: '2026-11-01T09:14:00Z' },
    { ...mega, ts: '2026-11-01T09:05:00Z', voyage: { sailingId: 's', route: 'TLL-HEL', depPort: 'TLL_D', arrPort: 'HEL_T2', depLat: 0, depLng: 0, arrLat: 0, arrLng: 0 } },
  ];
  it('statek z rejsu ładunku („Megastar”) = „M/F Megastar” z AIS; pozycja przykładowa (seed) pomijana', () => {
    const fi = ferryTrackInfo({ vessel: 'Megastar', routeText: null, positions, locale: 'pl' });
    expect(fi).toEqual({ vessel: 'Megastar', route: 'Tallinn → Helsinki', pos: { kind: 'ais', ts: '2026-11-01T09:05:00Z' } });
  });
  it('trasa z rejsu przypiętego do ładunku ma pierwszeństwo; pozycja szacowana → „est”; brak statku → „none”', () => {
    expect(ferryTrackInfo({ vessel: 'Megastar', routeText: 'Tallinn A → Helsinki', positions, locale: 'pl' }).route).toBe('Tallinn A → Helsinki');
    const est = [{ ...positions[1], estimated: { lastAisTs: null } }];
    expect(ferryTrackInfo({ vessel: 'Megastar', routeText: null, positions: est, locale: 'pl' }).pos).toEqual({ kind: 'est', lastAisTs: null });
    expect(ferryTrackInfo({ vessel: 'Finlandia', routeText: null, positions, locale: 'pl' }).pos).toEqual({ kind: 'none' });
    expect(ferryTrackInfo({ vessel: null, routeText: null, positions, locale: 'pl' }).pos).toEqual({ kind: 'none' });
  });
  it('warunek paska (ferryBarOn): okno „on” i etap promu; przed oknem, po dostawie i poza promem — nie', () => {
    expect(ferryBarOn(ferryLoad(), NOW)).toBe(true);
    expect(ferryBarOn(ferryLoad({ status: 'IN_TRANSIT_SE', stage: 'SE' as Load['stage'] }), NOW)).toBe(false);
    expect(ferryBarOn(ferryLoad({ status: 'DELIVERED', stage: 'DELIVERED' as Load['stage'] }), NOW)).toBe(false);
    expect(ferryBarOn(ferryLoad({ status: 'RESOURCES_PENDING', stage: 'PLAN', plannedLoadDate: '2026-11-05' }), NOW)).toBe(false);
    expect(ferryBarOn(null, NOW)).toBe(false);
  });

  it('rejs ładunku (loadSailing): sailingId; bez niego statek (bez „M/F”) + ta sama chwila odejścia', () => {
    const s = (id: string, vessel: string, departureAt: string): Sailing => ({
      id, vessel, route: 'TLL-HEL' as Sailing['route'], departureAt, arrivalAt: '2026-11-01T10:00:00Z',
      delayedDepartureAt: null, delayedArrivalAt: null, status: 'ZAPLANOWANY', source: 'TALLINK',
    });
    const list = [s('a', 'M/F Megastar', '2026-11-01T08:00:00.000Z'), s('b', 'Star', '2026-11-01T08:00:00Z'), s('c', 'Megastar', '2026-11-01T12:00:00Z')];
    expect(loadSailing({ sailingId: 'c', ferry: ferryLoad().ferry }, list)?.id).toBe('c');
    expect(loadSailing({ sailingId: 'zzz', ferry: ferryLoad().ferry }, list)).toBeUndefined();
    /* „Megastar” 08:00Z = „M/F Megastar” 08:00:00.000Z (inny zapis tej samej chwili) */
    expect(loadSailing({ sailingId: undefined, ferry: ferryLoad().ferry }, list)?.id).toBe('a');
    expect(loadSailing({ sailingId: undefined, ferry: { ...ferryLoad().ferry, departureAt: '2026-11-01T09:00:00Z' } }, list)).toBeUndefined();
    expect(loadSailing({ sailingId: undefined, ferry: { ...ferryLoad().ferry, vessel: null } }, list)).toBeUndefined();
  });

  it('panel: dane promu z subskrypcji AIS (bez nowych zapytań) i rejsu ładunku; TrackingBar bez zapytań', () => {
    const d = readFileSync('src/components/drawer/LoadDrawer.tsx', 'utf8');
    expect(d).toContain('subscribeFerryPositions({ prod: PROD_BUILD');
    expect(d).toContain('ferryBarOn(load, nowIso)');
    expect(d).toContain('loadSailing(load, sailings)');
    expect(d).toContain('ferry={ferryTrack}');
    const bar = readFileSync('src/components/drawer/TrackingBar.tsx', 'utf8');
    expect(bar).not.toMatch(/subscribe|getSupabase|fetch\(/);
  });
});

describe('BN9-c2 — jedno odpytywanie bazy na wszystkich odbiorców (produkcja)', () => {
  /** Świeży moduł `ais` z podstawionym `aisDb` (fabryka mocka) i środowiskiem produkcji. */
  async function freshAis(factory: () => unknown) {
    vi.resetModules();
    vi.doMock('../src/lib/aisDb', factory);
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    vi.stubGlobal('WebSocket', vi.fn());
    return (await import('../src/lib/ais')).subscribeFerryPositions;
  }
  function cleanup() {
    vi.doUnmock('../src/lib/aisDb');
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  }

  it('drugi odbiorca dostaje ostatni wynik od razu; bez odbiorców subskrypcja bazy zatrzymana', async () => {
    try {
      const stop = vi.fn();
      let push: ((p: AisPosition[]) => void) | null = null;
      const sub = vi.fn((cb: (p: AisPosition[]) => void) => { push = cb; return stop; });
      const subscribeFerryPositions = await freshAis(() => ({ subscribeAisDb: sub }));
      const a: [number, string][] = [];
      const b: [number, string][] = [];
      const offA = subscribeFerryPositions({ prod: true, onUpdate: (p, m) => a.push([p.length, m]) });
      await vi.waitFor(() => expect(sub).toHaveBeenCalledTimes(1));
      act(() => push!([mega]));
      const offB = subscribeFerryPositions({ prod: true, onUpdate: (p, m) => b.push([p.length, m]) });
      expect(b).toEqual([[1, 'db']]);
      expect(sub).toHaveBeenCalledTimes(1);
      expect(a).toEqual([[0, 'none'], [1, 'db']]);
      offA();
      expect(stop).not.toHaveBeenCalled();
      offB();
      expect(stop).toHaveBeenCalledTimes(1);
    } finally {
      cleanup();
    }
  });

  it('wyjątek w jednym odbiorcy — drugi i tak dostaje dane', async () => {
    try {
      let push: ((p: AisPosition[]) => void) | null = null;
      const sub = vi.fn((cb: (p: AisPosition[]) => void) => { push = cb; return () => {}; });
      const subscribeFerryPositions = await freshAis(() => ({ subscribeAisDb: sub }));
      const got: number[] = [];
      const offBad = subscribeFerryPositions({ prod: true, onUpdate: (p) => { if (p.length) throw new Error('zły odbiorca'); } });
      const offOk = subscribeFerryPositions({ prod: true, onUpdate: (p) => got.push(p.length) });
      await vi.waitFor(() => expect(sub).toHaveBeenCalledTimes(1));
      expect(() => push!([mega])).not.toThrow();
      expect(got).toEqual([0, 1]);
      offBad();
      offOk();
    } finally {
      cleanup();
    }
  });

  it('moduł bazy się nie wczytał — kolejna subskrypcja próbuje ponownie (bez nieobsłużonego błędu)', async () => {
    try {
      let attempt = 0;
      const sub = vi.fn(() => () => {});
      const subscribeFerryPositions = await freshAis(() => {
        attempt += 1;
        if (attempt === 1) throw new Error('chunk nie wczytany');
        return { subscribeAisDb: sub };
      });
      const off1 = subscribeFerryPositions({ prod: true, onUpdate: () => {} });
      await vi.waitFor(() => expect(attempt).toBe(1));
      await new Promise((r) => setTimeout(r, 0));
      expect(sub).not.toHaveBeenCalled();
      const off2 = subscribeFerryPositions({ prod: true, onUpdate: () => {} });
      await vi.waitFor(() => expect(sub).toHaveBeenCalledTimes(1));
      off1();
      off2();
    } finally {
      cleanup();
    }
  });

  it('odsubskrybowanie przed wczytaniem modułu, potem ponowna subskrypcja — odpytywanie działa (jedno)', async () => {
    try {
      const stop = vi.fn();
      const sub = vi.fn(() => stop);
      const subscribeFerryPositions = await freshAis(() => ({ subscribeAisDb: sub }));
      const off1 = subscribeFerryPositions({ prod: true, onUpdate: () => {} });
      off1();
      /* pierwsze `import()` kończy się już bez odbiorców — nie startuje odpytywania. (Vitest przy dwóch równoległych
         `import()` modułu z `vi.doMock` podaje drugiemu prawdziwy moduł, więc ponowna subskrypcja po rozstrzygnięciu.) */
      await new Promise((r) => setTimeout(r, 0));
      expect(sub).not.toHaveBeenCalled();
      const off2 = subscribeFerryPositions({ prod: true, onUpdate: () => {} });
      await vi.waitFor(() => expect(sub).toHaveBeenCalledTimes(1));
      await new Promise((r) => setTimeout(r, 0));
      expect(sub).toHaveBeenCalledTimes(1);
      off2();
      expect(stop).toHaveBeenCalledTimes(1);
    } finally {
      cleanup();
    }
  });
});

describe('BN9-c2 — teksty PL i EN', () => {
  it('klucze bn9c2_ w PL; EN z tymi samymi kluczami (panel po polsku — 8A, I18N_ALL.en = DRIVER_EN)', () => {
    const keys = Object.keys(BN9C2_EN);
    expect(keys.length).toBe(6);
    for (const k of keys) {
      expect(k.startsWith('bn9c2_')).toBe(true);
      expect(I18N_ALL.pl[k], k).toBeTruthy();
    }
    expect(Object.keys(I18N_ALL.pl).filter((k) => k.startsWith('bn9c2_')).sort()).toEqual(keys.sort());
    for (const v of Object.values(BN9C2_EN)) expect(/[ąćęłńóśźż]/i.test(v), v).toBe(false);
    expect(t('pl', 'bn9c2_trk_ferry')).toBe('Na promie');
  });
});
