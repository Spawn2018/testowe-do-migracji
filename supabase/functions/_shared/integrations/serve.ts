/**
 * M12 — wspólny punkt wejścia funkcji Edge integracji. Wywołanie: pg_cron → pg_net z kluczem service role
 * (scripts/ferry/cron-edge.sql, krok właściciela W-M12-1); `ferry-schedule` także ręcznie przez HHL (sesja).
 * Sekrety funkcji: TRAFIKVERKET_API_KEY, TOMTOM_API_KEY, KPD_DATEX_URL (+ KPD_AUTH_HEADER) — opcjonalne;
 * bez nich funkcja zwraca tryb DEMO i niczego nie pobiera. SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — platforma.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { runJob, type JobName } from './jobs.ts';
import { supabaseStore } from './store.ts';

export function serveJob(name: JobName, opts: { allowHhl?: boolean } = {}) {
  Deno.serve(async (req: Request) => {
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const url = Deno.env.get('SUPABASE_URL') ?? '';
    const auth = req.headers.get('Authorization') ?? '';
    const sb = createClient(url, service, { auth: { persistSession: false } });
    let allowed = !!service && auth === `Bearer ${service}`;
    if (!allowed && opts.allowHhl && auth.startsWith('Bearer ')) {
      const { data } = await sb.auth.getUser(auth.slice(7));
      if (data?.user) {
        const { data: u } = await sb.from('app_users').select('role,active').eq('auth_id', data.user.id).maybeSingle();
        allowed = !!u?.active && (u.role === 'HHL_ADMIN' || u.role === 'HHL_OPS');
      }
    }
    if (!allowed) return new Response('forbidden', { status: 403 });
    const res = await runJob(name, { store: supabaseStore(sb), fetch, env: Deno.env.toObject(), now: () => new Date() });
    return Response.json(res, { status: res.ok ? 200 : 502 });
  });
}
