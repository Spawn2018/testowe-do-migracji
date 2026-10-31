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
  kaaDeviationOk,
  type LatLng,
} from '../map/draw.ts';

/** Cron odświeża przy wieku ≥ 21 d, żeby purge 30 d nie zostawił mapy bez linii. */
export const ROAD_CRON_REFRESH_MS = 21 * 864e5;

const RETRY_REJECT_MS = 24 * 3600e3;

/** Spec ze słownika `here_road_legs` (DP-23). */
export type RoadLegSpecKind = 'pl' | 'se' | 'loose' | 'kaa';

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
};

/**
 * Zapas core (#667 B) gdy store bez `listLegs` (testy jednostkowe).
 * Produkcja: `here_road_legs` przez `listLegs`.
 */
export const ROAD_LEGS: readonly RoadLegDef[] = [
  { leg: 'PL-GDN', origin: '52.07391,17.0246', destination: '54.40372,18.6813', spec: 'pl', summary: 'Trasa drogowa Śrem–Gdańsk', browserFetch: true, mapGroup: 'core' },
  { leg: 'SE-NYN', origin: '58.90453,17.95621', destination: '65.80539,21.75914', spec: 'se', summary: 'Trasa drogowa Nynäshamn–Boden', browserFetch: true, mapGroup: 'core' },
  { leg: 'PL-GDY', origin: '52.07391,17.0246', destination: '54.53321,18.54425', spec: 'loose', summary: 'Trasa drogowa Śrem–Gdynia', browserFetch: true, mapGroup: 'core' },
  {
    leg: 'SE-KAA',
    origin: '56.1646,15.6308',
    destination: '65.80539,21.75914',
    spec: 'kaa',
    summary: 'Trasa drogowa Karlskrona–Boden (E22 / wybrzeże)',
    corridorCode: 'SE_E22',
    browserFetch: true,
    mapGroup: 'core',
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
  },
] as const;

export type CorridorBundle = { code: string; pts: LatLng[]; via: LatLng[]; updatedAt: number };

export type RoadGeomRow = {
  leg: string;
  fetched_at: string;
  points: unknown;
  retry_after: string | null;
};

export type RoadRefreshStore = {
  /** #667 E / DP-23: aktywne legi ze słownika; brak → ROAD_LEGS (testy). */
  listLegs?(): Promise<RoadLegDef[]>;
  listGeometry(): Promise<RoadGeomRow[]>;
  storeRoad(leg: string, points: unknown, summary: string, nowIso?: string): Promise<boolean>;
  loadCorridor(code: string): Promise<CorridorBundle>;
  /** `null` = brak odczytu wydatku — nie wołaj HERE (F7 #673 r4 uwaga 3). */
  monthSpend(): Promise<number | null>;
  noteRouting(): Promise<void>;
};

export type RefreshRoadOpts = {
  fetch: typeof fetch;
  hereApiKey: string;
  nowMs?: number;
  /** Domyślnie 30 d (przeglądarka); cron podaje ROAD_CRON_REFRESH_MS (21 d). */
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
 * browserOnly = tylko browser_fetch; cron = core + BN7 dopiero po browser_fetch=true.
 */
export async function resolveLegs(
  store: RoadRefreshStore,
  browserOnly: boolean | undefined,
): Promise<RoadLegDef[]> {
  const raw = store.listLegs ? await store.listLegs() : [...ROAD_LEGS];
  const all = raw.length > 0 ? raw : [...ROAD_LEGS];
  if (browserOnly) return all.filter((l) => l.browserFetch !== false);
  return all.filter((l) => l.mapGroup !== 'bn7' || l.browserFetch === true);
}

/** SOURCE_DOWN tylko dla legów core (BN7 bez punktów nie blokuje). */
function requiredForSourceDown(legs: RoadLegDef[]): RoadLegDef[] {
  return legs.filter((l) => l.mapGroup !== 'bn7');
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
    const corridor = isKaa ? await corridorFor(leg) : null;
    const corridorNewer =
      isKaa &&
      corridor != null &&
      corridor.updatedAt > 0 &&
      prev != null &&
      Number.isFinite(Date.parse(prev.fetched_at)) &&
      corridor.updatedAt > Date.parse(prev.fetched_at);
    if (!shouldFetch(prev, nowMs, corridorNewer, maxAgeMs)) continue;

    if (isKaa && (corridor == null || corridor.pts.length < 2)) {
      warnings.push(`${leg.leg}: brak korytarza (via) — pominięto HERE`);
      continue;
    }

    const viaPts = corridor?.via ?? [];
    const corridorPts = corridor?.pts ?? [];
    const corridorLabel = corridor?.code ?? '?';
    attempted += 1;

    const routeUrl = new URL('https://router.hereapi.com/v8/routes');
    routeUrl.searchParams.set('transportMode', 'truck');
    routeUrl.searchParams.set('origin', leg.origin);
    routeUrl.searchParams.set('destination', leg.destination);
    routeUrl.searchParams.set('return', 'polyline');
    routeUrl.searchParams.set('apiKey', opts.hereApiKey);
    if (isKaa) {
      for (const v of viaPts) {
        routeUrl.searchParams.append('via', `${v[0]},${v[1]}!passThrough=true`);
      }
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
    let body: { routes?: Array<{ sections?: Array<{ polyline?: string }> }> };
    try {
      body = await res.json();
    } catch {
      warnings.push(`${leg.leg}: zła odpowiedź JSON`);
      continue;
    }
    const sections = body?.routes?.[0]?.sections ?? [];
    const line: LatLng[] = [];
    for (const section of sections) {
      if (typeof section?.polyline !== 'string') continue;
      try {
        line.push(...decodeFlexiblePolyline(section.polyline));
      } catch {
        /* zła polilinia */
      }
    }
    const geomSpec =
      leg.spec === 'kaa' ? roadKaaSpecFromVia(viaPts)
        : leg.spec === 'pl' ? ROAD_PL
          : leg.spec === 'se' ? ROAD_SE
            : 'loose';
    const okGeom = geomSpec === 'loose' ? looseRoadOk(line) : roadGeometryOk(line, geomSpec);
    // #667 F7 r3 B4: SE_E22 / SE_KAA_INLAND = rzadki korytarz (controlPts + 15 km);
    // SE_KAA_TRACK (gdyby wrócił) = stara reguła śladu GPS.
    const sparse =
      corridorLabel === 'SE_E22' || corridorLabel === 'SE_KAA_INLAND';
    const controlPts: LatLng[] = (() => {
      if (!isKaa) return [];
      const [oLat, oLng] = leg.origin.split(',').map(Number);
      const [dLat, dLng] = leg.destination.split(',').map(Number);
      const out: LatLng[] = [];
      if (Number.isFinite(oLat) && Number.isFinite(oLng)) out.push([oLat!, oLng!]);
      out.push(...viaPts);
      if (Number.isFinite(dLat) && Number.isFinite(dLng)) out.push([dLat!, dLng!]);
      return out;
    })();
    const okDev =
      !isKaa ||
      corridorPts.length < 2 ||
      kaaDeviationOk(
        line,
        corridorPts,
        sparse ? { sparseCorridor: true, controlPts } : undefined,
      );
    if (!okGeom || !okDev) {
      const retryIso = new Date(nowMs + RETRY_REJECT_MS).toISOString();
      await store.storeRoad(
        leg.leg,
        null,
        leg.summary + (okGeom ? ` — odchyłka od ${corridorLabel}` : ' — geometria odrzucona'),
        retryIso,
      );
      warnings.push(`${leg.leg}: geometria odrzucona`);
      continue;
    }
    const ok = await store.storeRoad(leg.leg, line, leg.summary);
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
