/**
 * A6 E38 — cron co 5 min: odczyt pliku KSH z SharePoint (Graph) → parse → import_schedule.
 * Job: ksh-sharepoint-sync. Sekrety SHAREPOINT_* tylko w env; logi = statusy i liczby.
 * SOURCE_DOWN:KSH_SHAREPOINT po 30 min bez udanego odczytu (sticky, przez store.raiseRisk).
 * F7 #556: import_enabled (domyślnie dry_run), dedup hash, DEMO bez sekretów, try/catch handler.
 * A6 zapis: write_enabled → kolejka outbound → łatka xlsx → Graph PUT (D-1420).
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { isServiceRequest } from '../_shared/serviceAuth.ts';
import {
  downloadSharePointFile,
  hasSharePointSecrets,
  pickSharePointMode,
  type GraphEnv,
} from '../_shared/ksh/graph.ts';
import { parseWorkbookBytes, sha256Hex } from '../_shared/ksh/applyImport.ts';
import { shouldRaiseKshSourceDown } from '../_shared/ksh/sourceDown.ts';
import { shouldSkipUnchangedImport } from '../_shared/ksh/skipUnchanged.ts';
import { processOutboundWrites } from '../_shared/ksh/outboundWrite.ts';
import { supabaseStore } from '../_shared/integrations/store.ts';
import { sourceDownRisk } from '../_shared/integrations/sync.ts';

const JOB = 'ksh-sharepoint-sync';
const DEDUP_PREFIX = 'SOURCE_DOWN:KSH_SHAREPOINT';
/** Stały kod projektu KSH–Stegra (produkcja STEGRA_BODEN; seed/CI: STEGRA). */
const PROJECT_CODES = ['STEGRA_BODEN', 'STEGRA'] as const;

type SyncStateRow = {
  last_read_at?: string | null;
  import_enabled?: boolean | null;
  write_enabled?: boolean | null;
  write_test_ok_at?: string | null;
  source_ok?: boolean | null;
  last_error?: string | null;
  last_run?: {
    hash?: string;
    failed_hash?: string;
    dry_run?: boolean;
    first_error_at?: string;
    [k: string]: unknown;
  } | null;
};

Deno.serve(async (req: Request) => {
  try {
    return await handle(req);
  } catch {
    return Response.json(
      { job: JOB, mode: 'LIVE', ok: false, reason: 'handler_error' },
      { status: 502 },
    );
  }
});

async function handle(req: Request): Promise<Response> {
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  if (!service || !(await isServiceRequest(req, { url, service }))) {
    return new Response('forbidden', { status: 403 });
  }
  const sb = createClient(url, service, { auth: { persistSession: false } });
  const store = supabaseStore(sb);
  const env = Deno.env.toObject() as GraphEnv;
  const started = new Date().toISOString();

  if (!hasSharePointSecrets(env)) {
    const result = {
      job: JOB,
      mode: 'DEMO' as const,
      ok: true,
      reason: 'brak sekretów SHAREPOINT_* — nic nie pobrano',
    };
    const ins = await sb.from('integration_runs').insert({ job: JOB, ok: true, result });
    if (ins.error) {
      return Response.json({ ...result, ok: false, reason: 'integration_runs' }, { status: 502 });
    }
    return Response.json(result, { status: 200 });
  }

  let projectId: string | null = null;
  {
    const { data: projs, error: pe } = await sb
      .from('projects')
      .select('id, code')
      .in('code', [...PROJECT_CODES]);
    if (pe) {
      await insertRun(sb, false, { job: JOB, mode: 'LIVE', ok: false, reason: 'projects_query' });
      return Response.json({ ok: false, reason: 'projects_query' }, { status: 502 });
    }
    const rows = (projs ?? []) as { id: string; code: string }[];
    const preferred = rows.find((r) => r.code === 'STEGRA_BODEN') ?? rows[0];
    projectId = preferred?.id ?? null;
  }

  if (!projectId) {
    await insertRun(sb, false, { job: JOB, mode: 'LIVE', ok: false, reason: 'brak projektu STEGRA_BODEN' });
    return Response.json({ ok: false, reason: 'brak projektu STEGRA_BODEN' }, { status: 502 });
  }

  let prev: SyncStateRow | null = null;
  {
    const st = await sb
      .from('ksh_sync_state')
      .select('last_read_at, import_enabled, write_enabled, write_test_ok_at, last_run, source_ok, last_error')
      .eq('project_id', projectId)
      .maybeSingle();
    if (st.error) {
      const result = {
        job: JOB, mode: 'LIVE' as const, ok: false, reason: 'state_read_error',
      };
      await insertRun(sb, false, result);
      return Response.json(result, { status: 502 });
    }
    prev = (st.data as SyncStateRow | null) ?? null;
  }
  const prevReadAt = prev?.last_read_at ?? null;
  const importEnabled = prev?.import_enabled === true;
  const writeEnabled = prev?.write_enabled === true;
  const writeTestOkAt = prev?.write_test_ok_at ?? null;
  const fileMode = pickSharePointMode(env.SHAREPOINT_FILE_MODE);
  const prevHash = typeof prev?.last_run?.hash === 'string' ? prev.last_run.hash : null;
  const prevFirstErrorAt =
    typeof prev?.last_run?.first_error_at === 'string' ? prev.last_run.first_error_at : null;

  const maybeWrite = async (
    fileBytes: Uint8Array,
    fileSnapshot: Record<string, {
      ld: string | null;
      lt: string | null;
      dd: string | null;
      dt: string | null;
      co?: string | null;
      ho?: string | null;
    }>,
    eTag?: string | null,
  ) => {
    // F7 r2: zapis tylko przy write_enabled + import_enabled.
    if (!writeEnabled) return null;
    const res = await processOutboundWrites({
      sb,
      env,
      projectId,
      fileBytes,
      fileSnapshot,
      eTag,
      importEnabled,
      fileMode,
      writeTestOkAt,
    });
    if (res.mark_write_test_ok) {
      const okAt = await sb
        .from('ksh_sync_state')
        .update({ write_test_ok_at: new Date().toISOString() })
        .eq('project_id', projectId)
        .is('write_test_ok_at', null);
      if (okAt.error) {
        return {
          ...res,
          upload_ok: false,
          reason: 'write_test_ok_at',
          write_reason: 'write_test_ok_at',
        };
      }
    }
    return res;
  };

  const raiseDownIfDue = async (warnings: string[]) => {
    // Pierwsza awaria bez first_error_at: zegar startuje w last_run tego przebiegu.
    const clockStart = prevFirstErrorAt ?? started;
    if (!shouldRaiseKshSourceDown(prevReadAt, started, undefined, clockStart)) return;
    await store.raiseRisk(sourceDownRisk('KSH_SHAREPOINT', warnings, started));
  };

  const errorRunBase = (extra: Record<string, unknown> = {}) => ({
    ...extra,
    first_error_at: prevFirstErrorAt ?? started,
  });

  const upsertOk = async (args: {
    source_ok: boolean;
    last_read_at: string | null;
    last_run: Record<string, unknown> | null;
    last_error: string | null;
    snapshot?: unknown;
  }): Promise<boolean> => {
    const { error } = await sb.rpc('ksh_sync_state_upsert', {
      p_project: projectId,
      p_source_ok: args.source_ok,
      p_last_read_at: args.last_read_at,
      p_last_write_at: null,
      p_last_run: args.last_run,
      p_last_error: args.last_error,
      p_snapshot: args.snapshot ?? null,
    });
    return !error;
  };

  const dl = await downloadSharePointFile(env);
  if (!dl.ok) {
    const up = await upsertOk({
      source_ok: false,
      last_read_at: null,
      last_run: errorRunBase({
        mode: env.SHAREPOINT_FILE_MODE === 'test' ? 'test' : 'prod',
        download_ok: false,
      }),
      last_error: dl.reason.slice(0, 500),
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
    const runOk = await insertRun(sb, false, result);
    if (!up || !runOk) {
      return Response.json({ ...result, ok: false, reason: 'state_or_run' }, { status: 502 });
    }
    return Response.json(result, { status: 502 });
  }

  let parsed;
  try {
    parsed = await parseWorkbookBytes(dl.bytes);
  } catch (e) {
    const cls = e instanceof Error ? e.constructor.name : 'Error';
    const up = await upsertOk({
      source_ok: false,
      last_read_at: null,
      last_run: errorRunBase({
        bytes: dl.bytes.byteLength,
        mode: dl.mode,
        parse_ok: false,
        // F7 BLOKER: bez hash — ten sam plik nie maskuje się jako unchanged.
      }),
      last_error: `parse:${cls}`.slice(0, 500),
    });
    await raiseDownIfDue([`parse:${cls}`.slice(0, 120)]);
    const result = {
      job: JOB, mode: 'LIVE', ok: false, reason: `parse:${cls}`.slice(0, 120),
      observations: { bytes: String(dl.bytes.byteLength), mode: dl.mode },
    };
    const runOk = await insertRun(sb, false, result);
    if (!up || !runOk) {
      return Response.json({ ...result, ok: false, reason: 'state_or_run' }, { status: 502 });
    }
    return Response.json(result, { status: 502 });
  }

  const hash = await sha256Hex(dl.bytes);

  // Ten sam hash tylko po udanym przebiegu (F7 BLOKER — nie po failed_hash).
  const prevDryOnly = prev?.last_run?.dry_run === true;
  const skipImport = shouldSkipUnchangedImport({
    prevHash,
    hash,
    importEnabled,
    prevDryOnly,
    sourceOk: prev?.source_ok === true,
    lastError: prev?.last_error,
  });
  if (skipImport) {
    const writeRes = await maybeWrite(dl.bytes, parsed.snapshot, dl.meta.eTag);
    const lastRun = {
      ...(prev?.last_run && typeof prev.last_run === 'object' ? prev.last_run : {}),
      hash,
      bytes: dl.bytes.byteLength,
      mode: dl.mode,
      unchanged: true,
      import_enabled: importEnabled,
      dry_run: !importEnabled,
      write_enabled: writeEnabled,
      ...(writeRes ? {
        write_attempted: true,
        write_n: writeRes.written,
        write_conflicts: writeRes.conflicts,
        write_reason: writeRes.write_reason ?? writeRes.reason ?? null,
        upload_ok: writeRes.upload_ok,
      } : {}),
    };
    const up = await upsertOk({
      source_ok: true,
      last_read_at: started,
      last_run: lastRun,
      last_error: null,
      snapshot: writeRes?.snapshotPatch ?? undefined,
    });
    await store.resolveRisks(`${DEDUP_PREFIX}`);
    const result = {
      job: JOB, mode: 'LIVE', ok: true,
      reason: 'OK unchanged',
      observations: {
        bytes: String(dl.bytes.byteLength),
        mode: dl.mode,
        unchanged: 'true',
        import_enabled: importEnabled ? 'true' : 'false',
        write_enabled: writeEnabled ? 'true' : 'false',
        write_n: writeRes ? String(writeRes.written) : '0',
        write_conflicts: writeRes ? String(writeRes.conflicts) : '0',
        write_reason: writeRes?.write_reason ?? writeRes?.reason ?? '',
        upload_ok: writeRes?.upload_ok == null ? '' : String(writeRes.upload_ok),
      },
    };
    const runOk = await insertRun(sb, true, result);
    if (!up || !runOk) {
      return Response.json({ ...result, ok: false, reason: 'state_or_run' }, { status: 502 });
    }
    return Response.json(result, { status: 200 });
  }

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

  // import_enabled=false → tylko dry_run (F7 BLOKER 1); włącza właściciel po podglądzie.
  const dryRun = !importEnabled;

  const imp = await sb.rpc('import_schedule', {
    p_project: projectId,
    p_rows: parsed.rows,
    p_cancel_codes: [],
    p_file: fileMeta,
    p_dry_run: dryRun,
    p_quiet: false,
  });

  if (imp.error) {
    // Bez e.message — może nieść treść komórki / PII (F7).
    const errTag = `import:${imp.error.code || 'err'}`;
    const up = await upsertOk({
      source_ok: false,
      last_read_at: null,
      last_run: errorRunBase({
        bytes: dl.bytes.byteLength,
        mode: dl.mode,
        parse_ok: true,
        accepted: parsed.meta.accepted,
        // F7 BLOKER: failed_hash zamiast hash — następny przebieg nie skipuje.
        failed_hash: hash,
      }),
      last_error: errTag.slice(0, 500),
    });
    await raiseDownIfDue([errTag.slice(0, 120)]);
    const result = {
      job: JOB, mode: 'LIVE', ok: false, reason: errTag.slice(0, 120),
      observations: {
        bytes: String(dl.bytes.byteLength),
        accepted: String(parsed.meta.accepted),
        skipped_carrier: String(parsed.meta.skippedCarrier),
      },
    };
    const runOk = await insertRun(sb, false, result);
    if (!up || !runOk) {
      return Response.json({ ...result, ok: false, reason: 'state_or_run' }, { status: 502 });
    }
    return Response.json(result, { status: 502 });
  }

  const data = (imp.data ?? {}) as {
    added?: unknown[];
    changed?: unknown[];
    unchanged?: number;
    cancel_candidates?: unknown[];
    blocked?: unknown[];
    dates_check?: number;
  };
  const added = Array.isArray(data.added) ? data.added.length : 0;
  const changed = Array.isArray(data.changed) ? data.changed.length : 0;
  const cands = Array.isArray(data.cancel_candidates) ? data.cancel_candidates.length : 0;

  // #567 23B F7: podgląd tylko w dry_run; błąd niefatalny (nie source_ok/failed_hash/502).
  let previewError: string | null = null;
  if (dryRun) {
    const prevStore = await sb.rpc('ksh_sync_preview_store', {
      p_project: projectId,
      p_changed: Array.isArray(data.changed) ? data.changed : [],
      p_read_at: started,
      p_bytes: dl.bytes.byteLength,
      p_file_hash: hash,
      p_added: Array.isArray(data.added) ? data.added : [],
      p_cancel_candidates: Array.isArray(data.cancel_candidates) ? data.cancel_candidates : [],
      p_blocked: Array.isArray(data.blocked) ? data.blocked : [],
    });
    if (prevStore.error) {
      previewError = `preview:${prevStore.error.code || 'err'}`;
    }
  }

  await store.resolveRisks(`${DEDUP_PREFIX}`);

  const writeRes = await maybeWrite(dl.bytes, parsed.snapshot, dl.meta.eTag);

  const lastRun = {
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
    hash,
    dry_run: dryRun,
    import_enabled: importEnabled,
    write_enabled: writeEnabled,
    ...(previewError ? { preview_error: previewError.slice(0, 120) } : {}),
    ...(writeRes ? {
      write_attempted: true,
      write_n: writeRes.written,
      write_conflicts: writeRes.conflicts,
      write_reason: writeRes.write_reason ?? writeRes.reason ?? null,
      upload_ok: writeRes.upload_ok,
    } : {}),
    // Udany przebieg czyści zegar awarii.
  };

  const up = await upsertOk({
    source_ok: true,
    last_read_at: started,
    last_run: lastRun,
    last_error: null,
    snapshot: writeRes?.snapshotPatch ?? parsed.snapshot,
  });

  const result = {
    job: JOB, mode: 'LIVE', ok: true,
    reason: dryRun
      ? `OK dry_run: +${added} ~${changed} (HH ${parsed.meta.accepted}, NTG ${parsed.meta.skippedStandard})`
      : `OK import: +${added} ~${changed} (HH ${parsed.meta.accepted}, NTG ${parsed.meta.skippedStandard})`,
    observations: {
      bytes: String(dl.bytes.byteLength),
      mode: dl.mode,
      added: String(added),
      changed: String(changed),
      accepted: String(parsed.meta.accepted),
      skipped_carrier: String(parsed.meta.skippedCarrier),
      skipped_empty: String(parsed.meta.skippedEmpty),
      cancel_candidates: String(cands),
      dry_run: dryRun ? 'true' : 'false',
      import_enabled: importEnabled ? 'true' : 'false',
      write_enabled: writeEnabled ? 'true' : 'false',
      write_n: writeRes ? String(writeRes.written) : '0',
      write_conflicts: writeRes ? String(writeRes.conflicts) : '0',
      write_reason: writeRes?.write_reason ?? writeRes?.reason ?? '',
      upload_ok: writeRes?.upload_ok == null ? '' : String(writeRes.upload_ok),
    },
  };
  const runOk = await insertRun(sb, true, result);
  if (!up || !runOk) {
    return Response.json({ ...result, ok: false, reason: 'state_or_run' }, { status: 502 });
  }
  return Response.json(result, { status: 200 });
}

async function insertRun(
  sb: SupabaseClient,
  ok: boolean,
  result: Record<string, unknown>,
): Promise<boolean> {
  const { error } = await sb.from('integration_runs').insert({ job: JOB, ok, result });
  return !error;
}
