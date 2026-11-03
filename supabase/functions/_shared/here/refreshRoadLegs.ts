/**
 * #667 C / E — wspólne odświeżanie geometrii pomarańczowych dróg HERE.
 * Używane przez Edge `here-roads` (przeglądarka) i job cron `here-roads` (przed purge 30 d).
 * #667 E / DP-23: lista legów ze słownika w bazie (`listLegs`); ROAD_LEGS = zapas core w testach.
 */
import { decodeFlexiblePolyline } from './routeCheck.ts';
import { HERE_BILLING_DEFAULTS } from './billing.ts';
import { shouldFetch, ROAD_FETCH_DAY_MS } from './roadFetch.ts';
import {
  ROAD_PL,
  ROAD_SE,
  roadKaaSpecFromVia,
  looseRoadOk,
  roadGeometryOk,
  dictGeomRejectReason,
  kaaDeviationOk,
  type LatLng,
} from '../map/draw.ts';

/** Cron odświeża przy wieku ≥ 6 d (DP-198) — poniżej świeżości alarmu 7 d (`bn8b_here_leg_fresh`); purge 30 d bez zmian. */
export const ROAD_CRON_REFRESH_MS = 6 * 864e5;

const RETRY_REJECT_MS = 24 * 3600e3;

/** Spec ze słownika `here_road_legs` (DP-23 / BN7 dict). */
export type RoadLegSpecKind = 'pl' | 'se' | 'loose' | 'kaa' | 'dict';

export type RoadLegDef = {
  leg: string;
  origin: string;
  destination: string;
  spec: RoadLegSpecKind;
  summary: string;
  corridorCode?: string;
  /** false = tylko cron (#667 E BN7); brak = true. */
  browserFetch?: boolean;
  mapGroup?: 'core' | 'bn7';
  /** BN7: via passThrough [[lat,lng],…]. */
  viaPoints?: LatLng[];
  minKm?: number;
  maxKm?: number;
  /** BN7 / DP-55 / F7 #738 B2: cron bierze leg tylko gdy true (brak = false). */
  cronFetch?: boolean;
};

/**
 * Zapas core (#667 B) gdy store bez `listLegs` (testy jednostkowe).
 * Produkcja: `here_road_legs` przez `listLegs`.
 */
export const ROAD_LEGS: readonly RoadLegDef[] = [
  { leg: 'PL-GDN', origin: '52.07391,17.0246', destination: '54.40372,18.6813', spec: 'pl', summary: 'Trasa drogowa Śrem–Gdańsk', browserFetch: true, mapGroup: 'core', cronFetch: true },
  {
    leg: 'SE-NYN',
    origin: '58.90453,17.95621',
    destination: '65.80539,21.75914',
    spec: 'se',
    summary: 'Trasa drogowa Nynäshamn–Boden',
    // DP-197 / F7 #771: odchyłka SE_E4 + via na jezdni E4 (nie centra miast).
    corridorCode: 'SE_E4',
    viaPoints: [
      [59.322, 18.005], // Essingeleden E4
      [59.8767, 17.6953], // Uppsala E4 (0354)
      [60.6638, 17.109], // Gävle E4
      [61.7279, 17.065], // Hudiksvall E4
      [62.391, 17.340], // Sundsvall E4
      [63.8127, 20.3263], // Umeå E4
      [65.606, 22.053], // Luleå E4/97 (nie centrum)
    ],

    browserFetch: true,
    mapGroup: 'core',
    cronFetch: true,
  },
  { leg: 'PL-GDY', origin: '52.07391,17.0246', destination: '54.53321,18.54425', spec: 'loose', summary: 'Trasa drogowa Śrem–Gdynia', browserFetch: true, mapGroup: 'core', cronFetch: true },
  {
    leg: 'SE-KAA',
    origin: '56.1646,15.6308',
    destination: '65.80539,21.75914',
    spec: 'kaa',
    summary: 'Trasa drogowa Karlskrona–Boden (E22 / wybrzeże)',
    corridorCode: 'SE_E22',
    browserFetch: true,
    mapGroup: 'core',
    cronFetch: true,
  },
  {
    leg: 'SE-KAA-INLAND',
    origin: '56.1646,15.6308',
    destination: '65.80539,21.75914',
    spec: 'kaa',
    summary: 'Trasa drogowa Karlskrona–Boden (śródlądowa)',
    corridorCode: 'SE_KAA_INLAND',
    browserFetch: true,
    mapGroup: 'core',
    cronFetch: true,
  },
] as const;

export type CorridorBundle = { code: string; pts: LatLng[]; via: LatLng[]; updatedAt: number };

export type RoadGeomRow = {
  leg: string;
  fetched_at: string;
  points: unknown;
  retry_after: string | null;
};

export type RoadStoreMeta = { lengthM?: number; durationS?: number };

export type RoadRefreshStore = {
  /** #667 E / DP-23: aktywne legi ze słownika; brak → ROAD_LEGS (testy). */
  listLegs?(): Promise<RoadLegDef[]>;
  listGeometry(): Promise<RoadGeomRow[]>;
  storeRoad(
    leg: string,
    points: unknown,
    summary: string,
    nowIso?: string,
    meta?: RoadStoreMeta,
  ): Promise<boolean>;
  loadCorridor(code: string): Promise<CorridorBundle>;
  /** `null` = brak odczytu wydatku — nie wołaj HERE (F7 #673 r4 uwaga 3). */
  monthSpend(): Promise<number | null>;
  noteRouting(): Promise<void>;
};

export type RefreshRoadOpts = {
  fetch: typeof fetch;
  hereApiKey: string;
  nowMs?: number;
  /** Domyślnie 30 d (przeglądarka); cron podaje ROAD_CRON_REFRESH_MS (6 d, DP-198). */
  maxAgeMs?: number;
  /** true = tylko browser_fetch (Edge JWT); false/undefined = wszystkie (cron). */
  browserOnly?: boolean;
};

export type RefreshRoadResult = {
  stored: number;
  attempted: number;
  skippedBudget: boolean;
  warnings: string[];
  /** Legi bez ≥2 punktów po próbie odświeżenia. */
  missingLegs: string[];
};

function hasPoints(points: unknown): boolean {
  return Array.isArray(points) && points.length >= 2;
}

/**
 * #677 F7 r1 B1: pusty słownik → zapas ROAD_LEGS (nie {ok:true, stored:0}).
 * browserOnly = tylko browser_fetch; cron = cron_fetch (BN7 #718 / DP-55).
 */
export async function resolveLegs(
  store: RoadRefreshStore,
  browserOnly: boolean | undefined,
): Promise<RoadLegDef[]> {
  const raw = store.listLegs ? await store.listLegs() : [...ROAD_LEGS];
  const all = raw.length > 0 ? raw : [...ROAD_LEGS];
  if (browserOnly) return all.filter((l) => l.browserFetch !== false);
  // F7 #738 B2: tylko jawne cronFetch===true (spójne z legDefFromRow / default false).
  return all.filter((l) => l.cronFetch === true);
}

/** SOURCE_DOWN: core zawsze; BN7 dopiero gdy cron_fetch (po aktywacji — MEDIUM w jobie). */
function requiredForSourceDown(legs: RoadLegDef[]): RoadLegDef[] {
  return legs.filter((l) => l.mapGroup !== 'bn7' || l.cronFetch === true);
}

export async function refreshRoadLegs(
  store: RoadRefreshStore,
  opts: RefreshRoadOpts,
): Promise<RefreshRoadResult> {
  const nowMs = opts.nowMs ?? Date.now();
  const maxAgeMs = opts.maxAgeMs ?? ROAD_FETCH_DAY_MS;
  const warnings: string[] = [];
  const legs = await resolveLegs(store, opts.browserOnly);
  const requiredLegs = requiredForSourceDown(legs);
  const spend = await store.monthSpend();
  if (spend == null) {
    const rows = await store.listGeometry();
    const byLeg = new Map(rows.map((r) => [r.leg, r]));
    const missing = requiredLegs.filter((l) => !hasPoints(byLeg.get(l.leg)?.points)).map((l) => l.leg);
    return {
      stored: 0,
      attempted: 0,
      skippedBudget: false,
      warnings: ['Brak odczytu wydatku HERE (hereMonthSpend) — bez wołania HERE'],
      missingLegs: missing,
    };
  }
  if (spend >= HERE_BILLING_DEFAULTS.budgetUsd) {
    const rows = await store.listGeometry();
    const byLeg = new Map(rows.map((r) => [r.leg, r]));
    const missing = requiredLegs.filter((l) => !hasPoints(byLeg.get(l.leg)?.points)).map((l) => l.leg);
    return {
      stored: 0,
      attempted: 0,
      skippedBudget: true,
      warnings: missing.length
        ? [`Budżet HERE wyczerpany — brak geometrii: ${missing.join(', ')}`]
        : ['Budżet HERE wyczerpany — bez odświeżenia'],
      missingLegs: missing,
    };
  }

  const rows = await store.listGeometry();
  const have = new Map(rows.map((r) => [r.leg, r]));
  const corridorCache = new Map<string, CorridorBundle>();

  async function corridorFor(leg: RoadLegDef): Promise<CorridorBundle | null> {
    // #667 F7 r1 B3: tylko jawny corridorCode (SE_E22 / SE_KAA_INLAND).
    const code = leg.corridorCode ?? null;
    if (!code) return null;
    const cached = corridorCache.get(code);
    if (cached) return cached;
    const loaded = await store.loadCorridor(code);
    corridorCache.set(code, loaded);
    return loaded;
  }

  let stored = 0;
  let attempted = 0;
  for (const leg of legs) {
    const prev = have.get(leg.leg);
    const isKaa = leg.spec === 'kaa';
    // DP-197: SE-NYN/SE_E4 — ta sama kontrola odchyłki i via co KAA.
    const useCorridorDev = isKaa || leg.corridorCode === 'SE_E4';
    const corridor = useCorridorDev ? await corridorFor(leg) : null;
    const corridorNewer =
      useCorridorDev &&
      corridor != null &&
      corridor.updatedAt > 0 &&
      prev != null &&
      Number.isFinite(Date.parse(prev.fetched_at)) &&
      corridor.updatedAt > Date.parse(prev.fetched_at);
    if (!shouldFetch(prev, nowMs, corridorNewer, maxAgeMs)) continue;

    if (useCorridorDev && (corridor == null || corridor.pts.length < 2)) {
      warnings.push(`${leg.leg}: brak korytarza (via) — pominięto HERE`);
      continue;
    }

    const dictVia = leg.viaPoints ?? [];
    // KAA: via z korytarza OSM; SE_E4: via węzłów E4 z legu (DP-197 / F7 #771), inaczej corridor.via.
    const viaPts = isKaa
      ? (corridor?.via ?? [])
      : (dictVia.length > 0 ? dictVia : (corridor?.via ?? []));

    const corridorPts = corridor?.pts ?? [];
    const corridorLabel = corridor?.code ?? '?';
    attempted += 1;

    const routeUrl = new URL('https://router.hereapi.com/v8/routes');
    routeUrl.searchParams.set('transportMode', 'truck');
    routeUrl.searchParams.set('origin', leg.origin);
    routeUrl.searchParams.set('destination', leg.destination);
    // BN7: summary.length / duration; exclude RUS/BLR (ISO alpha-3, dok. HERE v8).
    routeUrl.searchParams.set('return', leg.spec === 'dict' ? 'polyline,summary' : 'polyline');
    routeUrl.searchParams.set('apiKey', opts.hereApiKey);
    if (leg.spec === 'dict' || useCorridorDev) {
      for (const v of viaPts) {
        routeUrl.searchParams.append('via', `${v[0]},${v[1]}!passThrough=true`);
      }
    }
    if (leg.spec === 'dict') {
      routeUrl.searchParams.set('exclude[countries]', 'RUS,BLR');
    }
    const res = await opts.fetch(routeUrl, { headers: { 'User-Agent': 'WatchTower/1' } });
    if (!res.ok) {
      // #667 F7 r1 N1: retry_after +1 h (bez pętli HERE); job zapisuje ostrzeżenia w integration_runs.
      const retryIso = new Date(nowMs + 3600e3).toISOString();
      await store.storeRoad(leg.leg, null, `${leg.summary} — HTTP ${res.status}`, retryIso);
      warnings.push(`${leg.leg}: HTTP ${res.status}`);
      continue;
    }
    await store.noteRouting();
    let body: {
      routes?: Array<{
        sections?: Array<{
          polyline?: string;
          summary?: { length?: number; duration?: number };
        }>;
      }>;
    };
    try {
      body = await res.json();
    } catch {
      warnings.push(`${leg.leg}: zła odpowiedź JSON`);
      continue;
    }
    const sections = body?.routes?.[0]?.sections ?? [];
    const line: LatLng[] = [];
    let lengthM = 0;
    let durationS = 0;
    for (const section of sections) {
      if (typeof section?.polyline !== 'string') continue;
      try {
        line.push(...decodeFlexiblePolyline(section.polyline));
      } catch {
        /* zła polilinia */
      }
      const len = Number(section.summary?.length);
      const dur = Number(section.summary?.duration);
      if (Number.isFinite(len)) lengthM += len;
      if (Number.isFinite(dur)) durationS += dur;
    }
    const geomSpec =
      leg.spec === 'kaa' ? roadKaaSpecFromVia(viaPts)
        : leg.spec === 'pl' ? ROAD_PL
          : leg.spec === 'se' ? ROAD_SE
            : leg.spec === 'dict' ? 'dict'
              : 'loose';
    const dictOpts = {
      via: dictVia,
      minKm: leg.minKm ?? 0,
      maxKm: leg.maxKm ?? Number.POSITIVE_INFINITY,
    };
    const dictReason = geomSpec === 'dict' ? dictGeomRejectReason(line, dictOpts) : null;
    const okGeom =
      geomSpec === 'dict'
        ? dictReason == null
        : geomSpec === 'loose'
          ? looseRoadOk(line)
          : roadGeometryOk(line, geomSpec);
    // #667 F7 r3 B4: SE_E22 / SE_KAA_INLAND = rzadki korytarz (controlPts + 15 km);
    // DP-197: SE_E4 sparse — ciężarówka na E4 (Essingeleden) vs cięciwa OSM przez centrum.
    // SE_KAA_TRACK (gdyby wrócił) = stara reguła śladu GPS.
    const sparse =
      corridorLabel === 'SE_E22' ||
      corridorLabel === 'SE_KAA_INLAND' ||
      corridorLabel === 'SE_E4';
    const controlPts: LatLng[] = (() => {
      if (!useCorridorDev) return [];
      const [oLat, oLng] = leg.origin.split(',').map(Number);
      const [dLat, dLng] = leg.destination.split(',').map(Number);
      const out: LatLng[] = [];
      if (Number.isFinite(oLat) && Number.isFinite(oLng)) out.push([oLat!, oLng!]);
      out.push(...viaPts);
      if (Number.isFinite(dLat) && Number.isFinite(dLng)) out.push([dLat!, dLng!]);
      return out;
    })();
    const okDev =
      !useCorridorDev ||
      corridorPts.length < 2 ||
      kaaDeviationOk(
        line,
        corridorPts,
        sparse ? { sparseCorridor: true, controlPts } : undefined,
      );
    if (!okGeom || !okDev) {
      const retryIso = new Date(nowMs + RETRY_REJECT_MS).toISOString();
      // DP-183: powód z liczbami (km/zakres/via/punkty) — bez geometrii w ostrzeżeniu.
      const detail = okGeom
        ? `odchyłka od ${corridorLabel}`
        : (dictReason ?? 'geometria odrzucona');
      await store.storeRoad(
        leg.leg,
        null,
        `${leg.summary} — ${detail}`,
        retryIso,
      );
      warnings.push(`${leg.leg}: ${detail}`);
      continue;
    }
    const meta =
      lengthM > 0 || durationS > 0
        ? { lengthM: lengthM > 0 ? lengthM : undefined, durationS: durationS > 0 ? durationS : undefined }
        : undefined;
    const ok = await store.storeRoad(leg.leg, line, leg.summary, undefined, meta);
    if (!ok) {
      warnings.push(`${leg.leg}: zapis nieudany`);
      continue;
    }
    stored += 1;
    have.set(leg.leg, {
      leg: leg.leg,
      fetched_at: new Date(nowMs).toISOString(),
      points: line,
      retry_after: null,
    });
  }

  const missingLegs = requiredLegs.filter((l) => !hasPoints(have.get(l.leg)?.points)).map((l) => l.leg);
  return { stored, attempted, skippedBudget: false, warnings, missingLegs };
}
