/**
 * BN6 (#716) — drogi LT/LV/EE/FI.
 * cz.1: Finlandia Digitraffic road (bez klucza, CC BY 4.0 Fintraffic).
 * cz.2: Litwa eismoinfo restrictions + weather (bez klucza; Via Lietuva).
 * cz.3: Łotwa LVC/transportdata.gov.lv — 22 zbiory `LV_NAP_<KOD>_{KEY,URL}` (#589).
 * cz.4: Estonia Tark Tee DATEX (`X-DATEX-API-KEY`; sekrety TARKTEE_DATEX_* bez zmiany nazw).
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

/**
 * F7 #733 — wspólny rdzeń słów objazdu LT/LV/EE/FI (apylanka, apvedceļš, ümbersõit…).
 * Używaj z flagą `u` / `iu` przy `\p{L}`.
 */
export const BALTIC_DETOUR_WORD =
  String.raw`apylank[\p{L}\p{M}]*|apbraukš[\p{L}\p{M}]*|apbrauk[\p{L}\p{M}]*|apvedceļ[\p{L}\p{M}]*|apvedcel[\p{L}\p{M}]*|ümbersõi[\p{L}\p{M}]*|umbersoi[\p{L}\p{M}]*|objazd[\p{L}\p{M}]*|detour[\p{L}\p{M}]*|rerout[\p{L}\p{M}]*`;

/** Test obecności objazdu w tekście (B2 #733 — ümbersõit). */
export const BALTIC_DETOUR_RE = new RegExp(`(?:${BALTIC_DETOUR_WORD})`, 'iu');

/** F7 #730 r2 B1 / r3 B1 / #733 B2 — usuń opis objazdu; `\p{L}` (apvedceļš / ümbersõit). */
export function stripBalticDetourText(text: string): string {
  return String(text ?? '').replace(
    new RegExp(
      String.raw`(?:^|[\s,.;:])(?:${BALTIC_DETOUR_WORD})(?=[^\p{L}]|$)[\s\S]*$`,
      'giu',
    ),
    ' ',
  );
}

/**
 * F7 #730 r3 / #733 B4 — marker DATEX/GeoJSON jako element/klucz, nie dowolny podciąg.
 * HTML z „payloadPublication” w tekście, `{"message"}`, `null`, `[]`, `<Error>` → false.
 */
export function hasDatexMarker(body: string, kind: 'xml' | 'json'): boolean {
  if (kind === 'xml') {
    if (/^<!DOCTYPE\s+html/i.test(body) || /^<html[\s>]/i.test(body)) return false;
    return /<(?:\w+:)?(?:situationRecord|d2LogicalModel|payloadPublication)\b/i.test(body);
  }
  return /"(?:situationRecord|d2LogicalModel|payload|payloadPublication|features)"\s*:/i
    .test(body);
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

/**
 * DP-158 — polska etykieta typu FI (params/title); surowy fiński zostaje w detail.
 * Digitraffic: ROAD_WORK / Tietyö, TRAFFIC_ANNOUNCEMENT / Liikennetiedote,
 * WEIGHT_RESTRICTION / painorajoitus.
 */
export function fiTypeLabelPl(situationType: string, titleFi: string): string {
  const t = `${situationType} ${titleFi}`.toLowerCase();
  if (/weight|painoraj|kelirikko|massa/.test(t)) return 'limit masy';
  if (/accident|onnettom|wypad/.test(t)) return 'wypadek';
  if (/closed|suljet|tien sulku|tie suljet|zamkn/.test(t)) return 'zamknięcie';
  if (/road\s*work|road_work|tiety[oö]|työmaa|robot/.test(t)) return 'roboty drogowe';
  if (/announcement|liikennetiedote|tiedote|komunikat/.test(t)) return 'komunikat';
  if (/exempt|poikkeuskuljet/.test(t)) return 'transport specjalny';
  return 'zdarzenie drogowe';
}

/**
 * F7 #732 B4 — terminale HEL: Länsisatama (TLL-HEL / West Harbour) i Vuosaari.
 * Zdarzenie ≤ 2 km → corridorMatch=on (drogi portowe bez numeru VT).
 */
export const FI_PORT_TERMINALS: LatLon[] = [
  [60.150, 24.915], // Länsisatama / West Harbour / Jätkäsaari
  [60.205, 25.195], // Vuosaari
];

export function nearFiPortTerminal(
  lat: number,
  lon: number,
  maxKm = 2,
): boolean {
  return FI_PORT_TERMINALS.some((p) => haversineKm([lat, lon], p) <= maxKm);
}

/** DP-157(a) — zwykłe Tietyö bez zamknięcia/objazdu/limitu → LOW (jak decyzja 85 / LT N1). */
export function fiSeverity(
  situationType: string,
  titleFi: string,
  weightT: number | null,
): { severity: RiskSeverity; roadClosed: boolean; hasDetour: boolean } {
  const blob = `${situationType} ${titleFi}`.toLowerCase();
  const roadClosed = /closed|suljet|tien sulku|tie suljet|carriageway.?blocked|ajorata\s*suljet/.test(blob);
  const hasDetour = /kiertotie|kierretään|detour|rerout|objazd/.test(blob);
  /* DP-168 N3: limit masy z liczbą → MEDIUM w parserze (weightLimitRisk → HIGH tylko przy ładunku > limit).
   * Sam tekst kelirikko/painorajoitus → MEDIUM, nigdy HIGH (nie spowalnia ETA). */
  if (weightT != null) {
    return { severity: 'MEDIUM', roadClosed, hasDetour };
  }
  if (/weight|painoraj|kelirikko/.test(blob)) {
    return { severity: 'MEDIUM', roadClosed, hasDetour };
  }
  /* F7 #732 B3: wypadek HIGH tylko z blokadą jezdni; bez roadClosed → MEDIUM. */
  if (/accident|onnettom/.test(blob)) {
    return { severity: roadClosed ? 'HIGH' : 'MEDIUM', roadClosed, hasDetour };
  }
  if (roadClosed) return { severity: 'HIGH', roadClosed: true, hasDetour };
  if (hasDetour) return { severity: 'MEDIUM', roadClosed, hasDetour: true };
  if (/road\s*work|road_work|tiety[oö]|työmaa/.test(blob)) {
    return { severity: 'LOW', roadClosed, hasDetour };
  }
  if (/announcement|liikennetiedote|tiedote/.test(blob)) {
    return { severity: 'LOW', roadClosed, hasDetour };
  }
  return { severity: 'MEDIUM', roadClosed, hasDetour };
}

/**
 * DP-157(b) — numer drogi FI z tytułu Digitraffic („Tie 4”, „Vt 29”, „E75”, „Kehä III”).
 * F7 #732: najpierw Tie|Vt|Kt|Seututie / Kehä; goła liczba tylko na początku tytułu
 * (nie „2 km” / godzina w środku).
 * DP-166: `\d{1,5}` — lokalne „Tie 19511”/8155 → off (nie unknown→on ≤3 km).
 */
export function extractFiRoadRef(text: string): string | null {
  const t = String(text ?? '').trim();
  if (!t) return null;
  if (/kehä\s*iii|keha\s*iii|kehä\s*3|keha\s*3|\bkehäiii\b/i.test(t)) return '50';
  /* F7 #732 B4: Kehä I (101) — dojazd z Länsisatamy. */
  if (/kehä\s*i\b|keha\s*i\b|kehä\s*1\b|keha\s*1\b|\bkehäi\b/i.test(t)) return '101';
  const e = t.match(/\bE\s*(\d{1,3})\b/i);
  if (e) return `E${e[1]}`;
  const named = t.match(/\b(?:vt|kt|tie|seututie)\s*(\d{1,5})\b/i);
  if (named) return String(Number(named[1]));
  const atStart = t.match(/^(\d{1,5})\b/);
  if (atStart) return String(Number(atStart[1]));
  return null;
}

/**
 * DP-157(b) / F7 #732 B2+B4: VT4/E75, VT29/E8, Kehä III (50), Kehä I (101),
 * Vuosaaren (103). Gołe „8”/„75” = VT8/Tie 75 → off (nie korytarz HEL→Tornio).
 * E8/E75 tylko z prefiksem E.
 */
export function fiRoadOnCorridor(road: string | null | undefined): BalticCorridorRoadMatch {
  if (road == null || road === '') return 'unknown';
  const r = road.toUpperCase().replace(/\s+/g, '');
  if (
    r === '4' || r === 'VT4' || r === 'E75'
    || r === '29' || r === 'VT29' || r === 'E8'
    || r === '50' || r === '101' || r === '103'
  ) {
    return 'on';
  }
  return 'off';
}

/** Limit masy FI bez liczby w payloadzie (kelirikko / painorajoitus w tekście). */
export function isFiWeightLimitLike(e: BalticRoadEvent): boolean {
  if (e.weightLimitT != null) return true;
  const blob = `${e.kind ?? ''} ${e.title ?? ''} ${e.detail ?? ''}`.toLowerCase();
  return /weight|painoraj|kelirikko|massa|limit masy/.test(blob);
}

/** DP-157: road + corridorMatch + cap; unknown ≤ 3 km korytarza lub ≤ 2 km portu → on. */
export function applyFiCorridorRoadFilter(
  events: BalticRoadEvent[],
  nowMs: number = Date.now(),
): BalticRoadEvent[] {
  const densified = densifyCorridor(CORRIDOR_FI);
  return events.map((e) => {
    const capped = balticCapLongDetourClosure(e, nowMs);
    const road = capped.road
      ?? extractFiRoadRef(`${capped.title ?? ''} ${capped.detail ?? ''}`);
    let corridorMatch = fiRoadOnCorridor(road);
    if (
      corridorMatch !== 'on'
      && capped.lat != null
      && capped.lon != null
      && nearFiPortTerminal(capped.lat, capped.lon)
    ) {
      corridorMatch = 'on';
    } else if (
      corridorMatch === 'unknown'
      && capped.lat != null
      && capped.lon != null
      && minDistToCorridorKm(capped.lat, capped.lon, CORRIDOR_FI, densified) <= 3
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
    const titleFi = annTitle(props);
    const weightT = weightFromAnn(props);
    const sig = fiSeverity(sitType, titleFi, weightT);
    const labelPl = fiTypeLabelPl(sitType, titleFi);
    const road = extractFiRoadRef(titleFi);
    out.push({
      id,
      /* DP-158: polska etykieta w title/params; fiński w detail. */
      title: labelPl,
      detail: titleFi,
      severity: sig.severity,
      lat: pt?.[0] ?? null,
      lon: pt?.[1] ?? null,
      kind: sitType,
      start: times.start,
      end: times.end,
      weightLimitT: weightT,
      road,
      roadClosed: sig.roadClosed,
      hasDetour: sig.hasDetour,
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
  /* F7 #732 B1: limit bez liczby → MEDIUM „sprawdź…”, nigdy HIGH (nie spowalnia). */
  if (limit == null) {
    return {
      ...base,
      severity: 'MEDIUM',
      title: `Trasa ${country}: limit masy — sprawdź zezwolenie / trasę`,
      titleKey: 'rk_road_baltic_weight_check',
      params: { country, event: e.title, limit: null },
    };
  }
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
    || k === 'EE_WEATHER'
    || k === 'WEATHER'
    || k.startsWith('EE_WEATHER')
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
  /* EE: T4 (Via Baltica), T1, T11… */
  const tee = t.match(/\bT\s*(\d{1,2})\b/i);
  if (tee) return `T${tee[1]}`;
  /* LV drogi regionalne P/V — znany numer → corridorMatch=off (F7 #730 B7). */
  const pv = t.match(/\b([PV])\s*(\d{1,5})\b/i);
  if (pv) return `${pv[1].toUpperCase()}${pv[2]}`;
  /* krašto / rajoninis: „134 Name…” na początku street; DP-166: do 5 cyfr jak FI. */
  const n = t.match(/^(\d{1,5})\b/);
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
 * F7 #730 r2 B2 / r3 B3 / decyzja 85: HIGH zamknięcie z objazdem tylko gdy
 * czas trwania (koniec − start; bez startu → od `nowMs`) ≤ 72 h.
 * Bez końca albo > 72 h → MEDIUM. Wspólne LT+LV — flaga `roadClosed`.
 */
export function balticCapLongDetourClosure(
  e: BalticRoadEvent,
  nowMs: number = Date.now(),
): BalticRoadEvent {
  if (e.severity !== 'HIGH') return e;
  if (e.weightLimitT != null) return e;
  const closed = e.roadClosed === true
    || e.kind === 'CLOSURES'
    || e.kind === 'BLOCKAGE';
  if (!closed) return e;
  const blob = `${e.title ?? ''} ${e.detail ?? ''}`;
  const hasDetour = e.hasDetour === true || BALTIC_DETOUR_RE.test(blob);
  if (!hasDetour) return { ...e, roadClosed: true };
  /* Objazd bez znanego końca → MEDIUM. */
  if (e.end == null) {
    return { ...e, severity: 'MEDIUM', hasDetour: true, roadClosed: true };
  }
  const startMs = e.start != null ? Date.parse(e.start) : nowMs;
  const endMs = Date.parse(e.end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return { ...e, severity: 'MEDIUM', hasDetour: true, roadClosed: true };
  }
  const hours = (endMs - startMs) / 3_600_000;
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
 * obniż severity; LV unknown w ≤ 3 km od CORRIDOR_LV → on; EE unknown ≤ 3 km
 * lub ≤ 2 km od portu → on; długie zamknięcie z objazdem → MEDIUM.
 * Pogoda/śliskość: tylko ≤ 3 km od korytarza (LT/LV/EE — F7 #733 B3).
 */
export function applyBalticCorridorRoadFilter(
  country: 'LT' | 'LV' | 'EE',
  events: BalticRoadEvent[],
  nowMs: number = Date.now(),
): BalticRoadEvent[] {
  const corridor = country === 'EE'
    ? CORRIDOR_EE
    : country === 'LV'
      ? CORRIDOR_LV
      : CORRIDOR_LT;
  const densified = densifyCorridor(corridor);
  const nearKm = 3;
  return events.map((e) => {
    const capped = balticCapLongDetourClosure(e, nowMs);
    const weatherLike = capped.kind === 'weather' || balticIsWeatherSlowEvent(capped)
      || String(capped.kind ?? '').startsWith('EE_WEATHER');
    if (weatherLike) {
      const nearWx = capped.lat != null && capped.lon != null
        && minDistToCorridorKm(capped.lat, capped.lon, corridor, densified) <= nearKm;
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
      : country === 'LV'
        ? lvRoadOnCorridor(road)
        : eeRoadOnCorridor(road, capped);
    /* F7 #730 B7: bez numeru, ale ≤ 3 km od polilinii LV → on. */
    if (
      country === 'LV'
      && corridorMatch === 'unknown'
      && capped.lat != null
      && capped.lon != null
      && minDistToCorridorKm(capped.lat, capped.lon, CORRIDOR_LV, densified) <= nearKm
    ) {
      corridorMatch = 'on';
    }
    /* EE: bez numeru ≤ 3 km od Via Baltica / ≤ 2 km od portów → on (F7 #733 B3). */
    if (
      country === 'EE'
      && corridorMatch === 'unknown'
      && capped.lat != null
      && capped.lon != null
      && (
        minDistToCorridorKm(capped.lat, capped.lon, CORRIDOR_EE, densified) <= nearKm
        || nearEePortTerminal(capped.lat, capped.lon)
      )
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
  /* DP-168 N3: limit masy z liczbą → MEDIUM w parserze. */
  if (meta.weightLimitT != null) return 'MEDIUM';
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
    const hasDetour = BALTIC_DETOUR_RE.test(textForSev);
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
 * DP-165 / DP-169 — klasa błędu sieci w ostrzeżeniu (bez wartości klucza, bez ścieżki URL).
 * Abort z naszego limitu czasu = „timeout”; DNS / TLS / reset / connect|read timeout osobno.
 */
export type BalticNetErrorClass =
  | 'timeout'
  | 'DNS'
  | 'TLS'
  | 'reset'
  | 'connect timeout'
  | 'read timeout'
  | 'sieć';

export function balticWarnHost(url: string): string {
  try {
    const h = new URL(url).host;
    return h || 'host';
  } catch {
    return 'host';
  }
}

export function classifyBalticNetError(err: unknown): BalticNetErrorClass {
  const name = err instanceof Error ? err.name : '';
  const msg = err instanceof Error ? err.message : String(err);
  if (name === 'AbortError' || /aborted|abort(?:ed)?\b/i.test(msg)) return 'timeout';
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo|name not resolved|nie można rozpoznać nazwy|nxdomain/i.test(msg)) {
    return 'DNS';
  }
  if (/CERT_|ERR_TLS|SSL|TLS|certificate|UNABLE_TO_VERIFY|handshake/i.test(msg)) return 'TLS';
  if (/ECONNRESET|connection reset|reset by peer|forcibly closed/i.test(msg)) return 'reset';
  if (/ECONNREFUSED|EHOSTUNREACH|ENETUNREACH|connect(?:ion)? timed out|connect timeout/i.test(msg)) {
    return 'connect timeout';
  }
  if (/read timed out|body.?timeout|header.?timeout|und_err_headers_timeout|und_err_body_timeout/i.test(msg)) {
    return 'read timeout';
  }
  if (/ETIMEDOUT|timed?\s*out|timeout/i.test(msg)) return 'timeout';
  return 'sieć';
}

/** Ostrzeżenie: `LV ROADWORKS: TLS host.example` — host bez ścieżki (ścieżka może mieć klucz). */
export function balticNetWarning(prefix: string, url: string, err: unknown): string {
  const klass = classifyBalticNetError(err);
  const host = balticWarnHost(url);
  if (klass === 'timeout') return `${prefix}: timeout ${host}`;
  if (klass === 'sieć') return `${prefix}: błąd sieci (${host})`;
  return `${prefix}: ${klass} ${host}`;
}

/**
 * F7 #736 B2 — meta klucza bez wartości: długość, trim, czy nagłówek pójdzie.
 * Klucz do użycia = `.trim()`; `key_trimmed=1` gdy przed trim były spacje / nowa linia.
 */
export type BalticKeyMeta = {
  key: string;
  key_len: number;
  key_trimmed: 0 | 1;
  key_header_sent: 0 | 1;
};

export function balticKeyMeta(raw: string | undefined | null): BalticKeyMeta {
  const rawStr = raw ?? '';
  const key = rawStr.trim();
  return {
    key,
    key_len: key.length,
    key_trimmed: rawStr !== key ? 1 : 0,
    key_header_sent: key.length > 0 ? 1 : 0,
  };
}

/** F7 #736 B3 — `host/pierwszy-segment` (bez parametrów, bez klucza). */
export function balticUrlKind(url: string): string {
  try {
    const u = new URL(url);
    const seg = u.pathname.split('/').filter(Boolean)[0] ?? '';
    return seg ? `${u.host}/${seg}` : u.host || 'host';
  } catch {
    return 'host';
  }
}

/** F7 #736 B1 — sonda `GET https://<host>/` bez klucza, timeout 5 s → `<kod|klasa>:<ms>`. */
export const BALTIC_PROBE_TIMEOUT_MS = 5_000;

export async function probeBalticHost(
  fetchFn: typeof fetch,
  host: string,
  ua: string,
): Promise<string> {
  const safeHost = host.replace(/\/+$/, '') || 'host';
  const url = `https://${safeHost}/`;
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), BALTIC_PROBE_TIMEOUT_MS);
  try {
    const res = await fetchFn(url, {
      method: 'GET',
      headers: { 'User-Agent': ua, Accept: '*/*' },
      signal: ctrl.signal,
    });
    const ms = Math.max(0, Date.now() - t0);
    return `${res.status}:${ms}`;
  } catch (e) {
    const ms = Math.max(0, Date.now() - t0);
    return `${classifyBalticNetError(e)}:${ms}`;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * DP-168 / F7 #733 r2 — wspólne limity pobierania LV/EE (i dalsze kraje).
 * Ciało czytać strumieniowo (bez `arrayBuffer` całości); Content-Length > limitu → too_large.
 */
export const BALTIC_FEED_MAX_BYTES = 5 * 1024 * 1024;
export const BALTIC_FEED_TIMEOUT_MS = 10_000;
export const BALTIC_FEED_BUDGET_MS = 65_000;

export type BalticFeedBodyResult =
  | { ok: true; text: string }
  | { ok: false; reason: 'too_large' };

/** Odczyt ciała odpowiedzi z limitem bajtów (strumień + wcześniejszy Content-Length). */
export async function readBalticFeedBody(
  res: Response,
  maxBytes: number = BALTIC_FEED_MAX_BYTES,
): Promise<BalticFeedBodyResult> {
  const clRaw = res.headers.get('content-length');
  const cl = clRaw != null ? Number(clRaw) : NaN;
  if (Number.isFinite(cl) && cl > maxBytes) {
    return { ok: false, reason: 'too_large' };
  }
  const body = res.body;
  if (body == null) {
    const text = await res.text();
    const bytes = new TextEncoder().encode(text).byteLength;
    if (bytes > maxBytes) return { ok: false, reason: 'too_large' };
    return { ok: true, text };
  }
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value == null || value.byteLength === 0) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch { /* ignore */ }
        return { ok: false, reason: 'too_large' };
      }
      chunks.push(value);
    }
  } catch (e) {
    try { await reader.cancel(); } catch { /* ignore */ }
    /* F7 #737 B2 — nie zamieniaj AbortError / reset na ogólne „sieć”. */
    throw e;
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c, off);
    off += c.byteLength;
  }
  return {
    ok: true,
    text: new TextDecoder('utf-8', { fatal: false }).decode(buf),
  };
}

/**
 * DP-168 — szablon obserwacji `<kraj>_<usługa>=ok:<rekordy>:<pominięte>:<format>:<swapped>`.
 * Wartość (`ok:…`) osobno; klucz składa caller (`lv_roadworks`, `ee_srti_accident`).
 */
export function balticFeedObsOk(
  records: number,
  skipped: number,
  format: string,
  swapped: number,
): string {
  return `ok:${records}:${skipped}:${format}:${swapped}`;
}

export function balticFeedObsKey(country: string, service: string): string {
  return `${country.toLowerCase()}_${service.toLowerCase()}`;
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
 * DP-168 / F7 #733 r2 — wspólna lista słów lodowych/śniegowych per język (bez duplikatu „jäide”).
 * Regex budowany raz; granice słowa z flagą `u` (Litera Unicode).
 * F7 #737 B1 — końcówki `[\\p{L}\\p{M}]*` zamiast `\\w*` (łapie ē/ā/ī itd.).
 */
export const BALTIC_ICY_WORDS = {
  lv: [
    'ledus', 'ledu', 'sliden[\\p{L}\\p{M}]*', 'apled[\\p{L}\\p{M}]*', 'aizsal[\\p{L}\\p{M}]*', 'salna',
    'riepoj[\\p{L}\\p{M}]*', 'glaz[\\p{L}\\p{M}]*', 'snieg[\\p{L}\\p{M}]*', 'szron[\\p{L}\\p{M}]*',
  ],
  ee: ['jäide', 'libedus', 'lumi', 'lörts', 'härmatis'],
  common: ['go[lł]oled[\\p{L}\\p{M}]*', 'black\\s*ice', 'ice', 'snow', 'frost'],
} as const;

export type BalticIcyLang = keyof typeof BALTIC_ICY_WORDS;

export function buildBalticIcyContentRe(langs: BalticIcyLang[]): RegExp {
  const words = [...new Set(langs.flatMap((l) => [...BALTIC_ICY_WORDS[l]]))];
  const alts = words.join('|');
  return new RegExp(`(?:^|[^\\p{L}])(?:${alts})(?=[^\\p{L}]|$)`, 'iu');
}

/** F7 #730 r2 B5 — lód/śnieg tylko na polach treści (nie surowy XML). */
export const LV_ICY_CONTENT_RE = buildBalticIcyContentRe(['lv', 'common']);

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

/** Centroid z latitude/longitude albo GML posList; `swapped` = liczba zamian osi. */
export function lvCoordsFromRecord(rec: string): {
  lat: number; lon: number; swapped: number;
} | null {
  const lat = Number(lvTag(rec, 'latitude'));
  const lon = Number(lvTag(rec, 'longitude'));
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    const norm = lvNormalizeLatLon(lat, lon);
    return { lat: norm.lat, lon: norm.lon, swapped: norm.swapped ? 1 : 0 };
  }
  const posRaw = rec.match(/<(?:\w+:)?posList\b[^>]*>([^<]*)<\/(?:\w+:)?posList>/i)?.[1]
    ?? rec.match(/<(?:\w+:)?pos\b[^>]*>([^<]*)<\/(?:\w+:)?pos>/i)?.[1];
  if (!posRaw) return null;
  const nums = posRaw.trim().split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
  if (nums.length < 2) return null;
  /* GML: pary lat lon (EPSG:4326 w DATEX LV) → centroid; korekta zamiany osi. */
  let sumLat = 0;
  let sumLon = 0;
  let n = 0;
  let swapped = 0;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const norm = lvNormalizeLatLon(nums[i]!, nums[i + 1]!);
    if (norm.swapped) swapped++;
    sumLat += norm.lat;
    sumLon += norm.lon;
    n++;
  }
  return n ? { lat: sumLat / n, lon: sumLon / n, swapped } : null;
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
  const hasDetour = /<(?:\w+:)?rerouting\b/i.test(rec) || BALTIC_DETOUR_RE.test(rec);
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

export type LvParseStats = { parsed: number; skipped: number; swapped: number };

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
  let swapped = 0;
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
    const { lat, lon } = coords;
    swapped += coords.swapped;
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
    stats.swapped += swapped;
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
  let swapped = 0;
  for (const raw of bag) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    const rec = (o.situationRecord ?? o.SituationRecord ?? o) as Record<string, unknown>;
    const id = String(rec.id ?? rec.situationRecordId ?? o.id ?? '').trim();
    if (!id) { skipped++; continue; }
    let lat: number | null = null;
    let lon: number | null = null;
    let pairSwapped = 0;
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
                if (norm.swapped) pairSwapped++;
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
    if (lat != null && lon != null && pairSwapped === 0) {
      const norm = lvNormalizeLatLon(lat, lon);
      lat = norm.lat;
      lon = norm.lon;
      if (norm.swapped) pairSwapped = 1;
    }
    if (lat == null || lon == null) { skipped++; continue; }
    swapped += pairSwapped;
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
    stats.swapped += swapped;
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
    /* N6 + DP-168 N3: wymiary i masa z liczbą → MEDIUM w parserze (nie HIGH). */
    out.push({
      id,
      title,
      detail: [cls, street, props.start != null ? `km ${props.start}` : ''].filter(Boolean).join(' · '),
      severity: 'MEDIUM',
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
    if (!hasDatexMarker(t, 'xml')) {
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
      if (!hasDatexMarker(t, 'json')) {
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

/* ---------- Estonia — Tark Tee DATEX (#716 cz.4) ---------- */

/**
 * F7 #733 B3 / r2 B3 — Via Baltica T4 (Ikla→Pärnu→Märjamaa→Kernu→Laagri);
 * T11 Laagri–Jüri–Väo; T1 Väo–Muuga; T8 Tallinn–Keila–Paldiski.
 * Punkty co ≤ ~10 km (nie Nõmme zamiast T11; nie linia przez zatokę do Paldiski).
 */
export const CORRIDOR_EE: LatLon[] = [
  [57.87, 24.36], // Ikla / Ainaži (granica LV/EE)
  [58.00, 24.42],
  [58.15, 24.48],
  [58.25, 24.50],
  [58.385, 24.498], // Pärnu
  [58.55, 24.47],
  [58.70, 24.44],
  [58.904, 24.425], // Märjamaa (T4)
  [59.02, 24.42],
  [59.13, 24.43], // Kernu
  [59.25, 24.50],
  [59.35, 24.56], // Laagri (T4/T11)
  /* T11 obwodnica Laagri → Jüri → Väo */
  [59.35, 24.70],
  [59.354, 24.893], // Jüri (T11)
  [59.39, 24.90],
  [59.413, 24.884], // Väo (T1/T11)
  /* T1 Väo → Muuga */
  [59.45, 24.92],
  [59.50, 24.96], // Muuga
  /* T8 Tallinn → Keila → Paldiski (po ≤ 10 km) */
  [59.44, 24.75], // Tallinn Vanasadam / centrum
  [59.40, 24.55],
  [59.35, 24.45],
  [59.308, 24.413], // Keila (T8)
  [59.32, 24.25],
  [59.34, 24.10],
  [59.352, 24.058], // Paldiski
];

/** Terminale portowe — zdarzenie ≤ 2 km → corridorMatch=on niezależnie od numeru. */
export const EE_PORT_TERMINALS: LatLon[] = [
  [59.444, 24.768], // Tallinn Vanasadam / Old City Harbour
  [59.500, 24.958], // Muuga
  [59.352, 24.058], // Paldiski
];

/** F7 #733 B7 — warunki Tark Tee: administrator + usługa. */
export const EE_ATTRIBUTION = 'Transpordiamet / Tark Tee (tarktee.ee)';
export const EE_UA = 'WatchTower/BN6 (log-mar.pl; road-ee; +48 kontakt HHL)';
/** Nagłówek z dokumentacji Tark Tee — bez zmiany nazw sekretów (#716). */
export const EE_DATEX_KEY_HEADER = 'X-DATEX-API-KEY';
export const EE_SOURCE_REF = 'https://tarktee.ee/';
export const EE_DATEX_BASE = 'https://tarktee.ee/api/v1/datex';

/**
 * Kanały DATEX 2.3 + SRTI 3.6 (#716) + measurementSites (F7 #733 B5 — współrzędne stacji).
 * Śliskość/widoczność SRTI — w UI „niedostępne”; nie pobieramy temporarySlipperyRoad.
 */
export const EE_DATEX_FEEDS = [
  { code: 'RESTRICTIONS', path: 'restrictions', format: 'xml' as const },
  { code: 'SAFETY', path: 'safetyData', format: 'xml' as const },
  { code: 'MEASUREMENT_SITES', path: 'measurementSites', format: 'xml' as const },
  { code: 'WEATHER', path: 'weatherData', format: 'xml' as const },
  { code: 'SRTI_ROADWORKS', path: 'srti/shortTermRoadWorks', format: 'json' as const },
  { code: 'SRTI_ACCIDENT', path: 'srti/unprotectedAccident', format: 'json' as const },
  { code: 'SRTI_BLOCKAGE', path: 'srti/unmanagedBlockage', format: 'json' as const },
  { code: 'SRTI_ANIMAL', path: 'srti/animalObstacle', format: 'json' as const },
] as const;

export type EeDatexFeedCode = (typeof EE_DATEX_FEEDS)[number]['code'];

export function eeDatexFeedUrl(path: string): string {
  return `${EE_DATEX_BASE}/${path.replace(/^\//, '')}`;
}

/**
 * Klucz API: TARKTEE_DATEX_TOKEN, potem PASSWORD (gdy klucz leży w parze USER/PASSWORD).
 * Nazw sekretów nie zmieniamy (#716). F7 #736 B2 — trim + meta długości.
 */
export function eeDatexApiKeyMeta(env: Record<string, string | undefined>): BalticKeyMeta {
  return balticKeyMeta(env.TARKTEE_DATEX_TOKEN ?? env.TARKTEE_DATEX_PASSWORD ?? '');
}

export function eeDatexApiKey(env: Record<string, string | undefined>): string {
  return eeDatexApiKeyMeta(env).key;
}

export function nearEePortTerminal(
  lat: number,
  lon: number,
  maxKm = 2,
): boolean {
  for (const p of EE_PORT_TERMINALS) {
    if (haversineKm([lat, lon], p) <= maxKm) return true;
  }
  return false;
}

/**
 * F7 #733 B1 — gołe „4” / „4 Tallinn–Pärnu–Ikla” → T4 (oraz 1/8/11 → T1/T8/T11).
 */
export function normalizeEeRoadRef(road: string | null | undefined): string | null {
  if (road == null || road === '') return null;
  const extracted = extractBalticRoadRef(road) ?? String(road).trim();
  const r = extracted.toUpperCase().replace(/\s+/g, '');
  if (/^(?:T)?([148]|11)$/.test(r)) {
    const n = r.replace(/^T/, '');
    return `T${n}`;
  }
  if (r === 'E67' || /^T\d{1,2}$/.test(r) || /^E\d{2,3}$/.test(r)) return r;
  return r;
}

/** EE: E67/T4 (Via Baltica) + T11 (obwodnica) + T1 przy Muuga; T8 przy Paldiski. */
export function eeRoadOnCorridor(
  road: string | null | undefined,
  e: Pick<BalticRoadEvent, 'lat' | 'lon'>,
): BalticCorridorRoadMatch {
  if (road == null || road === '') return 'unknown';
  const r = normalizeEeRoadRef(road) ?? '';
  if (r === 'E67' || r === 'T4' || r === 'T11') return 'on';
  if (r === 'T1') {
    /* Muuga / Tallinn wschód */
    if (
      e.lat != null && e.lon != null
      && e.lat >= 59.35 && e.lat <= 59.55
      && e.lon >= 24.70 && e.lon <= 25.20
    ) {
      return 'on';
    }
    return 'off';
  }
  if (r === 'T8') {
    /* Paldiski */
    if (
      e.lat != null && e.lon != null
      && e.lat >= 59.25 && e.lat <= 59.45
      && e.lon >= 23.90 && e.lon <= 24.30
    ) {
      return 'on';
    }
    return 'off';
  }
  return 'off';
}

export function eeCorridorBboxes(): FiBbox[] {
  const pad = 0.30;
  const boxes: FiBbox[] = [];
  for (let i = 0; i + 1 < CORRIDOR_EE.length; i++) {
    const [lat1, lon1] = CORRIDOR_EE[i]!;
    const [lat2, lon2] = CORRIDOR_EE[i + 1]!;
    boxes.push({
      xMin: Math.min(lon1, lon2) - pad,
      xMax: Math.max(lon1, lon2) + pad,
      yMin: Math.min(lat1, lat2) - pad,
      yMax: Math.max(lat1, lat2) + pad,
    });
  }
  return boxes;
}

export function eventInEeBboxes(
  e: Pick<BalticRoadEvent, 'lat' | 'lon'>,
  boxes: FiBbox[] = eeCorridorBboxes(),
): boolean {
  return eventInFiBboxes(e, boxes);
}

export function filterInEeBboxes(
  events: BalticRoadEvent[],
  boxes: FiBbox[] = eeCorridorBboxes(),
): BalticRoadEvent[] {
  return events.filter((e) => eventInEeBboxes(e, boxes));
}

/** Normalizacja lat/lon EE (~57.5–59.8 N, 21.8–28.2 E). */
export function eeNormalizeLatLon(a: number, b: number): {
  lat: number; lon: number; swapped: boolean;
} {
  const inEe = (lat: number, lon: number) =>
    lat >= 57.4 && lat <= 59.9 && lon >= 21.5 && lon <= 28.5;
  if (inEe(a, b)) return { lat: a, lon: b, swapped: false };
  if (inEe(b, a)) return { lat: b, lon: a, swapped: true };
  return { lat: a, lon: b, swapped: false };
}

export function eeCoordsFromRecord(rec: string): {
  lat: number; lon: number; swapped: number;
} | null {
  const lat = Number(lvTag(rec, 'latitude'));
  const lon = Number(lvTag(rec, 'longitude'));
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    const norm = eeNormalizeLatLon(lat, lon);
    return { lat: norm.lat, lon: norm.lon, swapped: norm.swapped ? 1 : 0 };
  }
  const posRaw = rec.match(/<(?:\w+:)?posList\b[^>]*>([^<]*)<\/(?:\w+:)?posList>/i)?.[1]
    ?? rec.match(/<(?:\w+:)?pos\b[^>]*>([^<]*)<\/(?:\w+:)?pos>/i)?.[1];
  if (!posRaw) return null;
  const nums = posRaw.trim().split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
  if (nums.length < 2) return null;
  let sumLat = 0;
  let sumLon = 0;
  let n = 0;
  let swapped = 0;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    const norm = eeNormalizeLatLon(nums[i]!, nums[i + 1]!);
    if (norm.swapped) swapped++;
    sumLat += norm.lat;
    sumLon += norm.lon;
    n++;
  }
  return n ? { lat: sumLat / n, lon: sumLon / n, swapped } : null;
}

const EE_TYPE_PL: Record<string, string> = {
  ...LV_TYPE_PL,
  MaintenanceWorks: 'roboty',
  Roadworks: 'roboty',
  ShortTermRoadWorks: 'roboty krótkoterminowe',
  UnprotectedAccident: 'wypadek',
  UnmanagedBlockage: 'blokada',
  AnimalPresenceOnRoad: 'zwierzę na drodze',
  AnimalObstacle: 'zwierzę na drodze',
};

function eeTypeLabel(type: string): string {
  const bare = type.replace(/^.*:/, '');
  return EE_TYPE_PL[bare] ?? 'utrudnienie';
}

function eeParseWeightLimitT(rec: string): number | null {
  const raw = lvTag(rec, 'maxGrossWeightAllowed')
    ?? lvTag(rec, 'grossVehicleWeight')
    ?? rec.match(/<(?:\w+:)?weightCharacteristic\b[\s\S]*?<(?:\w+:)?comparisonOp[^>]*>[\s\S]*?<(?:\w+:)?vehicleWeight\b[^>]*>([^<]+)</i)?.[1]
    ?? rec.match(/weight[^>]{0,40}>([\d.]+)\s*(?:t|ton)/i)?.[1];
  if (raw == null || raw === '') return null;
  const n = Number(String(raw).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** F7 #733 B9 — `lvTag(heightCharacteristic)` zwraca '' dla kontenera; `??` nie przechodzi dalej. */
function eeParseHeightLimitM(rec: string): number | null {
  const raw = lvTag(rec, 'vehicleHeight')
    || rec.match(/<(?:\w+:)?heightCharacteristic\b[\s\S]*?<(?:\w+:)?vehicleHeight\b[^>]*>([^<]+)</i)?.[1]
    || rec.match(/height[^>]{0,40}>([\d.]+)\s*m/i)?.[1]
    || '';
  if (!raw) return null;
  const n = Number(String(raw).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * F7 #733 B5 / DP-168 — est. lód/śnieg/szron (wspólny builder; nie „märg”).
 * Tylko pola treści, nie surowy XML.
 */
export const EE_ICY_CONTENT_RE = buildBalticIcyContentRe(['ee', 'common']);

function eeParseWidthLimitM(rec: string): number | null {
  const raw = rec.match(/<(?:\w+:)?widthCharacteristic\b[\s\S]*?<(?:\w+:)?vehicleWidth\b[^>]*>([^<]+)</i)?.[1]
    ?? rec.match(/width[^>]{0,40}>([\d.]+)\s*m/i)?.[1];
  if (raw == null || raw === '') return null;
  const n = Number(String(raw).replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Decyzja 85 jak LV: zwykłe roboty → LOW; HIGH tylko zamknięcie / blokada / wypadek z blokadą;
 * DP-168 N3: limit masy z liczbą → MEDIUM w parserze (weightLimitRisk → HIGH przy ładunku > limit);
 * F7 #733 B5: WEATHER HIGH tylko lód/śnieg/szron / widoczność < 200 m.
 */
export function eeSeverityForRecord(
  code: EeDatexFeedCode | string,
  recOrText: string,
  opts: {
    signals?: ReturnType<typeof lvRecordSignals>;
    weightLimitT?: number | null;
    contentText?: string;
    visibilityM?: number | null;
  } = {},
): RiskSeverity {
  const sig = opts.signals ?? lvRecordSignals(recOrText);
  const content = opts.contentText ?? '';
  if (opts.weightLimitT != null) return 'MEDIUM';
  if (sig.hasDimLimit && !sig.roadClosed && !sig.carriagewayBlocked) return 'MEDIUM';
  /* F7 #733 N1 — Accident tylko z pól treści / kodu, nie z surowego JSON.stringify(rec). */
  const accidentHit = code === 'SRTI_ACCIDENT'
    || /Accident/i.test(content)
    || /UnprotectedAccident/i.test(content);
  if (accidentHit) {
    return (sig.roadClosed || sig.carriagewayBlocked) ? 'HIGH' : 'MEDIUM';
  }
  if (code === 'SRTI_BLOCKAGE' || sig.roadClosed || sig.carriagewayBlocked) return 'HIGH';
  if (sig.laneClosures || sig.alternateTraffic || sig.narrowOrContraflow || sig.hasDetour) {
    return 'MEDIUM';
  }
  if (code === 'WEATHER' || code === 'EE_WEATHER' || code === 'MEASUREMENT_SITES') {
    const vis = opts.visibilityM;
    const lowVis = vis != null && Number.isFinite(vis) && vis > 0 && vis < 200;
    const icy = EE_ICY_CONTENT_RE.test(content)
      || LV_ICY_DATEX_TYPE_RE.test(content);
    if (icy || lowVis) return 'HIGH';
    return 'MEDIUM';
  }
  if (code === 'SRTI_ANIMAL') return 'MEDIUM';
  if (sig.speedLimitOnly) return 'LOW';
  /* Zwykłe roboty / restrictions bez zamknięcia — tylko pola treści (N1). */
  if (
    code === 'RESTRICTIONS'
    || code === 'SRTI_ROADWORKS'
    || code === 'SAFETY'
    || /MaintenanceWorks|Roadworks|ConstructionWorks|ShortTermRoadWorks/i.test(content || recOrText)
  ) {
    return 'LOW';
  }
  return 'LOW';
}

export type EeParseStats = {
  parsed: number;
  skipped: number;
  swapped: number;
  /** F7 #733 N8 — skąd numer drogi. */
  roadFromPole?: number;
  roadFromOpis?: number;
  /** F7 #733 r2 B2 — bloki weather / pominięte bez stacji. */
  weatherBlocks?: number;
  weatherNoSite?: number;
};

/** DATEX II 2.3 XML (restrictions / safety). Weather → parseEeWeatherData. */
export function parseEeDatexXml(
  xml: string,
  code: EeDatexFeedCode,
  stats?: EeParseStats,
): BalticRoadEvent[] {
  if (!xml || typeof xml !== 'string') return [];
  if (code === 'WEATHER' || code === 'MEASUREMENT_SITES') return [];
  const out: BalticRoadEvent[] = [];
  const recs = xml.split(/<(?:\w+:)?situationRecord\b/i).slice(1);
  let skipped = 0;
  let swapped = 0;
  let roadFromPole = 0;
  let roadFromOpis = 0;
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
    const coords = eeCoordsFromRecord(rec);
    if (!coords) { skipped++; continue; }
    const { lat, lon } = coords;
    swapped += coords.swapped;
    const comment = lvPublicComment(rec) || eeTypeLabel(String(type));
    const signals = lvRecordSignals(`${rec}\n${comment}`);
    const weightLimitT = eeParseWeightLimitT(rec);
    const heightLimitM = eeParseHeightLimitM(rec);
    const widthLimitM = eeParseWidthLimitM(rec);
    const severity = eeSeverityForRecord(code, comment, {
      signals, weightLimitT, contentText: comment,
    });
    const roadRaw = lvTag(rec, 'roadNumber');
    let road: string | null = null;
    if (roadRaw) {
      road = normalizeEeRoadRef(extractBalticRoadRef(roadRaw) ?? roadRaw.trim());
      roadFromPole++;
    } else {
      road = normalizeEeRoadRef(extractBalticRoadRefPreferStreet(null, comment));
      if (road) roadFromOpis++;
    }
    const label = eeTypeLabel(String(type));
    out.push({
      id,
      title: road ? `${label} · ${road}` : label,
      detail: comment,
      severity,
      lat,
      lon,
      kind: code,
      start: lvTag(rec, 'overallStartTime') ?? null,
      end: lvTag(rec, 'overallEndTime') ?? null,
      road,
      hasDetour: signals.hasDetour || BALTIC_DETOUR_RE.test(comment),
      roadClosed: signals.roadClosed || signals.carriagewayBlocked,
      weightLimitT,
      heightLimitM,
      widthLimitM,
    });
  }
  if (stats) {
    stats.parsed += out.length;
    stats.skipped += skipped;
    stats.swapped += swapped;
    stats.roadFromPole = (stats.roadFromPole ?? 0) + roadFromPole;
    stats.roadFromOpis = (stats.roadFromOpis ?? 0) + roadFromOpis;
  }
  return out;
}

/** Mapa id stacji → współrzędne (measurementSites / MeasurementSiteTablePublication). */
export function parseEeMeasurementSites(xml: string): Map<string, LatLon> {
  const map = new Map<string, LatLon>();
  if (!xml || typeof xml !== 'string') return map;
  const chunks = xml.split(/<(?:\w+:)?measurementSiteRecord\b/i).slice(1);
  for (const raw of chunks) {
    const rec = raw.split(/<\/(?:\w+:)?measurementSiteRecord>/i)[0] ?? '';
    const attr = rec.slice(0, Math.max(0, rec.indexOf('>')));
    const id = (attr.match(/\bid="([^"]+)"/i)?.[1]
      ?? lvTag(rec, 'measurementSiteIdentification')
      ?? lvTag(rec, 'id')
      ?? '').trim();
    if (!id) continue;
    const coords = eeCoordsFromRecord(rec);
    if (!coords) continue;
    map.set(id, [coords.lat, coords.lon]);
  }
  return map;
}

/**
 * F7 #733 r2 B1 — `lvTag(kontener)` zwraca '' gdy w środku jest element (temperature /
 * percentage / integerMetreDistance); czytaj zagnieżdżone jak B9 vehicleHeight.
 */
function eeNestedMeasure(
  block: string,
  container: string,
  innerTags: string[],
): string {
  const direct = lvTag(block, container);
  if (direct) return direct;
  const chunk = block.match(
    new RegExp(`<(?:\\w+:)?${container}\\b[\\s\\S]*?</(?:\\w+:)?${container}>`, 'i'),
  )?.[0] ?? '';
  const scope = chunk || block;
  for (const tag of innerTags) {
    const v = lvTag(scope, tag);
    if (v) return v;
  }
  for (const tag of innerTags) {
    const v = lvTag(block, tag);
    if (v) return v;
  }
  return '';
}

/**
 * F7 #733 B5 / r2 B1 — MeasuredDataPublication: połącz z measurementSites;
 * niekorzystne: lód/śnieg/szron w treści, temp. ≤ 0 °C + (RH≥90 | opad | mokra nawierzchnia),
 * widoczność < 200 m. „märg” samo → nie. Zimno+mokro → HIGH (spowolnienie).
 */
export function parseEeWeatherData(
  xml: string,
  sites: Map<string, LatLon>,
  stats?: EeParseStats,
): BalticRoadEvent[] {
  if (!xml || typeof xml !== 'string') return [];
  const byId = new Map<string, BalticRoadEvent>();
  let skipped = 0;
  let weatherBlocks = 0;
  let weatherNoSite = 0;
  const blocks = xml.split(/<(?:\w+:)?siteMeasurements\b/i).slice(1);
  for (const raw of blocks) {
    weatherBlocks++;
    const block = raw.split(/<\/(?:\w+:)?siteMeasurements>/i)[0] ?? raw;
    const ref = (block.match(
      /<(?:\w+:)?measurementSiteReference\b[^>]*(?:id|idRef|reference)="([^"]+)"/i,
    )?.[1]
      ?? block.match(/<(?:\w+:)?measurementSiteReference\b[^>]*>([^<]+)</i)?.[1]
      ?? '').trim();
    const site = ref ? sites.get(ref) : undefined;
    if (!site) { skipped++; weatherNoSite++; continue; }
    const [lat, lon] = site;
    const textBlob = [
      ...[...block.matchAll(/<(?:\w+:)?value\b[^>]*>([^<]*)</gi)].map((m) => m[1]),
      ...[...block.matchAll(/<(?:\w+:)?weatherRelatedRoadConditionType\b[^>]*>([^<]*)</gi)].map((m) => m[1]),
      ...[...block.matchAll(/<(?:\w+:)?roadSurfaceConditionType\b[^>]*>([^<]*)</gi)].map((m) => m[1]),
    ].join(' ');
    const visRaw = eeNestedMeasure(block, 'minimumVisibilityDistance', [
      'integerMetreDistance', 'metreDistance', 'distance',
    ])
      || lvTag(block, 'visibility')
      || block.match(/visibility[^>]{0,40}>([\d.]+)/i)?.[1]
      || '';
    const visibilityM = visRaw !== ''
      ? Number(String(visRaw).replace(/[^\d.]/g, ''))
      : null;
    const tempRaw = eeNestedMeasure(block, 'roadSurfaceTemperature', ['temperature'])
      || lvTag(block, 'temperature')
      || block.match(/surfaceTemperature[^>]{0,40}>([-\d.]+)/i)?.[1]
      || '';
    const surfaceTempC = tempRaw !== ''
      ? Number(String(tempRaw).replace(/[^\d.-]/g, ''))
      : null;
    const humidityRaw = eeNestedMeasure(block, 'relativeHumidity', ['percentage']);
    const humidityPct = humidityRaw !== ''
      ? Number(String(humidityRaw).replace(/[^\d.]/g, ''))
      : null;
    const precip = /precipitation|opad|vihm|rain/i.test(textBlob)
      || /<(?:\w+:)?precipitation\b/i.test(block);
    const wetSurface = /wet|moisture|niisk|märg/i.test(textBlob)
      || /roadSurfaceConditionType[^>]*>\s*wet/i.test(block);
    /* F7 r2 B1: wilgoć tylko RH≥90 albo opad / mokra nawierzchnia — nie dowolny <humidity>. */
    const moist = (humidityPct != null && Number.isFinite(humidityPct) && humidityPct >= 90)
      || precip
      || wetSurface;
    const lowVis = visibilityM != null && Number.isFinite(visibilityM)
      && visibilityM > 0 && visibilityM < 200;
    const icyText = EE_ICY_CONTENT_RE.test(textBlob)
      || LV_ICY_DATEX_TYPE_RE.test(textBlob);
    const coldWet = surfaceTempC != null && Number.isFinite(surfaceTempC)
      && surfaceTempC <= 0 && moist;
    /* Samo „märg” bez lodu / zimna / niskiej widoczności → pomiń. */
    if (!icyText && !lowVis && !coldWet) { skipped++; continue; }
    const bits = [
      icyText ? textBlob.trim().slice(0, 120) : '',
      surfaceTempC != null ? `temp nawierzchni ${surfaceTempC} C` : '',
      humidityPct != null ? `wilgotnosc ${humidityPct} %` : '',
      visibilityM != null ? `widocznosc ${visibilityM} m` : '',
    ].filter(Boolean);
    const detail = bits.join(' · ') || 'pogoda drogowa';
    /* F7 r2 B1: zimno+mokro → HIGH (spowolnienie); nie MEDIUM. */
    let severity = eeSeverityForRecord('EE_WEATHER', detail, {
      contentText: detail, visibilityM,
    });
    if (coldWet || icyText || lowVis) severity = 'HIGH';
    const measuredAt = (
      lvTag(block, 'measurementTimeDefault')
      || lvTag(block, 'timeDefault')
      || block.match(/<(?:\w+:)?(?:measurementTimeDefault|timeDefault)\b[^>]*>([^<]+)</i)?.[1]
      || ''
    ).trim();
    /* F7 r2 drobne: dwa pomiary tej samej stacji — id z czasem; dedup po gorszej wadze. */
    const id = measuredAt ? `ee-wx:${ref}:${measuredAt}` : `ee-wx:${ref}`;
    const next: BalticRoadEvent = {
      id,
      title: 'Pogoda drogowa',
      detail,
      severity,
      lat,
      lon,
      kind: 'EE_WEATHER',
      start: measuredAt || null,
      end: null,
      visibilityM: visibilityM != null && Number.isFinite(visibilityM) ? visibilityM : null,
      corridorMatch: 'on',
    };
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, next);
    } else {
      const rank = (s: RiskSeverity) => (s === 'HIGH' ? 3 : s === 'MEDIUM' ? 2 : 1);
      if (rank(next.severity) > rank(prev.severity)) byId.set(id, next);
    }
  }
  const out = [...byId.values()];
  if (stats) {
    stats.parsed += out.length;
    stats.skipped += skipped;
    stats.weatherBlocks = (stats.weatherBlocks ?? 0) + weatherBlocks;
    stats.weatherNoSite = (stats.weatherNoSite ?? 0) + weatherNoSite;
  }
  return out;
}

/** SRTI 3.6 JSON (domyślny format Tark Tee). */
export function parseEeSrtiJson(
  json: unknown,
  code: EeDatexFeedCode,
  stats?: EeParseStats,
): BalticRoadEvent[] {
  const bag: unknown[] = [];
  const walk = (node: unknown): void => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const x of node) walk(x);
      return;
    }
    if (typeof node !== 'object') return;
    const o = node as Record<string, unknown>;
    const nested = o.situationRecord ?? o.SituationRecord
      ?? o.situations ?? o.payload ?? o.payloadPublication;
    if (nested != null && nested !== o) {
      walk(nested);
      return;
    }
    if (
      (typeof o.id === 'string' || typeof o.situationRecordId === 'string')
      && (o.latitude != null || o.pointCoordinates != null
        || o.groupOfLocations != null || o.locationReference != null
        || o.Latitude != null || o.geometry != null)
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
  let swapped = 0;
  for (const raw of bag) {
    if (!raw || typeof raw !== 'object') continue;
    const o = raw as Record<string, unknown>;
    const rec = (o.situationRecord ?? o.SituationRecord ?? o) as Record<string, unknown>;
    const id = String(rec.id ?? rec.situationRecordId ?? o.id ?? '').trim();
    if (!id) { skipped++; continue; }
    let lat: number | null = null;
    let lon: number | null = null;
    let pairSwapped = 0;
    const latDirect = Number(rec.latitude ?? rec.Latitude);
    const lonDirect = Number(rec.longitude ?? rec.Longitude);
    if (Number.isFinite(latDirect) && Number.isFinite(lonDirect)) {
      const norm = eeNormalizeLatLon(latDirect, lonDirect);
      lat = norm.lat;
      lon = norm.lon;
      if (norm.swapped) pairSwapped = 1;
    } else {
      const pc = rec.pointCoordinates ?? rec.PointCoordinates;
      if (pc && typeof pc === 'object') {
        const p = pc as { latitude?: unknown; longitude?: unknown };
        const la = Number(p.latitude);
        const lo = Number(p.longitude);
        if (Number.isFinite(la) && Number.isFinite(lo)) {
          const norm = eeNormalizeLatLon(la, lo);
          lat = norm.lat;
          lon = norm.lon;
          if (norm.swapped) pairSwapped = 1;
        }
      }
      if (lat == null) {
        const blob = JSON.stringify(rec.locationReference ?? rec.groupOfLocations ?? rec.geometry ?? {});
        const pos = blob.match(/"posList"\s*:\s*"([^"]+)"/i)?.[1]
          ?? blob.match(/"pos"\s*:\s*"([^"]+)"/i)?.[1]
          ?? blob.match(/"coordinates"\s*:\s*\[\s*([-\d.]+)\s*,\s*([-\d.]+)/)?.slice(1).join(' ');
        if (pos) {
          const nums = String(pos).trim().split(/[\s,]+/).map(Number).filter((n) => Number.isFinite(n));
          if (nums.length >= 2) {
            /* GeoJSON często [lon, lat] */
            const asLonLat = eeNormalizeLatLon(nums[1]!, nums[0]!);
            const asLatLon = eeNormalizeLatLon(nums[0]!, nums[1]!);
            const pick = asLatLon.swapped && !asLonLat.swapped ? asLonLat : asLatLon;
            lat = pick.lat;
            lon = pick.lon;
            if (pick.swapped) pairSwapped = 1;
          }
        }
      }
    }
    if (lat == null || lon == null) { skipped++; continue; }
    swapped += pairSwapped;
    const type = String(rec.type ?? rec['@type'] ?? rec.situationRecordType ?? code);
    let comment = '';
    const gpc = rec.generalPublicComment ?? rec.GeneralPublicComment ?? rec.comment ?? rec.description;
    if (typeof gpc === 'string') comment = gpc;
    else if (gpc && typeof gpc === 'object') {
      comment = JSON.stringify(gpc).match(/"value"\s*:\s*"([^"]*)"/)?.[1] ?? '';
    }
    comment = decodeXmlEntities(comment || eeTypeLabel(type));
    /* F7 #733 N1 — sygnały z pól treści, nie z całego JSON.stringify(rec). */
    const contentForSig = [comment, type, String(rec.roadOrCarriagewayOrLaneManagementType ?? '')].join(' ');
    const signals = lvRecordSignals(contentForSig);
    const severity = eeSeverityForRecord(code, contentForSig, {
      signals, contentText: comment,
    });
    const roadRaw = rec.roadNumber ?? rec.RoadNumber;
    let road: string | null = null;
    if (roadRaw != null && String(roadRaw).trim()) {
      road = normalizeEeRoadRef(extractBalticRoadRef(String(roadRaw)) ?? String(roadRaw).trim());
      if (stats) stats.roadFromPole = (stats.roadFromPole ?? 0) + 1;
    } else {
      road = normalizeEeRoadRef(extractBalticRoadRefPreferStreet(null, comment));
      if (road && stats) stats.roadFromOpis = (stats.roadFromOpis ?? 0) + 1;
    }
    const label = eeTypeLabel(type.replace(/^.*:/, ''));
    out.push({
      id,
      title: road ? `${label} · ${road}` : label,
      detail: comment,
      severity,
      lat,
      lon,
      kind: code,
      start: typeof rec.overallStartTime === 'string' ? rec.overallStartTime : null,
      end: typeof rec.overallEndTime === 'string' ? rec.overallEndTime : null,
      road,
      hasDetour: signals.hasDetour || BALTIC_DETOUR_RE.test(comment),
      roadClosed: signals.roadClosed || signals.carriagewayBlocked
        || code === 'SRTI_BLOCKAGE',
    });
  }
  if (stats) {
    stats.parsed += out.length;
    stats.skipped += skipped;
    stats.swapped += swapped;
  }
  return out;
}

/**
 * F7 #733 B4 — jak LV: pierwszy znak; markery jako element/klucz (`hasDatexMarker`);
 * `{"message"}` / `null` / `[]` / `<Error>` / HTML → unknown.
 * WEATHER + sitesMap → parseEeWeatherData; MEASUREMENT_SITES → puste zdarzenia (mapa w jobie).
 */
export function parseEeFeedBody(
  text: string,
  code: EeDatexFeedCode,
  prefer: 'xml' | 'json',
  stats?: EeParseStats,
  sites?: Map<string, LatLon>,
): { events: BalticRoadEvent[]; format: string; sites?: Map<string, LatLon> } {
  const t = String(text ?? '').trim();
  if (!t) return { events: [], format: 'empty' };
  const c0 = t[0]!;
  if (prefer === 'xml' || c0 === '<') {
    if (!hasDatexMarker(t, 'xml')) {
      if (stats) stats.skipped += 1;
      return { events: [], format: 'unknown' };
    }
    if (code === 'MEASUREMENT_SITES') {
      const parsedSites = parseEeMeasurementSites(t);
      if (stats) stats.parsed += parsedSites.size;
      return { events: [], format: 'datex-xml', sites: parsedSites };
    }
    if (code === 'WEATHER') {
      return {
        events: parseEeWeatherData(t, sites ?? new Map(), stats),
        format: 'datex-xml',
      };
    }
    return { events: parseEeDatexXml(t, code, stats), format: 'datex-xml' };
  }
  if (c0 === '{' || c0 === '[') {
    try {
      const json = JSON.parse(t) as unknown;
      if (json === null || (Array.isArray(json) && json.length === 0)) {
        if (stats) stats.skipped += 1;
        return { events: [], format: 'unknown' };
      }
      if (
        json && typeof json === 'object' && !Array.isArray(json)
        && typeof (json as { message?: unknown }).message === 'string'
        && !hasDatexMarker(t, 'json')
      ) {
        if (stats) stats.skipped += 1;
        return { events: [], format: 'unknown' };
      }
      if (!hasDatexMarker(t, 'json')) {
        if (stats) stats.skipped += 1;
        return { events: [], format: 'unknown' };
      }
      /* F7 #733 r3: poprawna struktura z 0 rekordów = OK; unknown tylko bez struktury. */
      if (!eeJsonHasValidStructure(json)) {
        if (stats) stats.skipped += 1;
        return { events: [], format: 'unknown' };
      }
      return { events: parseEeSrtiJson(json, code, stats), format: 'datex-json' };
    } catch {
      return { events: [], format: 'unknown' };
    }
  }
  return { events: [], format: 'unknown' };
}

/**
 * F7 #733 r3 — rozpoznana struktura DATEX/GeoJSON (także pusta).
 * `{"features":[]}` / `payload` bez situation → OK; `payload:null` / `null` / `[]` → false.
 */
function eeJsonHasValidStructure(json: unknown): boolean {
  if (json == null) return false;
  if (Array.isArray(json)) return false;
  if (typeof json !== 'object') return false;
  const o = json as Record<string, unknown>;
  if (Array.isArray(o.features)) return true;
  if ('payload' in o) {
    const p = o.payload;
    if (p == null) return false;
    if (typeof p === 'object') return true;
    return false;
  }
  if (o.situationRecord != null || o.situations != null || o.payloadPublication != null) {
    return true;
  }
  return /"situationRecord"\s*:/i.test(JSON.stringify(json));
}
