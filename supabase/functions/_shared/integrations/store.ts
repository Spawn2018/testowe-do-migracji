/**
 * M12 — magazyn zadań integracji na Supabase (klucz service role, wyłącznie po stronie serwera).
 * Typ klienta minimalny, żeby ten sam kod działał w Deno (npm:@supabase/supabase-js) i w Node.
 */
import type { SyncStore, VehiclePos } from './jobs.ts';
import type { VesselFix } from '../ferry/digitraffic.ts';
import {
  fetchVesselPositionsNearHubPaged,
  findAtaTransitionIso,
  findAtdTransitionIso,
  GEOFENCE_QUERY_RADIUS_KM,
} from '../ferry/geofenceTransition.ts';
import {
  CANCEL_SUSPECT_DEDUP_PREFIX, sailingIdFromCancelSuspectDedup,
} from '../ferry/cancelSuspect.ts';

export {
  fetchVesselPositionsNearHubPaged,
  findAtaTransitionIso,
  findAtdTransitionIso,
  GEOFENCE_CLEAR_SOG_KN,
  GEOFENCE_IN_KM,
  GEOFENCE_OUT_KM,
  GEOFENCE_PAIR_MAX_MS,
  GEOFENCE_QUERY_RADIUS_KM,
  haversineKm,
  hubBbox,
  VESSEL_POS_MAX_PAGES,
  VESSEL_POS_PAGE_SIZE,
} from '../ferry/geofenceTransition.ts';
export type { GeofencePos } from '../ferry/geofenceTransition.ts';
import {
  filterLoadsReassignedFromSailing,
  loadIdsFromSailingCancelledDedups,
  sailingCancelledRiskLike,
} from '../ferry/tallinkRestore.ts';
import type { DbSailing, RiskInput, SailingInsert, SailingPatch, VesselRow } from './sync.ts';
import { ROAD_LEGS } from '../here/refreshRoadLegs.ts';
import { legDefFromRow } from '../here/legDefFromRow.ts';

export {
  filterLoadsReassignedFromSailing,
  isTallinkAlertAutoCancel,
  loadIdsFromSailingCancelledDedups,
  restoreStatusAfterCancel,
  sailingCancelledRiskLike,
} from '../ferry/tallinkRestore.ts';

// deno-lint-ignore no-explicit-any
type Client = any;
const SAILING_COLS = 'id,vessel_id,route,departure_at,arrival_at,delayed_departure_at,delayed_arrival_at,actual_departure_at,actual_arrival_at,status,source,source_ref';

/** DP-116 / #691: PostgREST max_rows=1000 — stronicowanie range + order(id). */
export const SAILINGS_PAGE_SIZE = 1000;
/** F7 #693 r1 R1-B2: po MAX_PAGES pełnych stron — błąd (nie ciche obcięcie). */
export const SAILINGS_MAX_PAGES = 50;
/** F7 #696 r4 / DP-116: risk_signals open cancel-suspect — ten sam limit stron. */
export const CANCEL_SUSPECT_RISK_PAGE_SIZE = SAILINGS_PAGE_SIZE;
export const CANCEL_SUSPECT_RISK_MAX_PAGES = SAILINGS_MAX_PAGES;
/** F7 #696 r4: `.in('id', …)` w paczkach — unikaj za długiego URL. */
export const CANCEL_SUSPECT_SAILING_IN_BATCH = 150;
/** #686 F7 B3: ryzyka SAILING_CANCELLED dla jednego rejsu — ten sam limit stron. */
export const SAILING_CANCELLED_RISK_PAGE_SIZE = SAILINGS_PAGE_SIZE;
export const SAILING_CANCELLED_RISK_MAX_PAGES = SAILINGS_MAX_PAGES;
export const SAILING_CANCELLED_LOAD_IN_BATCH = CANCEL_SUSPECT_SAILING_IN_BATCH;

type SailingCancelledRiskPageQuery = {
  select: (cols: string) => SailingCancelledRiskPageQuery;
  like: (col: string, val: string) => SailingCancelledRiskPageQuery;
  is: (col: string, val: null) => SailingCancelledRiskPageQuery;
  order: (col: string, opts?: { ascending?: boolean }) => SailingCancelledRiskPageQuery;
  range: (from: number, to: number) => Promise<{
    data: { id: string; load_id: string | null; dedup_key: string | null }[] | null;
    error: { message: string } | null;
  }>;
};

/**
 * #686 F7 B3 / DP-116: ryzyka SAILING_CANCELLED:%:{sailingId} ze stronicowaniem.
 * openOnly=true → tylko unresolved (resolve); false → także zamknięte (B2 przepięcia / expire).
 */
export async function fetchSailingCancelledRiskRowsPaged(
  fromTable: () => SailingCancelledRiskPageQuery,
  sailingId: string,
  opts?: {
    openOnly?: boolean;
    pageSize?: number;
    must?: <T>(r: { data: T; error: { message: string } | null }, what: string) => T;
  },
): Promise<{ id: string; load_id: string | null; dedup_key: string | null }[]> {
  const pageSize = opts?.pageSize ?? SAILING_CANCELLED_RISK_PAGE_SIZE;
  const mustFn = opts?.must ?? (<T>(r: { data: T; error: { message: string } | null }, what: string): T => {
    if (r.error) throw new Error(`${what}: ${r.error.message}`);
    return r.data;
  });
  const like = sailingCancelledRiskLike(sailingId);
  const out: { id: string; load_id: string | null; dedup_key: string | null }[] = [];
  const seen = new Set<string>();
  let from = 0;
  for (;;) {
    if (from >= SAILING_CANCELLED_RISK_MAX_PAGES * pageSize) {
      throw new Error('sailing-cancelled risk page cap exceeded');
    }
    let q = fromTable()
      .select('id,load_id,dedup_key')
      .like('dedup_key', like);
    if (opts?.openOnly) q = q.is('resolved_at', null);
    const r = mustFn(
      await q.order('id').range(from, from + pageSize - 1),
      'risk_signals sailing-cancelled page',
    ) as { id: string; load_id: string | null; dedup_key: string | null }[];
    for (const row of r) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
    }
    if (r.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

type SailingsPageQuery = {
  select: (cols: string) => SailingsPageQuery;
  gte: (col: string, val: string) => SailingsPageQuery;
  in: (col: string, vals: string[]) => SailingsPageQuery;
  order: (col: string, opts?: { ascending?: boolean }) => SailingsPageQuery;
  range: (from: number, to: number) => Promise<{ data: DbSailing[] | null; error: { message: string } | null }>;
};

type RiskDedupPageQuery = {
  select: (cols: string) => RiskDedupPageQuery;
  like: (col: string, val: string) => RiskDedupPageQuery;
  is: (col: string, val: null) => RiskDedupPageQuery;
  order: (col: string, opts?: { ascending?: boolean }) => RiskDedupPageQuery;
  range: (from: number, to: number) => Promise<{
    data: { dedup_key: string | null }[] | null;
    error: { message: string } | null;
  }>;
};

type SailingsByIdQuery = {
  select: (cols: string) => SailingsByIdQuery;
  in: (col: string, vals: string[]) => Promise<{ data: DbSailing[] | null; error: { message: string } | null }>;
};

/**
 * Odczyt sailings od fromIso ze stronicowaniem (obejście max_rows=1000).
 * Eksport pod testy DP-116 — ten sam helper co supabaseStore.sailingsSince.
 * F7 #693 r1: limicie stron → throw; dedupe po `id` (równoległy job między stronami).
 */
export async function fetchSailingsSincePaged(
  fromTable: () => SailingsPageQuery,
  fromIso: string,
  opts?: { sources?: string[]; pageSize?: number; must?: <T>(r: { data: T; error: { message: string } | null }, what: string) => T },
): Promise<DbSailing[]> {
  const pageSize = opts?.pageSize ?? SAILINGS_PAGE_SIZE;
  const mustFn = opts?.must ?? (<T>(r: { data: T; error: { message: string } | null }, what: string): T => {
    if (r.error) throw new Error(`${what}: ${r.error.message}`);
    return r.data;
  });
  const out: DbSailing[] = [];
  const seen = new Set<string>();
  let from = 0;
  for (;;) {
    if (from >= SAILINGS_MAX_PAGES * pageSize) {
      throw new Error('sailings page cap exceeded');
    }
    let q = fromTable()
      .select(SAILING_COLS)
      .gte('departure_at', fromIso);
    if (opts?.sources?.length) q = q.in('source', opts.sources);
    const r = mustFn(
      await q.order('departure_at').order('id').range(from, from + pageSize - 1),
      'sailings page',
    ) as DbSailing[];
    for (const row of r) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
    }
    if (r.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

/**
 * F7 #696 r4 / DP-116: otwarte dedupy cancel-suspect ze stronicowaniem (max_rows=1000).
 * Błąd strony albo page cap → throw (nie ciche obcięcie → resolveStale nie zamyka reszty).
 */
export async function fetchOpenCancelSuspectDedupKeysPaged(
  fromTable: () => RiskDedupPageQuery,
  likePattern: string,
  opts?: {
    pageSize?: number;
    must?: <T>(r: { data: T; error: { message: string } | null }, what: string) => T;
  },
): Promise<string[]> {
  const pageSize = opts?.pageSize ?? CANCEL_SUSPECT_RISK_PAGE_SIZE;
  const mustFn = opts?.must ?? (<T>(r: { data: T; error: { message: string } | null }, what: string): T => {
    if (r.error) throw new Error(`${what}: ${r.error.message}`);
    return r.data;
  });
  const out: string[] = [];
  const seen = new Set<string>();
  let from = 0;
  for (;;) {
    if (from >= CANCEL_SUSPECT_RISK_MAX_PAGES * pageSize) {
      throw new Error('cancel-suspect risk page cap exceeded');
    }
    const r = mustFn(
      await fromTable()
        .select('dedup_key')
        .like('dedup_key', likePattern)
        .is('resolved_at', null)
        .order('id')
        .range(from, from + pageSize - 1),
      'risk_signals open cancel-suspect page',
    ) as { dedup_key: string | null }[];
    for (const row of r) {
      const k = row.dedup_key;
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(k);
    }
    if (r.length < pageSize) break;
    from += pageSize;
  }
  return out;
}

/** F7 #696 r4: sailings po id w paczkach ≤ CANCEL_SUSPECT_SAILING_IN_BATCH. */
export async function fetchSailingsByIdsBatched(
  fromTable: () => SailingsByIdQuery,
  ids: string[],
  opts?: {
    batchSize?: number;
    must?: <T>(r: { data: T; error: { message: string } | null }, what: string) => T;
  },
): Promise<DbSailing[]> {
  const batchSize = opts?.batchSize ?? CANCEL_SUSPECT_SAILING_IN_BATCH;
  const mustFn = opts?.must ?? (<T>(r: { data: T; error: { message: string } | null }, what: string): T => {
    if (r.error) throw new Error(`${what}: ${r.error.message}`);
    return r.data;
  });
  const out: DbSailing[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < ids.length; i += batchSize) {
    const chunk = ids.slice(i, i + batchSize);
    const rows = mustFn(
      await fromTable().select(SAILING_COLS).in('id', chunk),
      'sailings open cancel-suspect batch',
    ) as DbSailing[];
    for (const row of rows) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
    }
  }
  return out;
}

export function supabaseStore(sb: Client, projectCode = 'STEGRA_BODEN'): SyncStore {
  let pid: string | null = null;
  const must = <T>(r: { data: T; error: { message: string } | null }, what: string): T => {
    if (r.error) throw new Error(`${what}: ${r.error.message}`);
    return r.data;
  };
  const projectId = async () => {
    if (!pid) pid = must(await sb.from('projects').select('id').eq('code', projectCode).single(), 'projects').id as string;
    return pid;
  };
  return {
    projectId,
    async vessels() { return must(await sb.from('vessels').select('id,name,mmsi,imo'), 'vessels') as VesselRow[]; },
    /** DP-116: stronicowanie — bez tego prod (>1000 rejsów) obcinał rozkład / statusy / pogodę. */
    async sailingsSince(fromIso: string) {
      return fetchSailingsSincePaged(() => sb.from('sailings') as SailingsPageQuery, fromIso, { must });
    },
    /**
     * F7 #690 R2-B4 / 63c: max(departure_at) VIKING source_ref null > now.
     * F7 r3: bez viking_schedule_imports.to_at (przerwany import wyciszał SOURCE_DOWN).
     */
    async maxVikingFileDepartureAt(nowIso: string) {
      const sail = must(
        await sb.from('sailings')
          .select('departure_at')
          .eq('source', 'VIKING')
          .is('source_ref', null)
          .gt('departure_at', nowIso)
          .order('departure_at', { ascending: false })
          .limit(1),
        'sailings max viking file',
      ) as { departure_at: string }[];
      return sail[0]?.departure_at ?? null;
    },
    /**
     * F7 #690 R2-B4: rejsy VIKING+RECZNIE od fromIso ze stronicowaniem (import pliku).
     * F7 r3: .order('id') — stabilny range. DP-116: wspólny helper.
     */
    async sailingsForVikingFileImport(fromIso: string) {
      return fetchSailingsSincePaged(
        () => sb.from('sailings') as SailingsPageQuery,
        fromIso,
        { sources: ['VIKING', 'RECZNIE'], must },
      );
    },
    async insertSailings(rows: SailingInsert[]) {
      // unikalność (statek, odejście): istniejący wiersz zostaje — plan i tak aktualizuje go osobno
      must(await sb.from('sailings').upsert(rows, { onConflict: 'vessel_id,departure_at', ignoreDuplicates: true }), 'sailings insert');
    },
    async updateSailing(id: string, patch: SailingPatch) {
      // F7 #421 r2: RECZNIE chroni delayed_*/status/plan; actual_* z AIS wolno dopisać także po ręcznej edycji.
      const { actual_departure_at, actual_arrival_at, ...rest } = patch;
      const at = new Date().toISOString();
      const restKeys = Object.keys(rest) as (keyof typeof rest)[];
      let wrote = false;
      if (restKeys.length) {
        const r = must(
          await sb.from('sailings').update({ ...rest, updated_at: at }).eq('id', id).neq('source', 'RECZNIE').select('id'),
          'sailings update',
        ) as unknown[];
        wrote = r.length > 0;
      }
      const actual: Record<string, string | null> = {};
      if (actual_departure_at !== undefined) actual.actual_departure_at = actual_departure_at;
      if (actual_arrival_at !== undefined) actual.actual_arrival_at = actual_arrival_at;
      if (Object.keys(actual).length) {
        const r = must(
          await sb.from('sailings').update({ ...actual, updated_at: at }).eq('id', id).select('id'),
          'sailings update actual',
        ) as unknown[];
        wrote = wrote || r.length > 0;
      }
      return wrote;
    },
    async sailingAssignedLoadCount(sailingId: string) {
      const res = await sb.from('loads').select('id', { count: 'exact', head: true }).eq('sailing_id', sailingId);
      if (res.error) throw new Error(`loads by sailing: ${res.error.message}`);
      return res.count ?? 0;
    },
    async deleteSailing(id: string) {
      const r = must(
        await sb.from('sailings').delete().eq('id', id).neq('source', 'RECZNIE').select('id'),
        'sailings delete',
      ) as unknown[];
      return r.length > 0;
    },
    async insertOperatorNotice(row: {
      sailingId: string;
      operator: string;
      kind: 'ODWOLANY' | 'OPOZNIONY' | 'ZMIANA_GODZINY' | 'PRZYWROCONY';
      note?: string | null;
      sourceUrl?: string | null;
      newDeparture?: string | null;
    }) {
      const r = must(
        await sb.from('operator_notices').insert({
          sailing_id: row.sailingId,
          operator: row.operator,
          kind: row.kind,
          new_departure: row.newDeparture ?? null,
          note: row.note ?? null,
          created_by: null,
          source: 'AUTO',
          source_url: row.sourceUrl ?? null,
        }).select('id').maybeSingle(),
        'operator_notices insert AUTO',
      ) as { id: string } | null;
      return r?.id ?? null;
    },
    /** #686 F7 B1: ostatni ODWOLANY (+ source_url) — Tallink Alert vs ts.ee. */
    async latestCancelNotice(sailingId: string) {
      const rows = must(
        await sb.from('operator_notices')
          .select('source,operator,source_url')
          .eq('sailing_id', sailingId)
          .eq('kind', 'ODWOLANY')
          .order('created_at', { ascending: false })
          .limit(1),
        'operator_notices latestCancel',
      ) as { source: string; operator: string; source_url: string | null }[];
      const row = rows[0];
      if (!row) return null;
      return { source: row.source, operator: row.operator, sourceUrl: row.source_url };
    },
    /** #686 F7 B3: SAILING_CANCELLED:%:{sailingId} → resolve (stronicowanie). */
    async resolveSailingCancelledRisks(sailingId: string) {
      const rows = await fetchSailingCancelledRiskRowsPaged(
        () => sb.from('risk_signals') as SailingCancelledRiskPageQuery,
        sailingId,
        { openOnly: true, must },
      );
      const drop = rows.map((r) => r.id);
      if (!drop.length) return 0;
      let n = 0;
      for (let i = 0; i < drop.length; i += SAILING_CANCELLED_LOAD_IN_BATCH) {
        const batch = drop.slice(i, i + SAILING_CANCELLED_LOAD_IN_BATCH);
        const updated = must(
          await sb.from('risk_signals').update({ resolved_at: new Date().toISOString() })
            .in('id', batch).is('resolved_at', null).select('id'),
          'risk_signals resolve sailing cancelled',
        ) as unknown[];
        n += updated.length;
      }
      return n;
    },
    /** #686 F7 B3: decyzje FERRY_CANCELLED z ryzyk tego rejsu → EXPIRED (filtr w SQL). */
    async expireFerryCancelledDecisions(sailingId: string) {
      const risks = await fetchSailingCancelledRiskRowsPaged(
        () => sb.from('risk_signals') as SailingCancelledRiskPageQuery,
        sailingId,
        { must },
      );
      const riskIds = risks.map((r) => r.id);
      if (!riskIds.length) return 0;
      let n = 0;
      for (let i = 0; i < riskIds.length; i += SAILING_CANCELLED_LOAD_IN_BATCH) {
        const batch = riskIds.slice(i, i + SAILING_CANCELLED_LOAD_IN_BATCH);
        const updated = must(
          await sb.from('decisions').update({
            status: 'EXPIRED',
            expired_reason: 'nieaktualna — rejs przywrócony (Tallink Alert AUTO)',
            updated_at: new Date().toISOString(),
          })
            .in('risk_id', batch)
            .in('status', ['NEW', 'ASSIGNED', 'SNOOZED'])
            .select('id'),
          'decisions expire ferry cancelled',
        ) as unknown[];
        n += updated.length;
      }
      return n;
    },
    /**
     * #686 F7 B2: transporty z SAILING_CANCELLED (także zamkniętych po decision_resolve),
     * które już nie mają tego sailing_id — bez cofania przypisań.
     */
    async reassignedLoadsAfterCancel(sailingId: string) {
      const risks = await fetchSailingCancelledRiskRowsPaged(
        () => sb.from('risk_signals') as SailingCancelledRiskPageQuery,
        sailingId,
        { must },
      );
      const loadIds = loadIdsFromSailingCancelledDedups(risks);
      if (!loadIds.length) return [];
      const loads: { id: string; sailing_id: string | null }[] = [];
      for (let i = 0; i < loadIds.length; i += SAILING_CANCELLED_LOAD_IN_BATCH) {
        const batch = loadIds.slice(i, i + SAILING_CANCELLED_LOAD_IN_BATCH);
        const chunk = must(
          await sb.from('loads').select('id,sailing_id').in('id', batch),
          'loads reassigned after cancel',
        ) as { id: string; sailing_id: string | null }[];
        loads.push(...chunk);
      }
      return filterLoadsReassignedFromSailing(loadIds, loads, sailingId);
    },
    async raiseRisk(r: RiskInput & { loadId?: string }) {
      const res = await sb.rpc('raise_integration_risk', {
        p_project: await projectId(), p_load: r.loadId ?? null, p_kind: r.kind, p_sev: r.severity, p_title: r.title,
        p_detail: { ...r.detail, title_key: r.titleKey, params: r.params }, p_dedup: r.dedup, p_source_url: r.sourceUrl ?? null, p_valid_until: r.validUntil ?? null,
      });
      return must(res, 'raise_integration_risk') === true;
    },
    /** F7 #699 B2: guid ERR — także zamknięte (bez powrotu po ręcznym zamknięciu). */
    async hasRiskDedup(dedup: string) {
      const rows = must(
        await sb.from('risk_signals').select('id').eq('dedup_key', dedup).limit(1),
        'risk_signals hasRiskDedup',
      ) as unknown[];
      return rows.length > 0;
    },
    /** F7 #695 r2 B2: otwarte ryzyko z prefiksem (UMG delayed tylko przy SOURCE_DOWN:STENA_STATUS). */
    async hasOpenRisk(dedupPrefix: string) {
      const like = `${dedupPrefix.replace(/[%_]/g, (c) => `\\${c}`)}%`;
      const rows = must(
        await sb.from('risk_signals').select('id').like('dedup_key', like).is('resolved_at', null).limit(1),
        'risk_signals hasOpenRisk',
      ) as unknown[];
      return rows.length > 0;
    },
    /**
     * F7 #696 r3 B1 / r4 DP-116: otwarte FERRY_CANCEL_SUSPECT + rejsy (bez limitu since).
     * risk_signals: range+order(id); sailings: .in() paczkami ≤150; błąd/cap → throw.
     */
    async openCancelSuspectSailings() {
      const like = `${CANCEL_SUSPECT_DEDUP_PREFIX.replace(/[%_]/g, (c) => `\\${c}`)}%`;
      const keys = await fetchOpenCancelSuspectDedupKeysPaged(
        () => sb.from('risk_signals') as RiskDedupPageQuery,
        like,
        { must },
      );
      const ids = [...new Set(
        keys.map((k) => sailingIdFromCancelSuspectDedup(k))
          .filter((id): id is string => !!id),
      )];
      if (!ids.length) return [];
      return fetchSailingsByIdsBatched(
        () => sb.from('sailings') as SailingsByIdQuery,
        ids,
        { must },
      );
    },
    async resolveRisks(dedupPrefix: string) {
      const r = must(await sb.from('risk_signals').update({ resolved_at: new Date().toISOString() })
        .like('dedup_key', `${dedupPrefix.replace(/[%_]/g, (c) => `\\${c}`)}%`).is('resolved_at', null).select('id'), 'risk_signals resolve') as unknown[];
      return r.length;
    },
    async resolveStaleRisks(dedupPrefix: string, keepDedup: string[]) {
      const like = `${dedupPrefix.replace(/[%_]/g, (c) => `\\${c}`)}%`;
      const rows = must(await sb.from('risk_signals').select('id,dedup_key').like('dedup_key', like).is('resolved_at', null), 'risk_signals stale') as { id: string; dedup_key: string | null }[];
      const keep = new Set(keepDedup);
      const drop = rows.filter((row) => row.dedup_key && !keep.has(row.dedup_key)).map((row) => row.id);
      if (!drop.length) return 0;
      const updated = must(await sb.from('risk_signals').update({ resolved_at: new Date().toISOString() }).in('id', drop).is('resolved_at', null).select('id'), 'risk_signals resolve stale') as unknown[];
      return updated.length;
    },
    async lastRun(job: string) {
      const r = must(await sb.from('integration_runs').select('ran_at').eq('job', job).order('ran_at', { ascending: false }).limit(1), 'integration_runs') as { ran_at: string }[];
      return r[0]?.ran_at ?? null;
    },
    /** F7 #689 R1-B3: ostatnie N wyników (od najnowszego) — streak Tallink Alert bez pamięci modułu. */
    async recentJobResults(job: string, limit: number) {
      const n = Math.max(0, Math.min(50, Math.floor(limit)));
      if (n === 0) return [];
      const r = must(
        await sb.from('integration_runs').select('result').eq('job', job)
          .order('ran_at', { ascending: false }).limit(n),
        'integration_runs recent',
      ) as { result: Record<string, unknown> | null }[];
      return r.map((row) => (row.result ?? {}) as import('./jobs.ts').JobResult);
    },
    async recordRun(job: string, ok: boolean, result: unknown) {
      must(await sb.from('integration_runs').insert({ job, ok, result }), 'integration_runs insert');
    },
    async saveVesselPosition(vesselId: string, fix: VesselFix) {
      must(await sb.from('vessel_positions').upsert({
        vessel_id: vesselId, lat: fix.lat, lon: fix.lon, sog_kn: fix.sogKn, cog: fix.cog, nav_stat: fix.navStat,
        observed_at: fix.timestampUtc, source: fix.source ?? 'DIGITRAFFIC', eta_at: fix.etaAt ?? null,
      }, { onConflict: 'vessel_id,observed_at', ignoreDuplicates: true }), 'vessel_positions insert');
    },
    async latestVesselObserved() {
      const rows = must(await sb.from('vessel_positions').select('vessel_id,observed_at').order('observed_at', { ascending: false }).limit(50), 'vessel_positions latest') as { vessel_id: string; observed_at: string }[];
      const best = new Map<string, string>();
      for (const r of rows) if (!best.has(r.vessel_id)) best.set(r.vessel_id, r.observed_at);
      return [...best.entries()].map(([vesselId, observedAt]) => ({ vesselId, observedAt }));
    },
    /**
     * DP-128 F7 r1: ATD = p_in przy przejściu ≤3 km → >4 km w ≤20 min (od sinceIso).
     * radiusKm zachowane w sygnaturze (kompatybilność SyncStore); klasyfikacja IN/OUT stała 3/4.
     */
    async lastPortPosition(
      vesselId: string,
      hub: { lat: number; lon: number },
      _radiusKm: number,
      sinceIso: string,
    ) {
      const rows = await fetchVesselPositionsNearHubPaged(
        () => sb.from('vessel_positions'),
        vesselId,
        hub,
        sinceIso,
        { queryKm: GEOFENCE_QUERY_RADIUS_KM, must },
      );
      return findAtdTransitionIso(rows, hub);
    },
    /**
     * DP-128 F7 r1: ATA = pierwsze wejście ≤3 km po poprzedniej >4 km lub SOG≥3, luka ≤20 min.
     */
    async firstPortEntryAfter(
      vesselId: string,
      hub: { lat: number; lon: number },
      _radiusKm: number,
      sinceIso: string,
    ) {
      const rows = await fetchVesselPositionsNearHubPaged(
        () => sb.from('vessel_positions'),
        vesselId,
        hub,
        sinceIso,
        { queryKm: GEOFENCE_QUERY_RADIUS_KM, must },
      );
      return findAtaTransitionIso(rows, hub);
    },
    async latestAisstreamFixes(sinceIso: string) {
      const rows = must(await sb.from('vessel_positions')
        .select('vessel_id,lat,lon,sog_kn,cog,nav_stat,observed_at,vessels(mmsi)')
        .eq('source', 'AISSTREAM').gte('observed_at', sinceIso)
        .order('observed_at', { ascending: false }).limit(100), 'vessel_positions aisstream') as unknown as {
          vessel_id: string; lat: number; lon: number; sog_kn: number | null; cog: number | null; nav_stat: number | null;
          observed_at: string; vessels: { mmsi: number | null } | null;
        }[];
      const seen = new Set<string>();
      const out: { vesselId: string; fix: VesselFix }[] = [];
      for (const r of rows) {
        if (seen.has(r.vessel_id) || r.vessels?.mmsi == null) continue;
        seen.add(r.vessel_id);
        out.push({ vesselId: r.vessel_id, fix: {
          mmsi: r.vessels.mmsi, lat: r.lat, lon: r.lon, sogKn: r.sog_kn, cog: r.cog, navStat: r.nav_stat,
          timestampUtc: new Date(r.observed_at).toISOString(), source: 'AISSTREAM',
        } });
      }
      return out;
    },
    async latestPositions(maxAgeMin: number) {
      return must(await sb.rpc('latest_vehicle_positions', { p_max_age_min: maxAgeMin }), 'latest_vehicle_positions') as VehiclePos[];
    },
    async seSlowdownPct() {
      const r = await sb.from('app_parameters').select('value').eq('key', 'SE_ROAD_SLOWDOWN_PCT').maybeSingle();
      if (r.error || r.data?.value == null) return 15;
      const n = Number(r.data.value);
      return Number.isFinite(n) && n >= 0 && n <= 100 ? n : 15;
    },
    /** BN3 F7 #682 B1: próg ATA/ETD z app_parameters (decyzja 58); zapas 15. */
    async ferryPortDelayMin() {
      const r = await sb.from('app_parameters').select('value').eq('key', 'FERRY_PORT_DELAY_MIN').maybeSingle();
      if (r.error || r.data?.value == null) return 15;
      const n = Number(r.data.value);
      return Number.isFinite(n) && n >= 0 && n <= 24 * 60 ? n : 15;
    },
    async saveCorridorCondition(row: {
      corridor: 'SE_E4' | 'SE_E22'; slowdownMult: number; reason: string | null; detail: unknown; observedAt: string;
    }) {
      must(await sb.from('corridor_conditions').upsert({
        corridor: row.corridor,
        slowdown_mult: row.slowdownMult,
        reason: row.reason,
        detail: row.detail,
        observed_at: row.observedAt,
        source: 'TRAFIKVERKET',
      }, { onConflict: 'corridor' }), 'corridor_conditions upsert');
    },
    async opsThresholds() {
      const r = await sb.from('ops_thresholds').select('key,value_num').in('key', ['WAVE_M', 'GUST_KN']);
      if (r.error || !r.data) return { waveM: 3.8, gustKn: 40 };
      let waveM = 3.8;
      let gustKn = 40;
      for (const row of r.data as { key: string; value_num: number }[]) {
        if (row.key === 'WAVE_M' && Number.isFinite(Number(row.value_num))) waveM = Number(row.value_num);
        if (row.key === 'GUST_KN' && Number.isFinite(Number(row.value_num))) gustKn = Number(row.value_num);
      }
      return { waveM, gustKn };
    },
    async saveMarineCondition(row: {
      corridor: 'BALTIC_GDN_NYN' | 'BALTIC_GDY_KAA';
      maxWaveM: number | null;
      maxGustKn: number | null;
      risk: 'niskie' | 'podwyższone' | 'wysokie';
      waveThrM: number;
      gustThrKn: number;
      sources: string;
      attribution: string;
      windowFrom: string | null;
      windowTo: string | null;
      detail: unknown;
      observedAt: string;
    }) {
      must(await sb.from('marine_conditions').upsert({
        corridor: row.corridor,
        max_wave_m: row.maxWaveM,
        max_gust_kn: row.maxGustKn,
        risk: row.risk,
        wave_thr_m: row.waveThrM,
        gust_thr_kn: row.gustThrKn,
        sources: row.sources,
        attribution: row.attribution,
        window_from: row.windowFrom,
        window_to: row.windowTo,
        detail: row.detail,
        observed_at: row.observedAt,
      }, { onConflict: 'corridor' }), 'marine_conditions upsert');
    },
    async translationGet(hash: string) {
      const r = await sb.from('translation_memory').select('pl_text').eq('text_hash', hash).maybeSingle();
      if (r.error || !r.data) return null;
      return String((r.data as { pl_text: string }).pl_text);
    },
    async translationPut(hash: string, source: string, pl: string, lang: 'SV' | 'EN') {
      must(await sb.from('translation_memory').upsert({
        text_hash: hash, source_lang: lang, source_text: source, pl_text: pl,
      }, { onConflict: 'text_hash' }), 'translation_memory');
    },
    async translationEnqueue(hash: string, source: string, lang: 'SV' | 'EN', reason: string) {
      must(await sb.from('translation_queue').upsert({
        source_hash: hash, source_lang: lang, source_text: source, reason,
      }, { onConflict: 'source_hash' }), 'translation_queue');
    },
    async translationListQueue(reasons: string[]) {
      const r = await sb.from('translation_queue')
        .select('source_hash,source_lang,source_text,reason,created_at')
        .in('reason', reasons)
        .order('created_at', { ascending: true })
        .limit(40);
      if (r.error) throw new Error(`translation_queue list: ${r.error.message}`);
      return ((r.data ?? []) as {
        source_hash: string; source_lang: string; source_text: string; reason: string; created_at: string;
      }[]).map((row) => ({
        hash: row.source_hash,
        source: row.source_text,
        lang: (row.source_lang === 'EN' ? 'EN' : 'SV') as 'SV' | 'EN',
        reason: row.reason,
        createdAt: row.created_at,
      }));
    },
    async translationDequeue(hash: string) {
      must(await sb.from('translation_queue').delete().eq('source_hash', hash), 'translation_queue delete');
    },
    async patchRoadRiskOpis(original: string, pl: string) {
      const r = await sb.from('risk_signals')
        .select('id,detail')
        .in('kind', ['ROAD_SE', 'ROAD_PL'])
        .is('resolved_at', null)
        .filter('detail->>oryginal', 'eq', original)
        .limit(20);
      if (r.error) throw new Error(`risk_signals road opis: ${r.error.message}`);
      let n = 0;
      for (const row of (r.data ?? []) as { id: string; detail: Record<string, unknown> | null }[]) {
        const detail = { ...(row.detail ?? {}), opis: pl };
        must(await sb.from('risk_signals').update({ detail }).eq('id', row.id), 'risk_signals opis');
        n++;
      }
      return n;
    },
    async deeplUsage() {
      const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit' }).format(new Date()) + '-01';
      const r = await sb.from('deepl_usage').select('characters,monthly_limit').eq('month', month).maybeSingle();
      const row = r.data as { characters?: number; monthly_limit?: number } | null;
      return { characters: Number(row?.characters ?? 0), limit: Number(row?.monthly_limit ?? 1000000) };
    },
    async deeplAddUsage(n: number) {
      const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit' }).format(new Date()) + '-01';
      const cur = await sb.from('deepl_usage').select('characters').eq('month', month).maybeSingle();
      const prev = Number((cur.data as { characters?: number } | null)?.characters ?? 0);
      const next = prev + n;
      must(await sb.from('deepl_usage').upsert({
        month, characters: next, monthly_limit: 1000000,
      }, { onConflict: 'month' }), 'deepl_usage');
      return next;
    },
    async noteHereUsage(service: 'tiles' | 'routing' | 'matching' | 'attributes' | 'traffic', n: number) {
      must(await sb.rpc('here_note_service', { p_service: service, p_n: n, p_usd: 0 }), 'here_note_service');
    },
    async hereMonthSpend() {
      const r = await sb.rpc('here_month_spend');
      if (r.error) throw new Error(`here_month_spend: ${r.error.message}`);
      return Number(r.data ?? 0);
    },
    /** #667 C — lista geometrii do crona here-roads. */
    async listHereRoadGeometry() {
      const r = await sb.from('here_road_geometry').select('leg,fetched_at,points,retry_after');
      if (r.error) throw new Error(`here_road_geometry: ${r.error.message}`);
      return (r.data ?? []).map((row) => ({
        leg: String(row.leg),
        fetched_at: String(row.fetched_at),
        points: row.points,
        retry_after: row.retry_after != null ? String(row.retry_after) : null,
      }));
    },
    /** #667 E / DP-23 — słownik legów; DP-44 legDefFromRow; F7 #677 B1 pusty → ROAD_LEGS. */
    async listHereRoadLegs() {
      const r = await sb
        .from('here_road_legs')
        .select('leg,origin_lat,origin_lng,dest_lat,dest_lng,spec,summary,corridor_code,browser_fetch,map_group')
        .eq('active', true)
        .order('sort_order');
      if (r.error) throw new Error(`here_road_legs: ${r.error.message}`);
      const rows = r.data ?? [];
      // Kolejność wdrożenia: 0355 → Edge; przed 0355 / pusty słownik = zapas core.
      if (rows.length === 0) return [...ROAD_LEGS];
      return rows.map((row) => legDefFromRow(row));
    },
    async storeHereRoad(leg: string, points: unknown, summary: string, nowIso?: string) {
      const args: Record<string, unknown> = { p_leg: leg, p_points: points, p_summary: summary };
      if (nowIso) args.p_now = nowIso;
      must(await sb.rpc('here_store_road', args), 'here_store_road');
    },
    async hereCorridorBundle(code: string) {
      const corrRow = await sb.from('corridor_polylines').select('updated_at').eq('code', code).maybeSingle();
      const updatedAt = Date.parse(String(corrRow.data?.updated_at ?? '')) || 0;
      type Pt = [number, number];
      const parsePts = (raw: unknown): Pt[] => {
        if (!Array.isArray(raw)) return [];
        const out: Pt[] = [];
        for (const p of raw) {
          if (!Array.isArray(p) || p.length < 2) continue;
          const lat = Number(p[0]);
          const lng = Number(p[1]);
          if (Number.isFinite(lat) && Number.isFinite(lng)) out.push([lat, lng]);
        }
        return out;
      };
      let pts: Pt[] = [];
      let via: Pt[] = [];
      const ptsRpc = await sb.rpc('here_corridor_points', { p_code: code });
      if (!ptsRpc.error) pts = parsePts(ptsRpc.data);
      const viaRpc = await sb.rpc('here_corridor_via_points', { p_code: code, p_max: 14 });
      if (!viaRpc.error) via = parsePts(viaRpc.data);
      return { code, pts, via, updatedAt };
    },
    async listActiveLoadsForTelematics() {
      const r = await sb.from('loads').select('id,trailer_plate,telematics_vehicle_id,status,plan_load_date,plan_delivery_date,tracking_opened_at')
        .not('status', 'in', '("CANCELLED","REMOVED","UNLOADED","DELIVERED","READY_TO_INVOICE","INVOICED")');
      if (r.error) throw new Error(`loads telematics: ${r.error.message}`);
      return (r.data ?? []).map((row) => ({
        id: row.id as string,
        trailer_plate: (row.trailer_plate as string | null) ?? null,
        telematics_vehicle_id: (row.telematics_vehicle_id as string | null) ?? null,
        status: (row.status as string | null) ?? null,
        plannedLoadDate: (row.plan_load_date as string | null) ?? null,
        plannedDeliverDate: (row.plan_delivery_date as string | null) ?? null,
        trackingOpenedAt: (row.tracking_opened_at as string | null) ?? null,
      }));
    },
    async processPosition(row: {
      loadId: string; lat: number; lon: number; ts: string;
      source: 'EMTRACK_WEB' | 'TELEMATICS_API' | 'SUBCONTRACTOR_LINK' | 'SAFEFLEET';
      speed?: number | null; heading?: number | null; ignition?: boolean | null; raw?: unknown;
    }) {
      must(await sb.rpc('process_position', {
        p_load_id: row.loadId,
        p_lat: row.lat,
        p_lon: row.lon,
        p_ts: row.ts,
        p_source: row.source,
        p_speed: row.speed ?? null,
        p_heading: row.heading ?? null,
        p_ignition: row.ignition ?? null,
        p_raw: row.raw ?? {},
      }), 'process_position');
    },
    async lastPositionAt(loadId: string, source: string) {
      const r = await sb.from('positions').select('ts').eq('load_id', loadId).eq('source', source)
        .order('ts', { ascending: false }).limit(1).maybeSingle();
      if (r.error || !r.data) return null;
      return String((r.data as { ts: string }).ts);
    },
    async truckBanHolidayHit(country: 'PL' | 'SE', isoUtc: string) {
      const r = await sb.rpc('truck_ban_holiday_hit', { p_country: country, p_ts: isoUtc });
      if (r.error) return false;
      return r.data === true;
    },
    async emtrackLoginState() {
      const r = await sb.from('emtrack_login_state').select('fail_streak,skipped_until,secret_fp').eq('id', 1).maybeSingle();
      if (r.error || !r.data) return null;
      const d = r.data as { fail_streak: number; skipped_until: string | null; secret_fp: string | null };
      return { failStreak: d.fail_streak ?? 0, skippedUntil: d.skipped_until, secretFp: d.secret_fp };
    },
    async saveEmtrackLoginState(state: { failStreak: number; skippedUntil: string | null; secretFp: string | null }) {
      must(await sb.from('emtrack_login_state').upsert({
        id: 1,
        fail_streak: state.failStreak,
        skipped_until: state.skippedUntil,
        secret_fp: state.secretFp,
        updated_at: new Date().toISOString(),
      }), 'emtrack_login_state');
    },
        async telmEmtrackWebEnabled() {
      const r = await sb.rpc('telm_emtrack_web_enabled');
      if (r.error) throw new Error(`telm_emtrack_web_enabled: ${r.error.message}`);
      return r.data === true;
    },
    async telmRioLinksEnabled() {
      const r = await sb.rpc('telm_rio_links_enabled');
      if (r.error) throw new Error(`telm_rio_links_enabled: ${r.error.message}`);
      return r.data === true;
    },
    async telmSafefleetPollEnabled() {
      const r = await sb.rpc('telm_safefleet_poll_enabled');
      if (r.error) throw new Error(`telm_safefleet_poll_enabled: ${r.error.message}`);
      return r.data === true;
    },
    async rioLinksLockTry(ttlSec = 90, token?: string) {
      const r = await sb.rpc('rio_links_lock_try', {
        p_ttl_sec: ttlSec,
        p_token: token ?? null,
      });
      if (r.error) throw new Error(`rio_links_lock_try: ${r.error.message}`);
      return r.data === true;
    },
    async rioLinksLockRelease(token?: string) {
      const r = await sb.rpc('rio_links_lock_release', { p_token: token ?? null });
      if (r.error) throw new Error(`rio_links_lock_release: ${r.error.message}`);
    },
    async safefleetPollLockTry(ttlSec = 90, token?: string) {
      const r = await sb.rpc('safefleet_poll_lock_try', {
        p_ttl_sec: ttlSec,
        p_token: token ?? null,
      });
      if (r.error) throw new Error(`safefleet_poll_lock_try: ${r.error.message}`);
      return r.data === true;
    },
    async safefleetPollLockRelease(token?: string) {
      const r = await sb.rpc('safefleet_poll_lock_release', { p_token: token ?? null });
      if (r.error) throw new Error(`safefleet_poll_lock_release: ${r.error.message}`);
    },
    async saveOrphanPosition(row: {
      plate: string; trackingObjectId?: string | null;
      lat: number; lon: number; ts: string;
      source: 'EMTRACK_WEB' | 'TELEMATICS_API' | 'SUBCONTRACTOR_LINK' | 'SAFEFLEET';
      speed?: number | null; heading?: number | null; ignition?: boolean | null; raw?: unknown;
    }) {
      must(await sb.rpc('telm_save_orphan_position', {
        p_plate: row.plate,
        p_tracking_object_id: row.trackingObjectId ?? null,
        p_lat: row.lat,
        p_lon: row.lon,
        p_ts: row.ts,
        p_source: row.source,
        p_speed: row.speed ?? null,
        p_heading: row.heading ?? null,
        p_ignition: row.ignition ?? null,
        p_raw: row.raw ?? {},
      }), 'telm_save_orphan_position');
    },
    /** #622: alarm HHL gdy GPS>2h, a sieroty mają token naczepy. */
    async scanOrphanTrailerAlerts() {
      const r = await sb.rpc('telm_scan_orphan_trailer_alerts');
      if (r.error) throw new Error(`telm_scan_orphan_trailer_alerts: ${r.error.message}`);
      return Number(r.data ?? 0);
    },
    async inferPhaseFromPosition(loadId: string, lat: number, lon: number, ts: string) {
      const r = await sb.rpc('telm_infer_phase_from_position', {
        p_load: loadId, p_lat: lat, p_lon: lon, p_ts: ts,
      });
      if (r.error) throw new Error(`telm_infer_phase_from_position: ${r.error.message}`);
      return r.data == null ? null : String(r.data);
    },
    async listRioLoadsForPoll() {
      // #442: bez shipment_code — kolumna jest w shipment_items, nie w loads (RioLoadRow.code nieużywane).
      const r = await sb.from('loads').select(
        'id,rio_tracking_id,rio_secret,rio_check_state,rio_check_at,rio_valid_from,rio_valid_to,rio_asset_name,rio_tracker_on,rio_last_fix_at,rio_error_streak,trailer_plate,tractor_plate,tractor_delivery_plate,status,plan_load_date,tracking_opened_at,telematics_vehicle_id',
      )
        .not('rio_tracking_id', 'is', null)
        .not('rio_secret', 'is', null)
        .not('status', 'in', '("CANCELLED","REMOVED","UNLOADED","DELIVERED","READY_TO_INVOICE","INVOICED")');
      if (r.error) throw new Error(`loads rio: ${r.error.message}`);
      return (r.data ?? []).map((row) => ({
        id: row.id as string,
        code: null as string | null,
        rio_tracking_id: String(row.rio_tracking_id),
        rio_secret: String(row.rio_secret),
        rio_check_state: (row.rio_check_state as string | null) ?? null,
        rio_check_at: (row.rio_check_at as string | null) ?? null,
        rio_valid_from: (row.rio_valid_from as string | null) ?? null,
        rio_valid_to: (row.rio_valid_to as string | null) ?? null,
        rio_asset_name: (row.rio_asset_name as string | null) ?? null,
        rio_tracker_on: (row.rio_tracker_on as string | null) ?? null,
        rio_last_fix_at: (row.rio_last_fix_at as string | null) ?? null,
        rio_error_streak: Number(row.rio_error_streak ?? 0),
        trailer_plate: (row.trailer_plate as string | null) ?? null,
        tractor_plate: (row.tractor_plate as string | null) ?? null,
        tractor_delivery_plate: (row.tractor_delivery_plate as string | null) ?? null,
        status: (row.status as string | null) ?? null,
        plannedLoadDate: (row.plan_load_date as string | null) ?? null,
        trackingOpenedAt: (row.tracking_opened_at as string | null) ?? null,
        telematics_vehicle_id: (row.telematics_vehicle_id as string | null) ?? null,
      }));
    },
    async updateRioLoadState(loadId: string, patch: {
      rio_check_state?: 'ok' | 'pending' | 'invalid' | 'down';
      rio_check_at?: string;
      rio_asset_name?: string | null;
      rio_tracker_on?: string | null;
      rio_valid_from?: string | null;
      rio_valid_to?: string | null;
      rio_last_fix_at?: string;
      rio_error_streak?: number;
    }) {
      must(await sb.from('loads').update(patch).eq('id', loadId), 'loads rio state');
    },
    async listSafefleetLoadsForPoll() {
      const r = await sb.from('loads').select(
        'id,safefleet_token,safefleet_check_state,safefleet_check_at,safefleet_last_fix_at,safefleet_error_streak,safefleet_trajectory_done,telematics_vehicle_id,status,plan_load_date,tracking_opened_at',
      )
        .eq('telematics_provider', 'SAFEFLEET')
        .not('safefleet_token', 'is', null)
        .not('status', 'in', '("CANCELLED","REMOVED","UNLOADED","DELIVERED","READY_TO_INVOICE","INVOICED")');
      if (r.error) throw new Error(`loads safefleet: ${r.error.message}`);
      return (r.data ?? []).map((row) => ({
        id: row.id as string,
        safefleet_token: String(row.safefleet_token),
        safefleet_check_state: (row.safefleet_check_state as string | null) ?? null,
        safefleet_check_at: (row.safefleet_check_at as string | null) ?? null,
        safefleet_last_fix_at: (row.safefleet_last_fix_at as string | null) ?? null,
        safefleet_error_streak: Number(row.safefleet_error_streak ?? 0),
        safefleet_trajectory_done: row.safefleet_trajectory_done === true,
        telematics_vehicle_id: (row.telematics_vehicle_id as string | null) ?? null,
        status: (row.status as string | null) ?? null,
        plannedLoadDate: (row.plan_load_date as string | null) ?? null,
        trackingOpenedAt: (row.tracking_opened_at as string | null) ?? null,
      }));
    },
    async updateSafefleetLoadState(loadId: string, patch: {
      safefleet_check_state?: 'ok' | 'pending' | 'invalid' | 'down';
      safefleet_check_at?: string;
      safefleet_last_fix_at?: string;
      safefleet_error_streak?: number;
      safefleet_trajectory_done?: boolean;
    }) {
      must(await sb.from('loads').update(patch).eq('id', loadId), 'loads safefleet state');
    },
    async lastPositionFix(loadId: string, source: string) {
      const r = await sb.from('positions').select('lat,lon,ts').eq('load_id', loadId).eq('source', source)
        .order('ts', { ascending: false }).limit(1).maybeSingle();
      if (r.error || !r.data) return null;
      const d = r.data as { lat: number; lon: number; ts: string };
      return { lat: Number(d.lat), lon: Number(d.lon), ts: String(d.ts) };
    },
  };
}
