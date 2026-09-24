/** Corridor geometry helpers — Turf along(corridor_ref, progress). Permit/reference only — NOT ORS legal. */
import along from '@turf/along';
import length from '@turf/length';
import bearing from '@turf/bearing';
import { lineString, point } from '@turf/helpers';
import corridorFc from '../data/corridor_ref.json';

export type CorridorCoord = [number, number]; // [lng, lat]

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

/** Live map engine = Leaflet (`CorridorMap.tsx`). MapLibre styles/deps removed (D21). */
