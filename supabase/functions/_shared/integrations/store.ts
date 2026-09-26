/**
 * M12 — magazyn zadań integracji na Supabase (klucz service role, wyłącznie po stronie serwera).
 * Typ klienta minimalny, żeby ten sam kod działał w Deno (npm:@supabase/supabase-js) i w Node.
 */
import type { SyncStore, VehiclePos } from './jobs.ts';
import type { DbSailing, RiskInput, SailingInsert, SailingPatch, VesselRow } from './sync.ts';

// deno-lint-ignore no-explicit-any
type Client = any;
const SAILING_COLS = 'id,vessel_id,route,departure_at,arrival_at,delayed_departure_at,delayed_arrival_at,status,source';

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
    async vessels() { return must(await sb.from('vessels').select('id,name,mmsi'), 'vessels') as VesselRow[]; },
    async sailingsSince(fromIso: string) {
      return must(await sb.from('sailings').select(SAILING_COLS).gte('departure_at', fromIso).order('departure_at'), 'sailings') as DbSailing[];
    },
    async insertSailings(rows: SailingInsert[]) {
      // unikalność (statek, odejście): istniejący wiersz zostaje — plan i tak aktualizuje go osobno
      must(await sb.from('sailings').upsert(rows, { onConflict: 'vessel_id,departure_at', ignoreDuplicates: true }), 'sailings insert');
    },
    async updateSailing(id: string, patch: SailingPatch) {
      const r = must(await sb.from('sailings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id).neq('source', 'RECZNIE').select('id'), 'sailings update') as unknown[];
      return r.length > 0;
    },
    async raiseRisk(r: RiskInput & { loadId?: string }) {
      const res = await sb.rpc('raise_integration_risk', {
        p_project: await projectId(), p_load: r.loadId ?? null, p_kind: r.kind, p_sev: r.severity, p_title: r.title,
        p_detail: r.detail, p_dedup: r.dedup, p_source_url: r.sourceUrl ?? null, p_valid_until: r.validUntil ?? null,
      });
      return must(res, 'raise_integration_risk') === true;
    },
    async resolveRisks(dedupPrefix: string) {
      const r = must(await sb.from('risk_signals').update({ resolved_at: new Date().toISOString() })
        .like('dedup_key', `${dedupPrefix.replace(/[%_]/g, (c) => `\\${c}`)}%`).is('resolved_at', null).select('id'), 'risk_signals resolve') as unknown[];
      return r.length;
    },
    async lastRun(job: string) {
      const r = must(await sb.from('integration_runs').select('ran_at').eq('job', job).order('ran_at', { ascending: false }).limit(1), 'integration_runs') as { ran_at: string }[];
      return r[0]?.ran_at ?? null;
    },
    async recordRun(job: string, ok: boolean, result: unknown) {
      must(await sb.from('integration_runs').insert({ job, ok, result }), 'integration_runs insert');
    },
    async latestPositions(maxAgeMin: number) {
      return must(await sb.rpc('latest_vehicle_positions', { p_max_age_min: maxAgeMin }), 'latest_vehicle_positions') as VehiclePos[];
    },
  };
}
