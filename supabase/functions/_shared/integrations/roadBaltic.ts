/**
 * BN6 (#716) — drogi LT/LV/EE/FI.
 * cz.1: Finlandia Digitraffic road (bez klucza, CC BY 4.0 Fintraffic).
 * cz.2: Litwa eismoinfo restrictions + weather (bez klucza; Via Lietuva).
 * cz.3: Łotwa LVC/transportdata.gov.lv — 22 zbiory `LV_NAP_<KOD>_{KEY,URL}` (#589).
 * Do BN7 (geometria trasy): filtr bboxami korytarza (F7 #726 B2); FI bbox w [20,59,32,71].
 * LT: źródło nie podaje wypadków — zapis w detail / corridor note.
 */
import type { RiskInput, RiskSeverity } from './sync.ts';
import { type LatLon } from './road.ts';

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

export type BalticCorridorRoadMatch = 'on' | 'off' | 'unknown';

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
  /** Numer drogi z street/roadNumber/opisu (A5, E67, 134…). */
  road?: string | null;
  /**
   * DP-164: dopasowanie do listy dróg korytarza (do BN7).
   * `on` — A5/A8/A10/E67 (+ A1 przy Kownie LT; A7/A1 LV); `off` — znany numer poza listą;
   * `unknown` — numer nie wynika z danych.
   */
  corridorMatch?: BalticCorridorRoadMatch;
  /** Limit masy [t] gdy weight restriction. */
  weightLimitT?: number | null;
  heightLimitM?: number | null;
  widthLimitM?: number | null;
  /** F7 #730 N6 — nacisk osi / długość → dimensionLimitRisk. */
  axleWeightLimitT?: number | null;
  lengthLimitM?: number | null;
  /** Widoczność [m] z DATEX (LV). */
  visibilityM?: number | null;
  /** Objazd / rerouting w rekordzie (B7: długie zamknięcie z objazdem → MEDIUM). */
  hasDetour?: boolean;
  /** Zamknięcie drogi (LT roadClosed / LV roadClosed / „eismas draudžiamas”). */
  roadClosed?: boolean;
  /** #716 LT: nieznane kody restrictionType (LD/SVKD) → detail.oryginal. */
  unknownCodes?: string[];
}

/** F7 #730 r2 — prefiks dedup, żeby stare HIGH dostały resolveStale (raise bez UPDATE wagi). */
export const BALTIC_RISK_DEDUP_VER = 'v2';

/** F7 #730 r2 B1 — usuń fragment opisu objazdu (nie bierz stamtąd numeru drogi). */
export function stripBalticDetourText(text: string): string {
  return String(text ?? '').replace(
    /(?:^|[\s,.;:])(?:apylank\w*|apbraukš\w*|apbrauk\w*|apvedceļ\w*|apvedcel\w*|objazd\w*|detour\w*|rerout\w*)\b[\s\S]*$/i,
    ' ',
  );
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

/** Czy punkt leży w którymkolwiek bboxie korytarza (lon=x, lat=y). */
export function eventInFiBboxes(
  e: Pick<BalticRoadEvent, 'lat' | 'lon'>,
  boxes: FiBbox[] = fiCorridorBboxes(),
): boolean {
  if (e.lat == null || e.lon == null) return false;
  const { lat, lon } = e;
  return boxes.some(
    (b) => lon >= b.xMin && lon <= b.xMax && lat >= b.yMin && lat <= b.yMax,
  );
}

/**
 * F7 #726 B2 / #716 §3.2: do geometrii trasy (BN7) filtruj bboxami korytarza,
 * bez bufora 2 km od rzadkiej polilinii CORRIDOR_FI.
 */
export function filterInFiBboxes(
  events: BalticRoadEvent[],
  boxes: FiBbox[] = fiCorridorBboxes(),
): BalticRoadEvent[] {
  return events.filter((e) => eventInFiBboxes(e, boxes));
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
      ...(e.unknownCodes?.length ? { oryginal: e.unknownCodes.join(',') } : {}),
    },
    dedup: `${kind}:${BALTIC_RISK_DEDUP_VER}:${e.id}`,
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

function balticIsWeatherSlowEvent(e: BalticRoadEvent): boolean {
  const k = String(e.kind ?? '');
  return k === 'weather'
    || k.startsWith('SLIPPERY_')
    || k.startsWith('EXC_WEATHER_')
    || k.startsWith('WEATHER_SAFETY_')
    || k.startsWith('POOR_ROAD_');
}

/**
 * Spowolnienie jak SE — tylko HIGH na drogach korytarza (`corridorMatch=on`),
 * bez limitu masy/wysokości/szerokości (F7 #726/#727 B2).
 * DP-164: poza listą / bez numeru → bez spowolnienia; reason „zamknięcia: N” / „pogoda: N”
 * (nie „nawierzchnia N” z SE RoadCondition).
 */
export function balticSlowdownMult(
  events: BalticRoadEvent[],
  pct = 15,
): { mult: number; reason: string | null } {
  const adverse = events.filter(
    (e) => e.severity === 'HIGH'
      && e.weightLimitT == null
      && e.heightLimitM == null
      && e.widthLimitM == null
      && e.lat != null
      && e.lon != null
      /* DP-164: off/unknown bez slowdown; null = FI (i inne) bez filtra jeszcze. */
      && e.corridorMatch !== 'off'
      && e.corridorMatch !== 'unknown',
  );
  if (!adverse.length) return { mult: 1, reason: null };
  const weatherN = adverse.filter(balticIsWeatherSlowEvent).length;
  const closeN = adverse.length - weatherN;
  const bits: string[] = [];
  if (closeN) bits.push(`zamknięcia: ${closeN}`);
  if (weatherN) bits.push(`pogoda: ${weatherN}`);
  return {
    mult: Math.round((1 + pct / 100) * 100) / 100,
    reason: bits.join(', ') || null,
  };
}

/**
 * DP-164 / F7 #730 r2 B1 — wyciąg numeru drogi.
 * Najpierw street / roadNumber; opis dopiero po `stripBalticDetourText`
 * (nigdy z fragmentu po słowach objazdu: apylank, objazd, apbrauk).
 * Kod „A01_…” / „0001… A01_…” → A1.
 */
export function extractBalticRoadRef(text: string): string | null {
  const t = String(text ?? '').trim();
  if (!t) return null;
  /* LT kod węzła: A01_113… → A1 */
  const a0 = t.match(/\bA0*(\d{1,2})(?:_\d|\b)/i);
  if (a0) return `A${Number(a0[1])}`;
  const a = t.match(/\bA\s*(\d{1,2})\b/i);
  if (a) return `A${a[1]}`;
  const e = t.match(/\bE\s*(\d{2,3})\b/i);
  if (e) return `E${e[1]}`;
  /* LV drogi regionalne P/V — znany numer → corridorMatch=off (F7 #730 B7). */
  const pv = t.match(/\b([PV])\s*(\d{1,4})\b/i);
  if (pv) return `${pv[1].toUpperCase()}${pv[2]}`;
  /* krašto / rajoninis: „134 Name…” na początku street */
  const n = t.match(/^(\d{1,4})\b/);
  if (n) return n[1];
  return null;
}

/** Street → title/detail (bez opisu objazdu). */
export function extractBalticRoadRefPreferStreet(
  street: string | null | undefined,
  ...rest: Array<string | null | undefined>
): string | null {
  const fromStreet = extractBalticRoadRef(String(street ?? '').trim());
  if (fromStreet) return fromStreet;
  for (const part of rest) {
    const hit = extractBalticRoadRef(stripBalticDetourText(String(part ?? '')));
    if (hit) return hit;
  }
  return null;
}

/** Haversine [km] — punkt ↔ punkt. */
export function haversineKm(a: LatLon, b: LatLon): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const la1 = toRad(a[0]);
  const la2 = toRad(b[0]);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Zagęszczenie polilinii korytarza (~co stepKm) do filtra odległości (F7 #730 B7). */
export function densifyCorridor(pts: LatLon[], stepKm = 2): LatLon[] {
  if (pts.length < 2) return [...pts];
  const out: LatLon[] = [pts[0]!];
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i]!;
    const b = pts[i + 1]!;
    const d = haversineKm(a, b);
    const n = Math.max(1, Math.ceil(d / stepKm));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return out;
}

/** Min. odległość [km] od zagęszczonego korytarza. */
export function minDistToCorridorKm(
  lat: number,
  lon: number,
  corridor: LatLon[],
  densified?: LatLon[],
): number {
  const pts = densified ?? densifyCorridor(corridor);
  let best = Infinity;
  for (const p of pts) {
    const d = haversineKm([lat, lon], p);
    if (d < best) best = d;
  }
  return best;
}

/**
 * F7 #730 r2 B2 / decyzja 85: HIGH tylko zamknięcie drogi korytarza bez objazdu
 * albo ze znanym końcem ≤ 72 h; objazd + brak końca / > 72 h → MEDIUM.
 * Wspólne LT+LV — flaga `roadClosed` (nie regex po „clos” w kind).
 */
export function balticCapLongDetourClosure(e: BalticRoadEvent): BalticRoadEvent {
  if (e.severity !== 'HIGH') return e;
  if (e.weightLimitT != null) return e;
  const closed = e.roadClosed === true
    || e.kind === 'CLOSURES'
    || e.kind === 'BLOCKAGE';
  if (!closed) return e;
  const blob = `${e.title ?? ''} ${e.detail ?? ''}`;
  const hasDetour = e.hasDetour === true
    || /(?:apylank\w*|apbraukš\w*|apbrauk\w*|apvedceļ\w*|apvedcel\w*|objazd\w*|detour\w*|rerout\w*)/i
      .test(blob);
  if (!hasDetour) return { ...e, roadClosed: true };
  /* Objazd: bez końca albo > 72 h → MEDIUM (bez spowolnienia). */
  if (e.end == null || e.start == null) {
    return { ...e, severity: 'MEDIUM', hasDetour: true, roadClosed: true };
  }
  const a = Date.parse(e.start);
  const b = Date.parse(e.end);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) {
    return { ...e, severity: 'MEDIUM', hasDetour: true, roadClosed: true };
  }
  const hours = (b - a) / 3_600_000;
  if (hours > 72) return { ...e, severity: 'MEDIUM', hasDetour: true, roadClosed: true };
  return { ...e, hasDetour: true, roadClosed: true };
}

/** LT: A5, A8, A10, E67 + A1 tylko w bboxie Kowna (F7 #730 r2 B1 — nie po tekście). */
export function ltRoadOnCorridor(
  road: string | null | undefined,
  e: Pick<BalticRoadEvent, 'lat' | 'lon' | 'title' | 'detail'>,
): BalticCorridorRoadMatch {
  if (road == null || road === '') return 'unknown';
  const r = road.toUpperCase().replace(/\s+/g, '');
  if (r === 'A5' || r === 'A8' || r === 'A10' || r === 'E67') return 'on';
  if (r === 'A1') {
    if (
      e.lat != null && e.lon != null
      && e.lat >= 54.85 && e.lat <= 54.98
      && e.lon >= 23.75 && e.lon <= 24.05
    ) {
      return 'on';
    }
    return 'off';
  }
  return 'off';
}

/**
 * LV: A7/E67 + A1 (do EE) + obwodnica Rygi A4/A5 (F7 #730 B7).
 * Znany numer poza listą (P/V, A12…) → off.
 */
export function lvRoadOnCorridor(road: string | null | undefined): BalticCorridorRoadMatch {
  if (road == null || road === '') return 'unknown';
  const r = road.toUpperCase().replace(/\s+/g, '');
  if (r === 'A7' || r === 'E67' || r === 'A1' || r === 'A4' || r === 'A5') return 'on';
  return 'off';
}

function balticCapSeverity(
  severity: RiskSeverity,
  match: BalticCorridorRoadMatch,
): RiskSeverity {
  if (match === 'off') return 'LOW';
  if (match === 'unknown' && severity === 'HIGH') return 'MEDIUM';
  return severity;
}

/**
 * DP-164 + F7 #730 B7/r2: oznacz road + corridorMatch; poza listą / bez numeru
 * obniż severity; LV unknown w ≤ 3 km od CORRIDOR_LV → on; długie zamknięcie
 * z objazdem → MEDIUM. Pogoda/śliskość: tylko ≤ 3 km od korytarza (r2 decyzja).
 */
export function applyBalticCorridorRoadFilter(
  country: 'LT' | 'LV',
  events: BalticRoadEvent[],
): BalticRoadEvent[] {
  const densified = densifyCorridor(country === 'LV' ? CORRIDOR_LV : CORRIDOR_LT);
  const corridor = country === 'LV' ? CORRIDOR_LV : CORRIDOR_LT;
  return events.map((e) => {
    const capped = balticCapLongDetourClosure(e);
    const weatherLike = capped.kind === 'weather' || balticIsWeatherSlowEvent(capped);
    if (weatherLike) {
      const nearWx = capped.lat != null && capped.lon != null
        && minDistToCorridorKm(capped.lat, capped.lon, corridor, densified) <= 3;
      return {
        ...capped,
        corridorMatch: (nearWx ? 'on' : 'off') as BalticCorridorRoadMatch,
        road: capped.road ?? null,
        severity: nearWx ? capped.severity : 'LOW' as RiskSeverity,
      };
    }
    const road = capped.road
      ?? extractBalticRoadRefPreferStreet(null, capped.title, capped.detail);
    let corridorMatch: BalticCorridorRoadMatch = country === 'LT'
      ? ltRoadOnCorridor(road, capped)
      : lvRoadOnCorridor(road);
    /* F7 #730 B7: bez numeru, ale ≤ 3 km od polilinii LV → on. */
    if (
      country === 'LV'
      && corridorMatch === 'unknown'
      && capped.lat != null
      && capped.lon != null
      && minDistToCorridorKm(capped.lat, capped.lon, CORRIDOR_LV, densified) <= 3
    ) {
      corridorMatch = 'on';
    }
    return {
      ...capped,
      road,
      corridorMatch,
      severity: balticCapSeverity(capped.severity, corridorMatch),
    };
  });
}

/** DP-164: po weightLimitRisk / dimensionLimitRisk — ponowne obniżenie severity. */
export function capBalticRiskSeverity(
  risk: RiskInput,
  match: BalticCorridorRoadMatch | undefined,
): RiskInput {
  if (match == null || match === 'on') return risk;
  const next = balticCapSeverity(risk.severity, match);
  return next === risk.severity ? risk : { ...risk, severity: next };
}

/**
 * F7 #727 B2 — limity wysokości/szerokości / słaby most: MEDIUM „sprawdź…”,
 * bez wpływu na spowolnienie (jak weightLimitRisk bez masy ładunku).
 */
export function dimensionLimitRisk(
  country: BalticRoadCountry,
  e: BalticRoadEvent,
  sourceUrl: string,
  attribution: string,
): RiskInput {
  const base = balticRoadRisk(country, e, sourceUrl, attribution);
  const bits: string[] = [];
  if (e.heightLimitM != null) bits.push(`wysokość ${e.heightLimitM} m`);
  if (e.widthLimitM != null) bits.push(`szerokość ${e.widthLimitM} m`);
  if (e.lengthLimitM != null) bits.push(`długość ${e.lengthLimitM} m`);
  if (e.axleWeightLimitT != null) bits.push(`nacisk osi ${e.axleWeightLimitT} t`);
  const kindLow = (e.kind ?? '').toLowerCase();
  if (kindLow.includes('weakbridge') || kindLow.includes('damagedbridge')) {
    bits.push('słaby most');
  }
  const what = bits.length ? bits.join(' / ') : 'wymiary';
  return {
    ...base,
    severity: 'MEDIUM',
    title: `Trasa ${country}: sprawdź ${what} / trasę`,
    titleKey: 'rk_road_baltic_dim_check',
    params: {
      country,
      event: e.title,
      height: e.heightLimitM ?? null,
      width: e.widthLimitM ?? null,
      length: e.lengthLimitM ?? null,
      axle: e.axleWeightLimitT ?? null,
    },
  };
}

/** Czy zdarzenie to limit wymiarów / most / oś / długość bez limitu masy → dimensionLimitRisk. */
export function isDimensionLimitEvent(e: BalticRoadEvent): boolean {
  if (e.weightLimitT != null) return false;
  if (
    e.heightLimitM != null
    || e.widthLimitM != null
    || e.axleWeightLimitT != null
    || e.lengthLimitM != null
  ) {
    return true;
  }
  const k = (e.kind ?? '').toLowerCase();
  return k.includes('weakbridge') || k.includes('damagedbridge');
}

/* ---------- Litwa — Via Lietuva / eismoinfo.lt (#716 cz.2) ---------- */

/** Via Baltica PL→LT→LV (załadunek → Tallinn/Muuga/Paldiski); do BN7 bboxy zamiast 2 km. */
export const CORRIDOR_LT: LatLon[] = [
  [54.40, 22.90], // granica PL/LT Kalvarija
  [54.56, 23.35], // Marijampolė
  [54.90, 23.90], // Kaunas
  [55.30, 24.15],
  [55.73, 24.35], // Panevėžys
  [56.05, 24.40], // Pasvalys
  [56.25, 24.45], // granica LT/LV
];

export const LT_RESTRICTIONS_URL = 'https://restrictions.eismoinfo.lt/';
export const LT_WEATHER_URL = 'https://eismoinfo.lt/weather-conditions-service';
export const LT_ATTRIBUTION = 'Via Lietuva (eismoinfo.lt)';
export const LT_UA = 'WatchTower/BN6 (log-mar.pl; road-lt; +48 kontakt HHL)';

/** Bboxy wzdłuż CORRIDOR_LT — filtr zdarzeń do BN7. */
export function ltCorridorBboxes(): FiBbox[] {
  return [
    { xMin: 22.5, xMax: 24.0, yMin: 54.2, yMax: 55.0 },
    { xMin: 23.2, xMax: 24.8, yMin: 54.7, yMax: 55.6 },
    { xMin: 23.8, xMax: 25.2, yMin: 55.4, yMax: 56.4 },
  ];
}

export function eventInLtBboxes(
  e: Pick<BalticRoadEvent, 'lat' | 'lon'>,
  boxes: FiBbox[] = ltCorridorBboxes(),
): boolean {
  return eventInFiBboxes(e, boxes);
}

export function filterInLtBboxes(
  events: BalticRoadEvent[],
  boxes: FiBbox[] = ltCorridorBboxes(),
): BalticRoadEvent[] {
  return events.filter((e) => eventInLtBboxes(e, boxes));
}

/** polyline „lat lon lat lon…” → centroid [lat, lon]. */
export function parseLtPolylineCentroid(polyline: string | null | undefined): LatLon | null {
  if (!polyline || typeof polyline !== 'string') return null;
  const nums = polyline.trim().split(/\s+/).map(Number).filter((n) => Number.isFinite(n));
  if (nums.length < 2) return null;
  let lat = 0;
  let lon = 0;
  let n = 0;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    lat += nums[i];
    lon += nums[i + 1];
    n++;
  }
  return n ? [lat / n, lon / n] : null;
}

function ltRestrictionMeta(restrictions: unknown): {
  weightLimitT: number | null;
  heightLimitM: number | null;
  widthLimitM: number | null;
  roadClosed: boolean;
  speedLimit: number | null;
  unknownCodes: string[];
} {
  const unknownCodes: string[] = [];
  let weightLimitT: number | null = null;
  let heightLimitM: number | null = null;
  let widthLimitM: number | null = null;
  let roadClosed = false;
  let speedLimit: number | null = null;
  if (!Array.isArray(restrictions)) {
    return {
      weightLimitT, heightLimitM, widthLimitM, roadClosed, speedLimit, unknownCodes,
    };
  }
  for (const raw of restrictions) {
    if (!raw || typeof raw !== 'object') continue;
    const t = String((raw as { restrictionType?: string }).restrictionType ?? '').trim();
    const v = Number((raw as { value?: number }).value);
    if (t === 'weightLimit' || t === 'axleWeightLimit') {
      if (Number.isFinite(v)) weightLimitT = v;
    } else if (t === 'heightLimit') {
      if (Number.isFinite(v)) heightLimitM = v;
    } else if (t === 'widthLimit') {
      if (Number.isFinite(v)) widthLimitM = v;
    } else if (t === 'roadClosed') {
      roadClosed = true;
    } else if (t === 'speedLimit') {
      if (Number.isFinite(v)) speedLimit = v;
    } else if (t === 'LD' || t === 'SVKD') {
      /* #716: kody nieznane — surowe w detail.oryginal, bez interpretacji. */
      unknownCodes.push(t);
    }
  }
  return {
    weightLimitT, heightLimitM, widthLimitM, roadClosed, speedLimit, unknownCodes,
  };
}

/** F7 #727 N1 — zwężenie / wahadło / objazd w opisie LT. */
function ltNarrowOrDetour(text: string): boolean {
  return /(?:^|[^a-ząčęėįšųūž])(?:juost|lane|apylank|objazd|detour|wahadl|alternat|vienos\s+juostos)(?:[^a-ząčęėįšųūž]|$)/i
    .test(text);
}

/**
 * F7 #727 B2/N1: HIGH tylko zamknięcie / powódź;
 * limity H/W i most → MEDIUM; zwykłe CONSTRUCTION + speedLimit → LOW.
 */
function ltSeverity(
  type: string,
  subtype: string | null,
  meta: ReturnType<typeof ltRestrictionMeta>,
  text: string,
): RiskSeverity {
  if (meta.roadClosed) return 'HIGH';
  const sub = (subtype ?? '').toLowerCase();
  if (sub.includes('flood')) return 'HIGH';
  if (meta.weightLimitT != null) return 'HIGH';
  if (
    meta.heightLimitM != null
    || meta.widthLimitM != null
    || sub.includes('weakbridge')
    || sub.includes('damagedbridge')
  ) {
    return 'MEDIUM';
  }
  if (type.toUpperCase() === 'CONSTRUCTION') {
    if (ltNarrowOrDetour(text)) return 'MEDIUM';
    /* Sam speedLimit (albo brak innych limitów) → LOW jak SE. */
    if (meta.speedLimit != null) return 'LOW';
    return 'MEDIUM';
  }
  return 'MEDIUM';
}

/** Waze CIFS-podobny feed restrictions.eismoinfo.lt (tablica obiektów). */
export function parseLtRestrictions(json: unknown): BalticRoadEvent[] {
  if (!Array.isArray(json)) return [];
  const out: BalticRoadEvent[] = [];
  for (const raw of json) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    const id = String(o._id ?? o.id ?? '').trim();
    if (!id) continue;
    const loc = (o.location && typeof o.location === 'object')
      ? o.location as { polyline?: string; street?: string }
      : {};
    const pt = parseLtPolylineCentroid(loc.polyline);
    const meta = ltRestrictionMeta(o.restrictions);
    const type = String(o.type ?? 'HAZARD');
    const subtype = o.subtype == null ? null : String(o.subtype);
    const title = String(o.shortDescription ?? o.description ?? subtype ?? type).trim() || type;
    const desc = String(o.description ?? '').trim();
    const street = loc.street ? String(loc.street) : '';
    const detailParts = [
      desc,
      street ? `ul. ${street}` : '',
    ].filter(Boolean);
    /* F7 #727 N2: uwaga o wypadkach tylko w corridor / risk.uwaga_wypadki, nie w każdym detail. */
    const textForSev = `${title} ${desc}`;
    /* F7 #730 r2 B1: numer najpierw ze street; opis bez fragmentu objazdu. */
    const road = extractBalticRoadRefPreferStreet(street, title, desc);
    const closedByText = /eismas\s+draudžiamas|uždarytas|uzdarytas/i.test(textForSev);
    const hasDetour = /(?:apylank\w*|apbrauk\w*|apvedceļ\w*|objazd\w*|detour\w*|rerout\w*)/i
      .test(textForSev);
    const roadClosed = meta.roadClosed || closedByText;
    const metaClosed = { ...meta, roadClosed };
    out.push({
      id,
      title,
      detail: detailParts.join(' · '),
      severity: ltSeverity(type, subtype, metaClosed, textForSev),
      lat: pt?.[0] ?? null,
      lon: pt?.[1] ?? null,
      kind: subtype ?? type,
      start: typeof o.startTime === 'string' ? o.startTime : null,
      end: typeof o.endTime === 'string' ? o.endTime : null,
      road,
      weightLimitT: meta.weightLimitT,
      heightLimitM: meta.heightLimitM,
      widthLimitM: meta.widthLimitM,
      roadClosed,
      hasDetour,
      unknownCodes: meta.unknownCodes.length ? meta.unknownCodes : undefined,
    });
  }
  return out;
}

export interface LtWeatherStation {
  id: string;
  lat: number;
  lon: number;
  friction: number | null;
  surface: string | null;
  visibilityM: number | null;
  warning: string | null;
  adverse: boolean;
  title: string;
}

/** Próg przyczepności — poniżej = ślisko (spowolnienie korytarza). */
export const LT_FRICTION_ADVERSE = 0.4;

/**
 * F7 #727 B1/N3 + DP-160 + F7 #730 N1 — lód / gołoledź / szron / śnieg / błoto pośniegowe.
 * Mokro/wilgotno (šlapia/drėgna/sausa) NIE jest niekorzystne.
 * F7 #730 N1: rdzenie bez końcowej granicy słowa (`šerkšn`→Šerkšnas, `apled`, `ledo`, `užsnig`).
 */
export const LT_ICY_RE =
  /(?:^|[^a-ząčęėįšųūžA-ZĄČĘĖĮŠŲŪŽ])(?:apled\w*|ledas|ledo\w*|plikled\w*|pliklus|lijundr\w*|sniegas|sniego|snieg\w*|užsnig\w*|šerkšn\w*|sersn\w*|šlapdrib\w*|slapdrib\w*|ice|snow|go[lł]oled\w*|b[lł]ot(?:o)?\s*po[sś]nieg\w*)/i;

/** Kody ostrzeżeń LT = warunki dobre / deszcz / mokra nawierzchnia — nie adverse. */
const LT_WARN_BENIGN = /^(NMS|GS|PS|KR\d*|KDB_00[23])$/i;

/** perspejimai: string albo tablica {pavadinimas,kodas} (prawdziwy feed). */
export function ltPerspejimaiText(raw: unknown): {
  text: string | null;
  codes: string[];
  danger: boolean;
} {
  if (raw == null || raw === '') return { text: null, codes: [], danger: false };
  if (Array.isArray(raw)) {
    const parts: string[] = [];
    const codes: string[] = [];
    for (const item of raw) {
      if (item && typeof item === 'object') {
        const o = item as { pavadinimas?: unknown; kodas?: unknown };
        const code = o.kodas == null ? '' : String(o.kodas).trim();
        const name = o.pavadinimas == null ? '' : String(o.pavadinimas).trim();
        if (code) codes.push(code);
        if (name) parts.push(name);
        else if (code) parts.push(code);
      } else if (item != null && String(item).trim()) {
        parts.push(String(item).trim());
      }
    }
    const text = parts.length ? parts.join('; ') : null;
    const danger = codes.some((c) => !LT_WARN_BENIGN.test(c))
      || (codes.length === 0 && text != null && LT_ICY_RE.test(text));
    return { text, codes, danger };
  }
  const text = String(raw).trim() || null;
  if (!text) return { text: null, codes: [], danger: false };
  return { text, codes: [], danger: LT_ICY_RE.test(text) };
}

/** F7 #727 B1 — adverse tylko lód/śnieg/szron, friction&lt;0.4, vis 1–199 m, ostrzeżenie nie-benign. */
export function ltWeatherIsAdverse(args: {
  surface: string | null;
  friction: number | null;
  visibilityM: number | null;
  warnDanger: boolean;
  warnText: string | null;
}): boolean {
  const icySurface = args.surface != null && LT_ICY_RE.test(args.surface);
  const icyWarn = args.warnText != null && LT_ICY_RE.test(args.warnText);
  const lowFriction = args.friction != null && Number.isFinite(args.friction)
    && args.friction < LT_FRICTION_ADVERSE;
  /* null/0 = brak pomiaru (API bywa null → Number null=0); nie traktuj jak mgła. */
  const lowVis = args.visibilityM != null
    && Number.isFinite(args.visibilityM)
    && args.visibilityM > 0
    && args.visibilityM < 200;
  return icySurface || icyWarn || lowFriction || lowVis || args.warnDanger;
}

export function parseLtWeather(json: unknown): LtWeatherStation[] {
  if (!Array.isArray(json)) return [];
  const out: LtWeatherStation[] = [];
  for (const raw of json) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    const id = String(o.id ?? '').trim();
    const lat = Number(o.lat);
    const lon = Number(o.lng ?? o.lon);
    if (!id || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const frictionRaw = o.sukibimo_koeficientas;
    const friction = frictionRaw == null || frictionRaw === ''
      ? null
      : Number(frictionRaw);
    const surface = o.kelio_danga == null ? null : String(o.kelio_danga);
    const visibilityM = o.matomumas == null || o.matomumas === ''
      ? null
      : Number(o.matomumas);
    const warn = ltPerspejimaiText(o.perspejimai);
    const frictionOk = friction != null && Number.isFinite(friction) ? friction : null;
    const visOk = visibilityM != null && Number.isFinite(visibilityM) ? visibilityM : null;
    const adverse = ltWeatherIsAdverse({
      surface,
      friction: frictionOk,
      visibilityM: visOk,
      warnDanger: warn.danger,
      warnText: warn.text,
    });
    out.push({
      id,
      lat,
      lon,
      friction: frictionOk,
      surface,
      visibilityM: visOk,
      warning: warn.text,
      adverse,
      title: String(o.irenginys ?? o.pavadinimas ?? `stacja ${id}`),
    });
  }
  return out;
}

/** Stacje pogodowe ≤ 3 km od korytarza → HIGH do spowolnienia (F7 #730 r2). */
export function ltWeatherToSlowdownEvents(
  stations: LtWeatherStation[],
  boxes: FiBbox[] = ltCorridorBboxes(),
): BalticRoadEvent[] {
  const densified = densifyCorridor(CORRIDOR_LT);
  return stations
    .filter((s) => s.adverse && eventInLtBboxes({ lat: s.lat, lon: s.lon }, boxes))
    .filter((s) => minDistToCorridorKm(s.lat, s.lon, CORRIDOR_LT, densified) <= 3)
    .map((s) => ({
      id: `wx:${s.id}`,
      title: s.warning ? `Pogoda: ${s.warning}` : `Pogoda: ${s.title}`,
      detail: [
        s.surface ? `nawierzchnia ${s.surface}` : '',
        s.friction != null ? `przyczepnosc ${s.friction}` : '',
        s.visibilityM != null ? `widocznosc ${s.visibilityM} m` : '',
      ].filter(Boolean).join(' · '),
      severity: 'HIGH' as RiskSeverity,
      lat: s.lat,
      lon: s.lon,
      kind: 'weather',
      start: null,
      end: null,
      corridorMatch: 'on' as const,
    }));
}

/* ---------- Łotwa — LVC / transportdata.gov.lv (#716 cz.3 / #589) ---------- */

/** Via Baltica LT→LV→EE (granica LT → Rīga → granica EE ku Tallinn/Muuga/Paldiski). */
export const CORRIDOR_LV: LatLon[] = [
  [56.25, 24.45], // granica LT/LV
  [56.55, 24.20], // Bauska
  [56.95, 24.10], // Rīga A7/A1
  [57.35, 24.40], // Saulkrasti / A1
  [57.75, 24.55], // Salacgrīva
  [57.90, 24.40], // granica LV/EE
];

export const LV_ATTRIBUTION = "LVC / transportdata.gov.lv (CC0 / CC BY)";
export const LV_UA = "WatchTower/BN6 (log-mar.pl; road-lv; +48 kontakt HHL)";
/** Nagłówek klucza NAP LV (#589 — potwierdzenie na pierwszym przebiegu LIVE). */
export const LV_NAP_KEY_HEADER = "Ocp-Apim-Subscription-Key";
/** Publiczny URL atrybucji — nigdy sekretny endpoint w logach. */
export const LV_SOURCE_REF = "https://transportdata.gov.lv/";

/** 22 zbiory (#589) — sekrety `LV_NAP_<KOD>_KEY` + `LV_NAP_<KOD>_URL`. */
export const LV_NAP_CODES = [
  "ROADWORKS",
  "ROADWORKS_SHORT",
  "CLOSURES",
  "LANE_CLOSURES",
  "WEIGHT_DIM",
  "ACCIDENTS",
  "ACCIDENT_AREA",
  "BLOCKAGE",
  "OBSTACLES",
  "WRONG_WAY",
  "POOR_ROAD_WM",
  "POOR_ROAD_TI",
  "POOR_ROAD_RM",
  "SLIPPERY_WM",
  "SLIPPERY_TI",
  "SLIPPERY_RM",
  "EXC_WEATHER_WM",
  "EXC_WEATHER_TI",
  "EXC_WEATHER_RM",
  "WEATHER_SAFETY_WM",
  "WEATHER_SAFETY_TI",
  "WEATHER_SAFETY_RM",
] as const;

export type LvNapCode = (typeof LV_NAP_CODES)[number];

export function lvNapKeyEnv(code: LvNapCode): string {
  return `LV_NAP_${code}_KEY`;
}
export function lvNapUrlEnv(code: LvNapCode): string {
  return `LV_NAP_${code}_URL`;
}

/**
 * Bboxy ±0,25° wokół odcinków CORRIDOR_LV (F7 #730 B7 — zwężenie vs ~85 km).
 */
export function lvCorridorBboxes(): FiBbox[] {
  const pad = 0.25;
  const boxes: FiBbox[] = [];
  for (let i = 0; i + 1 < CORRIDOR_LV.length; i++) {
    const [lat1, lon1] = CORRIDOR_LV[i]!;
    const [lat2, lon2] = CORRIDOR_LV[i + 1]!;
    boxes.push({
      xMin: Math.min(lon1, lon2) - pad,
      xMax: Math.max(lon1, lon2) + pad,
      yMin: Math.min(lat1, lat2) - pad,
      yMax: Math.max(lat1, lat2) + pad,
    });
  }
  return boxes;
}

export function eventInLvBboxes(
  e: Pick<BalticRoadEvent, "lat" | "lon">,
  boxes: FiBbox[] = lvCorridorBboxes(),
): boolean {
  return eventInFiBboxes(e, boxes);
}

export function filterInLvBboxes(
  events: BalticRoadEvent[],
  boxes: FiBbox[] = lvCorridorBboxes(),
): BalticRoadEvent[] {
  return events.filter((e) => eventInLvBboxes(e, boxes));
}

/**
 * F7 #730 r2 N4 — tylko potwierdzone nidy z subskrypcji (#589).
 * Bez zgadywanych mapowań WM/TI/RM; 461762 / 461673 / 461765 bez KEY/URL.
 */
export const LV_NAP_NID: Partial<Record<LvNapCode, number | string>> = {
  WEIGHT_DIM: 44751,
};

/** F7 #730 N7 — polskie etykiety typów DATEX zamiast surowych nazw. */
const LV_TYPE_PL: Record<string, string> = {
  MaintenanceWorks: 'roboty',
  Roadworks: 'roboty',
  ConstructionWorks: 'roboty',
  RoadOrCarriagewayOrLaneManagement: 'organizacja ruchu',
  AbnormalTraffic: 'utrudnienie ruchu',
  Accident: 'wypadek',
  AccidentArea: 'obszar wypadku',
  AnimalPresenceOnRoad: 'przeszkoda',
  VehicleObstruction: 'przeszkoda',
  Obstruction: 'przeszkoda',
  GeneralObstruction: 'przeszkoda',
  WinterDrivingConditions: 'śliskość',
  WeatherRelatedRoadConditions: 'pogoda',
  PoorEnvironmentConditions: 'warunki środowiskowe',
  AuthorityOperation: 'działanie służb',
  NetworkManagement: 'zarządzanie siecią',
};

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/gi, '&');
}

function lvIsSlipperyCode(code: string): boolean {
  return code.startsWith('SLIPPERY_');
}

function lvIsWeatherCode(code: string): boolean {
  return code.startsWith('SLIPPERY_')
    || code.startsWith('EXC_WEATHER_')
    || code.startsWith('WEATHER_SAFETY_')
    || code.startsWith('POOR_ROAD_');
}

/**
 * F7 #730 r2 B5 — lód/śnieg tylko na polach treści (granice słowa), nie na surowym XML
 * (unikaj „ice” w policeForces / „led” w scheduled).
 */
const LV_ICY_CONTENT_RE =
  /(?:^|[^a-zāčēģīķļņšūžA-ZĀČĒĢĪĶĻŅŠŪŽ])(?:ledus|ledu|sliden\w*|apled\w*|go[lł]oled\w*|szron\w*|aizsal\w*|salna|riepoj\w*|glaz\w*|snieg\w*|black\s*ice|\bice\b|\bsnow\b|frost)(?:[^a-zāčēģīķļņšūžA-ZĀČĒĢĪĶĻŅŠŪŽ]|$)/i;

/** Kody DATEX zjawisk lodowych / śniegu (zamiast regexu po całym rekordzie). */
const LV_ICY_DATEX_TYPE_RE =
  /\b(?:ice|blackIce|snowOnTheRoad|freezingRain|frost|hoarFrost|iceOnRoadway|snowDrifts|blizzard)\b/i;

function lvTag(rec: string, n: string): string | undefined {
  return rec.match(new RegExp(`<(?:\\w+:)?${n}\\b[^>]*>([^<]*)<`, 'i'))?.[1]?.trim();
}

/** F7 #730 r2 B7 — komentarz publiczny, nie sourceName (pierwszy value). */
function lvPublicComment(rec: string): string {
  const fromGpc = rec.match(
    /<(?:\w+:)?generalPublicComment\b[\s\S]*?<(?:\w+:)?value\b[^>]*>([^<]*)</i,
  )?.[1];
  if (fromGpc != null && fromGpc.trim()) return decodeXmlEntities(fromGpc.trim());
  const fromComment = rec.match(
    /<(?:\w+:)?(?:comment|publicComment)\b[\s\S]*?<(?:\w+:)?value\b[^>]*>([^<]*)</i,
  )?.[1];
  if (fromComment != null && fromComment.trim()) return decodeXmlEntities(fromComment.trim());
  return '';
}

/** Normalizacja lat/lon LV (~55.6–58.1 N, 20.9–28.3 E); zamiana gdy odwrócone. */
export function lvNormalizeLatLon(a: number, b: number): {
  lat: number; lon: number; swapped: boolean;
} {
  const inLv = (lat: number, lon: number) =>
    lat >= 55.4 && lat <= 58.3 && lon >= 20.7 && lon <= 28.5;
  if (inLv(a, b)) return { lat: a, lon: b, swapped: false };
  if (inLv(b, a)) return { lat: b, lon: a, swapped: true };
  return { lat: a, lon: b, swapped: false };
}

/** Centroid z latitude/longitude albo GML posList (DATEX v3 locationReference). */
export function lvCoordsFromRecord(rec: string): LatLon | null {
  const lat = Number(lvTag(rec, 'latitude'));
  const lon = Number(lvTag(rec, 'longitude'));
  if (Number.isFinite(lat) && Number.isFinite(lon)) return [lat, lon];
  const posRaw = rec.match(/<(?:\w+:)?posList\b[^>]*>([^<]*)<\/(?:\w+:)?posList>/i)?.[1]
    ?? rec.match(/<(?:\w+:)?pos\b[^>]*>([^<]*)<\/(?:\w+:)?pos>/i)?.[1];
  if (!posRaw) return null;
  const nums = posRaw.trim().split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
  if (nums.length < 2) return null;
  /* GML: pary lat lon (EPSG:4326 w DATEX LV) → centroid; korekta zamiany osi. */
  let sumLat = 0;
  let sumLon = 0;
  let n = 0;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const norm = lvNormalizeLatLon(nums[i]!, nums[i + 1]!);
    sumLat += norm.lat;
    sumLon += norm.lon;
    n++;
  }
  return n ? [sumLat / n, sumLon / n] : null;
}

function lvParseVisibilityM(rec: string): number | null {
  const raw = lvTag(rec, 'minimumVisibilityDistance')
    ?? lvTag(rec, 'visibility')
    ?? lvTag(rec, 'visibilityDistance');
  if (raw == null || raw === '') return null;
  const n = Number(raw.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function lvRecordSignals(rec: string): {
  roadClosed: boolean;
  carriagewayBlocked: boolean;
  lanesBlocked: boolean;
  laneClosures: boolean;
  alternateTraffic: boolean;
  narrowOrContraflow: boolean;
  hasDetour: boolean;
  hasDimLimit: boolean;
  speedLimitOnly: boolean;
} {
  const mgmt = [...rec.matchAll(
    /<(?:\w+:)?roadOrCarriagewayOrLaneManagementType\b[^>]*>([^<]*)</gi,
  )].map((m) => m[1].toLowerCase());
  const constr = [...rec.matchAll(
    /<(?:\w+:)?trafficConstrictionType\b[^>]*>([^<]*)</gi,
  )].map((m) => m[1].toLowerCase());
  const mgmtBlob = mgmt.join(' ');
  const constrBlob = constr.join(' ');
  const roadClosed = mgmt.some((t) => t === 'roadclosed' || t.includes('roadclosed'))
    || /<(?:\w+:)?roadOrCarriagewayOrLaneManagementType\b[^>]*>\s*roadClosed\s*</i.test(rec);
  /* F7 #730 r2 B6a: HIGH tylko carriagewayBlocked — nie lanesBlocked. */
  const carriagewayBlocked = constr.some((t) => t.includes('carriagewayblocked'))
    || /carriagewayBlocked/i.test(rec);
  const lanesBlocked = constr.some((t) =>
    t.includes('lanesblocked') || t === 'blocked' || t.includes('laneblocked')
  ) || /\blanesBlocked\b/i.test(rec);
  const laneClosures = mgmt.some((t) => t.includes('laneclosure') || t.includes('lanesclosed'))
    || /\blaneClosures?\b/i.test(rec);
  const alternateTraffic = mgmt.some((t) =>
    t.includes('singlealternatelinetraffic') || t.includes('alternatingtraffic')
  ) || /singleAlternateLineTraffic/i.test(rec);
  const narrowOrContraflow = mgmt.some((t) =>
    t.includes('narrowlanes') || t.includes('contraflow') || t.includes('lanesrestricted')
  ) || constr.some((t) =>
    t.includes('narrow') || t.includes('onelane') || t.includes('one_lane')
  ) || /\boneLane\b/i.test(rec);
  const hasDetour = /<(?:\w+:)?rerouting\b/i.test(rec)
    || /(?:apbraukš\w*|apbrauk\w*|apvedceļ\w*|apvedcel\w*|objazd\w*|detour\w*|rerout\w*)/i
      .test(rec);
  const hasDimLimit = /<(?:\w+:)?(?:heightCharacteristic|widthCharacteristic|weightCharacteristic|lengthCharacteristic|axleSpacing)/i
    .test(rec)
    || /<(?:\w+:)?(?:height|width|weight|length|axle)\w*Limit/i.test(rec);
  /* Sam temporarySpeedLimit → nie hasLimit (r2 B6d → LOW). */
  const speedLimitOnly = /temporarySpeedLimit/i.test(rec) && !hasDimLimit
    && !roadClosed && !carriagewayBlocked;
  void mgmtBlob;
  void constrBlob;
  return {
    roadClosed,
    carriagewayBlocked,
    lanesBlocked,
    laneClosures,
    alternateTraffic,
    narrowOrContraflow,
    hasDetour,
    hasDimLimit,
    speedLimitOnly,
  };
}

/**
 * F7 #730 B1/r2 B6 / decyzja 85: zwykłe roboty → LOW; MEDIUM zwężenie/wahadło/objazd;
 * HIGH zamknięcie / carriagewayBlocked / wypadek z blokadą; wrong-way → MEDIUM;
 * LANE_CLOSURES / laneClosures / singleAlternate → MEDIUM; sam speedLimit → LOW.
 */
export function lvSeverityForRecord(
  code: LvNapCode,
  recOrText: string,
  opts: {
    visibilityM?: number | null;
    signals?: ReturnType<typeof lvRecordSignals>;
    /** Pola treści do LV_ICY (nie surowy rekord). */
    contentText?: string;
  } = {},
): RiskSeverity {
  const sig = opts.signals ?? lvRecordSignals(recOrText);
  const content = opts.contentText ?? recOrText;
  if (code === 'WRONG_WAY') return 'MEDIUM';
  if (lvIsWeatherCode(code)) {
    const vis = opts.visibilityM;
    const lowVis = vis != null && Number.isFinite(vis) && vis > 0 && vis < 200;
    const icy = LV_ICY_DATEX_TYPE_RE.test(content)
      || LV_ICY_CONTENT_RE.test(content)
      || LT_ICY_RE.test(content);
    if (icy || lowVis) return 'HIGH';
    return 'MEDIUM';
  }
  if (sig.roadClosed || sig.carriagewayBlocked) return 'HIGH';
  if (code === 'CLOSURES' || code === 'BLOCKAGE') return 'HIGH';
  if (code === 'ACCIDENTS' || code === 'ACCIDENT_AREA') {
    return (sig.roadClosed || sig.carriagewayBlocked) ? 'HIGH' : 'MEDIUM';
  }
  /* r2 B6b: pas/pasy / wahadło / LANE_CLOSURES → MEDIUM */
  if (
    code === 'LANE_CLOSURES'
    || sig.laneClosures
    || sig.alternateTraffic
    || sig.lanesBlocked
  ) {
    return 'MEDIUM';
  }
  if (code === 'WEIGHT_DIM' || sig.hasDimLimit) return 'MEDIUM';
  if (sig.speedLimitOnly) return 'LOW';
  if (
    code === 'ROADWORKS' || code === 'ROADWORKS_SHORT'
    || /maintenance|roadwork|construction|remontdarb/i.test(content)
  ) {
    if (sig.narrowOrContraflow || sig.hasDetour || sig.hasDimLimit) return 'MEDIUM';
    return 'LOW';
  }
  if (sig.narrowOrContraflow || sig.hasDetour) return 'MEDIUM';
  return 'MEDIUM';
}

function lvTypeLabel(type: string): string {
  return LV_TYPE_PL[type] ?? LV_TYPE_PL[type.replace(/^.*:/, '')] ?? type;
}

function lvSlipperyId(lat: number, lon: number): string {
  /* F7 #730 N5 — siatka ~0,01° (~1 km). */
  return `slippery:${lat.toFixed(2)}:${lon.toFixed(2)}`;
}

export type LvParseStats = { parsed: number; skipped: number };

/** DATEX II v2/v3 XML — situationRecord; posList / locationReference (F7 #730 B6). */
export function parseLvDatexXml(
  xml: string,
  code: LvNapCode,
  stats?: LvParseStats,
): BalticRoadEvent[] {
  if (!xml || typeof xml !== 'string') return [];
  const out: BalticRoadEvent[] = [];
  const recs = xml.split(/<(?:\w+:)?situationRecord\b/i).slice(1);
  let skipped = 0;
  for (const raw of recs) {
    const rec = raw.split(/<\/(?:\w+:)?situationRecord>/i)[0] ?? '';
    const attr = rec.slice(0, Math.max(0, rec.indexOf('>')));
    const idRaw = attr.match(/\bid="([^"]+)"/i)?.[1]
      ?? rec.match(/<(?:\w+:)?id(?:Reference)?\b[^>]*>([^<]+)</i)?.[1]
      ?? '';
    const id = String(idRaw).trim();
    if (!id) { skipped++; continue; }
    const type = attr.match(/xsi:type="(?:\w+:)?(\w+)"/i)?.[1]
      ?? attr.match(/type="(?:\w+:)?(\w+)"/i)?.[1]
      ?? code;
    const coords = lvCoordsFromRecord(rec);
    if (!coords) { skipped++; continue; }
    const [lat, lon] = coords;
    const comment = lvPublicComment(rec) || lvTypeLabel(String(type));
    const signals = lvRecordSignals(rec);
    const visibilityM = lvParseVisibilityM(rec);
    const weatherType = lvTag(rec, 'weatherRelatedRoadConditionType')
      ?? lvTag(rec, 'poorEnvironmentType')
      ?? lvTag(rec, 'precipitationType')
      ?? '';
    const contentText = [comment, weatherType, String(type)].filter(Boolean).join(' ');
    const severity = lvSeverityForRecord(code, rec, {
      visibilityM, signals, contentText,
    });
    const roadRaw = lvTag(rec, 'roadNumber');
    const road = roadRaw
      ? (extractBalticRoadRef(roadRaw) ?? roadRaw.trim())
      : extractBalticRoadRefPreferStreet(null, comment);
    const label = lvTypeLabel(String(type));
    out.push({
      id: lvIsSlipperyCode(code) ? lvSlipperyId(lat, lon) : id,
      title: road ? `${label} · ${road}` : label,
      detail: comment,
      severity,
      lat,
      lon,
      kind: code,
      start: lvTag(rec, 'overallStartTime') ?? null,
      end: lvTag(rec, 'overallEndTime') ?? null,
      road,
      hasDetour: signals.hasDetour,
      roadClosed: signals.roadClosed || signals.carriagewayBlocked,
      visibilityM,
    });
  }
  if (stats) {
    stats.parsed += out.length;
    stats.skipped += skipped;
  }
  return out;
}

/** DATEX JSON — situation / situationRecord; bez przepisywania DATEX severity=high → HIGH. */
export function parseLvDatexJson(
  json: unknown,
  code: LvNapCode,
  stats?: LvParseStats,
): BalticRoadEvent[] {
  if (json && typeof json === 'object' && Array.isArray((json as { features?: unknown }).features)) {
    return parseLvWeightDimGeoJson(json, code, stats);
  }
  const bag: unknown[] = [];
  const walk = (node: unknown): void => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const x of node) walk(x);
      return;
    }
    if (typeof node !== 'object') return;
    const o = node as Record<string, unknown>;
    const nested = o.situationRecord ?? o.SituationRecord;
    if (nested != null) {
      walk(nested);
      return;
    }
    if (
      typeof o.id === 'string'
      && (o.latitude != null || o.pointCoordinates != null
        || o.groupOfLocations != null || o.locationReference != null
        || o.Latitude != null)
    ) {
      bag.push(node);
      return;
    }
    for (const v of Object.values(o)) {
      if (v && typeof v === 'object') walk(v);
    }
  };
  walk(json);

  const out: BalticRoadEvent[] = [];
  let skipped = 0;
  for (const raw of bag) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    const rec = (o.situationRecord ?? o.SituationRecord ?? o) as Record<string, unknown>;
    const id = String(rec.id ?? rec.situationRecordId ?? o.id ?? '').trim();
    if (!id) { skipped++; continue; }
    let lat: number | null = null;
    let lon: number | null = null;
    const latDirect = Number(rec.latitude ?? rec.Latitude);
    const lonDirect = Number(rec.longitude ?? rec.Longitude);
    if (Number.isFinite(latDirect) && Number.isFinite(lonDirect)) {
      lat = latDirect;
      lon = lonDirect;
    } else {
      const pc = rec.pointCoordinates ?? rec.PointCoordinates;
      if (pc && typeof pc === 'object') {
        const p = pc as { latitude?: unknown; longitude?: unknown };
        const la = Number(p.latitude);
        const lo = Number(p.longitude);
        if (Number.isFinite(la) && Number.isFinite(lo)) {
          lat = la;
          lon = lo;
        }
      }
      if (lat == null) {
        const lr = rec.locationReference ?? rec.LocationReference;
        if (lr && typeof lr === 'object') {
          const blob = JSON.stringify(lr);
          const pos = blob.match(/"posList"\s*:\s*"([^"]+)"/i)?.[1]
            ?? blob.match(/"pos"\s*:\s*"([^"]+)"/i)?.[1];
          if (pos) {
            const nums = pos.trim().split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
            if (nums.length >= 2) {
              /* F7 #730 r2 B7: centroid, nie pierwsza para. */
              let sLat = 0;
              let sLon = 0;
              let n = 0;
              for (let i = 0; i + 1 < nums.length; i += 2) {
                const norm = lvNormalizeLatLon(nums[i]!, nums[i + 1]!);
                sLat += norm.lat;
                sLon += norm.lon;
                n++;
              }
              if (n) {
                lat = sLat / n;
                lon = sLon / n;
              }
            }
          }
        }
      }
    }
    if (lat != null && lon != null) {
      const norm = lvNormalizeLatLon(lat, lon);
      lat = norm.lat;
      lon = norm.lon;
    }
    if (lat == null || lon == null) { skipped++; continue; }
    const type = String(rec.type ?? rec['@type'] ?? rec.situationRecordType ?? code);
    const gpc = rec.generalPublicComment ?? rec.GeneralPublicComment;
    let comment = '';
    if (typeof gpc === 'string') comment = gpc;
    else if (gpc && typeof gpc === 'object') {
      const raw = JSON.stringify(gpc);
      comment = raw.match(/"value"\s*:\s*"([^"]*)"/)?.[1] ?? '';
    }
    if (!comment) {
      comment = String(rec.comment ?? rec.description ?? type).trim();
    }
    comment = decodeXmlEntities(comment);
    const weatherType = String(
      rec.weatherRelatedRoadConditionType
        ?? rec.poorEnvironmentType
        ?? rec.precipitationType
        ?? '',
    );
    const contentText = [comment, weatherType, type].filter(Boolean).join(' ');
    const signals = lvRecordSignals(JSON.stringify(rec));
    const visRaw = rec.minimumVisibilityDistance ?? rec.visibility ?? rec.visibilityDistance;
    const visibilityM = visRaw != null && Number.isFinite(Number(visRaw)) ? Number(visRaw) : null;
    const severity = lvSeverityForRecord(code, JSON.stringify(rec), {
      visibilityM, signals, contentText,
    });
    const roadRaw = rec.roadNumber ?? rec.RoadNumber;
    const road = roadRaw != null && String(roadRaw).trim()
      ? (extractBalticRoadRef(String(roadRaw)) ?? String(roadRaw).trim())
      : extractBalticRoadRefPreferStreet(null, comment);
    const label = lvTypeLabel(type.replace(/^.*:/, ''));
    out.push({
      id: lvIsSlipperyCode(code) ? lvSlipperyId(lat, lon) : id,
      title: road ? `${label} · ${road}` : label,
      detail: comment,
      severity,
      lat,
      lon,
      kind: code,
      start: typeof rec.overallStartTime === 'string' ? rec.overallStartTime : null,
      end: typeof rec.overallEndTime === 'string' ? rec.overallEndTime : null,
      road,
      hasDetour: signals.hasDetour,
      roadClosed: signals.roadClosed || signals.carriagewayBlocked,
      visibilityM,
    });
  }
  if (stats) {
    stats.parsed += out.length;
    stats.skipped += skipped;
  }
  return out;
}

/** GeoJSON masa/gabaryty (nid 44751 / WEIGHT_DIM); oś/długość → dimension (N6). */
export function parseLvWeightDimGeoJson(
  json: unknown,
  code: LvNapCode = 'WEIGHT_DIM',
  stats?: LvParseStats,
): BalticRoadEvent[] {
  if (!json || typeof json !== 'object') return [];
  const features = (json as { features?: unknown }).features;
  if (!Array.isArray(features)) return [];
  const out: BalticRoadEvent[] = [];
  let skipped = 0;
  for (const raw of features) {
    if (!raw || typeof raw !== 'object') { skipped++; continue; }
    const f = raw as { geometry?: unknown; properties?: Record<string, unknown>; id?: unknown };
    const props = f.properties ?? {};
    const pt = featureCentroid(f.geometry);
    if (!pt) { skipped++; continue; }
    const id = String(
      props.id ?? props.restrictionId ?? f.id ?? `${pt[0].toFixed(4)}_${pt[1].toFixed(4)}`,
    ).trim();
    if (!id) { skipped++; continue; }
    const height = props.heightRestrictionInMeters != null
      ? Number(props.heightRestrictionInMeters)
      : props.heightLimit != null ? Number(props.heightLimit) : null;
    const width = props.widthRestrictionInMeters != null
      ? Number(props.widthRestrictionInMeters)
      : props.widthLimit != null ? Number(props.widthLimit) : null;
    const weight = props.weightRestrictionInTonnes != null
      ? Number(props.weightRestrictionInTonnes)
      : props.weightLimit != null ? Number(props.weightLimit) : null;
    const axle = props.axleWeightRestrictionInTonnes != null
      ? Number(props.axleWeightRestrictionInTonnes)
      : props.axleWeightLimit != null ? Number(props.axleWeightLimit) : null;
    const length = props.lengthRestrictionInMeters != null
      ? Number(props.lengthRestrictionInMeters)
      : props.lengthLimit != null ? Number(props.lengthLimit) : null;
    const street = props.street == null ? '' : String(props.street);
    const cls = props.restrictionClass == null ? '' : String(props.restrictionClass);
    const title = [cls, street].filter(Boolean).join(' · ') || 'limit masy/wymiarów';
    const road = extractBalticRoadRef(street) ?? extractBalticRoadRef(title);
    /* N6: bez „severity HIGH” dla samych wymiarów — masa osobno, reszta MEDIUM. */
    out.push({
      id,
      title,
      detail: [cls, street, props.start != null ? `km ${props.start}` : ''].filter(Boolean).join(' · '),
      severity: weight != null && Number.isFinite(weight) ? 'HIGH' : 'MEDIUM',
      lat: pt[0],
      lon: pt[1],
      kind: code,
      start: typeof props.startTime === 'string' ? props.startTime : null,
      end: typeof props.endTime === 'string' ? props.endTime : null,
      road,
      weightLimitT: weight != null && Number.isFinite(weight) ? weight : null,
      heightLimitM: height != null && Number.isFinite(height) ? height : null,
      widthLimitM: width != null && Number.isFinite(width) ? width : null,
      axleWeightLimitT: axle != null && Number.isFinite(axle) ? axle : null,
      lengthLimitM: length != null && Number.isFinite(length) ? length : null,
    });
  }
  if (stats) {
    stats.parsed += out.length;
    stats.skipped += skipped;
  }
  return out;
}

/**
 * F7 #730 B3/r2 B4: pierwszy znak `{`/`[` vs `<`; format OK tylko z markerami
 * DATEX/GeoJSON (`situationRecord` / `payload` / `d2LogicalModel` / `features`).
 * `{"message":"maintenance"}`, `[]`, `<Error>` → unknown (complete=false).
 */
export function parseLvFeedBody(
  body: string,
  code: LvNapCode,
  stats?: LvParseStats,
): { events: BalticRoadEvent[]; format: 'datex-xml' | 'datex-json' | 'geojson' | 'empty' | 'unknown' } {
  const t = body.trim();
  if (!t) return { events: [], format: 'empty' };
  const c0 = t[0]!;
  if (c0 === '<') {
    if (/^<!DOCTYPE\s+html/i.test(t) || /^<html[\s>]/i.test(t)) {
      return { events: [], format: 'unknown' };
    }
    if (!/situationRecord|d2LogicalModel|payloadPublication/i.test(t)) {
      return { events: [], format: 'unknown' };
    }
    return { events: parseLvDatexXml(t, code, stats), format: 'datex-xml' };
  }
  if (c0 === '{' || c0 === '[') {
    try {
      const json = JSON.parse(t) as unknown;
      if (json && typeof json === 'object' && Array.isArray((json as { features?: unknown }).features)) {
        return { events: parseLvWeightDimGeoJson(json, code, stats), format: 'geojson' };
      }
      const marker = /situationRecord|d2LogicalModel|"payload"|payloadPublication/i
        .test(t);
      if (!marker) {
        if (stats) stats.skipped += 1;
        return { events: [], format: 'unknown' };
      }
      return { events: parseLvDatexJson(json, code, stats), format: 'datex-json' };
    } catch {
      return { events: [], format: 'unknown' };
    }
  }
  return { events: [], format: 'unknown' };
}

/**
 * Dedup śliskości (#716 §3.5): WM/TI/RM → jedno id (siatka 0,01°, F7 #730 N5).
 */
export function dedupeLvSlippery(events: BalticRoadEvent[]): BalticRoadEvent[] {
  const byId = new Map<string, BalticRoadEvent>();
  for (const e of events) {
    const prev = byId.get(e.id);
    if (!prev) {
      byId.set(e.id, e);
      continue;
    }
    const rank = (s: RiskSeverity) => (s === 'HIGH' ? 3 : s === 'MEDIUM' ? 2 : 1);
    if (rank(e.severity) > rank(prev.severity)) byId.set(e.id, e);
  }
  return [...byId.values()];
}

/**
 * Pogoda/śliskość HIGH → spowolnienie; deszcz/wiatr = MEDIUM → nie.
 * F7 #730 r2: nie dubluj — caller ma użyć `balticSlowdownMult(near)`, nie near+weatherSlow.
 * Zostawione dla kompatybilności testów / LT-stylu.
 */
export function lvWeatherToSlowdownEvents(events: BalticRoadEvent[]): BalticRoadEvent[] {
  return events.filter(
    (e) => lvIsWeatherCode(String(e.kind ?? '')) && e.severity === 'HIGH',
  );
}
