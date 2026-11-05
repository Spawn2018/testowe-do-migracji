/**
 * DP-222 / #814 — BS-03 „brak AIS” mimo świeżego AIS Nova Star.
 * Etap: C2 / BN9-c2. Auto FERRY z rejsem poza listą klienta → pozycja statku po voyage.sailingId.
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

  it('CorridorMap / aisDb: DP-222 uchwyty', () => {
    const m = readFileSync('src/components/map/CorridorMap.tsx', 'utf8');
    expect(m).toContain('aisShipFixForFerryKey');
    expect(m).toContain('x.voyage?.sailingId === fk');
    const db = readFileSync('src/lib/aisDb.ts', 'utf8');
    expect(db).toContain('ensureSailingAisMarkers');
  });
});
