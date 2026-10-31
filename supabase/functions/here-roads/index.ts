/**
 * B-MAPA / #667 — geometria trasy ciężarówki HERE do rysowania. Bez wymiarów, bez myta.
 * Zapis na 30 dni. Przy pełnym budżecie (100 USD) nie woła HERE.
 * #572 BN0 / F7 #585 r4: SE-KAA z via; shouldFetch; odchyłka; odrzucenie nie kasuje punktów.
 * #667 B / F7 r1 B3: SE-KAA ← SE_E22; SE-KAA-INLAND ← jawnie SE_KAA_INLAND.
 * #667 C: wspólny refreshRoadLegs; cron (service role) → job here-roads + SOURCE_DOWN HERE_ROADS;
 *   przeglądarka (JWT) → odświeżenie bez ryzyka (jak dotychczas).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { HERE_BILLING_DEFAULTS } from '../_shared/here/billing.ts';
import {
  refreshRoadLegs,
  ROAD_LEGS,
  type CorridorBundle,
  type RoadRefreshStore,
} from '../_shared/here/refreshRoadLegs.ts';
import { legDefFromRow } from '../_shared/here/legDefFromRow.ts';
import { type LatLng } from '../_shared/map/draw.ts';
import { corsHeaders, corsPreflight } from '../_shared/cors.ts';
import { isServiceRequest } from '../_shared/serviceAuth.ts';
import { runJob } from '../_shared/integrations/jobs.ts';
import { supabaseStore } from '../_shared/integrations/store.ts';

function parseCorridorPoints(raw: unknown): LatLng[] {
  if (!Array.isArray(raw)) return [];
  const out: LatLng[] = [];
  for (const p of raw) {
    if (!Array.isArray(p) || p.length < 2) continue;
    const lat = Number(p[0]);
    const lng = Number(p[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) out.push([lat, lng]);
  }
  return out;
}

function roadStore(sb: ReturnType<typeof createClient>): RoadRefreshStore {
  return {
    // #667 E / DP-23 + #677 F7 B1: legi ze słownika; błąd/pustka → throw / ROAD_LEGS.
    // Kolejność wdrożenia: migracja 0355, potem Edge (bez fail-open na []).
    async listLegs() {
      const r = await sb
        .from('here_road_legs')
        .select('leg,origin_lat,origin_lng,dest_lat,dest_lng,spec,summary,corridor_code,browser_fetch,map_group')
        .eq('active', true)
        .order('sort_order');
      if (r.error) throw new Error(`here_road_legs: ${r.error.message}`);
      const rows = r.data ?? [];
      if (rows.length === 0) return [...ROAD_LEGS];
      return rows.map((row) => legDefFromRow(row));
    },
    async listGeometry() {
      const fresh = await sb.from('here_road_geometry').select('leg,fetched_at,points,retry_after');
      return (fresh.data ?? []).map((row) => ({
        leg: String(row.leg),
        fetched_at: String(row.fetched_at),
        points: row.points,
        retry_after: row.retry_after != null ? String(row.retry_after) : null,
      }));
    },
    async storeRoad(leg, points, summary, nowIso) {
      const args: Record<string, unknown> = { p_leg: leg, p_points: points, p_summary: summary };
      if (nowIso) args.p_now = nowIso;
      const save = await sb.rpc('here_store_road', args);
      return !save.error;
    },
    async loadCorridor(code): Promise<CorridorBundle> {
      const corrRow = await sb.from('corridor_polylines').select('updated_at').eq('code', code).maybeSingle();
      const updatedAt = Date.parse(String(corrRow.data?.updated_at ?? '')) || 0;
      let pts: LatLng[] = [];
      let via: LatLng[] = [];
      const ptsRpc = await sb.rpc('here_corridor_points', { p_code: code });
      if (!ptsRpc.error) pts = parseCorridorPoints(ptsRpc.data);
      const viaRpc = await sb.rpc('here_corridor_via_points', { p_code: code, p_max: 14 });
      if (!viaRpc.error) via = parseCorridorPoints(viaRpc.data);
      return { code, pts, via, updatedAt };
    },
    async monthSpend() {
      const spend = await sb.rpc('here_month_spend');
      return spend.error ? HERE_BILLING_DEFAULTS.budgetUsd : Number(spend.data);
    },
    async noteRouting() {
      await sb.rpc('here_note_service', {
        p_service: 'routing',
        p_n: 1,
        p_usd: HERE_BILLING_DEFAULTS.routesRateUsd,
      });
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflight();
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // #667 C: cron (service role) → job z SOURCE_DOWN przy braku linii.
  if (serviceKey && await isServiceRequest(req, { url: supabaseUrl, service: serviceKey })) {
    const res = await runJob('here-roads', {
      store: supabaseStore(sb),
      fetch,
      env: Deno.env.toObject(),
      now: () => new Date(),
    });
    return Response.json(res, { status: res.ok ? 200 : 502, headers: corsHeaders() });
  }

  const auth = req.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const user = await userClient.auth.getUser();
  if (!user.data.user) return Response.json({ ok: false }, { status: 401, headers: corsHeaders() });

  const key = Deno.env.get('HERE_API_KEY') ?? '';
  if (!key) return Response.json({ ok: false, reason: 'brak' }, { headers: corsHeaders() });
  // browserOnly: BN7 bez browser_fetch — nie pali HERE z każdej sesji mapy (#667 E).
  const result = await refreshRoadLegs(roadStore(sb), {
    fetch, hereApiKey: key, browserOnly: true,
  });
  if (result.skippedBudget) {
    return Response.json({ ok: false, reason: 'budzet' }, { headers: corsHeaders() });
  }
  return Response.json({ ok: true, stored: result.stored }, { headers: corsHeaders() });
});
