/**
 * DP-222 / #814 — BS-03 „brak AIS” mimo świeżego AIS Nova Star.
 * Etap: C2 / BN9-c2. Auto FERRY z rejsem poza listą klienta → pozycja statku po voyage.sailingId.
 * F7 #815 B1/B2: tabela Mapy (`mapRow`) — FERRY z AIS/est, nie GPS auta; odtworzenie łańcucha none→ok.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import type { AisPosition } from '../src/lib/ais';
import {
  aisShipFixForFerryKey,
  ensureSailingAisMarkers,
  ferryTrackInfo,
  withVoyages,
} from '../src/lib/bn9c2Ferry';
import type { SailingMapRow } from '../src/lib/ferry/estimate';
import { placeMarkers } from '../src/lib/p9eGroups';
import { mapRow, type RowCtx } from '../src/lib/p9cMap';
import { p9m, p9mp } from '../src/i18n/p9c';
import type { Load } from '../src/types';

const SAILING = '95e2835b-0000-4000-8000-000000000037';
const GDN = { lat: 54.40372, lon: 18.6813 };
const NYN = { lat: 58.90453, lon: 17.95621 };

function sailRow(p: Partial<SailingMapRow> = {}): SailingMapRow {
  return {
    sailing_id: SAILING,
    vessel_id: 'v-ns',
    vessel_name: 'M/F Nova Star',
    mmsi: 311000787,
    route: 'GDN-NYN',
    status: 'ZAPLANOWANY',
    departure_at: '2026-11-04T17:00:00Z',
    arrival_at: '2026-11-05T11:00:00Z',
    departed_at: null,
    arrived_at: null,
    dep_port: 'GDN',
    arr_port: 'NYN',
    dep_lat: GDN.lat,
    dep_lon: GDN.lon,
    arr_lat: NYN.lat,
    arr_lon: NYN.lon,
    ais_lat: 58.675,
    ais_lon: 18.065,
    ais_observed_at: '2026-11-05T09:49:00Z',
    ...p,
  };
}

const aisFresh: AisPosition = {
  mmsi: '311000787',
  vesselId: 'v-ns',
  name: 'M/F Nova Star',
  lat: 58.675,
  lng: 18.065,
  ts: '2026-11-05T09:49:00Z',
  source: 'db',
};

describe('DP-222 — auto FERRY bez rejsu w store → AIS po sailingId', () => {
  const nowMs = Date.parse('2026-11-05T10:00:00Z');
  const nowIso = '2026-11-05T10:00:00Z';

  it('aisShipFixForFerryKey: match voyage.sailingId bez nazwy statku', () => {
    const [withVoy] = withVoyages([aisFresh], [sailRow()], nowMs);
    expect(withVoy.voyage?.sailingId).toBe(SAILING);
    const ship = aisShipFixForFerryKey(SAILING, [withVoy], null, nowIso, () => 'ok');
    expect(ship).toMatchObject({ lat: 58.675, lng: 18.065, vessel: 'M/F Nova Star' });
    expect(ship?.estimated).toBeUndefined();
  });

  it('placeMarkers: FERRY + sailingId spoza sailings → ais ok, nie „none”', () => {
    const [withVoy] = withVoyages([aisFresh], [sailRow()], nowMs);
    const shipOf = (fk: string) => aisShipFixForFerryKey(fk, [withVoy], null, nowIso, () => 'ok');
    const items = [{
      id: 'bs-03', lat: 54.4, lng: 18.67, tile: 'FERRY' as const,
      ferryKey: SAILING, lastFixAt: '2026-11-04T16:50:00Z', late: false,
    }];
    const [grp] = placeMarkers(items, { zones: [], shipOf, grouping: true });
    expect(grp).toMatchObject({ kind: 'ferry', ais: 'ok', lat: 58.675, lng: 18.065 });
  });

  it('ferryTrackInfo: sailingId bez vessel → pozycja AIS', () => {
    const [withVoy] = withVoyages([aisFresh], [sailRow()], nowMs);
    const info = ferryTrackInfo({
      vessel: null,
      sailingId: SAILING,
      routeText: null,
      positions: [withVoy],
      locale: 'pl',
    });
    expect(info.pos).toEqual({ kind: 'ais', ts: '2026-11-05T09:49:00Z' });
    expect(info.vessel).toBe('M/F Nova Star');
  });

  it('ensureSailingAisMarkers: świeży AIS aktywnego rejsu, gdy Q-18 odfiltrował ślad', () => {
    const out = ensureSailingAisMarkers([], [sailRow()], nowMs);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      vesselId: 'v-ns', name: 'M/F Nova Star', lat: 58.675, lng: 18.065, source: 'db',
    });
    /* już jest w markerach — bez duplikatu */
    expect(ensureSailingAisMarkers(out, [sailRow()], nowMs)).toHaveLength(1);
    /* powrót / przed odjazdem — bez dopisku */
    expect(ensureSailingAisMarkers([], [sailRow({ route: 'NYN-GDN' })], nowMs)).toEqual([]);
    expect(ensureSailingAisMarkers([], [sailRow()], Date.parse('2026-11-04T16:00:00Z'))).toEqual([]);
  });

  it('CorridorMap / aisDb / MapView: DP-222 uchwyty', () => {
    const m = readFileSync('src/components/map/CorridorMap.tsx', 'utf8');
    expect(m).toContain('aisShipFixForFerryKey');
    expect(m).toContain('x.voyage?.sailingId === fk');
    expect(m).toContain('shipPos:');
    const db = readFileSync('src/lib/aisDb.ts', 'utf8');
    expect(db).toContain('ensureSailingAisMarkers');
    const mv = readFileSync('src/views/MapView.tsx', 'utf8');
    expect(mv).toContain('shipPos:');
    expect(mv).toContain('ferryTrackInfo');
  });
});

/** F7 #815 B1+B2 — wiersze jak SELECT prod BS-03 (0037): FERRY, rejs bez ATD, AIS Nova Star świeży. */
describe('DP-222 F7 #815 B1+B2 — tabela Mapy FERRY = AIS, nie GPS auta', () => {
  const nowIso = '2026-11-05T10:00:00Z';
  const nowMs = Date.parse(nowIso);
  const tx: RowCtx['tx'] = (k, p) => (p ? p9mp('pl', k, p) : p9m('pl', k));
  const baseCtx = (over: Partial<RowCtx> = {}): RowCtx => ({
    role: 'HHL', nowIso, prod: true, hasFix: () => false, sailingOf: () => undefined, tx, ...over,
  });

  function bs03(over: Partial<Load> = {}): Load {
    return {
      id: 'bs-03', code: 'BS-03', itemType: 'BS', qty: 1, stage: 'FERRY', progress: 0.5,
      status: 'ON_FERRY', plannedLoadDate: '2026-11-03', plannedDeliverDate: '2026-11-06',
      carrierId: 'scx', sailingId: SAILING,
      resources: { driverName: 'A', tractorPlate: 'X', trailerPlate: 'Y' },
      ferry: { vessel: 'Nova Star', departureAt: '2026-11-04T17:00:00Z', arrivalAt: '2026-11-05T11:00:00Z', bookingRef: null, status: 'BOOKED' },
      etaBoden: '2026-11-06T08:00:00Z', silentMinutes: null, delayed: false,
      hhlOrderNo: 'HHL/2026/0037', carrierOrderNo: '0037/10/S/2026',
      ...over,
    } as unknown as Load;
  }

  it('B2 odtworzenie: bez shipPos (stary łańcuch) → „statek bez AIS”; z AIS → ok', () => {
    const [withVoy] = withVoyages([aisFresh], [sailRow()], nowMs);
    const load = bs03();
    /* przed: hasFix=false, brak lastFixAt → p9c_pos_ship_none (to, co widział właściciel) */
    const before = mapRow(load, baseCtx({ hasFix: () => false }));
    expect(before.pos).toEqual({ kind: 'ship', text: 'statek bez AIS', sub: null, alarm: false });
    /* łańcuch: ferryTrackInfo po sailingId → ais; mapRow z shipPos → godzina AIS (09:49Z = 10:49 PL) */
    const track = ferryTrackInfo({
      vessel: 'Nova Star', sailingId: SAILING, routeText: null, positions: [withVoy], locale: 'pl',
    });
    expect(track.pos).toEqual({ kind: 'ais', ts: '2026-11-05T09:49:00Z' });
    const after = mapRow(load, baseCtx({
      hasFix: () => false,
      shipPos: () => track.pos,
    }));
    expect(after.pos).toMatchObject({ kind: 'ship', text: '10:49', sub: 'statek (AIS)', alarm: false });
  });

  it('B1: stary GPS auta w Gdańsku nie maskuje świeżego AIS', () => {
    const [withVoy] = withVoyages([aisFresh], [sailRow()], nowMs);
    const load = bs03({ etaDetail: { lastFixAt: '2026-11-04T16:50:00Z' } as Load['etaDetail'] });
    /* stary łańcuch brał lastFixAt auta (17:50 PL) i pisał „statek (AIS)” — mylące */
    const before = mapRow(load, baseCtx({ hasFix: () => true }));
    expect(before.pos.text).toBe('17:50');
    expect(before.pos.sub).toBe('statek (AIS)');
    const after = mapRow(load, baseCtx({
      hasFix: () => true,
      shipPos: () => ferryTrackInfo({
        vessel: 'Nova Star', sailingId: SAILING, routeText: null, positions: [withVoy], locale: 'pl',
      }).pos,
    }));
    expect(after.pos).toMatchObject({ kind: 'ship', text: '10:49', sub: 'statek (AIS)' });
  });

  it('B1: szacunek z rozkładu → est, nie „brak AIS”', () => {
    const load = bs03();
    const after = mapRow(load, baseCtx({
      shipPos: () => ({ kind: 'est', lastAisTs: '2026-11-05T04:00:00Z' }),
    }));
    expect(after.pos.kind).toBe('ship');
    expect(after.pos.text).toBe('05:00');
    expect(after.pos.sub).toBe('pozycja szacowana z rozkładu');
  });
});
