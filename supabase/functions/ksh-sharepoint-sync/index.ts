/**
 * A6 E38 — cron co 5 min: odczyt pliku KSH z SharePoint (Graph).
 * Job w integration_runs: ksh-sharepoint-sync.
 * Sekrety SHAREPOINT_* tylko w env funkcji; logi = statusy i liczby (bez URL/tokenu/PII).
 * Ten przebieg: pobranie pliku + stan ksh_sync_state (+ SOURCE_DOWN przy awarii).
 * Zastosowanie import_schedule + zapis WT→plik — kolejny commit A6.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { isServiceRequest } from '../_shared/serviceAuth.ts';
import { downloadSharePointFile, type GraphEnv } from '../_shared/ksh/graph.ts';

const JOB = 'ksh-sharepoint-sync';

Deno.serve(async (req: Request) => {
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  if (!service || !(await isServiceRequest(req, { url, service }))) {
    return new Response('forbidden', { status: 403 });
  }
  const sb = createClient(url, service, { auth: { persistSession: false } });
  const env = Deno.env.toObject() as GraphEnv;
  // TEST: SHAREPOINT_FILE_MODE=test w sekretach funkcji TEST; produkcja bez trybu = FILE_URL.
  const started = new Date().toISOString();

  let projectId: string | null = null;
  try {
    const { data: proj, error: pe } = await sb.from('projects').select('id').order('id').limit(1).maybeSingle();
    if (pe) throw new Error(`projects: ${pe.message}`);
    projectId = (proj?.id as string) ?? null;
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    await sb.from('integration_runs').insert({
      job: JOB, ok: false, result: { job: JOB, ok: false, reason: reason.slice(0, 200) },
    });
    return Response.json({ ok: false, reason: reason.slice(0, 200) }, { status: 502 });
  }

  if (!projectId) {
    await sb.from('integration_runs').insert({
      job: JOB, ok: false, result: { job: JOB, ok: false, reason: 'brak projektu' },
    });
    return Response.json({ ok: false, reason: 'brak projektu' }, { status: 502 });
  }

  const dl = await downloadSharePointFile(env);
  if (!dl.ok) {
    // SOURCE_DOWN przez store.raiseRisk (title_key) — w kolejnym kroku po serveJob;
    // tu tylko stan: widok liczy „Nie działa” z wieku lastReadAt (kshSyncView).
    await sb.rpc('ksh_sync_state_upsert', {
      p_project: projectId,
      p_source_ok: false,
      p_last_read_at: null,
      p_last_write_at: null,
      p_last_run: null,
      p_last_error: dl.reason.slice(0, 500),
      p_snapshot: null,
    });
    const result = {
      job: JOB, mode: 'LIVE', ok: false, reason: dl.reason.slice(0, 120),
      observations: {
        http: String(dl.meta.http),
        download_http: String(dl.meta.downloadHttp ?? ''),
        mode: env.SHAREPOINT_FILE_MODE === 'test' ? 'test' : 'prod',
      },
    };
    await sb.from('integration_runs').insert({ job: JOB, ok: false, result });
    return Response.json(result, { status: 502 });
  }

  await sb.rpc('ksh_sync_state_upsert', {
    p_project: projectId,
    p_source_ok: true,
    p_last_read_at: started,
    p_last_write_at: null,
    p_last_run: {
      created: 0,
      changed: 0,
      skipped: 0,
      ntg: 0,
      cases: 0,
      bytes: dl.bytes.byteLength,
      mode: dl.mode,
    },
    p_last_error: null,
    p_snapshot: null,
  });

  const result = {
    job: JOB, mode: 'LIVE', ok: true,
    reason: `Odczyt OK (${dl.bytes.byteLength} B, tryb ${dl.mode}) — import w kolejnym kroku A6`,
    observations: {
      bytes: String(dl.bytes.byteLength),
      mode: dl.mode,
      http: String(dl.meta.http),
    },
  };
  await sb.from('integration_runs').insert({ job: JOB, ok: true, result });
  return Response.json(result, { status: 200 });
});
