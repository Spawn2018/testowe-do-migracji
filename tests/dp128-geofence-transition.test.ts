/**
 * DP-128 F7 r1 — przejście geofence ATD/ATA (histereza 3/4 km, luka ≤20 min, stronicowanie).
 * Etap: BN4 / AIS; źródło F7 #703 r1 B1–B4.
 */
import { describe, expect, it } from 'vitest';
import {
  fetchVesselPositionsNearHubPaged,
  findAtaTransitionIso,
  findAtdTransitionIso,
  GEOFENCE_IN_KM,
  GEOFENCE_OUT_KM,
  GEOFENCE_QUERY_RADIUS_KM,
  haversineKm,
  supabaseStore,
  VESSEL_POS_PAGE_SIZE,
} from '../supabase/functions/_shared/integrations/store.ts';
import type { GeofencePos } from '../supabase/functions/_shared/ferry/geofenceTransition.ts';
import { AIS_PORT_COORDS } from '../supabase/functions/_shared/ferry/digitraffic.ts';

const GDN = AIS_PORT_COORDS.GDN;
const GDY = AIS_PORT_COORDS.GDY;
const TLLA = AIS_PORT_COORDS.TLLA;
const HEL = AIS_PORT_COORDS.HEL;
const HELA = AIS_PORT_COORDS.HELA;

function pos(
  t: string, lat: number, lon: number, sog: number | null = null,
): GeofencePos {
  return { observed_at: t, lat, lon, sog_kn: sog };
}

/** Punkt ~distKm na N od hubu (przybliżenie 1° ≈ 111 km). */
function northOf(hub: { lat: number; lon: number }, distKm: number) {
  return { lat: hub.lat + distKm / 111, lon: hub.lon };
}

describe('DP-128 geofenceTransition — pure', () => {
  it('R1 XPRS: luka >20 min między zatoką a TLLA → bez ATA (fałszywa produkcja)', () => {
    const rows = [
      pos('2026-11-01T10:00:00.000Z', 59.6, 24.9, 12),
      pos('2026-11-01T12:18:52.731Z', TLLA.lat, TLLA.lon, 0),
    ];
    expect(findAtaTransitionIso(rows, TLLA)).toBeNull();
  });

  it('R1 wariant OK: poprzednia ≤20 min poza hubem → ATA = wejście', () => {
    const out = northOf(TLLA, 6);
    const rows = [
      pos('2026-11-01T12:10:00.000Z', out.lat, out.lon, 8),
      pos('2026-11-01T12:18:52.731Z', TLLA.lat, TLLA.lon, 0),
    ];
    expect(findAtaTransitionIso(rows, TLLA)).toBe('2026-11-01T12:18:52.731Z');
  });

  it('R3 ATD: przerwa >20 min między GDY a pozycją 5 km → bez ATD', () => {
    const out = northOf(GDY, 5);
    const rows = [
      pos('2026-10-22T06:10:00.000Z', GDY.lat, GDY.lon, 0),
      pos('2026-10-22T08:15:00.000Z', out.lat, out.lon, 8),
    ];
    expect(findAtdTransitionIso(rows, GDY)).toBeNull();
  });

  it('R3 wariant OK: para ≤20 min → ATD = p_in', () => {
    const out = northOf(GDY, 5);
    const rows = [
      pos('2026-10-22T08:05:00.000Z', GDY.lat, GDY.lon, 0),
      pos('2026-10-22T08:15:00.000Z', out.lat, out.lon, 8),
    ];
    expect(findAtdTransitionIso(rows, GDY)).toBe('2026-10-22T08:05:00.000Z');
  });

  it('histereza HEL↔HELA (~3,27 km): w strefie martwej 3–4 km bez ATD/ATA', () => {
    const d = haversineKm(HEL.lat, HEL.lon, HELA.lat, HELA.lon);
    expect(d).toBeGreaterThan(GEOFENCE_IN_KM);
    expect(d).toBeLessThan(GEOFENCE_OUT_KM);
    /* HEL (in) → HELA (martwa strefa, nie OUT) — brak pary ATD. */
    expect(findAtdTransitionIso([
      pos('2026-11-01T08:00:00.000Z', HEL.lat, HEL.lon, 0),
      pos('2026-11-01T08:05:00.000Z', HELA.lat, HELA.lon, 4),
    ], HEL)).toBeNull();
    /* HELA jako hub: pozycja HEL nie jest IN (d>3), potem HELA IN bez poprzedniej OUT. */
    expect(findAtaTransitionIso([
      pos('2026-11-01T10:00:00.000Z', HEL.lat, HEL.lon, 2),
      pos('2026-11-01T10:05:00.000Z', HELA.lat, HELA.lon, 0),
    ], HELA)).toBeNull();
  });

  it('ATA: SOG≥3 w strefie martwej (≤4 km) też klaruje wejście', () => {
    const mid = northOf(GDN, 3.5); /* 3–4 km */
    expect(haversineKm(mid.lat, mid.lon, GDN.lat, GDN.lon)).toBeGreaterThan(GEOFENCE_IN_KM);
    expect(haversineKm(mid.lat, mid.lon, GDN.lat, GDN.lon)).toBeLessThanOrEqual(GEOFENCE_OUT_KM);
    expect(findAtaTransitionIso([
      pos('2026-09-24T19:30:00.000Z', mid.lat, mid.lon, 5),
      pos('2026-09-24T19:36:00.000Z', GDN.lat, GDN.lon, 0),
    ], GDN)).toBe('2026-09-24T19:36:00.000Z');
  });
});

describe('DP-128 fetchVesselPositionsNearHubPaged — atrapa PostgREST', () => {
  function limitingPosClient(all: GeofencePos[], hardCap = VESSEL_POS_PAGE_SIZE) {
    return {
      from(_table: string) {
        const state: {
          vesselId?: string;
          sinceIso?: string;
          latMin?: number; latMax?: number;
          lonMin?: number; lonMax?: number;
          ascending?: boolean;
        } = {};
        const api = {
          select(_cols: string) { return api; },
          eq(col: string, val: string) {
            if (col === 'vessel_id') state.vesselId = val;
            return api;
          },
          gte(col: string, val: string | number) {
            if (col === 'observed_at') state.sinceIso = String(val);
            if (col === 'lat') state.latMin = Number(val);
            if (col === 'lon') state.lonMin = Number(val);
            return api;
          },
          lte(col: string, val: string | number) {
            if (col === 'lat') state.latMax = Number(val);
            if (col === 'lon') state.lonMax = Number(val);
            return api;
          },
          order(col: string, opts?: { ascending?: boolean }) {
            if (col === 'observed_at') state.ascending = opts?.ascending !== false;
            return api;
          },
          async range(from: number, to: number) {
            let rows = all.slice();
            if (state.sinceIso) rows = rows.filter((r) => r.observed_at >= state.sinceIso!);
            if (state.latMin != null) rows = rows.filter((r) => r.lat >= state.latMin!);
            if (state.latMax != null) rows = rows.filter((r) => r.lat <= state.latMax!);
            if (state.lonMin != null) rows = rows.filter((r) => r.lon >= state.lonMin!);
            if (state.lonMax != null) rows = rows.filter((r) => r.lon <= state.lonMax!);
            rows.sort((a, b) => state.ascending
              ? a.observed_at.localeCompare(b.observed_at)
              : b.observed_at.localeCompare(a.observed_at));
            const end = Math.min(to + 1, from + hardCap);
            return { data: rows.slice(from, end), error: null };
          },
        };
        return api;
      },
    };
  }

  it('R4: 620 wierszy, wejście w ~600 — ATA mimo limitu strony (nie 200)', async () => {
    const hub = GDY;
    const out = northOf(hub, 6);
    const rows: GeofencePos[] = [];
    const t0 = Date.parse('2026-10-22T00:00:00.000Z');
    for (let i = 0; i < 598; i++) {
      rows.push(pos(new Date(t0 + i * 60_000).toISOString(), out.lat, out.lon, 10));
    }
    /* 599 = poza, 600 = w porcie — para ≤20 min. */
    rows.push(pos(new Date(t0 + 599 * 60_000).toISOString(), out.lat, out.lon, 8));
    rows.push(pos(new Date(t0 + 600 * 60_000).toISOString(), hub.lat, hub.lon, 0));
    for (let i = 601; i < 620; i++) {
      rows.push(pos(new Date(t0 + i * 60_000).toISOString(), hub.lat, hub.lon, 0));
    }
    const client = limitingPosClient(rows, 100);
    const fetched = await fetchVesselPositionsNearHubPaged(
      () => client.from('vessel_positions'),
      'v1',
      hub,
      '2026-10-22T00:00:00.000Z',
      { pageSize: 100, queryKm: GEOFENCE_QUERY_RADIUS_KM },
    );
    expect(fetched.length).toBeGreaterThan(200);
    expect(findAtaTransitionIso(fetched, hub)).toBe(
      new Date(t0 + 600 * 60_000).toISOString(),
    );
  });

  it('błąd strony → throw (bez cichego null)', async () => {
    const client = {
      from() {
        const api = {
          select() { return api; },
          eq() { return api; },
          gte() { return api; },
          lte() { return api; },
          order() { return api; },
          async range() {
            return { data: null, error: { message: 'boom' } };
          },
        };
        return api;
      },
    };
    await expect(fetchVesselPositionsNearHubPaged(
      () => client.from(),
      'v1',
      GDN,
      '2026-09-24T00:00:00.000Z',
    )).rejects.toThrow(/vessel_positions geofence page/);
  });

  it('supabaseStore.lastPortPosition / firstPortEntryAfter na atrapie', async () => {
    const hub = GDN;
    const out = northOf(hub, 5);
    const all = [
      pos('2026-09-24T19:30:00.000Z', hub.lat, hub.lon, 0),
      pos('2026-09-24T19:36:00.000Z', out.lat, out.lon, 8),
      pos('2026-09-24T19:50:00.000Z', out.lat + 0.02, out.lon, 10),
      pos('2026-09-25T08:00:00.000Z', out.lat, out.lon, 6),
      pos('2026-09-25T08:10:00.000Z', hub.lat, hub.lon, 0),
    ];
    const client = limitingPosClient(all, 50);
    const store = supabaseStore(client as never);
    const atd = await store.lastPortPosition!('v1', hub, 3, '2026-09-24T17:00:00.000Z');
    expect(atd).toBe('2026-09-24T19:30:00.000Z');
    const ata = await store.firstPortEntryAfter!('v1', hub, 3, '2026-09-24T19:40:00.000Z');
    expect(ata).toBe('2026-09-25T08:10:00.000Z');
  });
});
