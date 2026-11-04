/**
 * E49-b cz.2 (DP-206 / D-20261104-0105-01 Z3): zamknięcie drogi/mostu na trasie
 * → sprawa SCX „Objazd czy postój?” + HERE Routing truck (avoid[areas]).
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
  type TruckDims,
} from './detourHere.ts';
import { completeDims, type SetDims } from '../here/routeCheck.ts';

const USER_AGENT = 'WatchTower/1.0 (E49 detour; +https://tower.log-mar.pl)';
/** Średnia prędkość do estymacji decideBy (km/h). */
const APPROACH_KMH = 70;
/** Max zapytań HERE Routing na jeden przebieg joba (pula D-77/D-78). */
export const DETOUR_HERE_MAX_PER_RUN = 8;

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
  /** km wzdłuż korytarza (null = nieznany — i tak bierzemy, gdy currentLeg). */
  atKm: number | null;
  obokTrasy?: boolean;
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
    risks: Array<{ kind: string; level: 'warn' | 'ok'; text: string }>;
  };
  detour:
    | {
        addKm: number;
        addMin: number;
        etaIso: string;
        via: string;
        risks: Array<{ kind: string; level: 'warn' | 'ok'; text: string }>;
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
export function isOnRouteClosure(c: Pick<RoadClosureCandidate, 'title' | 'detailText' | 'roadClosed' | 'obokTrasy'>): boolean {
  if (c.obokTrasy === true) return false;
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

/** Corridor code z kind ryzyka. */
export function corridorFromRoadKind(kind: string, road?: string | null): string {
  const k = kind.toUpperCase();
  if (k.includes('ROAD_SE') || k === 'ROAD_SE') {
    if (road && /^E\s*22$/i.test(road.trim())) return 'SE_E22';
    return 'SE_E4';
  }
  if (k.includes('ROAD_PL') || k === 'ROAD_PL') return 'PL_ROAD';
  if (k.includes('ROAD_LT')) return 'ROAD_LT';
  if (k.includes('ROAD_LV')) return 'ROAD_LV';
  if (k.includes('ROAD_EE')) return 'ROAD_EE';
  if (k.includes('ROAD_FI')) return 'ROAD_FI';
  return kind;
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

/** Skrót via z notices/names — pierwsza sensowna nazwa drogi. */
export function viaFromHereNotices(notices: readonly string[], fallback = 'objazd HERE'): string {
  for (const n of notices) {
    const m = n.match(/\b([A-Z]?\d{1,3}|E\s*\d{1,3}|DK\s*\d+)\b/i);
    if (m) return `przez ${m[1]!.replace(/\s+/g, '')}`;
  }
  return fallback;
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
    line: Array<[number, number]> | null;
  } | null;
  noDetourWhy: string | null;
  baseLengthM?: number;
}): DetourCasePayload {
  const hold = planHold({
    nowIso: args.nowIso,
    decideByIso: args.decideByIso,
    untilIso: args.untilIso,
    baseEtaIso: args.baseEtaIso,
  });
  const permit = permitDetourRisk({ country: args.country, permitMode: args.permitMode });
  const holdRisks = [permit];
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
  const addKm = Math.max(0, Math.round(((args.here.lengthM - baseLen) / 1000) * 10) / 10);
  const addMin = Math.max(0, Math.round(args.here.durationSec / 60));
  const limitRisk =
    args.here.notices.some((n) => /violatedVehicleRestriction/i.test(n))
      ? {
          kind: 'LIMITS' as const,
          level: 'warn' as const,
          text: 'ograniczenia zestawu na objeździe (HERE)',
        }
      : {
          kind: 'LIMITS' as const,
          level: 'ok' as const,
          text: 'brak naruszeń wymiarów/masy na objeździe (HERE)',
        };

  return {
    hold: { ...hold, risks: holdRisks },
    detour: {
      addKm,
      addMin,
      etaIso: new Date(Date.parse(args.baseEtaIso) + addMin * 60_000).toISOString(),
      via: viaFromHereNotices(args.here.notices),
      risks: [permit, limitRisk],
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
};

export type DetourJobResult = {
  candidates: number;
  upserts: number;
  hereCalls: number;
  closed: number;
  warnings: string[];
};

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
  const closures = args.store.listOpenRoadClosures
    ? (await args.store.listOpenRoadClosures()).filter(isOnRouteClosure)
    : [];
  const legs = args.store.e49DetourLoadLegs ? await args.store.e49DetourLoadLegs() : [];
  const keep: string[] = [];
  let upserts = 0;
  let hereCalls = 0;

  const spend = args.store.hereMonthSpend ? await args.store.hereMonthSpend() : 0;
  const budget = args.budgetUsd ?? 100;
  const hereOk = Boolean(args.hereApiKey?.trim()) && spend < budget - 1e-9;
  if (!args.hereApiKey?.trim()) warnings.push('E49-b: brak HERE_API_KEY — sprawy tylko z postojem (bez objazdu)');
  else if (spend >= budget - 1e-9) warnings.push('E49-b: budżet HERE wyczerpany — bez zapytań Routing');

  for (const c of closures) {
    const matched = legs.filter(
      (leg) =>
        leg.currentLeg
        && leg.code === c.corridor
        && leg.status !== 'AT_SITE'
        && leg.status !== 'FERRY'
        && (c.atKm == null || c.atKm >= leg.fromKm - 0.5),
    );
    for (const leg of matched) {
      const dedup = detourDedupKey(leg.loadId, c.closureRef);
      keep.push(dedup);
      const decideBy = estimateDecideByIso({
        nowIso,
        fromKm: leg.fromKm,
        atKm: c.atKm,
      });
      const baseEta = leg.baseEtaIso && Number.isFinite(Date.parse(leg.baseEtaIso))
        ? leg.baseEtaIso
        : new Date(Date.parse(decideBy) + 6 * 3600_000).toISOString();

      let hereSummary: {
        lengthM: number;
        durationSec: number;
        notices: string[];
        line: Array<[number, number]> | null;
      } | null = null;
      let noWhy: string | null = null;
      let urlMasked: string | undefined;

      const dims = completeDims(leg.dims);
      if (hereOk && dims && hereCalls < DETOUR_HERE_MAX_PER_RUN) {
        const origin: readonly [number, number] = leg.position ?? [c.lat - 0.05, c.lon];
        const destination: readonly [number, number] = [c.lat + 0.08, c.lon];
        const avoid = avoidBboxAround(c.lat, c.lon).param;
        const url = buildDetourRoutingUrl({
          apiKey: args.hereApiKey!,
          origin,
          destination,
          dims: dims as TruckDims,
          avoidAreas: [avoid],
        });
        urlMasked = maskHereApiKey(url);
        try {
          const r = await args.fetch(url, {
            headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
          });
          hereCalls++;
          if (args.store.noteHereUsage) await args.store.noteHereUsage('routing', 1);
          if (!r.ok) {
            noWhy = `Brak objazdu dla tego zestawu (HERE HTTP ${r.status}) — tylko postój`;
            warnings.push(maskHereApiKey(`E49-b HERE ${r.status} ${url}`));
          } else {
            const body = await r.json();
            noWhy = noDetourWhyFromBody(
              body,
              `${dims.heightM}×${dims.widthM}×${dims.lengthM} m, ${dims.weightT} t`,
            );
            const sum = summarizeHereRoute(body);
            if (sum && !noWhy) {
              hereSummary = {
                ...sum,
                line: null, /* polyline w cz.2b / E45 — oszczędność payload */
              };
            } else if (!noWhy) {
              noWhy = 'Brak objazdu dla tego zestawu — tylko postój';
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
        corridor: c.corridor,
        atKm: c.atKm,
        here: hereSummary,
        noDetourWhy: noWhy,
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
        if (await args.store.upsertE49DetourCase(row)) upserts++;
      }
    }
  }

  const closed = args.store.closeStaleE49DetourCases
    ? await args.store.closeStaleE49DetourCases(keep)
    : 0;

  return {
    candidates: closures.length,
    upserts,
    hereCalls,
    closed,
    warnings,
  };
}

/** Re-export for tests / callers that need polyline helpers. */
export { simplifyLine };
