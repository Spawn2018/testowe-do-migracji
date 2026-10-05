/**
 * B-MAPA / Q-18 — czyste funkcje rysowania.
 * Bez sieci i bez kluczy. Geometria HERE nie jest tu zaszyta (D-81: najwyżej 30 dni w bazie).
 */

export const HERE_BUDGET_USD = 100;
/** Kafelki logistics.* to Advanced Raster Tile. Cennik bazowy: 0,0002 USD za transakcję. */
export const HERE_TILE_USD = 0.0002;
/** Próg B-MAPA: od 80% budżetu wspólnego mapy schodzą z kafelków HERE do końca miesiąca. */
export const HERE_TILE_STOP_USD = 80;
export const HERE_MAX_ZOOM = 19;

export type ThemeName = 'light' | 'dark';

export interface BasemapChoice {
  provider: 'here' | 'esri-streets' | 'carto';
  theme: ThemeName;
  style: 'logistics.day' | 'logistics.night' | null;
  url: string | null;
  attribution: string;
  maxZoom: number;
  hereRequests: boolean;
}

const ESRI_STREETS =
  'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}';
const ESRI_STREETS_ATTR =
  'Tiles &copy; Esri — Esri, HERE, Garmin, FAO, NOAA, USGS, &copy; OpenStreetMap contributors';
const CARTO_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
const CARTO_DARK_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';
const HERE_ATTR = '&copy; HERE';

export function warsawMonth(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  return `${y}-${m}`;
}

/** Wydatki z innego miesiąca nie trzymają map na zapasie. 1. dzień = nowy licznik. */
export function tilesOpen(spentUsd: number, spentMonth: string, now: Date): boolean {
  const month = spentMonth.slice(0, 7);
  if (month !== warsawMonth(now)) return true;
  return spentUsd < HERE_TILE_STOP_USD;
}

export function basemapFor(input: {
  theme: ThemeName;
  spentUsd: number;
  spentMonth: string;
  now: Date;
  allowHere?: boolean;
}): BasemapChoice {
  const theme = input.theme === 'dark' ? 'dark' : 'light';
  const open = input.allowHere !== false && tilesOpen(input.spentUsd, input.spentMonth, input.now);
  if (open) {
    return {
      provider: 'here',
      theme,
      style: theme === 'dark' ? 'logistics.night' : 'logistics.day',
      url: null,
      attribution: HERE_ATTR,
      maxZoom: HERE_MAX_ZOOM,
      hereRequests: true,
    };
  }
  if (theme === 'dark') {
    return {
      provider: 'carto',
      theme,
      style: null,
      url: CARTO_DARK,
      attribution: CARTO_DARK_ATTR,
      maxZoom: HERE_MAX_ZOOM,
      hereRequests: false,
    };
  }
  return {
    provider: 'esri-streets',
    theme,
    style: null,
    url: ESRI_STREETS,
    attribution: ESRI_STREETS_ATTR,
    maxZoom: HERE_MAX_ZOOM,
    hereRequests: false,
  };
}

/** Metry na piksel przy kafelku 256 px. Plac widać, gdy budynek ma kilkadziesiąt pikseli. */
export function metersPerPixel(lat: number, zoom: number): number {
  return (156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom;
}

const R_KM = 6371;
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(s)));
}

export type LatLng = readonly [number, number];

export function lineLengthKm(line: readonly LatLng[]): number {
  let s = 0;
  for (let i = 0; i < line.length - 1; i++) s += haversineKm(line[i][0], line[i][1], line[i + 1][0], line[i + 1][1]);
  return s;
}

export function maxSegmentKm(line: readonly LatLng[]): number {
  let m = 0;
  for (let i = 0; i < line.length - 1; i++) {
    m = Math.max(m, haversineKm(line[i][0], line[i][1], line[i + 1][0], line[i + 1][1]));
  }
  return m;
}

export function nearestKm(line: readonly LatLng[], lat: number, lng: number): number {
  let best = Infinity;
  for (const p of line) best = Math.min(best, haversineKm(p[0], p[1], lat, lng));
  return best;
}

export interface RoadSpec {
  minPoints: number;
  maxSegKm: number;
  minKm: number;
  maxKm: number;
  via: ReadonlyArray<{ lat: number; lng: number; km: number }>;
}

/** Śrem–Gdańsk: gęsta geometria przez Gniezno i Świecie (S5), nie cięciwa. */
export const ROAD_PL: RoadSpec = {
  minPoints: 500,
  maxSegKm: 3,
  minKm: 280,
  maxKm: 420,
  via: [
    { lat: 52.07391, lng: 17.0246, km: 2 },
    { lat: 52.535, lng: 17.6, km: 8 },
    { lat: 53.41, lng: 18.45, km: 3 },
    { lat: 54.40372, lng: 18.6813, km: 2 },
  ],
};

/** Nynäshamn–Boden: E4, mija Gävle i Sundsvall. */
export const ROAD_SE: RoadSpec = {
  minPoints: 2000,
  maxSegKm: 3,
  minKm: 900,
  maxKm: 1150,
  via: [
    { lat: 58.90453, lng: 17.95621, km: 2 },
    { lat: 60.67, lng: 17.14, km: 8 },
    { lat: 62.39, lng: 17.31, km: 8 },
    { lat: 65.80539, lng: 21.75914, km: 2 },
  ],
};

export function looseRoadOk(line: readonly LatLng[]): boolean {
  return line.length >= 200 && maxSegmentKm(line) <= 3 && lineLengthKm(line) >= 80;
}

export function roadGeometryOk(line: readonly LatLng[], spec: RoadSpec): boolean {
  if (line.length < spec.minPoints) return false;
  if (maxSegmentKm(line) > spec.maxSegKm) return false;
  const len = lineLengthKm(line);
  if (len < spec.minKm || len > spec.maxKm) return false;
  return spec.via.every((v) => nearestKm(line, v.lat, v.lng) <= v.km);
}

/**
 * Route Matching v8 nie jest w planie Base (od marca 2025 tylko Enterprise).
 * Zmiana planu jest zakazana. Ślad rysujemy z surowych punktów GPS.
 */
export const TRAIL_SOURCE = 'points' as const;

export function trailForDraw<T extends { lat: number; lng: number }>(points: readonly T[]): {
  source: 'points';
  matched: false;
  line: T[];
} {
  return { source: TRAIL_SOURCE, matched: false, line: points.map((p) => ({ ...p })) };
}

export function rawGps(fix: { lat: number; lng: number }): { lat: number; lng: number } {
  return { lat: fix.lat, lng: fix.lng };
}

/** Warstwa H-6 jest w kodzie i zostaje wyłączona, dopóki flaga i stała nie są razem prawdziwe. Stała jest fałszem. */
export const H6_LAYER_ENABLED = false;

export function h6Requests(flagFromDb: boolean, hasDims: boolean): boolean {
  const enabled: boolean = H6_LAYER_ENABLED;
  return enabled && flagFromDb && hasDims;
}

export interface PortZone {
  id: 'GDN' | 'GDY' | 'NYN' | 'KAA';
  country: 'PL' | 'SE';
  lat: number;
  lng: number;
  radiusKm: number;
}

export const PORT_ZONES: readonly PortZone[] = [
  { id: 'GDN', country: 'PL', lat: 54.4, lng: 18.67, radiusKm: 6 },
  { id: 'GDY', country: 'PL', lat: 54.533, lng: 18.55, radiusKm: 5 },
  { id: 'NYN', country: 'SE', lat: 58.912, lng: 17.955, radiusKm: 4 },
  { id: 'KAA', country: 'SE', lat: 56.161, lng: 15.586, radiusKm: 4 },
];

export function zoneAt(lat: number, lng: number): PortZone | null {
  let best: PortZone | null = null;
  let bestD = Infinity;
  for (const z of PORT_ZONES) {
    const d = haversineKm(lat, lng, z.lat, z.lng);
    if (d <= z.radiusKm && d < bestD) {
      best = z;
      bestD = d;
    }
  }
  return best;
}

export interface TrackFix {
  id: string;
  lat: number;
  lng: number;
  ts: string;
  /** Pole destination z AIS. Tylko potwierdzenie, nie przełącza kierunku. */
  destination?: string | null;
}

/**
 * Widoczny wyłącznie od wyjścia ze strefy portu w Polsce do wejścia w strefę portu w Szwecji.
 * Kierunek bierze się z wyjścia ze strefy. Postój i rejs do Polski są niewidoczne.
 */
export function sailingToSweden(history: readonly TrackFix[]): boolean {
  const sorted = [...history].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  if (sorted.length === 0) return false;
  let phase: 'unknown' | 'to-se' | 'to-pl' | 'in-port' = 'unknown';
  let prev = zoneAt(sorted[0].lat, sorted[0].lng);
  if (prev) phase = 'in-port';
  for (let i = 1; i < sorted.length; i++) {
    const z = zoneAt(sorted[i].lat, sorted[i].lng);
    if (prev && prev.country === 'PL' && !z) phase = 'to-se';
    else if (prev && prev.country === 'SE' && !z) phase = 'to-pl';
    else if (z) phase = 'in-port';
    prev = z;
  }
  return phase === 'to-se';
}

export function markersSailingToSweden<T extends TrackFix>(rows: readonly T[]): T[] {
  const byId = new Map<string, T[]>();
  for (const row of rows) {
    const list = byId.get(row.id);
    if (list) list.push(row);
    else byId.set(row.id, [row]);
  }
  const out: T[] = [];
  for (const list of byId.values()) {
    if (!sailingToSweden(list)) continue;
    const latest = [...list].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts)).at(-1);
    if (latest) out.push(latest);
  }
  return out;
}

type Xy = readonly [number, number];

function orient(a: Xy, b: Xy, c: Xy): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function segmentsCross(a: Xy, b: Xy, c: Xy, d: Xy): boolean {
  const o1 = orient(a, b, c);
  const o2 = orient(a, b, d);
  const o3 = orient(c, d, a);
  const o4 = orient(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

function pointInRing(p: Xy, ring: readonly Xy[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const hit = yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

/** Pierścienie lądu [lng, lat]. Uproszczone, tylko do testu że linia nie tnie lądu. */
export const LAND_RINGS: readonly (readonly Xy[])[] = [
  [
    [18.05, 56.95],
    [18.02, 57.25],
    [18.08, 57.75],
    [18.4, 57.98],
    [19.2, 57.9],
    [19.35, 57.3],
    [18.5, 56.92],
    [18.05, 56.95],
  ],
  [
    [15.7, 56.06],
    [15.78, 56.13],
    [15.9, 56.12],
    [15.88, 56.05],
    [15.7, 56.06],
  ],
];

export function segmentHitsLand(aLng: number, aLat: number, bLng: number, bLat: number): boolean {
  const a: Xy = [aLng, aLat];
  const b: Xy = [bLng, bLat];
  for (const ring of LAND_RINGS) {
    if (pointInRing(a, ring) || pointInRing(b, ring)) return true;
    for (let i = 0; i < ring.length - 1; i++) {
      if (segmentsCross(a, b, ring[i], ring[i + 1])) return true;
    }
  }
  return false;
}

export function lineHitsLand(line: readonly Xy[]): boolean {
  for (let i = 0; i < line.length - 1; i++) {
    if (segmentHitsLand(line[i][0], line[i][1], line[i + 1][0], line[i + 1][1])) return true;
  }
  return false;
}

/** Tory wodne [lng, lat]. Nie są geometrią HERE. */
export const WATER_GDN_NYN: readonly Xy[] = [
  [18.67, 54.4],
  [18.9, 54.85],
  [18.7, 55.6],
  [18.15, 56.4],
  [17.55, 57.1],
  [17.45, 57.7],
  [17.7, 58.3],
  [17.95, 58.75],
  [17.97, 58.91],
];

export const WATER_GDY_KAA: readonly Xy[] = [
  [18.54, 54.533],
  [18.85, 54.9],
  [17.6, 55.35],
  [16.5, 55.75],
  [16.05, 56.02],
  [15.95, 56.16],
  [15.63, 56.161],
];

export const STRAIGHT_GDN_NYN: readonly Xy[] = [
  [18.67, 54.4],
  [17.95, 58.9],
];

export const STRAIGHT_GDY_KAA: readonly Xy[] = [
  [18.54, 54.533],
  [15.586, 56.161],
];
