/**
 * #685-b / decyzja 63b + 74 — import rozkładu Viking z pliku (nie `applySailings`).
 * F7 #690 r1: tylko ZAPLANOWANY+przyszłe w ±3 h; B4 sezon; 63c od teraz.
 * F7 #690 r2: czyszczenie (trasa,statek)+dni + próg 50%; podgląd z planem;
 * max(departure) zamiast sailingsSince dla 63c; filtr VIKING przy odczycie.
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
 * B4 — obecność w nowym pliku. Okno ±1 min (F7 #690 r2 akceptacja koordynatora;
 * dokładny klucz jak planSailingSync — przesunięcie sezonu 10:00→10:30 kasuje stary).
 */
const FILE_MATCH_WIN_MS = 60_000;
/** #685-c / F7 #690 R1-B5 */
export const VIKING_FILE_COVERAGE_DAYS_CLOSE = 30;
/** F7 #690 R2-B1: poniżej progu nie kasować (niepełny plik). */
export const VIKING_FILE_CLEAN_MIN_RATIO = 0.5;

const DIGITRAFFIC_PREFIX = 'digitraffic:';

export type VikingFileSailing = Pick<IncomingSailing, 'route' | 'vessel' | 'departureUtc' | 'arrivalUtc'>;

export interface VikingFileImportStore {
  projectId(): Promise<string>;
  vessels(): Promise<VesselRow[]>;
  /**
   * Rejsy od `fromIso` do dopasowania Digitraffic/RECZNIE/sezon.
   * F7 #690 R2-B4: tylko VIKING+RECZNIE (albo stronicowanie) — unikaj max_rows=1000.
   */
  sailingsSince(fromIso: string): Promise<DbSailing[]>;
  /**
   * F7 #690 R2-B4 / 63c: max(departure_at) VIKING source_ref null, departure > now
   * (+ ewentualnie max viking_schedule_imports.to_at). Bez limitu wierszy.
   */
  maxVikingFileDepartureAt?(nowIso: string): Promise<string | null>;
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

/** F7 #690 R2-B2 — pozycja rejsu w planie podglądu. */
export interface VikingFilePlanRow {
  route: string;
  vessel: string;
  departureUtc: string;
  status?: string;
  reason?: string;
}

export interface VikingFileApplyPlan {
  to_insert: VikingFilePlanRow[];
  to_remove: VikingFilePlanRow[];
  to_take_over: VikingFilePlanRow[];
  risks: VikingFilePlanRow[];
  blocked: VikingFilePlanRow[];
}

export interface VikingFileApplyStats extends VikingFilePreview {
  inserted: number;
  updated: number;
  removed: number;
  takenOver: number;
  manualKept: number;
  risks: number;
  sourceDownClosed: boolean;
  /** F7 #690 R2-B1: wszystkie trasy z pliku przeszły próg 50%. */
  cleanThresholdPassed: boolean;
  warnings: string[];
  plan?: VikingFileApplyPlan;
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
 * F7 #690 R1-B5 / 63c. Digitraffic (source_ref) nie liczy się.
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

/** F7 #690 R2-B4: pokrycie z jednego max(departure_at). */
export function vikingCoverageDaysFromMaxDeparture(
  maxDepartureIso: string | null | undefined,
  nowMs: number,
): number {
  if (!maxDepartureIso) return 0;
  const dep = Date.parse(maxDepartureIso);
  if (!Number.isFinite(dep) || dep <= nowMs) return 0;
  return Math.floor((dep - nowMs) / 86_400_000);
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

function emptyPlan(): VikingFileApplyPlan {
  return { to_insert: [], to_remove: [], to_take_over: [], risks: [], blocked: [] };
}

/**
 * F7 #690 R2-B2: magazyn tylko do odczytu — zapisy zbierają plan, nic nie mutują bazy.
 */
export function planningVikingFileStore(
  base: VikingFileImportStore,
): { store: VikingFileImportStore; plan: VikingFileApplyPlan } {
  const plan = emptyPlan();
  const byId = new Map<string, DbSailing>();
  const vesselNames = new Map<string, string>();
  const store: VikingFileImportStore = {
    projectId: () => base.projectId(),
    vessels: async () => {
      const v = await base.vessels();
      for (const row of v) vesselNames.set(row.id, row.name);
      return v;
    },
    sailingsSince: async (fromIso) => {
      const rows = await base.sailingsSince(fromIso);
      for (const s of rows) byId.set(s.id, s);
      return rows.map((s) => structuredClone(s));
    },
    maxVikingFileDepartureAt: base.maxVikingFileDepartureAt
      ? (nowIso) => base.maxVikingFileDepartureAt!(nowIso)
      : undefined,
    async insertSailings(rows) {
      for (const r of rows) {
        plan.to_insert.push({
          route: r.route,
          vessel: vesselNames.get(r.vessel_id) ?? r.vessel_id,
          departureUtc: r.departure_at,
        });
      }
    },
    async updateSailing(id, patch) {
      const s = byId.get(id);
      if (!s) return false;
      if (patch.source_ref === null && isDigitrafficSourceRef(s.source_ref)) {
        plan.to_take_over.push({
          route: s.route,
          vessel: vesselNames.get(s.vessel_id) ?? s.vessel_id,
          departureUtc: (patch.departure_at as string | undefined) ?? s.departure_at,
          status: s.status,
          reason: 'digitraffic_takeover',
        });
      }
      return true;
    },
    sailingAssignedLoadCount: base.sailingAssignedLoadCount
      ? (id) => base.sailingAssignedLoadCount!(id)
      : undefined,
    async deleteSailing(id) {
      const s = byId.get(id);
      if (!s) return false;
      plan.to_remove.push({
        route: s.route,
        vessel: vesselNames.get(s.vessel_id) ?? s.vessel_id,
        departureUtc: s.departure_at,
        status: s.status,
        reason: isDigitrafficSourceRef(s.source_ref) ? 'digitraffic' : 'season',
      });
      return true;
    },
    async raiseRisk(r) {
      plan.risks.push({
        route: String((r.detail as { trasa?: string } | undefined)?.trasa ?? ''),
        vessel: String(r.params?.vessel ?? ''),
        departureUtc: String(r.params?.dep ?? ''),
        reason: r.dedup,
      });
      return true;
    },
    async resolveRisks() {
      return 0;
    },
  };
  return { store, plan };
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

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Zapis rejsów z pliku: najpierw digitraffic ±3 h (tylko ZAPLANOWANY+przyszłe),
 * nietykalne blokują insert; potem planSailingSync; B4 czyszczenie sezonu (r2: próg);
 * 63c.
 */
export async function applyVikingFileSchedule(
  deps: VikingFileImportDeps,
  incoming: readonly VikingFileSailing[],
  opts: { sinceIso: string; now?: Date; collectPlan?: boolean },
): Promise<VikingFileApplyStats> {
  const warnings: string[] = [];
  const preview = previewVikingFileSailings(incoming);
  const plan = opts.collectPlan ? emptyPlan() : undefined;
  const stats: VikingFileApplyStats = {
    ...preview,
    inserted: 0,
    updated: 0,
    removed: 0,
    takenOver: 0,
    manualKept: 0,
    risks: 0,
    sourceDownClosed: false,
    cleanThresholdPassed: true,
    warnings,
    plan,
  };
  if (incoming.length === 0) return stats;

  const { store } = deps;
  const nowMs = (opts.now ?? deps.now()).getTime();
  const [projectId, vessels, existingRaw] = await Promise.all([
    store.projectId(),
    store.vessels(),
    store.sailingsSince(opts.sinceIso),
  ]);
  /* F7 #690 R2-B3: pracujemy na kopii — mutacje lokalne nie psują asercji source_ref. */
  const existing = existingRaw.map((s) => structuredClone(s));
  /* R2-B1: próg 50% względem bazy sprzed insertów tego importu. */
  const existingBeforeImport = existing.map((s) => structuredClone(s));
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
      plan?.blocked.push({
        route: inc.route,
        vessel: inc.vessel,
        departureUtc: inc.departureUtc,
        status: blocked.status,
        reason: `blocked:${blocked.status}`,
      });
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
          plan?.to_take_over.push({
            route: inc.route,
            vessel: inc.vessel,
            departureUtc: inc.departureUtc,
            reason: 'digitraffic_takeover',
          });
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
            plan?.to_remove.push({
              route: dtNear.route,
              vessel: byId.get(dtNear.vessel_id) ?? dtNear.vessel_id,
              departureUtc: dtNear.departure_at,
              reason: 'digitraffic',
            });
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
  const syncPlan = planSailingSync({
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
  stats.manualKept += syncPlan.manualKept;
  if (syncPlan.inserts.length) {
    await store.insertSailings(syncPlan.inserts.map((r) => ({ ...r, source_ref: null })));
    stats.inserted += syncPlan.inserts.length;
    for (const r of syncPlan.inserts) {
      plan?.to_insert.push({
        route: r.route,
        vessel: byId.get(r.vessel_id) ?? r.vessel_id,
        departureUtc: r.departure_at,
      });
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
  for (const u of syncPlan.updates) {
    const patch: SailingPatch = { ...u.patch, source_ref: null };
    if (await store.updateSailing(u.id, patch)) {
      stats.updated += 1;
      const row = live.find((s) => s.id === u.id);
      if (row) Object.assign(row, patch);
    }
  }
  for (const name of syncPlan.unknownVessels) {
    warnings.push(`Viking plik: nieznany statek „${name}”.`);
  }

  /* F7 #690 R2-B1: czyszczenie tylko (trasa, statek) + dni z pliku; próg 50% na trasę. */
  const fileFromDay = preview.fromAt ? dayKey(preview.fromAt) : '';
  const fileToDay = preview.toAt ? dayKey(preview.toAt) : '';
  const pairKeys = new Set(
    incoming.map((s) => `${s.route}\0${s.vessel}`),
  );
  const routeDays = new Map<string, Set<string>>();
  const fileCountByRoute = new Map<string, number>();
  for (const inc of incoming) {
    fileCountByRoute.set(inc.route, (fileCountByRoute.get(inc.route) ?? 0) + 1);
    let days = routeDays.get(inc.route);
    if (!days) {
      days = new Set();
      routeDays.set(inc.route, days);
    }
    days.add(dayKey(inc.departureUtc));
  }

  let cleanThresholdPassed = true;
  if (fileFromDay && fileToDay && store.deleteSailing) {
    const existingByRoute = new Map<string, number>();
    for (const s of existingBeforeImport) {
      if (s.source !== 'VIKING') continue;
      if (s.source_ref != null && s.source_ref !== '') continue;
      if (!isVikingFileTouchCandidate(s, nowMs)) continue;
      const depDay = dayKey(s.departure_at);
      if (depDay < fileFromDay || depDay > fileToDay) continue;
      existingByRoute.set(s.route, (existingByRoute.get(s.route) ?? 0) + 1);
    }

    const routeOk = new Map<string, boolean>();
    for (const route of fileCountByRoute.keys()) {
      const fileN = fileCountByRoute.get(route) ?? 0;
      const existN = existingByRoute.get(route) ?? 0;
      const ok = existN === 0 || fileN >= existN * VIKING_FILE_CLEAN_MIN_RATIO;
      routeOk.set(route, ok);
      if (!ok) {
        cleanThresholdPassed = false;
        warnings.push(
          `Viking plik: niepełny rozkład trasy ${route} (${fileN}/${existN} < 50%) — bez kasowania.`,
        );
        const raised = await store.raiseRisk({
          kind: 'FERRY',
          severity: 'MEDIUM',
          title: 'Niepełny plik rozkładu Vikinga',
          titleKey: 'rk_ferry_viking_schedule_incomplete',
          params: { vessel: route, dep: preview.fromAt ?? '' },
          detail: {
            zrodlo: 'VIKING_FILE',
            trasa: route,
            file_count: fileN,
            existing_count: existN,
            from_at: preview.fromAt,
            to_at: preview.toAt,
          },
          dedup: `VIKING_FILE_INCOMPLETE:${route}:${fileFromDay}:${fileToDay}`,
        });
        if (raised) {
          stats.risks += 1;
          plan?.risks.push({
            route,
            vessel: '',
            departureUtc: preview.fromAt ?? '',
            reason: `VIKING_FILE_INCOMPLETE:${route}`,
          });
        }
      }
    }
    stats.cleanThresholdPassed = cleanThresholdPassed;

    for (const s of [...live]) {
      if (gone.has(s.id)) continue;
      if (s.source !== 'VIKING') continue;
      if (s.source_ref != null && s.source_ref !== '') continue;
      if (!isVikingFileTouchCandidate(s, nowMs)) continue;
      const depMs = Date.parse(s.departure_at);
      const depDay = dayKey(s.departure_at);
      if (depDay < fileFromDay || depDay > fileToDay) continue;
      const vName = byId.get(s.vessel_id) ?? '';
      if (!pairKeys.has(`${s.route}\0${vName}`)) continue;
      if (!routeDays.get(s.route)?.has(depDay)) continue;
      if (routeOk.get(s.route) !== true) continue;
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
        if (ok) {
          stats.risks += 1;
          plan?.risks.push({
            route: s.route,
            vessel: vName,
            departureUtc: s.departure_at,
            reason: `VIKING_FILE_MISSING:${s.id}`,
          });
        }
        continue;
      }
      try {
        if (await store.deleteSailing(s.id)) {
          stats.removed += 1;
          gone.add(s.id);
          plan?.to_remove.push({
            route: s.route,
            vessel: vName,
            departureUtc: s.departure_at,
            reason: 'season',
          });
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

  /* #685-c: pokrycie od teraz (zapisane VIKING, source_ref null) ≥ 30 d; tylko po progu. */
  let coverage = 0;
  if (store.maxVikingFileDepartureAt) {
    const maxDep = await store.maxVikingFileDepartureAt(new Date(nowMs).toISOString());
    coverage = vikingCoverageDaysFromMaxDeparture(maxDep, nowMs);
    /* Po insertach w tej samej transakcji max w bazie może jeszcze nie widzieć live — bierz max. */
    const liveCov = vikingScheduleCoverageDaysFromNow(live.filter((s) => !gone.has(s.id)), nowMs);
    if (liveCov > coverage) coverage = liveCov;
  } else {
    coverage = vikingScheduleCoverageDaysFromNow(live.filter((s) => !gone.has(s.id)), nowMs);
  }
  /* F7 R2-B3: apply zamyka przy coverage > 30 (cron nadal ≥ 30). */
  if (
    cleanThresholdPassed
    && coverage > VIKING_FILE_COVERAGE_DAYS_CLOSE
  ) {
    await store.resolveRisks('SOURCE_DOWN:VIKING_SCHEDULE:');
    stats.sourceDownClosed = true;
  }

  return stats;
}

/** Walidacja from_ymd z klienta (F7 #690 r2 nieblokujące). */
export function parseVikingImportFromYmd(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const y = Number(raw.slice(0, 4));
  const m = Number(raw.slice(5, 7));
  const d = Number(raw.slice(8, 10));
  if (y < 2024 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return raw;
}

/** Mapowanie błędu assert → komunikat bez surowego RPC (F7 #690 r2). */
export function vikingImportAssertError(message: string): string {
  return /2FA|Administrator|preview|Podgląd/i.test(message)
    ? 'Tylko Administrator HHL z 2FA'
    : 'Brak uprawnień do importu';
}
