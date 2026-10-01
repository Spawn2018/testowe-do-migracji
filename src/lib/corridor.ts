/**
 * II-7 — rzut GPS na korytarz OSM (ta sama geometria co Edge CORRIDOR_* / corridor_polylines).
 * + helpers mapy (permit_reference z corridor_ref.json) dla Leaflet / seed demo.
 * Czyste funkcje: bez sieci, bez sekretów.
 */
import along from '@turf/along';
import length from '@turf/length';
import bearing from '@turf/bearing';
import { lineString, point } from '@turf/helpers';
import corridorFc from '../data/corridor_ref.json';

export type LatLon = [number, number];
export type CorridorCoord = [number, number]; // [lng, lat]

/** Śrem → Gdańsk (OSM / ODbL — przybliżenie korytarza zezwolenia). */
export const CORRIDOR_PL: LatLon[] = [
  [52.0739, 17.0246], [52.4064, 16.9252], [52.8, 17.6], [53.1235, 18.0084], [53.4000, 18.4400],
  [53.4837, 18.7536], [54.0, 18.75], [54.3520, 18.6466], [54.4037, 18.6813],
];

/** Nynäshamn → E4 → Boden. */
export const CORRIDOR_SE: LatLon[] = [
  [58.9045, 17.9562], [59.3293, 18.0686], [59.8586, 17.6389], [60.6749, 17.1413], [61.7274, 17.1056],
  [62.3908, 17.3069], [62.6323, 17.9379], [63.2909, 18.7153], [63.8258, 20.2630], [64.7507, 20.9528],
  [65.3172, 21.4794], [65.5848, 22.1547], [65.8054, 21.7591],
];

const R_KM = 6371;
const rad = (d: number) => (d * Math.PI) / 180;

function haversineKm(a: LatLon, b: LatLon): number {
  const dLat = rad(b[0] - a[0]);
  const dLon = rad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Długość łamanej [km]. */
export function corridorLengthKm(line: LatLon[]): number {
  let s = 0;
  for (let i = 0; i < line.length - 1; i++) s += haversineKm(line[i], line[i + 1]);
  return s;
}

/** Odległość punktu od łamanej [km] (projekcja lokalna — jak w road.ts). */
export function distanceToCorridorKm(lat: number, lon: number, line: LatLon[]): number {
  const k = Math.cos(lat * Math.PI / 180);
  const xy = ([a, b]: LatLon) => [b * (Math.PI / 180) * R_KM * k, a * (Math.PI / 180) * R_KM] as const;
  const [px, py] = xy([lat, lon]);
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = xy(line[i]);
    const [bx, by] = xy(line[i + 1]);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}

/**
 * Postęp wzdłuż korytarza: remainingFrac 0..1 (1 = na starcie), remainingKm, offM.
 * Locate ≈ skumulowana odległość do najbliższego rzutu / długość.
 */
export function corridorProgress(
  lat: number,
  lon: number,
  line: LatLon[],
): { remainingFrac: number; remainingKm: number; offM: number; totalKm: number } {
  const totalKm = corridorLengthKm(line);
  const k = Math.cos(lat * Math.PI / 180);
  const xy = ([a, b]: LatLon) => [b * (Math.PI / 180) * R_KM * k, a * (Math.PI / 180) * R_KM] as const;
  const [px, py] = xy([lat, lon]);
  let bestD = Infinity;
  let bestAlong = 0;
  let alongKm = 0;
  for (let i = 0; i < line.length - 1; i++) {
    const segKm = haversineKm(line[i], line[i + 1]);
    const [ax, ay] = xy(line[i]);
    const [bx, by] = xy(line[i + 1]);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (d < bestD) {
      bestD = d;
      bestAlong = alongKm + t * segKm;
    }
    alongKm += segKm;
  }
  const remainingFrac = totalKm > 0 ? Math.min(1, Math.max(0, 1 - bestAlong / totalKm)) : 1;
  return {
    remainingFrac,
    remainingKm: remainingFrac * totalKm,
    offM: bestD * 1000,
    totalKm,
  };
}

/** Czas jazdy [h] = remainingKm × (paramHours / totalKm) × slowdownMult. */
export function driveHoursRemaining(
  remainingKm: number,
  totalKm: number,
  paramHours: number,
  slowdownMult = 1,
): number {
  if (totalKm <= 0) return paramHours * slowdownMult;
  return (remainingKm / totalKm) * paramHours * slowdownMult;
}

export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';

/* ---------- mapa (Leaflet CorridorMap / seed demo) — geometria permit_reference ---------- */

type Fc = {
  type: string;
  features: Array<{
    id?: string | number;
    properties?: Record<string, unknown> | null;
    geometry: { type: string; coordinates: number[][] };
  }>;
};

const fc = corridorFc as unknown as Fc;
const refFeature = fc.features.find(
  (f) => f.properties?.kind === 'permit_reference' || f.id === 'corridor-ref',
)!;

export const CORRIDOR_REF_COORDS: CorridorCoord[] = refFeature.geometry.coordinates.map(
  (c) => [c[0], c[1]] as CorridorCoord,
);

export const CORRIDOR_LINE = lineString(CORRIDOR_REF_COORDS);
export const CORRIDOR_LENGTH_KM = length(CORRIDOR_LINE, { units: 'kilometers' });

export const FERRY_LEG_COORDS: CorridorCoord[] = (
  fc.features.find((f) => f.properties?.kind === 'ferry_leg')?.geometry.coordinates ?? []
).map((c) => [c[0], c[1]] as CorridorCoord);

/** Progress → WGS84 position + heading along permit/reference corridor. */
export function positionAlongCorridor(progress: number): {
  lng: number;
  lat: number;
  heading: number;
  segment: 'PL_ROAD' | 'FERRY' | 'SE_ROAD';
} {
  const p = Math.max(0, Math.min(1, progress));
  const dist = p * CORRIDOR_LENGTH_KM;
  const pt = along(CORRIDOR_LINE, dist, { units: 'kilometers' });
  const [lng, lat] = pt.geometry.coordinates;
  const look = along(CORRIDOR_LINE, Math.min(CORRIDOR_LENGTH_KM, dist + 0.5), {
    units: 'kilometers',
  });
  const heading = bearing(point([lng, lat]), look);
  let segment: 'PL_ROAD' | 'FERRY' | 'SE_ROAD' = 'PL_ROAD';
  if (p >= 0.4 && p < 0.55) segment = 'FERRY';
  else if (p >= 0.55) segment = 'SE_ROAD';
  return { lng, lat, heading, segment };
}

export const CORRIDOR_GEOJSON = corridorFc as unknown as GeoJSON.FeatureCollection;
