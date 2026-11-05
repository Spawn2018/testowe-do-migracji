/**
 * DP-222 / #814 — BS-04 na pozycji Nova Star zamiast Wawla (przeciwne kursy tej samej linii).
 * Etap: C2 / BN9-c2. Auto z sailingId GDN→NYN musi stać na tym statku, nie na NYN→GDN.
 */
import { afterEach, describe, expect, it } from 'vitest';
import type { AisPosition } from '../src/lib/ais';
import {
  aisShipFixForFerryKey,
  ensureSailingAisMarkers,
  ferryTrackInfo,
  setSailingVesselIndex,
  withVoyages,
} from '../src/lib/bn9c2Ferry';
import type { SailingMapRow } from '../src/lib/ferry/estimate';
import { placeMarkers } from '../src/lib/p9eGroups';

const WAWEL_SAIL = '6174b072-0000-4000-8000-000000000038';
const NOVA_SAIL = '95e2835b-0000-4000-8000-000000000037';
const GDN = { lat: 54.40372, lon: 18.6813 };
const NYN = { lat: 58.90453, lon: 17.95621 };
const nowIso = '2026-11-05T18:40:00Z';
const nowMs = Date.parse(nowIso);

function sail(p: Partial<SailingMapRow> & Pick<SailingMapRow, 'sailing_id' | 'vessel_id' | 'vessel_name' | 'mmsi' | 'route'>): SailingMapRow {
  const out = p.route === 'NYN-GDN';
  return {
    status: 'W_REJSIE',
    departure_at: out ? '2026-11-05T17:00:00Z' : '2026-11-05T17:00:00Z',
    arrival_at: out ? '2026-11-06T11:00:00Z' : '2026-11-06T11:00:00Z',
    departed_at: out ? '2026-11-05T17:23:00Z' : '2026-11-05T17:15:40Z',
    arrived_at: null,
    dep_port: out ? 'NYN' : 'GDN',
    arr_port: out ? 'GDN' : 'NYN',
    dep_lat: out ? NYN.lat : GDN.lat,
    dep_lon: out ? NYN.lon : GDN.lon,
    arr_lat: out ? GDN.lat : NYN.lat,
    arr_lon: out ? GDN.lon : NYN.lon,
    ais_lat: null,
    ais_lon: null,
    ais_observed_at: null,
    ...p,
  };
}

const wawelAis: AisPosition = {
  mmsi: '311852000',
  vesselId: 'v-wawel',
  name: 'M/F Wawel',
  lat: 54.691,
  lng: 18.954,
  ts: '2026-11-05T18:34:00Z',
  source: 'db',
};

const novaAis: AisPosition = {
  mmsi: '311000787',
  vesselId: 'v-nova',
  name: 'M/F Nova Star',
  lat: 58.62,
  lng: 18.053,
  ts: '2026-11-05T18:30:00Z',
  source: 'db',
};

const rows = [
  sail({
    sailing_id: WAWEL_SAIL,
    vessel_id: 'v-wawel',
    vessel_name: 'M/F Wawel',
    mmsi: 311852000,
    route: 'GDN-NYN',
    ais_lat: 54.691,
    ais_lon: 18.954,
    ais_observed_at: '2026-11-05T18:34:00Z',
  }),
  sail({
    sailing_id: NOVA_SAIL,
    vessel_id: 'v-nova',
    vessel_name: 'M/F Nova Star',
    mmsi: 311000787,
    route: 'NYN-GDN',
    ais_lat: 58.62,
    ais_lon: 18.053,
    ais_observed_at: '2026-11-05T18:30:00Z',
  }),
];

describe('DP-222 BS-04 — dwa statki tej samej linii, auto na właściwym', () => {
  afterEach(() => setSailingVesselIndex([]));

  it('aisShipFixForFerryKey: GDN→NYN (Wawel) nie bierze pozycji NYN→GDN (Nova Star)', () => {
    const live = withVoyages([wawelAis, novaAis], rows, nowMs);
    expect(live.find((x) => x.vesselId === 'v-wawel')?.voyage?.sailingId).toBe(WAWEL_SAIL);
    expect(live.find((x) => x.vesselId === 'v-nova')?.voyage?.sailingId).toBe(NOVA_SAIL);

    const ship = aisShipFixForFerryKey(WAWEL_SAIL, live, 'Nova Star', nowIso, () => 'fresh');
    expect(ship).toMatchObject({ lat: 54.691, lng: 18.954, vessel: 'M/F Wawel' });
  });

  it('byName nie bierze markera z obcym voyage.sailingId (stara nazwa w ferry)', () => {
    /* Wawel bez voyage; Nova z rejsem powrotnym; bez vessel_id → null (nie Szwecja) */
    const novaVoy = withVoyages([novaAis], [rows[1]], nowMs)[0];
    const ship = aisShipFixForFerryKey(WAWEL_SAIL, [wawelAis, novaVoy], 'Nova Star', nowIso, () => 'fresh');
    expect(ship).toBeNull();
  });

  it('F7 #824: Wawel bez voyage + nazwa store Nova Star → pozycja Wawla po vessel_id', () => {
    /* regresja BS-04: byVoyage milczy, byName wskazałby Novę — vessel_id z ferry_sailings_map ratuje Hel */
    const novaVoy = withVoyages([novaAis], [rows[1]], nowMs)[0];
    const ship = aisShipFixForFerryKey(
      WAWEL_SAIL,
      [wawelAis, novaVoy],
      'Nova Star',
      nowIso,
      () => 'fresh',
      { sailings: rows },
    );
    expect(ship).toMatchObject({ lat: 54.691, lng: 18.954, vessel: 'M/F Wawel' });
  });

  it('placeMarkers: BS-04 na Helu (Wawel), nie przy Szwecji — także bez voyage na markerze', () => {
    const novaVoy = withVoyages([novaAis], [rows[1]], nowMs)[0];
    const live = [wawelAis, novaVoy]; /* Wawel bez voyage — wcześniej test przeszedłby bez poprawki F7 */
    const shipOf = (fk: string) => aisShipFixForFerryKey(
      fk, live, fk === WAWEL_SAIL ? 'Nova Star' : 'Wawel', nowIso, () => 'fresh', { sailings: rows },
    );
    const items = [{
      id: 'bs-04', lat: 54.4, lng: 18.67, tile: 'FERRY' as const,
      ferryKey: WAWEL_SAIL, lastFixAt: '2026-11-05T17:20:00Z', late: false,
    }];
    const [grp] = placeMarkers(items, { zones: [], shipOf, grouping: true });
    expect(grp).toMatchObject({ kind: 'ferry', ais: 'ok', lat: 54.691, lng: 18.954, vessel: 'M/F Wawel' });
  });

  it('ensureSailingAisMarkers: Q-18 bez Wawla → dołożenie z rejsu; Nova powrotna bez dopisku outbound', () => {
    const onlyNova = ensureSailingAisMarkers([novaAis], rows, nowMs);
    expect(onlyNova.some((m) => m.vesselId === 'v-wawel')).toBe(true);
    expect(onlyNova.filter((m) => m.vesselId === 'v-nova')).toHaveLength(1);
    const live = withVoyages(onlyNova, rows, nowMs);
    const ship = aisShipFixForFerryKey(WAWEL_SAIL, live, null, nowIso, () => 'fresh');
    expect(ship).toMatchObject({ lat: 54.691, lng: 18.954, vessel: 'M/F Wawel' });
  });

  it('ferryTrackInfo: sailingId Wawla + myląca nazwa Nova → AIS Wawla (także bez voyage)', () => {
    const novaVoy = withVoyages([novaAis], [rows[1]], nowMs)[0];
    const info = ferryTrackInfo({
      vessel: 'Nova Star',
      sailingId: WAWEL_SAIL,
      routeText: null,
      positions: [wawelAis, novaVoy],
      locale: 'pl',
      sailings: rows,
    });
    expect(info.pos).toEqual({ kind: 'ais', ts: '2026-11-05T18:34:00Z' });
    expect(info.vessel).toBe('Nova Star'); /* etykieta z opts; pozycja z vessel_id */
  });
});
