/**
 * A6 E38 — cron co 5 min: odczyt pliku KSH z SharePoint (Graph) → parse → import_schedule.
 * Job: ksh-sharepoint-sync. Sekrety SHAREPOINT_* tylko w env; logi = statusy i liczby.
 * SOURCE_DOWN:KSH_SHAREPOINT po 30 min bez udanego odczytu (sticky, przez store.raiseRisk).
 * Zapis WT→plik — kolejny krok A6.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { isServiceRequest } from '../_shared/serviceAuth.ts';
import { downloadSharePointFile, type GraphEnv } from '../_shared/ksh/graph.ts';
import { parseWorkbookBytes, sha256Hex } from '../_shared/ksh/applyImport.ts';
import { shouldRaiseKshSourceDown } from '../_shared/ksh/sourceDown.ts';
import { supabaseStore } from '../_shared/integrations/store.ts';
import { sourceDownRisk } from '../_shared/integrations/sync.ts';

const JOB = 'ksh-sharepoint-sync';
const DEDUP_PREFIX = 'SOURCE_DOWN:KSH_SHAREPOINT';

Deno.serve(async (req: Request) => {
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  if (!service || !(await isServiceRequest(req, { url, service }))) {
    return new Response('forbidden', { status: 403 });
  }
  const sb = createClient(url, service, { auth: { persistSession: false } });
  const store = supabaseStore(sb);
  const env = Deno.env.toObject() as GraphEnv;
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

  /** last_read_at przed nieudanym przebiegiem — do progu 30 min (tabela, nie RPC HHL). */
  let prevReadAt: string | null = null;
  try {
    const st = await sb.from('ksh_sync_state').select('last_read_at').order('updated_at', { ascending: false }).limit(1).maybeSingle();
    prevReadAt = (st.data as { last_read_at?: string | null } | null)?.last_read_at ?? null;
  } catch {
    prevReadAt = null;
  }

  const raiseDownIfDue = async (warnings: string[]) => {
    if (!shouldRaiseKshSourceDown(prevReadAt, started)) return;
    await store.raiseRisk(sourceDownRisk('KSH_SHAREPOINT', warnings, started));
  };

  const dl = await downloadSharePointFile(env);
  if (!dl.ok) {
    await sb.rpc('ksh_sync_state_upsert', {
      p_project: projectId,
      p_source_ok: false,
      p_last_read_at: null,
      p_last_write_at: null,
      p_last_run: null,
      p_last_error: dl.reason.slice(0, 500),
      p_snapshot: null,
    });
    await raiseDownIfDue([dl.reason.slice(0, 120)]);
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

  let parsed;
  try {
    parsed = await parseWorkbookBytes(dl.bytes);
  } catch (e) {
    const reason = e instanceof Error ? e.message : String(e);
    await sb.rpc('ksh_sync_state_upsert', {
      p_project: projectId,
      p_source_ok: false,
      p_last_read_at: null,
      p_last_write_at: null,
      p_last_run: { bytes: dl.bytes.byteLength, mode: dl.mode, parse_ok: false },
      p_last_error: `parse: ${reason}`.slice(0, 500),
      p_snapshot: null,
    });
    await raiseDownIfDue([`parse: ${reason}`.slice(0, 120)]);
    const result = {
      job: JOB, mode: 'LIVE', ok: false, reason: `parse: ${reason}`.slice(0, 120),
      observations: { bytes: String(dl.bytes.byteLength), mode: dl.mode },
    };
    await sb.from('integration_runs').insert({ job: JOB, ok: false, result });
    return Response.json(result, { status: 502 });
  }

  const hash = await sha256Hex(dl.bytes);
  const fileMeta = {
    name: `sharepoint-${dl.mode}.xlsx`,
    hash,
    source: 'SHAREPOINT',
    column_map: parsed.columnMap,
    rejected: parsed.meta.rejected,
    skipped_standard: parsed.meta.skippedStandard,
    skipped_carrier: parsed.meta.skippedCarrier,
    skipped_empty: parsed.meta.skippedEmpty,
  };

  // Powiadomienia o zmianie dat zostają (E38 / G-18) — bez p_quiet.
  const imp = await sb.rpc('import_schedule', {
    p_project: projectId,
    p_rows: parsed.rows,
    p_cancel_codes: [],
    p_file: fileMeta,
    p_dry_run: false,
    p_quiet: false,
  });

  if (imp.error) {
    const reason = imp.error.message.slice(0, 500);
    await sb.rpc('ksh_sync_state_upsert', {
      p_project: projectId,
      p_source_ok: false,
      p_last_read_at: null,
      p_last_write_at: null,
      p_last_run: {
        bytes: dl.bytes.byteLength,
        mode: dl.mode,
        parse_ok: true,
        accepted: parsed.meta.accepted,
      },
      p_last_error: `import: ${reason}`.slice(0, 500),
      p_snapshot: null,
    });
    await raiseDownIfDue([`import: ${reason}`.slice(0, 120)]);
    const result = {
      job: JOB, mode: 'LIVE', ok: false, reason: `import: ${reason}`.slice(0, 120),
      observations: {
        bytes: String(dl.bytes.byteLength),
        accepted: String(parsed.meta.accepted),
        skipped_carrier: String(parsed.meta.skippedCarrier),
      },
    };
    await sb.from('integration_runs').insert({ job: JOB, ok: false, result });
    return Response.json(result, { status: 502 });
  }

  const data = (imp.data ?? {}) as {
    added?: unknown[];
    changed?: unknown[];
    unchanged?: number;
    cancel_candidates?: unknown[];
    dates_check?: number;
  };
  const added = Array.isArray(data.added) ? data.added.length : 0;
  const changed = Array.isArray(data.changed) ? data.changed.length : 0;
  const cands = Array.isArray(data.cancel_candidates) ? data.cancel_candidates.length : 0;

  await store.resolveRisks(`${DEDUP_PREFIX}`);

  await sb.rpc('ksh_sync_state_upsert', {
    p_project: projectId,
    p_source_ok: true,
    p_last_read_at: started,
    p_last_write_at: null,
    p_last_run: {
      created: added,
      changed,
      unchanged: data.unchanged ?? 0,
      skipped: parsed.meta.skippedCarrier + parsed.meta.skippedEmpty + parsed.meta.skippedStandard,
      ntg: parsed.meta.skippedStandard,
      cases: cands + (data.dates_check ?? parsed.meta.datesToCheck),
      bytes: dl.bytes.byteLength,
      mode: dl.mode,
      accepted: parsed.meta.accepted,
      cancel_candidates: cands,
    },
    p_last_error: null,
    p_snapshot: parsed.snapshot,
  });

  const result = {
    job: JOB, mode: 'LIVE', ok: true,
    reason: `OK import: +${added} ~${changed} (HH ${parsed.meta.accepted}, NTG ${parsed.meta.skippedStandard})`,
    observations: {
      bytes: String(dl.bytes.byteLength),
      mode: dl.mode,
      added: String(added),
      changed: String(changed),
      accepted: String(parsed.meta.accepted),
      skipped_carrier: String(parsed.meta.skippedCarrier),
      skipped_empty: String(parsed.meta.skippedEmpty),
      cancel_candidates: String(cands),
    },
  };
  await sb.from('integration_runs').insert({ job: JOB, ok: true, result });
  return Response.json(result, { status: 200 });
});
