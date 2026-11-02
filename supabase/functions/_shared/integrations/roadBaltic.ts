/**
 * BN6 (#716) — drogi LT/LV/EE/FI.
 * cz.1: Finlandia Digitraffic road (bez klucza, CC BY 4.0 Fintraffic).
 * Bufor korytarza 2 km; bbox FI musi mieścić się w [20,59,32,71].
 */
import type { RiskInput, RiskSeverity } from './sync.ts';
import { distanceToCorridorKm, seRoadSlowdownMult, type LatLon } from './road.ts';

export type BalticRoadCountry = 'LT' | 'LV' | 'EE' | 'FI';
export type BalticRoadKind = `ROAD_${BalticRoadCountry}`;

/** Vuosaari → Oulu → Tornio → Boden (bboxy wzdłuż trasy FI). */
export const CORRIDOR_FI: LatLon[] = [
  [60.212, 25.188], // Vuosaari
  [60.45, 25.1],
  [61.5, 25.7],
  [62.9, 25.7],
  [64.0, 25.5],
  [65.012, 25.47], // Oulu
  [65.74, 24.55], // Kemi
  [65.85, 24.15], // Tornio
  [65.83, 24.13], // Haparanda
  [65.805, 21.76], // Boden
];

/** Digitraffic road — dopuszczalny bbox [xMin,yMin,xMax,yMax] = [20,59,32,71]. */
export const FI_BBOX_LIMIT = { xMin: 20, yMin: 59, xMax: 32, yMax: 71 } as const;

export const FI_ROADWORKS_URL = 'https://tie.digitraffic.fi/api/traffic-message/v2/roadworks';
export const FI_ANNOUNCEMENTS_URL =
  'https://tie.digitraffic.fi/api/traffic-message/v2/traffic-announcements';
export const FI_WEIGHT_URL =
  'https://tie.digitraffic.fi/api/traffic-message/v2/weight-restrictions';

export const FI_ATTRIBUTION =
  'Source: Fintraffic / digitraffic.fi, license CC 4.0 BY';

export interface FiBbox {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** Bboxy wzdłuż CORRIDOR_FI — każdy w limicie Digitraffic. */
export function fiCorridorBboxes(): FiBbox[] {
  return [
    { xMin: 24.5, xMax: 26.5, yMin: 59.8, yMax: 61.5 },
    { xMin: 24.5, xMax: 26.8, yMin: 61.4, yMax: 63.5 },
    { xMin: 24.0, xMax: 26.5, yMin: 63.4, yMax: 65.2 },
    { xMin: 23.5, xMax: 26.5, yMin: 64.8, yMax: 66.2 },
    { xMin: 21.0, xMax: 25.0, yMin: 65.5, yMax: 66.5 },
  ];
}

export function fiBboxInLimit(b: FiBbox): boolean {
  return (
    b.xMin >= FI_BBOX_LIMIT.xMin
    && b.yMin >= FI_BBOX_LIMIT.yMin
    && b.xMax <= FI_BBOX_LIMIT.xMax
    && b.yMax <= FI_BBOX_LIMIT.yMax
    && b.xMin < b.xMax
    && b.yMin < b.yMax
  );
}

export function fiTrafficUrl(base: string, b: FiBbox): string {
  if (!fiBboxInLimit(b)) {
    throw new Error(
      `FI Digitraffic bbox poza [20,59,32,71]: ${b.xMin},${b.yMin},${b.xMax},${b.yMax}`,
    );
  }
  const q = new URLSearchParams({
    xMin: String(b.xMin),
    xMax: String(b.xMax),
    yMin: String(b.yMin),
    yMax: String(b.yMax),
  });
  return `${base}?${q.toString()}`;
}

export interface BalticRoadEvent {
  id: string;
  title: string;
  detail: string;
  severity: RiskSeverity;
  lat: number | null;
  lon: number | null;
  kind: string;
  start: string | null;
  end: string | null;
  /** Limit masy [t] gdy weight restriction. */
  weightLimitT?: number | null;
  heightLimitM?: number | null;
  widthLimitM?: number | null;
}

function featureCentroid(geom: unknown): LatLon | null {
  if (!geom || typeof geom !== 'object') return null;
  const g = geom as { type?: string; coordinates?: unknown };
  if (g.type === 'Point' && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
    const lon = Number(g.coordinates[0]);
    const lat = Number(g.coordinates[1]);
    return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : null;
  }
  const collect: number[][] = [];
  const walk = (c: unknown): void => {
    if (!Array.isArray(c)) return;
    if (typeof c[0] === 'number' && typeof c[1] === 'number') {
      collect.push([Number(c[0]), Number(c[1])]);
      return;
    }
    for (const x of c) walk(x);
  };
  walk(g.coordinates);
  if (!collect.length) return null;
  const lon = collect.reduce((a, p) => a + p[0], 0) / collect.length;
  const lat = collect.reduce((a, p) => a + p[1], 0) / collect.length;
  return [lat, lon];
}

function annTitle(props: Record<string, unknown>): string {
  const anns = props.announcements;
  if (!Array.isArray(anns) || !anns.length) return String(props.situationType ?? 'zdarzenie');
  const fi = anns.find((a) => a && typeof a === 'object' && (a as { language?: string }).language === 'fi')
    ?? anns[0];
  if (fi && typeof fi === 'object' && typeof (fi as { title?: string }).title === 'string') {
    return String((fi as { title: string }).title).trim() || String(props.situationType ?? 'zdarzenie');
  }
  return String(props.situationType ?? 'zdarzenie');
}

function annTimes(props: Record<string, unknown>): { start: string | null; end: string | null } {
  const anns = props.announcements;
  if (!Array.isArray(anns) || !anns.length) return { start: null, end: null };
  const a = anns[0] as { timeAndDuration?: { startTime?: string; endTime?: string } };
  const td = a?.timeAndDuration;
  return {
    start: typeof td?.startTime === 'string' ? td.startTime : null,
    end: typeof td?.endTime === 'string' ? td.endTime : null,
  };
}

function weightFromAnn(props: Record<string, unknown>): number | null {
  const anns = props.announcements;
  if (!Array.isArray(anns)) return null;
  for (const raw of anns) {
    if (!raw || typeof raw !== 'object') continue;
    const feats = (raw as { features?: unknown }).features;
    if (!Array.isArray(feats)) continue;
    for (const f of feats) {
      if (!f || typeof f !== 'object') continue;
      const name = String((f as { name?: string }).name ?? '').toLowerCase();
      const unit = String((f as { unit?: string }).unit ?? '').toLowerCase();
      const q = Number((f as { quantity?: number }).quantity);
      if (!Number.isFinite(q)) continue;
      if (name.includes('massa') || name.includes('mass') || unit === 't') return q;
    }
  }
  return null;
}

function situationSeverity(type: string, weightT: number | null): RiskSeverity {
  const t = type.toLowerCase();
  if (weightT != null) return 'HIGH';
  if (t.includes('accident') || t.includes('wypad')) return 'HIGH';
  if (t.includes('closed') || t.includes('zamkn')) return 'HIGH';
  if (t.includes('road work') || t.includes('robot')) return 'MEDIUM';
  if (t.includes('weight')) return 'HIGH';
  return 'MEDIUM';
}

/** Parsuje FeatureCollection Digitraffic traffic-message (roadworks / announcements / weight). */
export function parseFiTrafficMessages(json: unknown): BalticRoadEvent[] {
  if (!json || typeof json !== 'object') return [];
  const features = (json as { features?: unknown }).features;
  if (!Array.isArray(features)) return [];
  const out: BalticRoadEvent[] = [];
  for (const raw of features) {
    if (!raw || typeof raw !== 'object') continue;
    const f = raw as { geometry?: unknown; properties?: Record<string, unknown> };
    const props = f.properties ?? {};
    const id = String(props.situationId ?? '').trim();
    if (!id) continue;
    const pt = featureCentroid(f.geometry);
    const times = annTimes(props);
    const sitType = String(props.situationType ?? 'unknown');
    const weightT = weightFromAnn(props);
    out.push({
      id,
      title: annTitle(props),
      detail: sitType,
      severity: situationSeverity(sitType, weightT),
      lat: pt?.[0] ?? null,
      lon: pt?.[1] ?? null,
      kind: sitType,
      start: times.start,
      end: times.end,
      weightLimitT: weightT,
    });
  }
  return out;
}

/** Zostaw zdarzenia w buforze km od linii korytarza (domyślnie 2 km — BN6). */
export function filterNearCorridor(
  events: BalticRoadEvent[],
  line: LatLon[],
  bufferKm = 2,
): BalticRoadEvent[] {
  return events.filter((e) => {
    if (e.lat == null || e.lon == null) return false;
    return distanceToCorridorKm(e.lat, e.lon, line) <= bufferKm;
  });
}

export function balticRoadRisk(
  country: BalticRoadCountry,
  e: BalticRoadEvent,
  sourceUrl: string,
  attribution: string,
): RiskInput {
  const kind: BalticRoadKind = `ROAD_${country}`;
  /* BN6: brak końca zdarzenia → 24 h od teraz (odświeżenie przy następnym odczycie). */
  const validUntil = e.end
    ?? new Date(Date.now() + 24 * 3600_000).toISOString();
  return {
    kind,
    severity: e.severity,
    title: `Trasa ${country}: ${e.title}`,
    titleKey: 'rk_road_baltic',
    params: { country, event: e.title },
    detail: {
      opis: e.detail,
      rodzaj: e.kind,
      lat: e.lat,
      lon: e.lon,
      od: e.start,
      do: e.end,
      zrodlo: attribution,
      weight_limit_t: e.weightLimitT ?? null,
      height_limit_m: e.heightLimitM ?? null,
      width_limit_m: e.widthLimitM ?? null,
    },
    dedup: `${kind}:${e.id}`,
    sourceUrl,
    validUntil,
  };
}

/**
 * Limit masy/wymiarów: HIGH gdy ładunek > limit; MEDIUM gdy brak masy (ponadnormatywne — sprawdź zezwolenie).
 */
export function weightLimitRisk(
  country: BalticRoadCountry,
  e: BalticRoadEvent,
  loadTons: number | null,
  sourceUrl: string,
  attribution: string,
): RiskInput {
  const base = balticRoadRisk(country, e, sourceUrl, attribution);
  const limit = e.weightLimitT;
  if (limit == null) return base;
  if (loadTons != null && loadTons > limit) {
    return {
      ...base,
      severity: 'HIGH',
      title: `Trasa ${country}: limit masy ${limit} t (ładunek ${loadTons} t)`,
      titleKey: 'rk_road_baltic_weight',
      params: { country, event: e.title, limit, load: loadTons },
    };
  }
  return {
    ...base,
    severity: 'MEDIUM',
    title: `Trasa ${country}: limit masy ${limit} t — sprawdź zezwolenie / trasę`,
    titleKey: 'rk_road_baltic_weight_check',
    params: { country, event: e.title, limit },
  };
}

/** Spowolnienie jak SE — przy ≥1 adverse (tu: HIGH lub weight). */
export function balticSlowdownMult(
  events: BalticRoadEvent[],
  pct = 15,
): { mult: number; reason: string | null } {
  const adverse = events.filter(
    (e) => (e.severity === 'HIGH' || e.weightLimitT != null) && e.lat != null && e.lon != null,
  );
  return seRoadSlowdownMult({
    conditions: adverse.map((e) => ({
      id: e.id,
      road: null,
      text: e.title,
      code: null,
      location: '',
      lat: e.lat as number,
      lon: e.lon as number,
      start: e.start,
      adverse: true,
    })),
    weather: [],
    pct,
  });
}
