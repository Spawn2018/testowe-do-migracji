/**
 * H-3 — przeszkody wzdłuż korytarza. Wołana tylko kluczem service role.
 * Przy wyłączonej fladze H3_CORRIDOR_OBSTACLES nie woła HERE.
 * Nie czyta transportów i nie uzupełnia wymiarów. Nie włącza H-1.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { isServiceRequest } from '../_shared/serviceAuth.ts';
import { runCorridorObstacles, type CorridorLegName, type CorridorSave } from '../_shared/here/corridorObstacles.ts';

Deno.serve(async (req: Request) => {
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const allowed = !!service && (await isServiceRequest(req, { url, service }));
  if (!allowed) return new Response('forbidden', { status: 403 });
  const sb = createClient(url, service, { auth: { persistSession: false } });
  const res = await runCorridorObstacles({
    fetch,
    apiKey: Deno.env.get('HERE_API_KEY'),
    now: () => new Date(),
    db: {
      async enabled() {
        const { data, error } = await sb.rpc('h3_corridor_enabled');
        if (error) return false;
        return data === true;
      },
      async latest(leg: CorridorLegName) {
        const { data } = await sb
          .from('corridor_fetches')
          .select('fetched_at, status')
          .eq('leg', leg)
          .maybeSingle();
        if (!data) return null;
        return { fetchedAt: String(data.fetched_at), status: String(data.status) };
      },
      async monthSpendUsd() {
        const { data, error } = await sb.rpc('here_month_spend');
        if (error || data == null) return 0;
        return Number(data);
      },
      async save(row: CorridorSave) {
        const { error } = await sb.rpc('h3_replace_leg', {
          p_leg: row.leg,
          p_fetched_at: row.fetchedAt,
          p_status: row.status,
          p_summary: row.summary,
          p_replace: row.replace,
          p_items: row.items,
          p_raw: row.raw,
        });
        if (error) throw new Error('zapis korytarza odrzucony');
      },
      async noteUsage(service, requests, usd) {
        await sb.rpc('here_note_service', {
          p_service: service,
          p_n: requests,
          p_usd: usd,
          p_now: new Date().toISOString(),
        });
      },
      async purgeRaw() {
        await sb.rpc('purge_here_corridor_raw', { p_now: new Date().toISOString() });
      },
    },
  });
  return Response.json(res);
});
