/**
 * E49-a (DP-205): punkty prognozy wiatru co 25 km wzdłuż polilinii korytarza (Z1 / #783).
 * Współrzędne GeoJSON [lon, lat]; bearing = kierunek jazdy (stopnie, 0–360).
 */

export const E49_WIND_STEP_KM = 25;

export type CorridorWindPoint = {
  km: number;
  lon: number;
  lat: number;
  /** Kierunek odcinka w przód (deg). */
  bearingDeg: number;
};

function toRad(d: number): number {
  return (d * Math.PI) / 180;
}

function toDeg(r: number): number {
  return (r * 180) / Math.PI;
}

/** Haversine km między dwoma punktami [lon, lat]. */
export function haversineKm(a: readonly [number, number], b: readonly [number, number]): number {
  const R = 6371;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const la1 = toRad(a[1]);
  const la2 = toRad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Azymut początkowy A→B (0–360, north=0). */
export function bearingDeg(a: readonly [number, number], b: readonly [number, number]): number {
  const φ1 = toRad(a[1]);
  const φ2 = toRad(b[1]);
  const Δλ = toRad(b[0] - a[0]);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((toDeg(Math.atan2(y, x)) % 360) + 360) % 360;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Punkty co `stepKm` wzdłuż polilinii (w tym start 0 km).
 * Ostatni wierzchołek tylko gdy odległość od poprzedniego punktu ≥ step/2.
 */
export function samplePolylineEveryKm(
  coords: readonly (readonly [number, number])[],
  stepKm = E49_WIND_STEP_KM,
): CorridorWindPoint[] {
  if (coords.length < 2 || !(stepKm > 0)) return [];
  const out: CorridorWindPoint[] = [];
  let segStart = coords[0]!;
  let traveled = 0;
  let nextAt = 0;
  let bearing = bearingDeg(coords[0]!, coords[1]!);

  const push = (km: number, lon: number, lat: number, brg: number) => {
    out.push({
      km: Math.round(km * 100) / 100,
      lon: Math.round(lon * 1e6) / 1e6,
      lat: Math.round(lat * 1e6) / 1e6,
      bearingDeg: Math.round(brg * 10) / 10,
    });
  };

  push(0, segStart[0], segStart[1], bearing);
  nextAt = stepKm;

  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1]!;
    const b = coords[i]!;
    const segKm = haversineKm(a, b);
    if (!(segKm > 0)) continue;
    bearing = bearingDeg(a, b);
    let local = 0;
    while (traveled + segKm >= nextAt) {
      const need = nextAt - traveled;
      const t = need / segKm;
      push(nextAt, lerp(a[0], b[0], t), lerp(a[1], b[1], t), bearing);
      nextAt += stepKm;
      local = need;
      if (local >= segKm) break;
    }
    traveled += segKm;
    segStart = b;
  }

  const last = coords[coords.length - 1]!;
  const lastOut = out[out.length - 1]!;
  if (haversineKm([lastOut.lon, lastOut.lat], last) >= stepKm / 2) {
    push(traveled, last[0], last[1], bearing);
  }
  return out;
}

/** GeoJSON LineString / MultiLineString → lista [lon, lat]. */
export function coordsFromGeoJson(geom: unknown): [number, number][] {
  if (!geom || typeof geom !== 'object') return [];
  const g = geom as { type?: string; coordinates?: unknown };
  if (g.type === 'LineString' && Array.isArray(g.coordinates)) {
    return g.coordinates
      .filter((c): c is [number, number] => Array.isArray(c) && c.length >= 2)
      .map((c) => [Number(c[0]), Number(c[1])] as [number, number])
      .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
  }
  if (g.type === 'MultiLineString' && Array.isArray(g.coordinates)) {
    const out: [number, number][] = [];
    for (const line of g.coordinates) {
      if (!Array.isArray(line)) continue;
      for (const c of line) {
        if (!Array.isArray(c) || c.length < 2) continue;
        const lon = Number(c[0]);
        const lat = Number(c[1]);
        if (Number.isFinite(lon) && Number.isFinite(lat)) out.push([lon, lat]);
      }
    }
    return out;
  }
  return [];
}
