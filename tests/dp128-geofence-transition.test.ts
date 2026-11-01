/**
 * DP-128 F7 r2 — przejście geofence ATD/ATA (histereza 3/4 km, luka ≤20 min,
 * pas 3–4 km pomijany, stronicowanie). Etap: BN4 / AIS; źródło F7 #703 r2 B1/P1/P2.
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
const NYN = AIS_PORT_COORDS.NYN;
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

/**
 * Realny tor wyjścia: postój w hubie, potem ruch co 1 min z danym SOG (kn)
 * radialnie na N — gęste pozycje w pasie 3–4 km (F7 r2 B1).
 */
function denseOutboundTrack(
  hub: { lat: number; lon: number },
  t0Iso: string,
  sogKn: number,
  opts?: { dwellMin?: number; outToKm?: number; withSog?: boolean },
): GeofencePos[] {
  const dwellMin = opts?.dwellMin ?? 3;
  const outToKm = opts?.outToKm ?? 6;
  const withSog = opts?.withSog !== false;
  const t0 = Date.parse(t0Iso);
  const kmPerMin = (sogKn * 1.852) / 60;
  const rows: GeofencePos[] = [];
  for (let m = 0; m < dwellMin; m++) {
    rows.push(pos(new Date(t0 + m * 60_000).toISOString(), hub.lat, hub.lon, 0));
  }
  let dist = 0;
  let m = dwellMin;
  while (dist < outToKm) {
    dist = Math.min(outToKm, dist + kmPerMin);
    const p = northOf(hub, dist);
    rows.push(pos(
      new Date(t0 + m * 60_000).toISOString(),
      p.lat,
      p.lon,
      withSog ? sogKn : null,
    ));
    m += 1;
  }
  return rows;
}

/** Oczekiwany ATD: ostatnia pozycja ≤3 km przed pierwszą >4 km. */
function expectedAtdFromTrack(
  rows: GeofencePos[],
  hub: { lat: number; lon: number },
): string | null {
  const sorted = rows.slice().sort((a, b) => a.observed_at.localeCompare(b.observed_at));
  let lastIn: string | null = null;
  for (const r of sorted) {
    const d = haversineKm(r.lat, r.lon, hub.lat, hub.lon);
    if (d <= GEOFENCE_IN_KM) lastIn = new Date(r.observed_at).toISOString();
    else if (d > GEOFENCE_OUT_KM && lastIn) return lastIn;
  }
  return null;
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

  it('B1 ATD: gęsty tor co 1 min (pas 3–4 km) — GDY/GDN/TLLA przy 8/12/17 kn', () => {
    for (const [hub, label] of [[GDY, 'GDY'], [GDN, 'GDN'], [TLLA, 'TLLA']] as const) {
      for (const sog of [8, 12, 17]) {
        const rows = denseOutboundTrack(hub, '2026-10-22T08:00:00.000Z', sog);
        const midCount = rows.filter((r) => {
          const d = haversineKm(r.lat, r.lon, hub.lat, hub.lon);
          return d > GEOFENCE_IN_KM && d <= GEOFENCE_OUT_KM;
        }).length;
        expect(midCount, `${label} ${sog} kn pas 3–4`).toBeGreaterThan(0);
        expect(findAtdTransitionIso(rows, hub), `${label} ${sog} kn`).toBe(
          expectedAtdFromTrack(rows, hub),
        );
      }
    }
  });

  it('P1 ATA: NYN 17 kn bez sog_kn — pas 3–4 km nie blokuje wejścia', () => {
    const out = northOf(NYN, 6);
    const mid = northOf(NYN, 3.5);
    const rows = [
      pos('2026-09-25T06:00:00.000Z', out.lat, out.lon, null),
      pos('2026-09-25T06:05:00.000Z', mid.lat, mid.lon, null), /* pas bez SOG */
      pos('2026-09-25T06:10:00.000Z', NYN.lat, NYN.lon, 0),
    ];
    expect(findAtaTransitionIso(rows, NYN)).toBe('2026-09-25T06:10:00.000Z');
  });

  it('P1 ATA: gęste wejście co 1 min bez sog w pasie 3–4 — GDN/NYN/HEL', () => {
    for (const hub of [GDN, NYN, HEL]) {
      const t0 = Date.parse('2026-09-25T08:00:00.000Z');
      const rows: GeofencePos[] = [];
      /* Zbliżanie z 6 km do 0, co 1 min, bez sog_kn — kilka punktów w pasie 3–4. */
      for (let i = 0; i <= 12; i++) {
        const dist = 6 - i * 0.5;
        const p = dist <= 0 ? hub : northOf(hub, dist);
        rows.push(pos(new Date(t0 + i * 60_000).toISOString(), p.lat, p.lon, null));
      }
      const midCount = rows.filter((r) => {
        const d = haversineKm(r.lat, r.lon, hub.lat, hub.lon);
        return d > GEOFENCE_IN_KM && d <= GEOFENCE_OUT_KM;
      }).length;
      expect(midCount).toBeGreaterThan(0);
      const firstIn = rows.find((r) =>
        haversineKm(r.lat, r.lon, hub.lat, hub.lon) <= GEOFENCE_IN_KM
      )!;
      expect(findAtaTransitionIso(rows, hub)).toBe(
        new Date(firstIn.observed_at).toISOString(),
      );
    }
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
