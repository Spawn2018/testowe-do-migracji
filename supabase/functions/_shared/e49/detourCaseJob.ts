/**
 * E49-b cz.2 (DP-206 / D-20261104-0105-01 Z3): zamknięcie drogi/mostu na trasie
 * → sprawa SCX „Objazd czy postój?” + HERE Routing truck (avoid[areas]).
 * F7 #791 r2: B3–B6, B8–B9.
 */
import {
  avoidBboxAround,
  classifyClosureReason,
  closureSourceOf,
  detourDedupKey,
  looksLikeRoadClosure,
  permitDetourRisk,
  planHold,
  type ClosureReason,
  type ClosureSource,
  type DetourCountry,
} from './detourPlan.ts';
import {
  buildDetourRoutingUrl,
  maskHereApiKey,
  noDetourWhyFromBody,
  simplifyLine,
  summarizeHereRoute,
  viaFromHereSummary,
  type TruckDims,
} from './detourHere.ts';
import { completeDims, type SetDims } from '../here/routeCheck.ts';
import { haversineKm, bearingDeg } from './corridorWind.ts';

const USER_AGENT = 'WatchTower/1.0 (E49 detour; +https://tower.log-mar.pl)';
/** Średnia prędkość do estymacji decideBy (km/h). */
const APPROACH_KMH = 70;
/** Max zapytań HERE Routing na jeden przebieg joba (pula D-77/D-78). */
export const DETOUR_HERE_MAX_PER_RUN = 8;
/** Odcinek bazowy / objazd: km przed i za zamknięciem na korytarzu. */
const DETOUR_SEGMENT_KM = 5;

export type DetourRiskRow = { kind: string; level: 'warn' | 'ok'; text: string };

export type RoadClosureCandidate = {
  /** Prefiks dedup ryzyka / id źródła (np. ROAD_SE:SIT:123). */
  closureRef: string;
  country: DetourCountry;
  place: string;
  title: string;
  detailText: string;
  lat: number;
  lon: number;
  noticeIso: string;
  untilIso: string | null;
  roadClosed?: boolean;
  /** Korytarz powiązany (SE_E4, PL_ROAD, ROAD_LT…). */
  corridor: string;
  /** km wzdłuż korytarza (null = wyliczyć z polilinii). */
  atKm: number | null;
  obokTrasy?: boolean;
  /** detail.korytarz_droga: on|off|unknown */
  korytarzDroga?: string | null;
};

export type DetourLoadLeg = {
  loadId: string;
  code: string;
  fromKm: number;
  currentLeg: boolean;
  status: string;
  baseEtaIso: string | null;
  dims: SetDims;
  /** [lat, lon] auta albo null. */
  position: readonly [number, number] | null;
  /** Tryb zezwolenia na tym odcinku. */
  permitMode: 'TRASA' | 'FIRMA' | 'NONE' | 'UNKNOWN';
};

export type DetourCasePayload = {
  hold: {
    untilIso: string | null;
    addMin: number;
    etaIso: string;
    risks: DetourRiskRow[];
  };
  detour:
    | {
        addKm: number;
        addMin: number;
        etaIso: string;
        via: string;
        risks: DetourRiskRow[];
        line: Array<[number, number]> | null;
      }
    | { none: true; why: string };
  closure: {
    lat: number;
    lon: number;
    corridor: string;
    atKm: number | null;
    avoid: string;
  };
  hereUrlMasked?: string;
};

export type DetourCaseUpsert = {
  loadId: string;
  dedupKey: string;
  country: DetourCountry;
  place: string;
  reason: ClosureReason;
  reasonDetail: string | null;
  source: ClosureSource;
  noticeAt: string;
  untilAt: string | null;
  decideBy: string;
  payload: DetourCasePayload;
  riskDedupKey: string | null;
};

/** Czy ryzyko/sytuacja to zamknięcie na trasie (nie „obok”). */
export function isOnRouteClosure(c: Pick<RoadClosureCandidate, 'title' | 'detailText' | 'roadClosed' | 'obokTrasy' | 'korytarzDroga'>): boolean {
  if (c.obokTrasy === true) return false;
  if (c.korytarzDroga === 'off') return false;
  if (/obok trasy/i.test(c.title)) return false;
  return looksLikeRoadClosure(`${c.title} ${c.detailText}`, c.roadClosed);
}

/** Kraj z kind ryzyka ROAD_XX / korytarza. */
export function countryFromRoadKind(kindOrCorridor: string): DetourCountry | null {
  const k = kindOrCorridor.toUpperCase();
  if (k.includes('ROAD_SE') || k.startsWith('SE_')) return 'SE';
  if (k.includes('ROAD_PL') || k.startsWith('PL_')) return 'PL';
  if (k.includes('ROAD_LT') || k === 'ROAD_LT') return 'LT';
  if (k.includes('ROAD_LV') || k === 'ROAD_LV') return 'LV';
  if (k.includes('ROAD_EE') || k === 'ROAD_EE') return 'EE';
  if (k.includes('ROAD_FI') || k.startsWith('FI_')) return 'FI';
  return null;
}

/** Corridor code z kind ryzyka (alias źródła — B3 mapuje na nogę trasy). */
export function corridorFromRoadKind(kind: string, road?: string | null): string {
  const k = kind.toUpperCase();
  if (k.includes('ROAD_SE') || k === 'ROAD_SE') {
    if (road && /^E\s*22$/i.test(road.trim())) return 'SE_E22';
    if (road && /^E\s*18$/i.test(road.trim())) return 'SE_E18_KPS';
    return 'SE_E4';
  }
  if (k.includes('ROAD_PL') || k === 'ROAD_PL') return 'PL_ROAD';
  if (k.includes('ROAD_LT')) return 'ROAD_LT';
  if (k.includes('ROAD_LV')) return 'ROAD_LV';
  if (k.includes('ROAD_EE')) return 'ROAD_EE';
  if (k.includes('ROAD_FI')) return 'ROAD_FI';
  return kind;
}

/**
 * F7 #791 B3: ROAD_LT/LV/EE → PL_EE_E67; ROAD_FI → FI_E75; SE_E4 → SE_E4_STO;
 * przy korytarz_droga=on — kraj → noga trasy.
 */
export function corridorMatchesLeg(
  closure: Pick<RoadClosureCandidate, 'corridor' | 'country' | 'korytarzDroga'>,
  legCode: string,
): boolean {
  if (closure.korytarzDroga === 'off') return false;
  if (closure.corridor === legCode) return true;

  const c = closure.corridor.toUpperCase();
  const leg = legCode.toUpperCase();

  if ((c === 'ROAD_LT' || c === 'ROAD_LV' || c === 'ROAD_EE') && leg === 'PL_EE_E67') return true;
  if (c === 'ROAD_FI' && leg === 'FI_E75') return true;
  if (c === 'PL_ROAD' && (leg === 'PL_ROAD' || leg === 'PL_EE_E67')) return true;
  if (c === 'SE_E4' && (leg === 'SE_E4' || leg === 'SE_E4_STO')) return true;
  if (c === 'SE_E22' && leg.includes('E22')) return true;
  if (c === 'SE_E18_KPS' && (leg === 'SE_E18_KPS' || leg.includes('E18'))) return true;

  if (closure.korytarzDroga === 'on' || closure.korytarzDroga == null) {
    switch (closure.country) {
      case 'LT':
      case 'LV':
      case 'EE':
        return leg === 'PL_EE_E67';
      case 'FI':
        return leg === 'FI_E75';
      case 'PL':
        return leg === 'PL_ROAD' || leg === 'PL_EE_E67' || leg.startsWith('PL_');
      case 'SE':
        return leg.startsWith('SE_');
    }
  }
  return false;
}

/** Miejsce z tytułu ryzyka (bez prefiksu „Warunki drogowe …:”). */
export function placeFromRoadTitle(title: string, road?: string | null): string {
  const m = title.match(/:\s*(.+)$/);
  const body = (m?.[1] ?? title).trim();
  const short = body.split(',')[0]?.trim() || body;
  if (short.length <= 80) return short;
  if (road) return `${road} zamknięty`;
  return `${short.slice(0, 77)}…`;
}

/**
 * decideBy ≈ dojazd do zjazdu przed zamknięciem.
 * Brak atKm → +2 h (bezpieczny termin).
 */
export function estimateDecideByIso(args: {
  nowIso: string;
  fromKm: number;
  atKm: number | null;
}): string {
  const now = Date.parse(args.nowIso);
  if (args.atKm == null || !Number.isFinite(args.atKm)) {
    return new Date(now + 2 * 3600_000).toISOString();
  }
  const ahead = Math.max(0, args.atKm - args.fromKm);
  const h = ahead / APPROACH_KMH;
  return new Date(now + Math.max(0.25, h) * 3600_000).toISOString();
}

/** Skrót via z notices — fallback gdy brak spans.names (B9). */
export function viaFromHereNotices(notices: readonly string[], fallback = 'objazd HERE'): string {
  for (const n of notices) {
    const m = n.match(/\b([A-Z]?\d{1,3}|E\s*\d{1,3}|DK\s*\d+)\b/i);
    if (m) return `przez ${m[1]!.replace(/\s+/g, '')}`;
  }
  return fallback;
}

/** GeoJSON LineString / MultiLineString → [[lon,lat],…]. */
export function coordsFromCorridorGeoJson(geo: unknown): Array<[number, number]> {
  if (!geo || typeof geo !== 'object') return [];
  const g = geo as { type?: string; coordinates?: unknown };
  if (g.type === 'LineString' && Array.isArray(g.coordinates)) {
    return (g.coordinates as number[][])
      .filter((c) => Array.isArray(c) && c.length >= 2)
      .map((c) => [Number(c[0]), Number(c[1])] as [number, number]);
  }
  if (g.type === 'MultiLineString' && Array.isArray(g.coordinates)) {
    const out: Array<[number, number]> = [];
    for (const part of g.coordinates as number[][][]) {
      for (const c of part ?? []) {
        if (Array.isArray(c) && c.length >= 2) out.push([Number(c[0]), Number(c[1])]);
      }
    }
    return out;
  }
  return [];
}

/**
 * Rzut punktu na polilinię korytarza → km wzdłuż trasy (F7 B4).
 * Współrzędne polilinii [lon,lat]; punkt (lat, lon).
 */
export function projectKmOnCorridor(
  coordsLonLat: readonly (readonly [number, number])[],
  lat: number,
  lon: number,
): number | null {
  if (coordsLonLat.length < 2) return null;
  let bestD = Infinity;
  let bestKm = 0;
  let traveled = 0;
  for (let i = 0; i < coordsLonLat.length - 1; i++) {
    const a = coordsLonLat[i]!;
    const b = coordsLonLat[i + 1]!;
    const segKm = haversineKm(a, b);
    if (!(segKm > 0)) continue;
    const cosLat = Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180);
    const dx = (b[0] - a[0]) * cosLat;
    const dy = b[1] - a[1];
    const len2 = dx * dx + dy * dy;
    let t = 0;
    if (len2 > 0) {
      t = (((lon - a[0]) * cosLat) * dx + (lat - a[1]) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
    }
    const pLon = a[0] + t * (b[0] - a[0]);
    const pLat = a[1] + t * (b[1] - a[1]);
    const d = haversineKm([lon, lat], [pLon, pLat]);
    if (d < bestD) {
      bestD = d;
      bestKm = traveled + t * segKm;
    }
    traveled += segKm;
  }
  if (!(bestD < 25)) return null; /* >25 km od korytarza — nie na trasie */
  return Math.round(bestKm * 10) / 10;
}

/** Punkt na polilinii w danym km (lat,lon). */
export function pointAtKm(
  coordsLonLat: readonly (readonly [number, number])[],
  km: number,
): [number, number] | null {
  if (coordsLonLat.length < 2) return null;
  let traveled = 0;
  const target = Math.max(0, km);
  for (let i = 0; i < coordsLonLat.length - 1; i++) {
    const a = coordsLonLat[i]!;
    const b = coordsLonLat[i + 1]!;
    const segKm = haversineKm(a, b);
    if (!(segKm > 0)) continue;
    if (traveled + segKm >= target) {
      const t = (target - traveled) / segKm;
      const lon = a[0] + t * (b[0] - a[0]);
      const lat = a[1] + t * (b[1] - a[1]);
      return [lat, lon];
    }
    traveled += segKm;
  }
  const last = coordsLonLat[coordsLonLat.length - 1]!;
  return [last[1], last[0]];
}

function offsetByKm(lat: number, lon: number, bearing: number, km: number): [number, number] {
  const R = 6371;
  const δ = km / R;
  const θ = (bearing * Math.PI) / 180;
  const φ1 = (lat * Math.PI) / 180;
  const λ1 = (lon * Math.PI) / 180;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(
    Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
    Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
  );
  return [(φ2 * 180) / Math.PI, (((λ2 * 180) / Math.PI + 540) % 360) - 180];
}

const DETOUR_RISK_KINDS = [
  'PERMIT', 'LIMITS', 'BAN', 'WORKS', 'WIND', 'HOURS', 'FERRY', 'WINDOW', 'PILOT',
] as const;

/**
 * F7 #791 B8: 9 rodzajów ryzyk (ok/warn) dla postoju i objazdu —
 * brak danych → zdanie „brak danych …”, nie pominięcie.
 */
export function buildNineRisks(args: {
  side: 'hold' | 'detour';
  country: DetourCountry;
  permitMode: DetourLoadLeg['permitMode'];
  hereNotices?: readonly string[];
  noDetour?: boolean;
}): DetourRiskRow[] {
  const permit = permitDetourRisk({ country: args.country, permitMode: args.permitMode });
  const violated = (args.hereNotices ?? []).some((n) => /violatedVehicleRestriction/i.test(n));
  const byKind: Record<string, DetourRiskRow> = {
    PERMIT: permit,
    LIMITS: args.side === 'detour' && !args.noDetour
      ? (violated
        ? { kind: 'LIMITS', level: 'warn', text: 'ograniczenia zestawu na objeździe (HERE)' }
        : { kind: 'LIMITS', level: 'ok', text: 'brak naruszeń wymiarów/masy na objeździe (HERE)' })
      : { kind: 'LIMITS', level: 'ok', text: 'brak danych ograniczeń wymiarów (postój — bez jazdy objazdem)' },
    BAN: { kind: 'BAN', level: 'ok', text: 'brak danych zakazów czasowych na objeździe' },
    WORKS: { kind: 'WORKS', level: 'ok', text: 'brak danych o robotach na objeździe' },
    WIND: { kind: 'WIND', level: 'ok', text: 'brak danych wiatru na objeździe / przy zamknięciu' },
    HOURS: { kind: 'HOURS', level: 'ok', text: 'brak danych czasu pracy kierowcy (H-4)' },
    FERRY: { kind: 'FERRY', level: 'ok', text: 'brak danych rejsu promu względem ETA' },
    WINDOW: { kind: 'WINDOW', level: 'ok', text: 'brak danych okna dostawy KSH' },
    PILOT: { kind: 'PILOT', level: 'ok', text: 'brak danych o pilotach na objeździe' },
  };
  return DETOUR_RISK_KINDS.map((k) => byKind[k]!);
}

export function buildDetourPayload(args: {
  nowIso: string;
  decideByIso: string;
  untilIso: string | null;
  baseEtaIso: string;
  country: DetourCountry;
  permitMode: DetourLoadLeg['permitMode'];
  lat: number;
  lon: number;
  corridor: string;
  atKm: number | null;
  here: {
    lengthM: number;
    durationSec: number;
    notices: string[];
    names?: string[];
    roadNumbers?: string[];
    line: Array<[number, number]> | null;
  } | null;
  noDetourWhy: string | null;
  /** Długość / czas trasy bazowej (te same punkty, bez avoid) — F7 B6. */
  baseLengthM?: number;
  baseDurationSec?: number;
}): DetourCasePayload {
  const hold = planHold({
    nowIso: args.nowIso,
    decideByIso: args.decideByIso,
    untilIso: args.untilIso,
    baseEtaIso: args.baseEtaIso,
  });
  const holdRisks = buildNineRisks({
    side: 'hold',
    country: args.country,
    permitMode: args.permitMode,
  });
  const avoid = avoidBboxAround(args.lat, args.lon).param;

  if (args.noDetourWhy || !args.here) {
    return {
      hold: { ...hold, risks: holdRisks },
      detour: {
        none: true,
        why: args.noDetourWhy ?? 'Brak objazdu dla tego zestawu — tylko postój',
      },
      closure: {
        lat: args.lat,
        lon: args.lon,
        corridor: args.corridor,
        atKm: args.atKm,
        avoid,
      },
    };
  }

  const baseLen = args.baseLengthM ?? 0;
  const baseDur = args.baseDurationSec ?? 0;
  const addKm = Math.max(0, Math.round(((args.here.lengthM - baseLen) / 1000) * 10) / 10);
  const addMin = Math.max(0, Math.round((args.here.durationSec - baseDur) / 60));
  const via = viaFromHereSummary({
    names: args.here.names ?? [],
    roadNumbers: args.here.roadNumbers ?? [],
    notices: args.here.notices,
  });

  return {
    hold: { ...hold, risks: holdRisks },
    detour: {
      addKm,
      addMin,
      etaIso: new Date(Date.parse(args.baseEtaIso) + addMin * 60_000).toISOString(),
      via,
      risks: buildNineRisks({
        side: 'detour',
        country: args.country,
        permitMode: args.permitMode,
        hereNotices: args.here.notices,
      }),
      line: args.here.line,
    },
    closure: {
      lat: args.lat,
      lon: args.lon,
      corridor: args.corridor,
      atKm: args.atKm,
      avoid,
    },
  };
}

export type DetourJobStore = {
  listOpenRoadClosures?(): Promise<RoadClosureCandidate[]>;
  e49DetourLoadLegs?(): Promise<DetourLoadLeg[]>;
  upsertE49DetourCase?(row: DetourCaseUpsert): Promise<boolean>;
  closeStaleE49DetourCases?(keepDedup: string[]): Promise<number>;
  noteHereUsage?(service: 'routing', n: number): Promise<void>;
  hereMonthSpend?(): Promise<number>;
  corridorPolylineGeoJson?(code: string): Promise<unknown>;
};

export type DetourJobResult = {
  candidates: number;
  upserts: number;
  hereCalls: number;
  closed: number;
  warnings: string[];
};

async function fetchHereSummary(args: {
  fetch: typeof fetch;
  url: string;
  dimsLabel: string;
}): Promise<{
  summary: ReturnType<typeof summarizeHereRoute>;
  noWhy: string | null;
  ok: boolean;
  status: number;
}> {
  const r = await args.fetch(args.url, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });
  if (!r.ok) {
    return {
      summary: null,
      noWhy: `Brak objazdu dla tego zestawu (HERE HTTP ${r.status}) — tylko postój`,
      ok: false,
      status: r.status,
    };
  }
  const body = await r.json();
  const noWhy = noDetourWhyFromBody(body, args.dimsLabel);
  const summary = summarizeHereRoute(body);
  return { summary, noWhy, ok: true, status: r.status };
}

/**
 * Przebieg Z3: zamknięcia on-route × transporty na korytarzu (przed autem) → sprawy + HERE.
 */
export async function runDetourCases(args: {
  store: DetourJobStore;
  fetch: typeof fetch;
  now: Date;
  hereApiKey: string | null | undefined;
  budgetUsd?: number;
}): Promise<DetourJobResult> {
  const warnings: string[] = [];
  const nowIso = args.now.toISOString();
  let closures: RoadClosureCandidate[] = [];
  let closuresOk = false;
  try {
    closures = args.store.listOpenRoadClosures
      ? (await args.store.listOpenRoadClosures()).filter(isOnRouteClosure)
      : [];
    closuresOk = true;
  } catch (e) {
    warnings.push(`E49-b listOpenRoadClosures: ${e instanceof Error ? e.message : 'błąd'}`);
  }
  const legs = args.store.e49DetourLoadLegs ? await args.store.e49DetourLoadLegs() : [];
  const keep: string[] = [];
  let upserts = 0;
  let hereCalls = 0;
  const polyCache = new Map<string, Array<[number, number]>>();

  const spend = args.store.hereMonthSpend ? await args.store.hereMonthSpend() : 0;
  const budget = args.budgetUsd ?? 100;
  const hereOk = Boolean(args.hereApiKey?.trim()) && spend < budget - 1e-9;
  if (!args.hereApiKey?.trim()) warnings.push('E49-b: brak HERE_API_KEY — sprawy tylko z postojem (bez objazdu)');
  else if (spend >= budget - 1e-9) warnings.push('E49-b: budżet HERE wyczerpany — bez zapytań Routing');

  const loadPoly = async (code: string): Promise<Array<[number, number]>> => {
    if (polyCache.has(code)) return polyCache.get(code)!;
    let coords: Array<[number, number]> = [];
    if (args.store.corridorPolylineGeoJson) {
      try {
        coords = coordsFromCorridorGeoJson(await args.store.corridorPolylineGeoJson(code));
      } catch {
        coords = [];
      }
    }
    polyCache.set(code, coords);
    return coords;
  };

  for (const c of closures) {
    const matched = legs.filter(
      (leg) =>
        leg.currentLeg
        && corridorMatchesLeg(c, leg.code)
        && leg.status !== 'AT_SITE'
        && leg.status !== 'FERRY',
    );
    for (const leg of matched) {
      const poly = await loadPoly(leg.code);
      let atKm = c.atKm;
      if ((atKm == null || !Number.isFinite(atKm)) && poly.length >= 2) {
        atKm = projectKmOnCorridor(poly, c.lat, c.lon);
      }
      // B4: bez km albo zamknięcie za autem → pomiń.
      if (atKm == null || !Number.isFinite(atKm)) {
        warnings.push(`E49-b: brak at_km dla ${c.closureRef} / ${leg.code} — pominięto`);
        continue;
      }
      if (atKm < leg.fromKm - 0.5) continue;

      const dedup = detourDedupKey(leg.loadId, c.closureRef);
      keep.push(dedup);
      const decideBy = estimateDecideByIso({
        nowIso,
        fromKm: leg.fromKm,
        atKm,
      });
      const baseEta = leg.baseEtaIso && Number.isFinite(Date.parse(leg.baseEtaIso))
        ? leg.baseEtaIso
        : new Date(Date.parse(decideBy) + 6 * 3600_000).toISOString();

      let hereSummary: {
        lengthM: number;
        durationSec: number;
        notices: string[];
        names?: string[];
        roadNumbers?: string[];
        line: Array<[number, number]> | null;
      } | null = null;
      let baseLengthM = 0;
      let baseDurationSec = 0;
      let noWhy: string | null = null;
      let urlMasked: string | undefined;

      const dims = completeDims(leg.dims);
      const dimsLabel = dims
        ? `${dims.heightM}×${dims.widthM}×${dims.lengthM} m, ${dims.weightT} t`
        : '';

      // Origin / destination wzdłuż korytarza (nie ±0,05° N–S) — F7 B6.
      let origin: readonly [number, number];
      let destination: readonly [number, number];
      const before = pointAtKm(poly, Math.max(0, atKm - DETOUR_SEGMENT_KM));
      const after = pointAtKm(poly, atKm + DETOUR_SEGMENT_KM);
      if (before && after) {
        origin = leg.position && projectKmOnCorridor(poly, leg.position[0], leg.position[1]) != null
          && (projectKmOnCorridor(poly, leg.position[0], leg.position[1])! <= atKm)
          ? leg.position
          : before;
        destination = after;
      } else {
        const brg = leg.position
          ? bearingDeg([leg.position[1], leg.position[0]], [c.lon, c.lat])
          : 0;
        origin = leg.position ?? offsetByKm(c.lat, c.lon, (brg + 180) % 360, DETOUR_SEGMENT_KM);
        destination = offsetByKm(c.lat, c.lon, brg, DETOUR_SEGMENT_KM);
      }

      if (hereOk && dims && hereCalls < DETOUR_HERE_MAX_PER_RUN) {
        const avoid = avoidBboxAround(c.lat, c.lon).param;
        const dimsT = dims as TruckDims;
        try {
          // Trasa bazowa (bez avoid) — nadwyżka km/min.
          if (hereCalls + 1 < DETOUR_HERE_MAX_PER_RUN) {
            const baseUrl = buildDetourRoutingUrl({
              apiKey: args.hereApiKey!,
              origin,
              destination,
              dims: dimsT,
            });
            const base = await fetchHereSummary({ fetch: args.fetch, url: baseUrl, dimsLabel });
            hereCalls++;
            if (args.store.noteHereUsage) await args.store.noteHereUsage('routing', 1);
            if (base.summary) {
              baseLengthM = base.summary.lengthM;
              baseDurationSec = base.summary.durationSec;
            }
          }

          const url = buildDetourRoutingUrl({
            apiKey: args.hereApiKey!,
            origin,
            destination,
            dims: dimsT,
            avoidAreas: [avoid],
          });
          urlMasked = maskHereApiKey(url);
          if (hereCalls >= DETOUR_HERE_MAX_PER_RUN) {
            noWhy = 'Brak objazdu w tym przebiegu — limit zapytań HERE; przeliczenie za ≤ 30 min';
          } else {
            const det = await fetchHereSummary({ fetch: args.fetch, url, dimsLabel });
            hereCalls++;
            if (args.store.noteHereUsage) await args.store.noteHereUsage('routing', 1);
            if (!det.ok) {
              noWhy = det.noWhy;
              warnings.push(maskHereApiKey(`E49-b HERE ${det.status} ${url}`));
            } else {
              noWhy = det.noWhy;
              if (det.summary && !noWhy) {
                hereSummary = {
                  lengthM: det.summary.lengthM,
                  durationSec: det.summary.durationSec,
                  notices: det.summary.notices,
                  names: det.summary.names,
                  roadNumbers: det.summary.roadNumbers,
                  line: null,
                };
              } else if (!noWhy) {
                noWhy = 'Brak objazdu dla tego zestawu — tylko postój';
              }
            }
          }
        } catch (e) {
          hereCalls++;
          noWhy = 'Brak objazdu dla tego zestawu (błąd HERE) — tylko postój';
          warnings.push(`E49-b HERE: ${e instanceof Error ? maskHereApiKey(e.message) : 'błąd'}`);
        }
      } else if (!dims) {
        noWhy = 'Brak objazdu — brak wymiarów zestawu w tabeli (D1)';
      } else if (!hereOk) {
        noWhy = 'Brak objazdu — HERE niedostępne; tylko postój';
      } else if (hereCalls >= DETOUR_HERE_MAX_PER_RUN) {
        noWhy = 'Brak objazdu w tym przebiegu — limit zapytań HERE; przeliczenie za ≤ 30 min';
      }

      const payload = buildDetourPayload({
        nowIso,
        decideByIso: decideBy,
        untilIso: c.untilIso,
        baseEtaIso: baseEta,
        country: c.country,
        permitMode: leg.permitMode,
        lat: c.lat,
        lon: c.lon,
        corridor: leg.code,
        atKm,
        here: hereSummary,
        noDetourWhy: noWhy,
        baseLengthM,
        baseDurationSec,
      });
      if (urlMasked) payload.hereUrlMasked = urlMasked;

      const row: DetourCaseUpsert = {
        loadId: leg.loadId,
        dedupKey: dedup,
        country: c.country,
        place: c.place,
        reason: classifyClosureReason(`${c.title} ${c.detailText}`),
        reasonDetail: null,
        source: closureSourceOf(c.country),
        noticeAt: c.noticeIso,
        untilAt: c.untilIso,
        decideBy,
        payload,
        riskDedupKey: c.closureRef,
      };
      if (args.store.upsertE49DetourCase) {
        try {
          if (await args.store.upsertE49DetourCase(row)) upserts++;
        } catch (e) {
          warnings.push(`E49-b upsert: ${e instanceof Error ? e.message : 'błąd'}`);
        }
      }
    }
  }

  let closed = 0;
  if (closuresOk && args.store.closeStaleE49DetourCases) {
    try {
      closed = await args.store.closeStaleE49DetourCases(keep);
    } catch (e) {
      warnings.push(`E49-b close_stale: ${e instanceof Error ? e.message : 'błąd'}`);
    }
  }

  return {
    candidates: closures.length,
    upserts,
    hereCalls,
    closed,
    warnings,
  };
}

/** Re-export for tests / callers that need polyline helpers. */
export { simplifyLine, viaFromHereSummary };
