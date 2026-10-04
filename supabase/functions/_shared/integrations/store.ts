/**
 * M12 — magazyn zadań integracji na Supabase (klucz service role, wyłącznie po stronie serwera).
 * Typ klienta minimalny, żeby ten sam kod działał w Deno (npm:@supabase/supabase-js) i w Node.
 */
import type { SyncStore, VehiclePos } from './jobs.ts';
import type { VesselFix } from '../ferry/digitraffic.ts';
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
        p_detail: { ...r.detail, title_key: r.titleKey, params: r.params }, p_dedup: r.dedup, p_source_url: r.sourceUrl ?? null, p_valid_until: r.validUntil ?? null,
      });
      return must(res, 'raise_integration_risk') === true;
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
    async recordRun(job: string, ok: boolean, result: unknown) {
      must(await sb.from('integration_runs').insert({ job, ok, result }), 'integration_runs insert');
    },
    async saveVesselPosition(vesselId: string, fix: VesselFix) {
      must(await sb.from('vessel_positions').upsert({
        vessel_id: vesselId, lat: fix.lat, lon: fix.lon, sog_kn: fix.sogKn, cog: fix.cog, nav_stat: fix.navStat,
        observed_at: fix.timestampUtc, source: 'DIGITRAFFIC',
      }, { onConflict: 'vessel_id,observed_at', ignoreDuplicates: true }), 'vessel_positions insert');
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
    async saveCorridorCondition(row: {
      corridor: 'SE_E4'; slowdownMult: number; reason: string | null; detail: unknown; observedAt: string;
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
      corridor: 'BALTIC_GDN_NYN';
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
  };
}
