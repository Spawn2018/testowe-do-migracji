/**
 * DP-128 F7 r2 + DP-222 F7 #818 B1: ATD/ATA z AIS przy przejściu geofence (histereza 3/4 km).
 * ATA: luka ≤20 min. ATD: ≤20 min, albo ≤60 min gdy p_out ma SOG≥3 albo kolejne
 * pozycje oddalają się od portu (AISSTREAM co 10–25 min w Zatoce). ATD = ostatnia
 * w strefie z SOG≥1, inaczej ostatnia w strefie. Pas 3–4 km pomijany.
 */

export type GeofencePos = {
  observed_at: string;
  lat: number;
  lon: number;
  sog_kn: number | null;
};

/** Promień zapytania wokół portu (bbox + filtr haversine). */
export const GEOFENCE_QUERY_RADIUS_KM = 15;
/** Wewnątrz hubu (ATD p_in / ATA p_in). */
export const GEOFENCE_IN_KM = 3;
/** Poza hubem — histereza względem IN (ATD p_out / ATA „poprzednia”). */
export const GEOFENCE_OUT_KM = 4;
/** Maks. przerwa pary ATD/ATA bez dowodu ruchu (SOG / oddalanie). */
export const GEOFENCE_PAIR_MAX_MS = 20 * 60_000;
/** DP-222: AISSTREAM rzadki — para ATD do 60 min przy SOG≥3 albo oddalaniu. */
export const GEOFENCE_ATD_SPARSE_MAX_MS = 60 * 60_000;
/** ATD = ostatnia w strefie z SOG ≥ 1 kn (ruszanie z nabrzeża). */
export const GEOFENCE_ATD_MOVING_SOG_KN = 1;
export const GEOFENCE_CLEAR_SOG_KN = 3;

export const VESSEL_POS_PAGE_SIZE = 1000;
export const VESSEL_POS_MAX_PAGES = 50;

export function haversineKm(
  aLat: number, aLon: number, bLat: number, bLon: number,
): number {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (aLat - bLat) * rad;
  const dLon = (aLon - bLon) * rad;
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(bLat * rad) * Math.cos(aLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Bbox przybliżający promień queryKm wokół hubu (filtr haversine potem). */
export function hubBbox(hub: { lat: number; lon: number }, queryKm = GEOFENCE_QUERY_RADIUS_KM) {
  const dLat = queryKm / 111;
  const dLon = queryKm / (111 * Math.max(0.2, Math.cos((hub.lat * Math.PI) / 180)));
  return {
    latMin: hub.lat - dLat,
    latMax: hub.lat + dLat,
    lonMin: hub.lon - dLon,
    lonMax: hub.lon + dLon,
  };
}

function isClearOutside(dKm: number, sogKn: number | null): boolean {
  if (dKm > GEOFENCE_OUT_KM) return true;
  return sogKn != null && Number.isFinite(sogKn) && sogKn >= GEOFENCE_CLEAR_SOG_KN;
}

function sogAtLeast(sogKn: number | null, minKn: number): boolean {
  return sogKn != null && Number.isFinite(sogKn) && sogKn >= minKn;
}

/** DP-222: para ATD może mieć lukę do 60 min przy dowodzie ruchu. */
function atdAllowsSparseGap(
  sorted: GeofencePos[],
  outIdx: number,
  hub: { lat: number; lon: number },
): boolean {
  const pOut = sorted[outIdx]!;
  if (sogAtLeast(pOut.sog_kn, GEOFENCE_CLEAR_SOG_KN)) return true;
  const dOut = haversineKm(pOut.lat, pOut.lon, hub.lat, hub.lon);
  for (let j = outIdx + 1; j < sorted.length; j++) {
    const r = sorted[j]!;
    const d = haversineKm(r.lat, r.lon, hub.lat, hub.lon);
    if (d <= GEOFENCE_IN_KM) return false;
    if (d > dOut + 0.05) return true;
  }
  return false;
}

/**
 * ATD: p_in = ostatnia ≤3 km (prefer. SOG≥1), p_out = pierwsza późniejsza >4 km,
 * pas 3–4 km pomijany. Luka ≤20 min, albo ≤60 min przy SOG≥3 / oddalaniu (DP-222).
 * Czas = p_in. `rows` — pozycje w okolicy hubu od since; kolejność dowolna.
 */
export function findAtdTransitionIso(
  rows: GeofencePos[],
  hub: { lat: number; lon: number },
): string | null {
  const sorted = rows
    .filter((r) => Number.isFinite(Date.parse(r.observed_at)))
    .slice()
    .sort((a, b) => a.observed_at.localeCompare(b.observed_at));
  let lastIn: GeofencePos | null = null;
  let lastInMoving: GeofencePos | null = null;
  let best: string | null = null;
  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i]!;
    const d = haversineKm(row.lat, row.lon, hub.lat, hub.lon);
    if (d <= GEOFENCE_IN_KM) {
      lastIn = row;
      if (sogAtLeast(row.sog_kn, GEOFENCE_ATD_MOVING_SOG_KN)) lastInMoving = row;
      continue;
    }
    if (d <= GEOFENCE_OUT_KM) {
      /* Pas 3–4 km: pomijaj — nie przerywa pary, nie jest p_out. */
      continue;
    }
    /* d > 4 km = p_out */
    if (lastIn) {
      const pin = lastInMoving ?? lastIn;
      const gap = Date.parse(row.observed_at) - Date.parse(pin.observed_at);
      const maxMs = atdAllowsSparseGap(sorted, i, hub)
        ? GEOFENCE_ATD_SPARSE_MAX_MS
        : GEOFENCE_PAIR_MAX_MS;
      if (gap >= 0 && gap <= maxMs) {
        best = new Date(pin.observed_at).toISOString();
      }
      lastIn = null;
      lastInMoving = null;
    }
  }
  return best;
}

/**
 * ATA: najwcześniejsza pozycja ciągłej serii w porcie (≤3 km), przed którą
 * ostatnia pozycja z SOG ≥3 albo >4 km (pas 3–4 bez SOG pomijany), bez ≤3 km
 * pomiędzy, w ≤20 min. Czas = p_in.t.
 */
export function findAtaTransitionIso(
  rows: GeofencePos[],
  hub: { lat: number; lon: number },
): string | null {
  const sorted = rows
    .filter((r) => Number.isFinite(Date.parse(r.observed_at)))
    .slice()
    .sort((a, b) => a.observed_at.localeCompare(b.observed_at));
  let lastClear: GeofencePos | null = null;
  for (const row of sorted) {
    const d = haversineKm(row.lat, row.lon, hub.lat, hub.lon);
    if (d <= GEOFENCE_IN_KM) {
      if (lastClear) {
        const gap = Date.parse(row.observed_at) - Date.parse(lastClear.observed_at);
        if (gap >= 0 && gap <= GEOFENCE_PAIR_MAX_MS) {
          return new Date(row.observed_at).toISOString();
        }
      }
      /* W porcie bez ważnej pary — dalsze punkty serii nie są początkiem wejścia. */
      lastClear = null;
      continue;
    }
    if (isClearOutside(d, row.sog_kn)) {
      lastClear = row;
      continue;
    }
    /* Pas 3–4 km bez SOG≥3: pomijaj — lastClear zostaje. */
  }
  return null;
}

type VesselPosPageQuery = {
  select: (cols: string) => VesselPosPageQuery;
  eq: (col: string, val: string) => VesselPosPageQuery;
  gte: (col: string, val: string | number) => VesselPosPageQuery;
  lte: (col: string, val: string | number) => VesselPosPageQuery;
  order: (col: string, opts?: { ascending?: boolean }) => VesselPosPageQuery;
  range: (from: number, to: number) => Promise<{
    data: GeofencePos[] | null;
    error: { message: string } | null;
  }>;
};

/**
 * Pozycje wokół hubu od sinceIso — najnowsze pierwsze, ze stronicowaniem (DP-116).
 * Błąd zapytania / page cap → throw. Filtr haversine ≤ queryKm.
 */
export async function fetchVesselPositionsNearHubPaged(
  fromTable: () => VesselPosPageQuery,
  vesselId: string,
  hub: { lat: number; lon: number },
  sinceIso: string,
  opts?: {
    queryKm?: number;
    pageSize?: number;
    maxPages?: number;
    must?: <T>(r: { data: T; error: { message: string } | null }, what: string) => T;
  },
): Promise<GeofencePos[]> {
  const queryKm = opts?.queryKm ?? GEOFENCE_QUERY_RADIUS_KM;
  const pageSize = opts?.pageSize ?? VESSEL_POS_PAGE_SIZE;
  const maxPages = opts?.maxPages ?? VESSEL_POS_MAX_PAGES;
  const mustFn = opts?.must ?? (<T>(r: { data: T; error: { message: string } | null }, what: string): T => {
    if (r.error) throw new Error(`${what}: ${r.error.message}`);
    return r.data;
  });
  const box = hubBbox(hub, queryKm);
  const out: GeofencePos[] = [];
  const seen = new Set<string>();
  let from = 0;
  for (;;) {
    if (from >= maxPages * pageSize) {
      throw new Error('vessel_positions geofence page cap exceeded');
    }
    const r = mustFn(
      await fromTable()
        .select('observed_at,lat,lon,sog_kn')
        .eq('vessel_id', vesselId)
        .gte('observed_at', sinceIso)
        .gte('lat', box.latMin).lte('lat', box.latMax)
        .gte('lon', box.lonMin).lte('lon', box.lonMax)
        .order('observed_at', { ascending: false })
        .range(from, from + pageSize - 1),
      'vessel_positions geofence page',
    ) as GeofencePos[];
    for (const row of r) {
      const key = `${row.observed_at}|${row.lat}|${row.lon}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (haversineKm(row.lat, row.lon, hub.lat, hub.lon) <= queryKm) out.push(row);
    }
    if (r.length < pageSize) break;
    from += pageSize;
  }
  return out;
}
