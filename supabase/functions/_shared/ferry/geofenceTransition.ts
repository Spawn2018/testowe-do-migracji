/**
 * DP-128 F7 r1: ATD/ATA z AIS tylko przy przejściu geofence z histerezą i luką ≤20 min.
 * Świadomy skutek (decyzja 81): przerwa sygnału >20 min przy nabrzeżu → brak godziny zamiast zgadywania.
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
/** Maks. przerwa między p_in a p_out (ATD) albo poprzednią a wejściem (ATA). */
export const GEOFENCE_PAIR_MAX_MS = 20 * 60_000;
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

/**
 * ATD: najpóźniejsza para kolejnych pozycji p_in (≤3 km) → p_out (>4 km),
 * z p_out.t − p_in.t ≤ 20 min. Czas = p_in.t.
 * `rows` — pozycje w okolicy hubu od since; kolejność dowolna.
 */
export function findAtdTransitionIso(
  rows: GeofencePos[],
  hub: { lat: number; lon: number },
): string | null {
  const sorted = rows
    .filter((r) => Number.isFinite(Date.parse(r.observed_at)))
    .slice()
    .sort((a, b) => a.observed_at.localeCompare(b.observed_at));
  let best: string | null = null;
  for (let i = 0; i < sorted.length - 1; i++) {
    const pin = sorted[i]!;
    const pout = sorted[i + 1]!;
    const dIn = haversineKm(pin.lat, pin.lon, hub.lat, hub.lon);
    const dOut = haversineKm(pout.lat, pout.lon, hub.lat, hub.lon);
    if (dIn > GEOFENCE_IN_KM) continue;
    if (dOut <= GEOFENCE_OUT_KM) continue;
    const gap = Date.parse(pout.observed_at) - Date.parse(pin.observed_at);
    if (gap < 0 || gap > GEOFENCE_PAIR_MAX_MS) continue;
    best = new Date(pin.observed_at).toISOString();
  }
  return best;
}

/**
 * ATA: najwcześniejsza pozycja ciągłej serii w porcie (≤3 km), której poprzednia
 * jest ≤20 min wcześniej, ma >4 km albo SOG ≥3 kn. Czas = p_in.t.
 */
export function findAtaTransitionIso(
  rows: GeofencePos[],
  hub: { lat: number; lon: number },
): string | null {
  const sorted = rows
    .filter((r) => Number.isFinite(Date.parse(r.observed_at)))
    .slice()
    .sort((a, b) => a.observed_at.localeCompare(b.observed_at));
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const pin = sorted[i]!;
    const dIn = haversineKm(pin.lat, pin.lon, hub.lat, hub.lon);
    if (dIn > GEOFENCE_IN_KM) continue;
    /* Ciągła seria: poprzednia też w porcie → to nie jest początek wejścia. */
    const dPrev = haversineKm(prev.lat, prev.lon, hub.lat, hub.lon);
    if (dPrev <= GEOFENCE_IN_KM) continue;
    const gap = Date.parse(pin.observed_at) - Date.parse(prev.observed_at);
    if (gap < 0 || gap > GEOFENCE_PAIR_MAX_MS) continue;
    const sog = prev.sog_kn;
    const clear = dPrev > GEOFENCE_OUT_KM
      || (sog != null && Number.isFinite(sog) && sog >= GEOFENCE_CLEAR_SOG_KN);
    if (!clear) continue;
    return new Date(pin.observed_at).toISOString();
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
