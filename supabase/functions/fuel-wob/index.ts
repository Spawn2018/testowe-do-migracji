/**
 * III-10 — cotygodniowe pobranie EU Weekly Oil Bulletin (olej napędowy PL/SE z podatkami, EUR/l)
 * do fuel_index_readings. WYŁĄCZONE do D-2: przy security_flags.FUEL_WOB_INGEST = false funkcja
 * kończy się bez pobierania i bez żadnego zapisu. Wywołanie wyłącznie z kluczem service role
 * (pg_cron → pg_net; harmonogram zakłada właściciel razem z włączeniem przełącznika).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import JSZip from 'npm:jszip@3';
import { isServiceRequest } from '../_shared/serviceAuth.ts';
import { WOB_LATEST_URL, readWobXlsx, wobSourceUrl } from '../_shared/fuel/wob.ts';

Deno.serve(async (req) => {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!service || !(await isServiceRequest(req, { url, service }))) return new Response('forbidden', { status: 403 });
  const sb = createClient(url, service, { auth: { persistSession: false } });
  const { data: enabled, error: fe } = await sb.rpc('fuel_wob_enabled');
  if (fe) return new Response(fe.message, { status: 500 });
  if (enabled !== true) return Response.json({ ok: true, skipped: 'FUEL_WOB_INGEST wyłączone (D-2)' });

  const log = (ok: boolean, result: Record<string, unknown>) => sb.from('integration_runs').insert({ job: 'fuel-wob', ok, result });
  try {
    const res = await fetch(WOB_LATEST_URL, { headers: { 'User-Agent': 'TOWER/1.0 (+https://tower.log-mar.pl)' } });
    if (!res.ok) throw new Error(`WOB: HTTP ${res.status}`);
    const parsed = await readWobXlsx(new Uint8Array(await res.arrayBuffer()), (b) => JSZip.loadAsync(b));
    const { data: proj, error: pe } = await sb.from('projects').select('id').eq('code', 'STEGRA_BODEN').single();
    if (pe || !proj) throw new Error(`projects: ${pe?.message ?? 'brak projektu'}`);
    const rows = parsed.readings.map(({ index_code, period, reading_date, value }) => ({ index_code, period, reading_date, value }));
    const { data, error } = await sb.rpc('fuel_wob_ingest', { p_project: proj.id, p_rows: rows, p_source_url: wobSourceUrl(parsed.priceDate) });
    if (error) throw new Error(error.message);
    await log(true, { price_date: parsed.priceDate, ...(data as Record<string, unknown>) });
    return Response.json({ ok: true, price_date: parsed.priceDate, readings: parsed.readings, result: data });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await log(false, { error: msg });
    return new Response(msg, { status: 500 });
  }
});
