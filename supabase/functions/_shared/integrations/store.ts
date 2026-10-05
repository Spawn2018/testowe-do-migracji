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
    async vessels() { return must(await sb.from('vessels').select('id,name,mmsi,imo'), 'vessels') as VesselRow[]; },
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
        observed_at: fix.timestampUtc, source: fix.source ?? 'DIGITRAFFIC', eta_at: fix.etaAt ?? null,
      }, { onConflict: 'vessel_id,observed_at', ignoreDuplicates: true }), 'vessel_positions insert');
    },
    async latestVesselObserved() {
      const rows = must(await sb.from('vessel_positions').select('vessel_id,observed_at').order('observed_at', { ascending: false }).limit(50), 'vessel_positions latest') as { vessel_id: string; observed_at: string }[];
      const best = new Map<string, string>();
      for (const r of rows) if (!best.has(r.vessel_id)) best.set(r.vessel_id, r.observed_at);
      return [...best.entries()].map(([vesselId, observedAt]) => ({ vesselId, observedAt }));
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
    async listActiveLoadsForTelematics() {
      const r = await sb.from('loads').select('id,trailer_plate,telematics_vehicle_id,status')
        .not('status', 'in', '("DONE","CANCELLED","CANCELED","ARCHIVED")');
      if (r.error) throw new Error(`loads telematics: ${r.error.message}`);
      return (r.data ?? []) as { id: string; trailer_plate: string | null; telematics_vehicle_id: string | null; status: string | null }[];
    },
    async processPosition(row: {
      loadId: string; lat: number; lon: number; ts: string;
      source: 'EMTRACK_WEB' | 'TELEMATICS_API' | 'SUBCONTRACTOR_LINK';
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
    async telmEmtrackWebEnabled() {
      const r = await sb.rpc('telm_emtrack_web_enabled');
      if (r.error) throw new Error(`telm_emtrack_web_enabled: ${r.error.message}`);
      return r.data === true;
    },
  };
}
