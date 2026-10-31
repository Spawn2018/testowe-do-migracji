/**
 * #685-b / decyzja 63b + 74 — import rozkładu Viking z pliku (nie `applySailings`).
 * W ±3 h trasa/statek: `digitraffic:%` bez transportów → usuń; z transportami → przejmij
 * (czasy z pliku, `source_ref=null`). RECZNIE nietykalne. #685-c: horyzont ≥ 30 d → SOURCE_DOWN.
 */
import type {
  DbSailing, IncomingSailing, RiskInput, SailingInsert, SailingPatch, VesselRow,
} from '../integrations/sync.ts';
import { planSailingSync } from '../integrations/sync.ts';

/** F7 #688 r4 / decyzja 74 — okno Digitraffic↔plik. */
export const VIKING_FILE_SCHEDULE_WIN_MS = 3 * 3600_000;
/** Exact + bliski RECZNIE (jak dopasowanie ±30 min w planSailingSync / test bn2). */
const MANUAL_KEEP_WIN_MS = 30 * 60_000;
/** #685-c */
export const VIKING_FILE_COVERAGE_DAYS_CLOSE = 30;

const DIGITRAFFIC_PREFIX = 'digitraffic:';

export type VikingFileSailing = Pick<IncomingSailing, 'route' | 'vessel' | 'departureUtc' | 'arrivalUtc'>;

export interface VikingFileImportStore {
  projectId(): Promise<string>;
  vessels(): Promise<VesselRow[]>;
  sailingsSince(fromIso: string): Promise<DbSailing[]>;
  insertSailings(rows: SailingInsert[]): Promise<void>;
  updateSailing(id: string, patch: SailingPatch): Promise<boolean>;
  sailingAssignedLoadCount?(sailingId: string): Promise<number>;
  deleteSailing?(id: string): Promise<boolean>;
  raiseRisk(r: RiskInput & { loadId?: string }): Promise<boolean>;
  resolveRisks(dedupPrefix: string): Promise<number>;
}

export interface VikingFileImportDeps {
  store: VikingFileImportStore;
  now: () => Date;
}

export interface VikingFilePreview {
  sailingCount: number;
  fromAt: string | null;
  toAt: string | null;
  horizonDays: number;
}

export interface VikingFileApplyStats extends VikingFilePreview {
  inserted: number;
  updated: number;
  removed: number;
  takenOver: number;
  manualKept: number;
  risks: number;
  sourceDownClosed: boolean;
  warnings: string[];
}

export function isDigitrafficSourceRef(ref: string | null | undefined): boolean {
  return (ref ?? '').startsWith(DIGITRAFFIC_PREFIX);
}

export function previewVikingFileSailings(
  sailings: readonly VikingFileSailing[],
): VikingFilePreview {
  if (sailings.length === 0) {
    return { sailingCount: 0, fromAt: null, toAt: null, horizonDays: 0 };
  }
  const deps = sailings.map((s) => Date.parse(s.departureUtc)).filter(Number.isFinite).sort((a, b) => a - b);
  const fromAt = new Date(deps[0]!).toISOString();
  const toAt = new Date(deps[deps.length - 1]!).toISOString();
  const horizonDays = deps.length < 2
    ? 0
    : Math.floor((deps[deps.length - 1]! - deps[0]!) / 86_400_000);
  return { sailingCount: sailings.length, fromAt, toAt, horizonDays };
}

function nearest(
  rows: readonly DbSailing[],
  vesselId: string,
  route: string,
  depMs: number,
  pred: (s: DbSailing) => boolean,
  winMs: number,
  except?: ReadonlySet<string>,
): DbSailing | undefined {
  let best: DbSailing | undefined;
  let bestAbs = Infinity;
  for (const s of rows) {
    if (except?.has(s.id)) continue;
    if (s.vessel_id !== vesselId || s.route !== route) continue;
    if (!pred(s)) continue;
    const abs = Math.abs(Date.parse(s.departure_at) - depMs);
    if (abs > winMs || abs >= bestAbs) continue;
    bestAbs = abs;
    best = s;
  }
  return best;
}

/**
 * Zapis rejsów z pliku: najpierw digitraffic ±3 h (usuń/przejmij), potem planSailingSync
 * dla pozostałych (RECZNIE już odfiltrowane).
 */
export async function applyVikingFileSchedule(
  deps: VikingFileImportDeps,
  incoming: readonly VikingFileSailing[],
  opts: { sinceIso: string; now?: Date },
): Promise<VikingFileApplyStats> {
  const warnings: string[] = [];
  const preview = previewVikingFileSailings(incoming);
  const stats: VikingFileApplyStats = {
    ...preview,
    inserted: 0,
    updated: 0,
    removed: 0,
    takenOver: 0,
    manualKept: 0,
    risks: 0,
    sourceDownClosed: false,
    warnings,
  };
  if (incoming.length === 0) return stats;

  const { store } = deps;
  const [projectId, vessels, existing] = await Promise.all([
    store.projectId(),
    store.vessels(),
    store.sailingsSince(opts.sinceIso),
  ]);
  const byName = new Map(vessels.map((v) => [v.name, v.id]));
  const gone = new Set<string>();
  const rest: VikingFileSailing[] = [];

  for (const inc of incoming) {
    const vesselId = byName.get(inc.vessel);
    if (!vesselId) {
      warnings.push(`Viking plik: nieznany statek „${inc.vessel}”.`);
      continue;
    }
    const depMs = Date.parse(inc.departureUtc);

    const manualNear = nearest(
      existing, vesselId, inc.route, depMs,
      (s) => s.source === 'RECZNIE',
      MANUAL_KEEP_WIN_MS,
      gone,
    );
    if (manualNear) {
      stats.manualKept += 1;
      continue;
    }

    const dtNear = nearest(
      existing, vesselId, inc.route, depMs,
      (s) => isDigitrafficSourceRef(s.source_ref),
      VIKING_FILE_SCHEDULE_WIN_MS,
      gone,
    );
    if (dtNear) {
      const loads = store.sailingAssignedLoadCount
        ? await store.sailingAssignedLoadCount(dtNear.id)
        : 0;
      if (loads > 0) {
        const ok = await store.updateSailing(dtNear.id, {
          departure_at: new Date(inc.departureUtc).toISOString(),
          arrival_at: new Date(inc.arrivalUtc).toISOString(),
          source: 'VIKING',
          source_ref: null,
        });
        if (ok) {
          stats.takenOver += 1;
          stats.updated += 1;
          const row = existing.find((s) => s.id === dtNear.id);
          if (row) {
            row.departure_at = new Date(inc.departureUtc).toISOString();
            row.arrival_at = new Date(inc.arrivalUtc).toISOString();
            row.source = 'VIKING';
            row.source_ref = null;
          }
        }
        continue;
      }
      if (store.deleteSailing) {
        try {
          if (await store.deleteSailing(dtNear.id)) {
            stats.removed += 1;
            gone.add(dtNear.id);
            const ix = existing.findIndex((s) => s.id === dtNear.id);
            if (ix >= 0) existing.splice(ix, 1);
          }
        } catch (e) {
          warnings.push(
            `Viking plik: nie usunięto Digitraffic ${dtNear.id} (${e instanceof Error ? e.message : 'błąd'})`,
          );
          continue;
        }
      }
    }
    rest.push(inc);
  }

  const live = existing.filter((s) => !gone.has(s.id));
  const plan = planSailingSync({
    existing: live,
    vessels,
    incoming: rest.map((s) => ({
      route: s.route,
      vessel: s.vessel,
      departureUtc: s.departureUtc,
      arrivalUtc: s.arrivalUtc,
    })),
    projectId,
    sinceUtc: opts.sinceIso,
    source: 'VIKING',
  });
  stats.manualKept += plan.manualKept;
  if (plan.inserts.length) {
    await store.insertSailings(plan.inserts.map((r) => ({ ...r, source_ref: null })));
    stats.inserted += plan.inserts.length;
  }
  for (const u of plan.updates) {
    const patch: SailingPatch = { ...u.patch, source_ref: null };
    if (await store.updateSailing(u.id, patch)) stats.updated += 1;
  }
  for (const name of plan.unknownVessels) {
    warnings.push(`Viking plik: nieznany statek „${name}”.`);
  }

  if (preview.horizonDays >= VIKING_FILE_COVERAGE_DAYS_CLOSE) {
    await store.resolveRisks('SOURCE_DOWN:VIKING_SCHEDULE:');
    stats.sourceDownClosed = true;
  }

  return stats;
}
