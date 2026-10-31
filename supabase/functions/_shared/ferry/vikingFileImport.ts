/**
 * #685-b / decyzja 63b + 74 — import rozkładu Viking z pliku (nie `applySailings`).
 * F7 #690 r1: tylko ZAPLANOWANY+przyszłe w ±3 h (digitraffic usuń/przejmij);
 * nietykalne blokują wstawienie; zmiana sezonu czyści nieobecne VIKING; 63c z pokryciem od teraz.
 */
import type {
  DbSailing, IncomingSailing, RiskInput, SailingInsert, SailingPatch, VesselRow,
} from '../integrations/sync.ts';
import { planSailingSync } from '../integrations/sync.ts';

/** F7 #688 r4 / decyzja 74 — okno Digitraffic↔plik. */
export const VIKING_FILE_SCHEDULE_WIN_MS = 3 * 3600_000;
/** Exact + bliski RECZNIE (jak dopasowanie ±30 min w planSailingSync / test bn2). */
const MANUAL_KEEP_WIN_MS = 30 * 60_000;
/**
 * B4 — obecność w nowym pliku. Dokładny klucz jak planSailingSync (nie ±30 min):
 * przesunięcie sezonu 10:00→10:30 musi skasować stary wiersz (F7 #690 przykład).
 */
const FILE_MATCH_WIN_MS = 60_000;
/** #685-c / F7 #690 R1-B5 */
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

/** F7 #690 R1-B2/B3: kandydat do usunięcia/przejęcia. */
export function isVikingFileTouchCandidate(s: DbSailing, nowMs: number): boolean {
  return s.status === 'ZAPLANOWANY' && Date.parse(s.departure_at) > nowMs;
}

/**
 * Pokrycie rozkładu Viking z pliku **od teraz** (zapisane rejsy, source_ref null).
 * F7 #690 R1-B5 / 63c.
 */
export function vikingScheduleCoverageDaysFromNow(
  rows: readonly DbSailing[],
  nowMs: number,
): number {
  let max = -Infinity;
  for (const s of rows) {
    if (s.source !== 'VIKING') continue;
    if (s.source_ref != null && s.source_ref !== '') continue;
    const dep = Date.parse(s.departure_at);
    if (!Number.isFinite(dep) || dep <= nowMs) continue;
    if (dep > max) max = dep;
  }
  if (!Number.isFinite(max) || max <= nowMs) return 0;
  return Math.floor((max - nowMs) / 86_400_000);
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

function inFile(
  incoming: readonly VikingFileSailing[],
  vesselName: string,
  route: string,
  depMs: number,
): boolean {
  for (const inc of incoming) {
    if (inc.vessel !== vesselName || inc.route !== route) continue;
    if (Math.abs(Date.parse(inc.departureUtc) - depMs) <= FILE_MATCH_WIN_MS) return true;
  }
  return false;
}

/**
 * Zapis rejsów z pliku: najpierw digitraffic ±3 h (tylko ZAPLANOWANY+przyszłe),
 * nietykalne blokują insert; potem planSailingSync; B4 czyszczenie sezonu; 63c.
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
  const nowMs = (opts.now ?? deps.now()).getTime();
  const [projectId, vessels, existing] = await Promise.all([
    store.projectId(),
    store.vessels(),
    store.sailingsSince(opts.sinceIso),
  ]);
  const byName = new Map(vessels.map((v) => [v.name, v.id]));
  const byId = new Map(vessels.map((v) => [v.id, v.name]));
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

    /* F7 #690 R1-B2/B3: nietykalne (ODWOLANY / W_REJSIE / przeszłe / …) blokują wstawienie. */
    const blocked = nearest(
      existing, vesselId, inc.route, depMs,
      (s) => !isVikingFileTouchCandidate(s, nowMs),
      VIKING_FILE_SCHEDULE_WIN_MS,
      gone,
    );
    if (blocked) {
      warnings.push(
        `Viking plik: pominięto ${inc.route} ${inc.departureUtc} — nietykalny rejs ${blocked.status} w ±3 h.`,
      );
      continue;
    }

    const dtNear = nearest(
      existing, vesselId, inc.route, depMs,
      (s) => isDigitrafficSourceRef(s.source_ref) && isVikingFileTouchCandidate(s, nowMs),
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
    for (const r of plan.inserts) {
      live.push({
        id: `ins-${live.length}-${r.departure_at}`,
        vessel_id: r.vessel_id,
        route: r.route,
        departure_at: r.departure_at,
        arrival_at: r.arrival_at,
        delayed_departure_at: r.delayed_departure_at,
        delayed_arrival_at: r.delayed_arrival_at,
        status: r.status,
        source: r.source,
        source_ref: null,
      });
    }
  }
  for (const u of plan.updates) {
    const patch: SailingPatch = { ...u.patch, source_ref: null };
    if (await store.updateSailing(u.id, patch)) {
      stats.updated += 1;
      const row = live.find((s) => s.id === u.id);
      if (row) Object.assign(row, patch);
    }
  }
  for (const name of plan.unknownVessels) {
    warnings.push(`Viking plik: nieznany statek „${name}”.`);
  }

  /* F7 #690 R1-B4: zmiana sezonu — VIKING z pliku nieobecne w dniach zakresu pliku. */
  const fileFromDay = preview.fromAt?.slice(0, 10) ?? '';
  const fileToDay = preview.toAt?.slice(0, 10) ?? '';
  if (fileFromDay && fileToDay && store.deleteSailing) {
    for (const s of [...live]) {
      if (gone.has(s.id)) continue;
      if (s.source !== 'VIKING') continue;
      if (s.source_ref != null && s.source_ref !== '') continue;
      if (!isVikingFileTouchCandidate(s, nowMs)) continue;
      const depMs = Date.parse(s.departure_at);
      const depDay = s.departure_at.slice(0, 10);
      if (depDay < fileFromDay || depDay > fileToDay) continue;
      const vName = byId.get(s.vessel_id) ?? '';
      if (inFile(incoming, vName, s.route, depMs)) continue;
      const loads = store.sailingAssignedLoadCount
        ? await store.sailingAssignedLoadCount(s.id)
        : 0;
      if (loads > 0) {
        const ok = await store.raiseRisk({
          kind: 'FERRY',
          severity: 'MEDIUM',
          title: 'Rejs Vikinga zniknął z rozkładu — sprawdź',
          titleKey: 'rk_ferry_viking_schedule_missing',
          params: { vessel: vName || s.vessel_id, dep: s.departure_at },
          detail: {
            zrodlo: 'VIKING_FILE',
            sailing_id: s.id,
            trasa: s.route,
            departure_at: s.departure_at,
          },
          dedup: `VIKING_FILE_MISSING:${s.id}`,
        });
        if (ok) stats.risks += 1;
        continue;
      }
      try {
        if (await store.deleteSailing(s.id)) {
          stats.removed += 1;
          gone.add(s.id);
          const ix = live.findIndex((x) => x.id === s.id);
          if (ix >= 0) live.splice(ix, 1);
        }
      } catch (e) {
        warnings.push(
          `Viking plik: nie usunięto starego ${s.id} (${e instanceof Error ? e.message : 'błąd'})`,
        );
      }
    }
  }

  /* #685-c: pokrycie od teraz (zapisane VIKING, source_ref null) ≥ 30 d. */
  const coverage = vikingScheduleCoverageDaysFromNow(live.filter((s) => !gone.has(s.id)), nowMs);
  if (coverage >= VIKING_FILE_COVERAGE_DAYS_CLOSE) {
    await store.resolveRisks('SOURCE_DOWN:VIKING_SCHEDULE:');
    stats.sourceDownClosed = true;
  }

  return stats;
}
