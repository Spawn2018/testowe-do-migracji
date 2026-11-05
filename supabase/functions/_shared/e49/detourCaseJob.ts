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
import {
  banRiskTitle,
  holidayBanHit,
  plSundayBanHit,
  seWeekendBanHit,
} from '../here/windAndBans.ts';
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

/** Punkt prognozy wiatru (DP-212) — próbki godzinowe z `corridor_wind_forecast`. */
export type DetourWindRow = {
  km: number;
  samples: readonly {
    at: string;
    gustMs?: number | null;
    windMs?: number | null;
    gust_ms?: number | null;
    wind_ms?: number | null;
  }[];
};

/**
 * DP-212 / F7 #791 nieblok. + F7 #811 B1: szczyt porywu w oknie jazdy wariantu.
 * Próbki prognozy są godzinowe — okno rozszerzamy do pełnych godzin
 * [floor_h(from), ceil_h(to)], żeby krótki objazd (np. 10:20–10:50) widział 10:00 i 11:00.
 * Brak próbek w rozszerzonym oknie → null → WIND warn.
 */
export function peakGustInDriveWindow(args: {
  rows: readonly DetourWindRow[];
  fromIso: string;
  toIso: string;
}): number | null {
  const from = Date.parse(args.fromIso);
  const to = Date.parse(args.toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to) || !args.rows.length) return null;
  const HOUR_MS = 3_600_000;
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const t0 = Math.floor(lo / HOUR_MS) * HOUR_MS;
  const t1 = Math.ceil(hi / HOUR_MS) * HOUR_MS;
  let peak: number | null = null;
  for (const row of args.rows) {
    for (const s of row.samples ?? []) {
      const at = Date.parse(s.at);
      if (!Number.isFinite(at) || at < t0 || at > t1) continue;
      const g = Number(s.gustMs ?? s.gust_ms ?? s.windMs ?? s.wind_ms);
      if (!Number.isFinite(g)) continue;
      if (peak == null || g > peak) peak = g;
    }
  }
  return peak;
}

/** Kontekst ryzyk karty (F7 #791 r4/r5 B8) — wartości z bazy; brak = warn „sprawdź …”. */
export type DetourRiskCtx = {
  /**
   * DP-212: punkty korytarza przed autem — szczyt liczony w oknie jazdy wariantu
   * (`banFromIso`/`banToIso` w `buildNineRisks`).
   */
  windRows?: readonly DetourWindRow[] | null;
  /** Poryw m/s (fallback testów / bez okna); produkcja: windRows + okno. */
  windGustMs?: number | null;
  /** Pozostały czas jazdy H-4 (min) do najbliższego EU_DAILY_REST. */
  hoursLeftMin?: number | null;
  /** Rejs: operator (vessels.operator) + plan wypłynięcia. */
  ferryOperator?: string | null;
  ferryDepIso?: string | null;
  /** Następny rejs (gdy nie zdąży na przypisany) — HH:MM w tekście. */
  ferryNextDepIso?: string | null;
  /** ETA do portu przeprawy (bazowe, bez wariantu) — nie eta_site/Boden. */
  ferryPortEtaBaseIso?: string | null;
  /** Po przeprawie (IN_TRANSIT_SE…) — FERRY bez „nie zdąży”. */
  ferryPast?: boolean;
  /** Koniec okna dostawy KSH. */
  windowEndIso?: string | null;
  /** Kraje z awizacji pilotów (np. ['SE']). */
  pilotCountries?: readonly string[] | null;
  /** true gdy baseEta jest syntetyczne (decideBy+6h) — WINDOW/FERRY bez ok. */
  syntheticEta?: boolean;
  /**
   * DP-211 / F7 #805: święto H-12 w oknie jazdy wariantu (nie ETA placu).
   * `null` = nie sprawdzono → warn (nigdy ok).
   */
  holidayBan?: boolean | null;
  /**
   * DP-211: otwarte ROAD_* (korytarz_droga=on) z robotami — strona postój / domyślnie.
   * `null` = brak źródła; `false` = źródło OK, brak robót.
   */
  worksHit?: boolean | null;
  worksTitle?: string | null;
  /**
   * DP-211 F7 B3: WORKS dla **objazdu** — roboty na geometrii trasy objazdu
   * (bez bieżącego zamknięcia). `undefined` = użyj worksHit; `null` = brak geometrii → sprawdź.
   */
  worksDetourHit?: boolean | null;
  worksDetourTitle?: string | null;
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
  /** F7 r4 B8: dane pod zdania ryzyk. */
  riskCtx?: DetourRiskCtx | null;
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
  /** B6: brak trasy bazowej HERE — upsert ma zachować poprzedni objazd. */
  baseMissing?: boolean;
  /** F7 r4/r5 B6: pozycja auta przy prawdziwym liczeniu HERE [lat, lon]. */
  positionAtCalc?: readonly [number, number] | null;
  /** ISO czasu ostatniego prawdziwego liczenia HERE. */
  hereCalculatedAt?: string | null;
  /** Notices z ostatniego HERE (LIMITS przy pamięci). */
  hereNotices?: string[] | null;
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
  // F7 r3 B3 / dec. 99: unknown i off = obok trasy — tylko 'on'.
  if (c.korytarzDroga != null && c.korytarzDroga !== 'on') return false;
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
  // F7 #791 r3 B3: unknown/off = obok trasy (decyzja 99) — tylko korytarz_droga='on'.
  if (closure.korytarzDroga !== 'on') return false;
  if (closure.corridor === legCode) return true;

  const c = closure.corridor.toUpperCase();
  const leg = legCode.toUpperCase();

  if ((c === 'ROAD_LT' || c === 'ROAD_LV' || c === 'ROAD_EE') && leg === 'PL_EE_E67') return true;
  if (c === 'ROAD_FI' && leg === 'FI_E75') return true;
  if (c === 'PL_ROAD' && (leg === 'PL_ROAD' || leg === 'PL_EE_E67')) return true;
  if (c === 'SE_E4' && (leg === 'SE_E4' || leg === 'SE_E4_STO' || leg === 'SE_KAA_INLAND' || leg === 'SE_KAA_TRACK')) {
    return true;
  }
  if (c === 'SE_E22' && (leg.includes('E22') || leg === 'SE_KAA_INLAND' || leg === 'SE_KAA_TRACK')) return true;
  if (c === 'SE_E18_KPS' && (leg === 'SE_E18_KPS' || leg.includes('E18'))) return true;
  // Alias: zamknięcie oznaczone kodem nogi inland/track.
  if ((c === 'SE_KAA_INLAND' || c === 'SE_KAA_TRACK') && (leg.startsWith('SE_') || leg.includes('KAA'))) {
    return true;
  }

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
      return leg.startsWith('SE_') || leg === 'SE_KAA_INLAND' || leg === 'SE_KAA_TRACK';
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

/** F7 #805 B1: czy okno [from,to] nakłada się na zakaz weekendowy PL/SE. */
export function banWindowHitsWeekend(
  country: 'PL' | 'SE',
  fromIso: string,
  toIso: string,
): { hit: boolean; sampleIso: string | null } {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to)) {
    return { hit: false, sampleIso: null };
  }
  const start = Math.min(from, to);
  const end = Math.max(from, to);
  const step = 3 * 3600_000;
  const hitFn = country === 'SE' ? seWeekendBanHit : plSundayBanHit;
  for (let t = start; t <= end; t += step) {
    const iso = new Date(t).toISOString();
    if (hitFn(iso)) return { hit: true, sampleIso: iso };
  }
  const endIso = new Date(end).toISOString();
  if (hitFn(endIso)) return { hit: true, sampleIso: endIso };
  return { hit: false, sampleIso: null };
}

/**
 * F7 #805 B1: okno jazdy wariantu (nie ETA placu).
 * Objazd: [max(now, decideBy), start + driveMin]; postój: [now, koniec postoju].
 */
export function banDriveWindow(args: {
  side: 'hold' | 'detour';
  nowIso: string;
  decideByIso: string;
  /** Koniec postoju (ISO) — strona hold. */
  holdEndIso?: string | null;
  /** Czas jazdy wariantu w minutach (HERE duration / addMin). */
  driveMin?: number | null;
}): { fromIso: string; toIso: string } | null {
  const now = Date.parse(args.nowIso);
  if (!Number.isFinite(now)) return null;
  if (args.side === 'hold') {
    const end = args.holdEndIso && Number.isFinite(Date.parse(args.holdEndIso))
      ? Date.parse(args.holdEndIso)
      : now + 6 * 3600_000;
    return {
      fromIso: new Date(now).toISOString(),
      toIso: new Date(Math.max(now, end)).toISOString(),
    };
  }
  const decide = Date.parse(args.decideByIso);
  const start = Number.isFinite(decide) ? Math.max(now, decide) : now;
  const drive = args.driveMin != null && Number.isFinite(args.driveMin)
    ? Math.max(0, args.driveMin)
    : 0;
  return {
    fromIso: new Date(start).toISOString(),
    toIso: new Date(start + drive * 60_000).toISOString(),
  };
}

/**
 * DP-211 / F7 #805: BAN — zakazy w **oknie jazdy** wariantu (nakładanie z weekendem/świętem).
 * PL/SE: weekend H-12 + święto; `holidayHit == null` → warn (B2), nigdy ok.
 * Pojedyncze `etaIso` = degenerowane okno [eta, eta] (kompatybilność testów).
 */
export function riskBanForEta(args: {
  country: DetourCountry;
  etaIso?: string | null;
  fromIso?: string | null;
  toIso?: string | null;
  holidayHit?: boolean | null;
}): DetourRiskRow {
  if (args.country !== 'PL' && args.country !== 'SE') {
    return { kind: 'BAN', level: 'warn', text: 'sprawdź zakazy czasowe na objeździe' };
  }
  let from = args.fromIso ?? null;
  let to = args.toIso ?? null;
  if ((!from || !to) && args.etaIso && Number.isFinite(Date.parse(args.etaIso))) {
    from = args.etaIso;
    to = args.etaIso;
  }
  if (!from || !to || !Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to))) {
    return { kind: 'BAN', level: 'warn', text: 'sprawdź zakazy czasowe na objeździe' };
  }
  const weekend = banWindowHitsWeekend(args.country, from, to);
  const holiday = holidayBanHit(args.holidayHit);
  if (weekend.hit || holiday) {
    const sample = weekend.sampleIso ?? from;
    const tz = args.country === 'SE' ? 'Europe/Stockholm' : 'Europe/Warsaw';
    const whenLocal = new Intl.DateTimeFormat('pl-PL', {
      timeZone: tz,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(sample));
    return {
      kind: 'BAN',
      level: 'warn',
      text: banRiskTitle(args.country, whenLocal),
    };
  }
  // F7 B2: brak danych o świętach → warn, nigdy ok.
  if (args.holidayHit == null) {
    return {
      kind: 'BAN',
      level: 'warn',
      text: `brak weekendu ${args.country} w czasie objazdu; święta nie sprawdzono`,
    };
  }
  return {
    kind: 'BAN',
    level: 'ok',
    text: `brak zakazu czasowego ${args.country} w czasie objazdu`,
  };
}

/**
 * DP-211 / F7 #805: WORKS — roboty na trasie objazdu / postoju.
 * Brak źródła (`hit == null`) → „sprawdź …”; źródło bez robót → ok.
 */
export function riskWorksOnCorridor(args: {
  hit?: boolean | null;
  title?: string | null;
}): DetourRiskRow {
  if (args.hit == null) {
    return { kind: 'WORKS', level: 'warn', text: 'sprawdź roboty / utrudnienia na objeździe' };
  }
  if (args.hit) {
    const t = (args.title ?? '').replace(/\s+/g, ' ').trim();
    return {
      kind: 'WORKS',
      level: 'warn',
      text: t
        ? `roboty / utrudnienia na objeździe: ${t.slice(0, 100)}`
        : 'roboty / utrudnienia na trasie objazdu',
    };
  }
  return {
    kind: 'WORKS',
    level: 'ok',
    text: 'brak otwartych robót ROAD_* na trasie objazdu',
  };
}

/** Bufor km: roboty w pobliżu polilinii objazdu (jak próg E49-b / geofence). */
export const WORKS_DETOUR_BUFFER_KM = 2;

/** Min. odległość punktu (lat,lon) od polilinii [lat,lon] — km. */
export function minDistToLineKm(
  lat: number,
  lon: number,
  lineLatLon: readonly (readonly [number, number])[],
): number | null {
  if (lineLatLon.length < 2) return null;
  let best = Infinity;
  for (let i = 0; i < lineLatLon.length - 1; i++) {
    const a = lineLatLon[i]!;
    const b = lineLatLon[i + 1]!;
    const cosLat = Math.cos((((a[0] + b[0]) / 2) * Math.PI) / 180);
    const dx = (b[1] - a[1]) * cosLat;
    const dy = b[0] - a[0];
    const len2 = dx * dx + dy * dy;
    let t = 0;
    if (len2 > 0) {
      t = (((lon - a[1]) * cosLat) * dx + (lat - a[0]) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
    }
    const pLat = a[0] + t * (b[0] - a[0]);
    const pLon = a[1] + t * (b[1] - a[1]);
    const d = haversineKm([lon, lat], [pLon, pLat]);
    if (d < best) best = d;
  }
  return Number.isFinite(best) ? best : null;
}

/**
 * F7 #805 B3: roboty na geometrii objazdu (bez `excludeRef` = bieżące zamknięcie).
 * Brak linii → `{ hit: null }` (warn „sprawdź”).
 */
export function worksOnDetourGeometry(args: {
  works: readonly RoadClosureCandidate[];
  lineLatLon: readonly (readonly [number, number])[] | null | undefined;
  excludeRef: string;
  bufferKm?: number;
}): { hit: boolean | null; title: string | null } {
  if (!args.lineLatLon || args.lineLatLon.length < 2) {
    return { hit: null, title: null };
  }
  const buf = args.bufferKm ?? WORKS_DETOUR_BUFFER_KM;
  const near: RoadClosureCandidate[] = [];
  for (const w of args.works) {
    if (w.closureRef === args.excludeRef) continue;
    if (!looksLikeRoadWorks(w)) continue;
    const d = minDistToLineKm(w.lat, w.lon, args.lineLatLon);
    if (d != null && d <= buf) near.push(w);
  }
  if (near.length === 0) return { hit: false, title: null };
  return { hit: true, title: near[0]!.title };
}

/** Czy kandydat ROAD_* to roboty / utrudnienia (nie samo zamknięcie mostu). */
export function looksLikeRoadWorks(c: Pick<RoadClosureCandidate, 'title' | 'detailText' | 'roadClosed'>): boolean {
  if (classifyClosureReason(`${c.title} ${c.detailText}`) === 'WORKS') return true;
  if (c.roadClosed === true) return false;
  return /roboty|utrudn|works|arbete|vägarbete|tietyö|remont|budowa|construction|lane.?closure/i
    .test(`${c.title} ${c.detailText}`);
}

/** F7 #791 r4 B8: WIND z porywu m/s (E49-a). */
export function riskWindFromGust(gustMs: number | null | undefined): DetourRiskRow {
  if (gustMs == null || !Number.isFinite(gustMs)) {
    return { kind: 'WIND', level: 'warn', text: 'sprawdź wiatr na objeździe / przy zamknięciu' };
  }
  const g = Math.round(gustMs);
  if (g >= 25) {
    return { kind: 'WIND', level: 'warn', text: `wiatr na objeździe do ${g} m/s — ryzyko postoju` };
  }
  if (g >= 20) {
    return { kind: 'WIND', level: 'warn', text: `wiatr na objeździe do ${g} m/s — spowolnienie` };
  }
  return { kind: 'WIND', level: 'ok', text: `wiatr na objeździe do ${g} m/s — bez wpływu` };
}

/**
 * F7 #791 r5 B8b: suma EU_DRIVE do pierwszego EU_DAILY_REST z H4_SEGMENTS.items (minuty).
 */
export function hoursLeftFromH4Segments(items: unknown): number | null {
  if (!Array.isArray(items) || items.length === 0) return null;
  let driveH = 0;
  let sawDrive = false;
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue;
    const it = raw as { code?: string; hours?: number | string };
    const code = String(it.code ?? '');
    const h = Number(it.hours);
    if (code === 'EU_DAILY_REST') {
      return sawDrive || driveH > 0 ? Math.round(driveH * 60) : 0;
    }
    if (code === 'EU_DRIVE' && Number.isFinite(h) && h > 0) {
      driveH += h;
      sawDrive = true;
    }
  }
  return sawDrive ? Math.round(driveH * 60) : null;
}

/** F7 #791 r4/r5 B8: HOURS z pozostałego czasu jazdy H-4 (need = wariant, nie okno decyzji). */
export function riskHoursFromLeft(leftMin: number | null | undefined, needMin: number | null | undefined): DetourRiskRow {
  if (leftMin == null || !Number.isFinite(leftMin)) {
    return { kind: 'HOURS', level: 'warn', text: 'sprawdź czas pracy kierowcy (H-4)' };
  }
  const left = Math.max(0, Math.round(leftMin));
  const need = needMin != null && Number.isFinite(needMin) ? Math.max(0, Math.round(needMin)) : null;
  if (need != null && left < need) {
    return {
      kind: 'HOURS',
      level: 'warn',
      text: `zostało ${fmtHm(left)} jazdy H-4 — za mało na wariant (${fmtHm(need)})`,
    };
  }
  return {
    kind: 'HOURS',
    level: 'ok',
    text: need != null
      ? `zostało ${fmtHm(left)} jazdy H-4 — wystarczy (potrzeba ${fmtHm(need)})`
      : `zostało ${fmtHm(left)} jazdy H-4`,
  };
}

/** F7 #791 r5 B8a: FERRY — rejs vs ETA **do portu** wariantu (nie Boden). */
export function riskFerryVsEta(args: {
  operator: string | null | undefined;
  depIso: string | null | undefined;
  /** ETA dojazdu do portu przeprawy dla wariantu. */
  etaIso: string | null | undefined;
  pastFerry?: boolean;
  nextDepIso?: string | null;
  /** Brak wiarygodnego ETA (syntetyczne) → warn, nigdy ok. */
  syntheticEta?: boolean;
}): DetourRiskRow {
  if (args.pastFerry) {
    const op = args.operator ? ` ${args.operator}` : '';
    return { kind: 'FERRY', level: 'ok', text: `rejs${op} — już za transportem` };
  }
  if (!args.operator || !args.depIso || !Number.isFinite(Date.parse(args.depIso))) {
    return { kind: 'FERRY', level: 'warn', text: 'sprawdź rejs promu względem ETA' };
  }
  const dep = Date.parse(args.depIso);
  const hhmm = new Date(dep).toISOString().slice(11, 16);
  if (args.syntheticEta || !args.etaIso || !Number.isFinite(Date.parse(args.etaIso))) {
    return {
      kind: 'FERRY',
      level: 'warn',
      text: `rejs ${args.operator} ${hhmm} — sprawdź zapas do ETA portu`,
    };
  }
  const eta = Date.parse(args.etaIso);
  const slackMin = Math.round((dep - eta) / 60_000);
  if (slackMin < 0) {
    const next = args.nextDepIso && Number.isFinite(Date.parse(args.nextDepIso))
      ? new Date(Date.parse(args.nextDepIso)).toISOString().slice(11, 16)
      : null;
    return {
      kind: 'FERRY',
      level: 'warn',
      text: next
        ? `rejs ${args.operator} ${hhmm} — nie zdąży; następny ${next}`
        : `rejs ${args.operator} ${hhmm} — nie zdąży (spóźnienie ${fmtHm(-slackMin)})`,
    };
  }
  return {
    kind: 'FERRY',
    level: 'ok',
    text: `rejs ${args.operator} ${hhmm} — zdąży (zapas ${fmtHm(slackMin)})`,
  };
}

/** F7 #791 r4/r5 B8: WINDOW — okno KSH vs ETA (bez ok na syntetycznym ETA). */
export function riskWindowVsEta(args: {
  windowEndIso: string | null | undefined;
  etaIso: string | null | undefined;
  syntheticEta?: boolean;
}): DetourRiskRow {
  if (!args.windowEndIso || !Number.isFinite(Date.parse(args.windowEndIso))) {
    return { kind: 'WINDOW', level: 'warn', text: 'sprawdź okno dostawy KSH' };
  }
  const end = Date.parse(args.windowEndIso);
  const endLabel = new Date(end).toISOString().slice(0, 16).replace('T', ' ');
  if (args.syntheticEta || !args.etaIso || !Number.isFinite(Date.parse(args.etaIso))) {
    return { kind: 'WINDOW', level: 'warn', text: `okno KSH do ${endLabel} — sprawdź ETA` };
  }
  const eta = Date.parse(args.etaIso);
  if (eta > end) {
    const late = Math.round((eta - end) / 60_000);
    return {
      kind: 'WINDOW',
      level: 'warn',
      text: `okno KSH do ${endLabel} — ETA po oknie (+${fmtHm(late)})`,
    };
  }
  const slack = Math.round((end - eta) / 60_000);
  return {
    kind: 'WINDOW',
    level: 'ok',
    text: `okno KSH do ${endLabel} — ETA w oknie (zapas ${fmtHm(slack)})`,
  };
}

/** ETA do portu dla wariantu: baza + addMin wariantu. */
export function etaPortForVariant(
  basePortIso: string | null | undefined,
  addMin: number,
): string | null {
  if (!basePortIso || !Number.isFinite(Date.parse(basePortIso))) return null;
  return new Date(Date.parse(basePortIso) + Math.max(0, addMin) * 60_000).toISOString();
}

/** Kraje bez eskorty w awizacji (decyzja 105 / #809 — DP-210). */
const PILOT_NOT_REQUIRED: ReadonlySet<DetourCountry> = new Set(['EE', 'LV', 'LT', 'FI']);

/** F7 #791 r4 B8 + DP-210: PILOT — awizacja PL/SE; EE/LV/LT/FI = niewymagany. */
export function riskPilotForCountry(args: {
  country: DetourCountry;
  pilotCountries: readonly string[] | null | undefined;
}): DetourRiskRow {
  if (PILOT_NOT_REQUIRED.has(args.country)) {
    return {
      kind: 'PILOT',
      level: 'ok',
      text: `pilot niewymagany (${args.country})`,
    };
  }
  const list = args.pilotCountries;
  if (!list || list.length === 0) {
    return { kind: 'PILOT', level: 'warn', text: 'sprawdź pilotów na objeździe' };
  }
  const has = list.map((c) => c.toUpperCase()).includes(args.country);
  if (has) {
    return { kind: 'PILOT', level: 'ok', text: `pilot ${args.country} w awizacji — jest` };
  }
  return {
    kind: 'PILOT',
    level: 'warn',
    text: `pilot ${args.country} — brak w awizacji (jest: ${list.join(', ')})`,
  };
}

function fmtHm(min: number): string {
  const m = Math.max(0, Math.round(min));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h <= 0) return `${r} min`;
  if (r === 0) return `${h} h`;
  return `${h} h ${r} min`;
}

/**
 * F7 #791 B8/r4: 9 rodzajów ryzyk (ok/warn) dla postoju i objazdu —
 * brak danych → **warn** „sprawdź …”, nigdy `ok` (makieta).
 * WIND/HOURS/FERRY/WINDOW/PILOT/BAN/WORKS: zdania z wartościami gdy riskCtx / wiersze podane.
 */
export function buildNineRisks(args: {
  side: 'hold' | 'detour';
  country: DetourCountry;
  permitMode: DetourLoadLeg['permitMode'];
  hereNotices?: readonly string[];
  noDetour?: boolean;
  /** ETA placu (WINDOW). */
  etaIso?: string | null;
  /** ETA do portu przeprawy (FERRY); domyślnie etaIso. */
  ferryEtaIso?: string | null;
  /** F7 #805 B1: okno jazdy wariantu dla BAN (nie ETA placu). */
  banFromIso?: string | null;
  banToIso?: string | null;
  /** Potrzeba jazdy wariantu (objazd: +addMin; postój: 0). */
  needDriveMin?: number | null;
  riskCtx?: DetourRiskCtx | null;
  /** Gdy podane — nadpisują riskCtx (testy). */
  wind?: DetourRiskRow | null;
  hours?: DetourRiskRow | null;
  ferry?: DetourRiskRow | null;
  window?: DetourRiskRow | null;
  pilot?: DetourRiskRow | null;
  ban?: DetourRiskRow | null;
  works?: DetourRiskRow | null;
}): DetourRiskRow[] {
  const permit = permitDetourRisk({ country: args.country, permitMode: args.permitMode });
  const violated = (args.hereNotices ?? []).some((n) => /violatedVehicleRestriction/i.test(n));
  const missing = (kind: string, checkWhat: string): DetourRiskRow => ({
    kind,
    level: 'warn',
    text: `sprawdź ${checkWhat}`,
  });
  const ctx = args.riskCtx ?? null;
  // DP-212: WIND ze szczytu w oknie jazdy wariantu (te same banFrom/banTo co BAN).
  const wind = args.wind ?? (() => {
    if (ctx?.windRows && args.banFromIso && args.banToIso) {
      return riskWindFromGust(peakGustInDriveWindow({
        rows: ctx.windRows,
        fromIso: args.banFromIso,
        toIso: args.banToIso,
      }));
    }
    return riskWindFromGust(ctx?.windGustMs);
  })();
  const hours = args.hours ?? riskHoursFromLeft(ctx?.hoursLeftMin, args.needDriveMin);
  const ferryEta = args.ferryEtaIso ?? args.etaIso;
  const ferry = args.ferry ?? riskFerryVsEta({
    operator: ctx?.ferryOperator,
    depIso: ctx?.ferryDepIso,
    etaIso: ferryEta,
    pastFerry: ctx?.ferryPast === true,
    nextDepIso: ctx?.ferryNextDepIso,
    syntheticEta: ctx?.syntheticEta === true,
  });
  const window = args.window ?? riskWindowVsEta({
    windowEndIso: ctx?.windowEndIso,
    etaIso: args.etaIso,
    syntheticEta: ctx?.syntheticEta === true,
  });
  const pilot = args.pilot ?? riskPilotForCountry({
    country: args.country,
    pilotCountries: ctx?.pilotCountries,
  });
  // DP-211 F7 #805: BAN w oknie jazdy; WORKS — objazd z geometrii (worksDetour*).
  const ban = args.ban ?? riskBanForEta({
    country: args.country,
    fromIso: args.banFromIso,
    toIso: args.banToIso,
    // Kompatybilność: bez okna — degeneracja do etaIso (testy / stare wywołania).
    etaIso: args.banFromIso == null ? args.etaIso : null,
    holidayHit: ctx?.holidayBan,
  });
  const worksHit = args.side === 'detour' && ctx?.worksDetourHit !== undefined
    ? ctx.worksDetourHit
    : ctx?.worksHit;
  const worksTitle = args.side === 'detour' && ctx?.worksDetourTitle !== undefined
    ? ctx.worksDetourTitle
    : ctx?.worksTitle;
  const works = args.works ?? riskWorksOnCorridor({
    hit: worksHit,
    title: worksTitle,
  });
  const byKind: Record<string, DetourRiskRow> = {
    PERMIT: permit,
    LIMITS: args.side === 'detour' && !args.noDetour
      ? (violated
        ? { kind: 'LIMITS', level: 'warn', text: 'ograniczenia zestawu na objeździe (HERE)' }
        : args.hereNotices
          ? { kind: 'LIMITS', level: 'ok', text: 'brak naruszeń wymiarów/masy na objeździe (HERE)' }
          : missing('LIMITS', 'ograniczenia wymiarów/masy na objeździe'))
      : missing('LIMITS', 'ograniczenia wymiarów (postój — bez jazdy objazdem)'),
    BAN: ban,
    WORKS: works,
    WIND: wind,
    HOURS: hours,
    FERRY: ferry,
    WINDOW: window,
    PILOT: pilot,
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
  riskCtx?: DetourRiskCtx | null;
  /** F7 #805 B3: kandydaci WORKS (bez bieżącego zamknięcia liczy worksOnDetourGeometry). */
  worksCandidates?: readonly RoadClosureCandidate[];
  excludeClosureRef?: string;
}): DetourCasePayload {
  const hold = planHold({
    nowIso: args.nowIso,
    decideByIso: args.decideByIso,
    untilIso: args.untilIso,
    baseEtaIso: args.baseEtaIso,
  });
  const holdEndIso = hold.untilIso
    ?? new Date(Date.parse(args.nowIso) + hold.addMin * 60_000).toISOString();
  const holdBanWin = banDriveWindow({
    side: 'hold',
    nowIso: args.nowIso,
    decideByIso: args.decideByIso,
    holdEndIso,
  });
  // F7 r5 B8a: FERRY porównuje ETA do portu, nie placu (Boden).
  const holdFerryEta = etaPortForVariant(args.riskCtx?.ferryPortEtaBaseIso, hold.addMin);
  // F7 r5 B8b: need z wariantu (postój = 0 jazdy; odpoczynek osobno w tekście gdy left znane).
  const holdRisks = buildNineRisks({
    side: 'hold',
    country: args.country,
    permitMode: args.permitMode,
    riskCtx: args.riskCtx,
    etaIso: hold.etaIso,
    ferryEtaIso: holdFerryEta,
    banFromIso: holdBanWin?.fromIso,
    banToIso: holdBanWin?.toIso,
    needDriveMin: 0,
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
  // F7 B1: czas wariantu = pełny duration HERE (nie sama nadwyżka).
  const driveMin = Math.max(addMin, Math.round(args.here.durationSec / 60));
  const via = viaFromHereSummary({
    names: args.here.names ?? [],
    roadNumbers: args.here.roadNumbers ?? [],
    notices: args.here.notices,
  });
  const detourEta = new Date(Date.parse(args.baseEtaIso) + addMin * 60_000).toISOString();
  const detourFerryEta = etaPortForVariant(args.riskCtx?.ferryPortEtaBaseIso, addMin);
  const detourBanWin = banDriveWindow({
    side: 'detour',
    nowIso: args.nowIso,
    decideByIso: args.decideByIso,
    driveMin,
  });
  // F7 B3: WORKS na geometrii objazdu; bez linii → null (sprawdź); bez bieżącego zamknięcia.
  let detourCtx = args.riskCtx ?? null;
  if (args.worksCandidates && args.excludeClosureRef) {
    const onLine = worksOnDetourGeometry({
      works: args.worksCandidates,
      lineLatLon: args.here.line,
      excludeRef: args.excludeClosureRef,
    });
    detourCtx = {
      ...(detourCtx ?? {}),
      worksDetourHit: onLine.hit,
      worksDetourTitle: onLine.title,
    };
  }

  return {
    hold: { ...hold, risks: holdRisks },
    detour: {
      addKm,
      addMin,
      etaIso: detourEta,
      via,
      risks: buildNineRisks({
        side: 'detour',
        country: args.country,
        permitMode: args.permitMode,
        hereNotices: args.here.notices,
        riskCtx: detourCtx,
        etaIso: detourEta,
        ferryEtaIso: detourFerryEta,
        banFromIso: detourBanWin?.fromIso,
        banToIso: detourBanWin?.toIso,
        // F7 r5 B8b: need = sama nadwyżka jazdy objazdu, nie okno decyzji.
        needDriveMin: addMin,
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

export type OpenDetourCache = {
  payload: DetourCasePayload;
  /** Ostatnia pozycja auta przy liczeniu HERE [lat, lon]. */
  position: readonly [number, number] | null;
  closureLat: number;
  closureLon: number;
};

/** Wynik nóg E49-b: tablica (testy) albo legi + ostrzeżenia (prod, F7 #811 B2). */
export type DetourLoadLegsResult =
  | DetourLoadLeg[]
  | { legs: DetourLoadLeg[]; warnings?: string[] };

export function normalizeDetourLoadLegs(raw: DetourLoadLegsResult | undefined | null): {
  legs: DetourLoadLeg[];
  warnings: string[];
} {
  if (raw == null) return { legs: [], warnings: [] };
  if (Array.isArray(raw)) return { legs: raw, warnings: [] };
  return { legs: raw.legs ?? [], warnings: raw.warnings ?? [] };
}

export type DetourJobStore = {
  listOpenRoadClosures?(): Promise<RoadClosureCandidate[]>;
  e49DetourLoadLegs?(): Promise<DetourLoadLegsResult>;
  upsertE49DetourCase?(row: DetourCaseUpsert): Promise<boolean>;
  closeStaleE49DetourCases?(keepDedup: string[]): Promise<number>;
  noteHereUsage?(service: 'routing', n: number): Promise<void>;
  hereMonthSpend?(): Promise<number>;
  corridorPolylineGeoJson?(code: string): Promise<unknown>;
  /** F7 r4 B6: pamięć HERE — poprzedni payload otwartej sprawy. */
  getOpenDetourCache?(dedupKey: string): Promise<OpenDetourCache | null>;
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
  const { legs, warnings: legWarnings } = normalizeDetourLoadLegs(
    args.store.e49DetourLoadLegs ? await args.store.e49DetourLoadLegs() : [],
  );
  for (const w of legWarnings) warnings.push(w);
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
    // F7 r3 B3: wszystkie pozostałe nogi (nie tylko currentLeg) — „na dalszej trasie”.
    const matched = legs.filter(
      (leg) =>
        corridorMatchesLeg(c, leg.code)
        && leg.status !== 'AT_SITE'
        && leg.status !== 'FERRY'
        && leg.status !== 'DELIVERED'
        && leg.status !== 'CANCELLED'
        && leg.status !== 'REMOVED'
        && leg.status !== 'READY'
        && leg.status !== 'AT_LOADING'
        && leg.status !== 'PLANNED',
    );
    for (const leg of matched) {
      // F7 r4 B4: sprawa tylko w drodze (IN_TRANSIT_* / ON_FERRY / TO_PORT…) ze świeżą pozycją.
      const inTransit = /IN_TRANSIT|ON_FERRY|TO_PORT|PRE_/.test(leg.status);
      if (!inTransit) continue;
      if (!leg.position) {
        // Trzymaj otwartą sprawę w keep, jeśli zamknięcie trwa (F7 r4 uwaga).
        const dedupKeep = detourDedupKey(leg.loadId, c.closureRef);
        keep.push(dedupKeep);
        warnings.push(`E49-b: brak świeżej pozycji ${leg.loadId} — pominięto sprawę`);
        continue;
      }
      const poly = await loadPoly(leg.code);
      // F7 r4 B4: atKm zawsze z rzutu na polilinię nogi + próg 25 km (także gdy źródło podało at_km).
      let atKm: number | null = null;
      if (poly.length >= 2) {
        atKm = projectKmOnCorridor(poly, c.lat, c.lon);
        if (atKm != null) {
          const nearest = pointAtKm(poly, atKm);
          if (nearest && haversineKm([c.lon, c.lat], nearest) > 25) {
            atKm = null;
          }
        }
      } else if (c.atKm != null && Number.isFinite(c.atKm)) {
        atKm = c.atKm;
      }
      if (atKm == null || !Number.isFinite(atKm)) {
        warnings.push(`E49-b: brak at_km dla ${c.closureRef} / ${leg.code} — pominięto`);
        continue;
      }
      // Noga przyszła (nie current): fromKm=0 — całe zamknięcie jest „przed” autem.
      const fromKm = leg.currentLeg ? leg.fromKm : 0;
      if (atKm < fromKm - 0.5) continue;

      const dedup = detourDedupKey(leg.loadId, c.closureRef);
      keep.push(dedup);
      const decideBy = estimateDecideByIso({
        nowIso,
        fromKm,
        atKm,
      });
      const syntheticEta = !(leg.baseEtaIso && Number.isFinite(Date.parse(leg.baseEtaIso)));
      const baseEta = !syntheticEta
        ? leg.baseEtaIso!
        : new Date(Date.parse(decideBy) + 6 * 3600_000).toISOString();
      // DP-211 F7 #805 B3: WORKS bez bieżącego zamknięcia (objazd je omija).
      const worksPeers = closuresOk
        ? closures.filter((x) =>
          x.closureRef !== c.closureRef
          && corridorMatchesLeg(x, leg.code)
          && looksLikeRoadWorks(x)
        )
        : [];
      const riskCtx: DetourRiskCtx = {
        ...(leg.riskCtx ?? {}),
        syntheticEta: syntheticEta || leg.riskCtx?.syntheticEta === true,
        // Postój: roboty na korytarzu (bez bieżącego). Objazd: geometria w buildDetourPayload.
        worksHit: closuresOk ? worksPeers.length > 0 : null,
        worksTitle: closuresOk ? (worksPeers[0]?.title ?? null) : null,
      };

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
      let hereCalculatedAt: string | null = null;

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

      let baseMissing = false;
      // F7 r4/r5 B6: pamięć HERE — kotwica tylko z prawdziwego liczenia; >2 h → przelicz.
      let reusedCache = false;
      const prev = args.store.getOpenDetourCache
        ? await args.store.getOpenDetourCache(dedup)
        : null;
      const prevCalcAt = prev?.payload?.hereCalculatedAt
        ?? null;
      const cacheFresh = prevCalcAt != null
        && Number.isFinite(Date.parse(prevCalcAt))
        && (Date.parse(nowIso) - Date.parse(prevCalcAt)) <= 2 * 3600_000;
      const cacheAnchor = prev?.position
        ?? (prev?.payload?.positionAtCalc && prev.payload.positionAtCalc.length >= 2
          ? [prev.payload.positionAtCalc[0]!, prev.payload.positionAtCalc[1]!] as [number, number]
          : null);
      if (
        prev
        && prev.payload
        && !('none' in prev.payload.detour && prev.payload.detour.none)
        && cacheFresh
        && Math.abs(prev.closureLat - c.lat) < 1e-4
        && Math.abs(prev.closureLon - c.lon) < 1e-4
        && cacheAnchor
        && leg.position
        && haversineKm(
          [cacheAnchor[1], cacheAnchor[0]],
          [leg.position[1], leg.position[0]],
        ) <= 10
      ) {
        reusedCache = true;
        const cached = prev.payload.detour;
        const cachedNotices = prev.payload.hereNotices ?? [];
        if (!('none' in cached)) {
          // Odtwórz nadwyżkę z cache + notices z ostatniego liczenia (B6b.3 LIMITS).
          baseLengthM = 1000;
          baseDurationSec = 60;
          hereSummary = {
            lengthM: 1000 + cached.addKm * 1000,
            durationSec: 60 + cached.addMin * 60,
            notices: [...cachedNotices],
            names: cached.via ? [cached.via] : [],
            roadNumbers: [],
            line: cached.line,
          };
          hereCalculatedAt = prevCalcAt;
        }
      }

      if (!reusedCache && hereOk && dims && hereCalls < DETOUR_HERE_MAX_PER_RUN) {
        const avoid = avoidBboxAround(c.lat, c.lon).param;
        const dimsT = dims as TruckDims;
        try {
          // Trasa bazowa (bez avoid) — nadwyżka km/min. Bez bazy nie liczymy objazdu (B6).
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
            } else {
              baseMissing = true;
            }
          } else {
            baseMissing = true;
          }

          if (!baseMissing && baseLengthM > 0) {
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
              baseMissing = true;
            } else {
              const det = await fetchHereSummary({ fetch: args.fetch, url, dimsLabel });
              hereCalls++;
              if (args.store.noteHereUsage) await args.store.noteHereUsage('routing', 1);
              if (!det.ok) {
                noWhy = det.noWhy;
                baseMissing = true;
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
          } else if (!noWhy) {
            noWhy = 'Brak objazdu w tym przebiegu — brak trasy bazowej HERE; przeliczenie za ≤ 30 min';
            baseMissing = true;
          }
        } catch (e) {
          hereCalls++;
          noWhy = 'Brak objazdu dla tego zestawu (błąd HERE) — tylko postój';
          baseMissing = true;
          warnings.push(`E49-b HERE: ${e instanceof Error ? maskHereApiKey(e.message) : 'błąd'}`);
        }
      } else if (!reusedCache && !dims) {
        noWhy = 'Brak objazdu — brak wymiarów zestawu w tabeli (D1)';
      } else if (!reusedCache && !hereOk) {
        noWhy = 'Brak objazdu — HERE niedostępne; tylko postój';
        baseMissing = true;
      } else if (!reusedCache && hereCalls >= DETOUR_HERE_MAX_PER_RUN) {
        noWhy = 'Brak objazdu w tym przebiegu — limit zapytań HERE; przeliczenie za ≤ 30 min';
        baseMissing = true;
      }

      // F7 r5 B6b.2: po >2 h bez świeżego HERE — objazd nieaktualny (bez przycisku).
      if (
        !reusedCache
        && baseMissing
        && prev
        && prev.payload
        && !('none' in prev.payload.detour && prev.payload.detour.none)
        && prevCalcAt
        && Number.isFinite(Date.parse(prevCalcAt))
        && (Date.parse(nowIso) - Date.parse(prevCalcAt)) > 2 * 3600_000
      ) {
        noWhy = 'Objazd nieaktualny (>2 h) — sprawdź objazd; tylko postój do przeliczenia';
        hereSummary = null;
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
        riskCtx,
        worksCandidates: closuresOk ? closures : undefined,
        excludeClosureRef: c.closureRef,
      });
      if (urlMasked) payload.hereUrlMasked = urlMasked;
      if (baseMissing) payload.baseMissing = true;
      // F7 r5 B6b.1: kotwica tylko przy prawdziwym liczeniu HERE (nie przy pamięci / baseMissing).
      if (!reusedCache && !baseMissing && hereSummary && leg.position) {
        payload.positionAtCalc = leg.position;
        payload.hereCalculatedAt = nowIso;
        payload.hereNotices = hereSummary.notices;
      } else if (reusedCache && prev) {
        payload.positionAtCalc = prev.payload.positionAtCalc ?? cacheAnchor;
        payload.hereCalculatedAt = prevCalcAt;
        payload.hereNotices = prev.payload.hereNotices ?? [];
        if (!('none' in prev.payload.detour) && !('none' in payload.detour)) {
          payload.detour.via = prev.payload.detour.via;
          payload.detour.line = prev.payload.detour.line;
        }
      } else if (baseMissing && prev?.payload?.positionAtCalc) {
        // Zachowaj starą kotwicę — nie przesuwaj przy błędzie HERE.
        payload.positionAtCalc = prev.payload.positionAtCalc;
        payload.hereCalculatedAt = prev.payload.hereCalculatedAt ?? null;
        payload.hereNotices = prev.payload.hereNotices ?? null;
      }

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
