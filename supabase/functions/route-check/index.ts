/**
 * H-1 — kontrola trasy. Wołana tylko kluczem service role.
 * Przy wyłączonej fladze nie czyta transportów i nie woła HERE.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { isServiceRequest } from '../_shared/serviceAuth.ts';
import { numOrNull, runRouteCheck, type LegName, type SetDims } from '../_shared/here/routeCheck.ts';

Deno.serve(async (req: Request) => {
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const allowed = !!service && (await isServiceRequest(req, { url, service }));
  if (!allowed) return new Response('forbidden', { status: 403 });
  const sb = createClient(url, service, { auth: { persistSession: false } });
  const res = await runRouteCheck({
    fetch,
    apiKey: Deno.env.get('HERE_API_KEY'),
    now: () => new Date(),
    db: {
      async enabled() {
        const { data, error } = await sb.rpc('h1_route_check_enabled');
        if (error) return false;
        return data === true;
      },
      async loads() {
        const { data, error } = await sb
          .from('loads')
          .select('id, combo_height_m, combo_width_m, combo_length_m, combo_weight_t, combo_axle_count, combo_axle_load_t, sailings(route)')
          .limit(500);
        if (error || !data) return [];
        return data.map((row: Record<string, unknown>) => {
          const sailing = row.sailings as { route?: string } | { route?: string }[] | null;
          const route = Array.isArray(sailing) ? sailing[0]?.route ?? null : sailing?.route ?? null;
          const dims: SetDims = {
            heightM: numOrNull(row.combo_height_m),
            widthM: numOrNull(row.combo_width_m),
            lengthM: numOrNull(row.combo_length_m),
            weightT: numOrNull(row.combo_weight_t),
            axleCount: numOrNull(row.combo_axle_count),
            axleLoadT: numOrNull(row.combo_axle_load_t),
          };
          return { id: String(row.id), route, dims };
        });
      },
      async latest(loadId: string, leg: LegName) {
        const { data } = await sb
          .from('route_checks')
          .select('checked_at, dims_key')
          .eq('load_id', loadId)
          .eq('leg', leg)
          .order('checked_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!data) return null;
        return { checkedAt: String(data.checked_at), dimsKey: String(data.dims_key) };
      },
      async monthSpendUsd() {
        const { data, error } = await sb.rpc('here_month_spend');
        if (error || data == null) return 0;
        return Number(data);
      },
      async monthRoutingRequests() {
        const { data, error } = await sb.rpc('here_month_routing_requests');
        if (error || data == null) return 0;
        return Number(data);
      },
      async save(row) {
        const { error } = await sb.rpc('h1_record_route_check', {
          p_load: row.loadId,
          p_leg: row.leg,
          p_checked_at: row.checkedAt,
          p_dims_key: row.dimsKey,
          p_status: row.status,
          p_summary: row.summary,
          p_permits: row.permits,
          p_obstacles: row.obstacles,
          p_raw: row.raw,
        });
        if (error) throw new Error('zapis kontroli odrzucony');
      },
      async noteUsage(requests: number) {
        await sb.rpc('here_note_requests', { p_n: requests, p_usd: 0, p_now: new Date().toISOString() });
      },
    },
  });
  return Response.json(res);
});
