/**
 * BN6 (#716) — drogi LT/LV/EE/FI.
 * cz.1: Finlandia Digitraffic road (bez klucza, CC BY 4.0 Fintraffic).
 * cz.2: Litwa eismoinfo restrictions + weather (bez klucza; Via Lietuva).
 * Do BN7 (geometria trasy): filtr bboxami korytarza (F7 #726 B2); FI bbox w [20,59,32,71].
 * LT: źródło nie podaje wypadków — zapis w detail / corridor note.
 */
import type { RiskInput, RiskSeverity } from './sync.ts';
import { seRoadSlowdownMult, type LatLon } from './road.ts';

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
  /** #716 LT: nieznane kody restrictionType (LD/SVKD) → detail.oryginal. */
  unknownCodes?: string[];
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

/**
 * Spowolnienie jak SE — tylko HIGH bez limitu masy/wysokości/szerokości
 * (F7 #726 kelirikko; F7 #727 B2: wiadukty/słabe mosty nie spowalniają).
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
      && e.lon != null,
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
    },
  };
}

/** Czy zdarzenie to limit wymiarów / most bez limitu masy → dimensionLimitRisk. */
export function isDimensionLimitEvent(e: BalticRoadEvent): boolean {
  if (e.weightLimitT != null) return false;
  if (e.heightLimitM != null || e.widthLimitM != null) return true;
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
    const detailParts = [
      desc,
      loc.street ? `ul. ${loc.street}` : '',
    ].filter(Boolean);
    /* F7 #727 N2: uwaga o wypadkach tylko w corridor / risk.uwaga_wypadki, nie w każdym detail. */
    const textForSev = `${title} ${desc}`;
    out.push({
      id,
      title,
      detail: detailParts.join(' · '),
      severity: ltSeverity(type, subtype, meta, textForSev),
      lat: pt?.[0] ?? null,
      lon: pt?.[1] ?? null,
      kind: subtype ?? type,
      start: typeof o.startTime === 'string' ? o.startTime : null,
      end: typeof o.endTime === 'string' ? o.endTime : null,
      weightLimitT: meta.weightLimitT,
      heightLimitM: meta.heightLimitM,
      widthLimitM: meta.widthLimitM,
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
 * F7 #727 B1/N3 — lód / gołoledź / szron / śnieg / błoto pośniegowe (granice słów).
 * Mokro/wilgotno (šlapia/drėgna) NIE jest niekorzystne.
 */
export const LT_ICY_RE =
  /(?:^|[^a-ząčęėįšųūžA-ZĄČĘĖĮŠŲŪŽ])(?:led|plikled(?:is)?|pliklus|lijundr|sniego|snieg|šerkšn|sersn|ice|snow|go[lł]oled(?:ź|z)?|b[lł]ot(?:o)?\s*po[sś]nieg)(?:[^a-ząčęėįšųūžA-ZĄČĘĖĮŠŲŪŽ]|$)/i;

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

/** Stacje pogodowe w bboxach → zdarzenia HIGH do spowolnienia (bez osobnych ryzyk). */
export function ltWeatherToSlowdownEvents(
  stations: LtWeatherStation[],
  boxes: FiBbox[] = ltCorridorBboxes(),
): BalticRoadEvent[] {
  return stations
    .filter((s) => s.adverse && eventInLtBboxes({ lat: s.lat, lon: s.lon }, boxes))
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
    }));
}
