/** #429 C — pozycja promu szacowana z rozkładu (decyzja koordynatora 22.10.2026). */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { estimateFerryPositions, type SailingMapRow } from '../src/lib/ferry/estimate';
import { withEstimates } from '../src/lib/aisDb';
import type { AisPosition } from '../src/lib/ais';

const GDN = { lat: 54.40372, lon: 18.6813 };
const NYN = { lat: 58.90453, lon: 17.95621 };
const TLL_D = { lat: 59.440, lon: 24.775 };
const HEL_T2 = { lat: 60.154, lon: 24.914 };

function row(p: Partial<SailingMapRow> = {}): SailingMapRow {
  return {
    sailing_id: 's1', vessel_id: 'v-ns', vessel_name: 'M/F Nova Star', mmsi: 311000787, route: 'GDN-NYN', status: 'ZAPLANOWANY',
    departure_at: '2026-10-22T16:00:00Z', arrival_at: '2026-10-23T10:00:00Z', departed_at: null, arrived_at: null,
    dep_port: 'GDN', arr_port: 'NYN', dep_lat: GDN.lat, dep_lon: GDN.lon, arr_lat: NYN.lat, arr_lon: NYN.lon,
    ais_lat: 54.6, ais_lon: 18.7, ais_observed_at: '2026-10-22T18:00:00Z',
    ...p,
  };
}

function rowTllHel(p: Partial<SailingMapRow> = {}): SailingMapRow {
  return row({
    sailing_id: 's-mega', vessel_id: 'v-mega', vessel_name: 'M/F Megastar', mmsi: 276829000, route: 'TLL-HEL',
    departure_at: '2026-11-01T08:00:00Z', arrival_at: '2026-11-01T10:00:00Z',
    dep_port: 'TLL_D', arr_port: 'HEL_T2',
    dep_lat: TLL_D.lat, dep_lon: TLL_D.lon, arr_lat: HEL_T2.lat, arr_lon: HEL_T2.lon,
    ais_lat: 59.6, ais_lon: 24.85, ais_observed_at: '2026-11-01T08:10:00Z',
    ...p,
  });
}
const at = (iso: string) => Date.parse(iso);

describe('estimateFerryPositions', () => {
  it('w połowie rejsu PL→SE, AIS sprzed 7 h → punkt w połowie odcinka', () => {
    const [e] = estimateFerryPositions([row()], at('2026-10-23T01:00:00Z'));
    expect(e.lat).toBeCloseTo((GDN.lat + NYN.lat) / 2, 3);
    expect(e.lng).toBeCloseTo((GDN.lon + NYN.lon) / 2, 3);
    expect(e.lastAisTs).toBe('2026-10-22T18:00:00Z');
    expect(e.heading).toBeGreaterThan(340);
  });

  it('świeży AIS (≤ 30 min) wygrywa — brak szacunku', () => {
    expect(estimateFerryPositions([row({ ais_observed_at: '2026-10-23T00:45:00Z' })], at('2026-10-23T01:00:00Z'))).toEqual([]);
  });

  it('rejs SE→PL / FI→EE (Q-18 / isOutbound), przed wypłynięciem, po dopłynięciu albo odwołany — brak szacunku', () => {
    const now = at('2026-10-23T01:00:00Z');
    expect(estimateFerryPositions([row({ route: 'NYN-GDN', dep_port: 'NYN', arr_port: 'GDN' })], now)).toEqual([]);
    expect(estimateFerryPositions([rowTllHel({ route: 'HEL-TLL', dep_port: 'HEL_T2', arr_port: 'TLL_D' })], at('2026-11-01T09:00:00Z'))).toEqual([]);
    expect(estimateFerryPositions([row()], at('2026-10-22T15:00:00Z'))).toEqual([]);
    expect(estimateFerryPositions([row()], at('2026-10-23T11:00:00Z'))).toEqual([]);
    expect(estimateFerryPositions([row({ arrived_at: '2026-10-23T00:30:00Z' })], now)).toEqual([]);
    expect(estimateFerryPositions([row({ status: 'ODWOLANY' })], now)).toEqual([]);
  });

  it('BN4: TLL-HEL w połowie, AIS stary → szacunek na odcinku Tallinn→Helsinki', () => {
    const [e] = estimateFerryPositions([rowTllHel()], at('2026-11-01T09:00:00Z'));
    expect(e.lat).toBeCloseTo((TLL_D.lat + HEL_T2.lat) / 2, 3);
    expect(e.lng).toBeCloseTo((TLL_D.lon + HEL_T2.lon) / 2, 3);
    expect(e.name).toBe('M/F Megastar');
  });

  it('bez departed_at: AIS w porcie odejścia albo brak AIS → brak szacunku (prom mógł nie wypłynąć)', () => {
    const now = at('2026-10-23T01:00:00Z');
    expect(estimateFerryPositions([row({ ais_lat: 54.41, ais_lon: 18.69 })], now)).toEqual([]);
    expect(estimateFerryPositions([row({ ais_lat: null, ais_lon: null, ais_observed_at: null })], now)).toEqual([]);
  });

  it('rzeczywiste wypłynięcie przesuwa początek; brak AIS → lastAisTs null', () => {
    const [e] = estimateFerryPositions([row({ departed_at: '2026-10-22T18:00:00Z', ais_observed_at: null })], at('2026-10-22T18:00:00Z'));
    expect(e.lat).toBeCloseTo(GDN.lat, 5);
    expect(e.lastAisTs).toBeNull();
  });
});

describe('withEstimates', () => {
  const ais: AisPosition = { mmsi: '311000787', vesselId: 'NS', name: 'M/F Nova Star', lat: 54.6, lng: 18.7, ts: '2026-10-22T18:00:00Z', source: 'db' };

  it('zastępuje starą pozycję statku szacunkiem, inne statki bez zmian', () => {
    const other: AisPosition = { ...ais, mmsi: '1', name: 'M/F Stena Ebba' };
    const out = withEstimates([ais, other], [row()], at('2026-10-23T01:00:00Z'));
    expect(out).toHaveLength(2);
    expect(out[0].estimated).toEqual({ lastAisTs: '2026-10-22T18:00:00Z' });
    expect(out[0].ts).toBe('2026-10-22T18:00:00Z');
    expect(out[1].estimated).toBeUndefined();
  });

  it('dodaje prom, którego nie ma w pozycjach (luka AIS > 48 h)', () => {
    const out = withEstimates([], [row({ departed_at: '2026-10-22T16:10:00Z', ais_observed_at: null, ais_lat: null, ais_lon: null })], at('2026-10-23T01:00:00Z'));
    expect(out).toHaveLength(1);
    expect(out[0].estimated?.lastAisTs).toBeNull();
  });
});

describe('grupa aut na promie', () => {
  it('pozycja szacowana → ais „est”, opis „szacowana z rozkładu”, nie „z AIS”', async () => {
    const { placeMarkers } = await import('../src/lib/p9eGroups');
    const items = [{ id: 'L1', lat: 54, lng: 18, tile: 'FERRY', ferryKey: 'NS-1', lastFixAt: null, late: false }] as never;
    const ship = { lat: 56.6, lng: 18.3, ts: '2026-10-22T18:00:00Z', stale: false, vessel: 'M/F Nova Star', estimated: { lastAisTs: '2026-10-22T18:00:00Z' } };
    const [grp] = placeMarkers(items, { zones: [], shipOf: () => ship, grouping: true });
    expect(grp).toMatchObject({ kind: 'ferry', ais: 'est', at: '2026-10-22T18:00:00Z', lat: 56.6 });
    const g = readFileSync('src/lib/p9eGroups.ts', 'utf8');
    expect(g).toContain("ais: ship ? (ship.estimated ? 'est' : ship.stale ? 'stale' : 'ok') : 'none'");
    expect(g).toContain("g.ais === 'est' ? (g.at ? ctx.tx('p9e_ais_est'");
    expect(readFileSync('src/i18n/p9e.ts', 'utf8')).toContain("p9e_ais_est: 'pozycja szacowana z rozkładu · ostatni AIS {t}'");
    expect(readFileSync('src/components/map/CorridorMap.tsx', 'utf8')).toContain("vessel: p.name, estimated: p.estimated }");
  });

  it('CSS: przerywany obrys po regule .wt-dot', () => {
    const css = readFileSync('src/index.css', 'utf8');
    expect(css.indexOf('.wt-marker-ferry-est .wt-dot{outline:2px dashed')).toBeGreaterThan(css.indexOf('.wt-dot{position:relative'));
    expect(css).toContain('.wt-mk.is-est{outline:2px dashed');
    expect(css.indexOf('.wt-mk.is-est.is-late{outline:3px solid var(--red)')).toBeGreaterThan(css.indexOf('.wt-mk.is-est{'));
  });
});

describe('mapa: znacznik i teksty', () => {
  it('przerywany znacznik i opis z godziną ostatniego AIS', () => {
    const m = readFileSync('src/components/map/CorridorMap.tsx', 'utf8');
    expect(m).toContain("ferryDivIcon('#6BA8D6', heading, false, true)");
    expect(m).toContain("'i429_est_tip'");
    expect(readFileSync('src/lib/mapMarkers.ts', 'utf8')).toContain("estimated ? 'wt-marker-ferry-est' : ''");
    const i2 = readFileSync('src/i18n/i2.ts', 'utf8');
    expect(i2).toContain("i429_est_tip: 'szacowana z rozkładu · ostatni AIS {d}'");
  });
});
