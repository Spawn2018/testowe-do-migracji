/**
 * A6 — przetworzenie kolejki WT→plik: konflikt / łatka / upload Graph.
 * Liczby w wyniku; bez kodów w logach wywołującego (opcjonalnie w observations).
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { uploadSharePointFile, type GraphEnv } from './graph.ts';
import { patchWorkbookBytes, type OutboundPatch } from './xlsxPatch.ts';
import { fileRowChangedSinceRead, type FileDateSnap } from './writeConflict.ts';

export type OutboundItem = {
  id: number;
  load_id: string;
  code: string;
  patch: OutboundPatch & Record<string, unknown>;
  expected_file?: FileDateSnap | null;
};

export type SnapshotMap = Record<string, FileDateSnap>;

function asSnap(v: unknown): FileDateSnap | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  return {
    ld: typeof o.ld === 'string' ? o.ld : o.ld == null ? null : String(o.ld),
    lt: typeof o.lt === 'string' ? o.lt : o.lt == null ? null : String(o.lt),
    dd: typeof o.dd === 'string' ? o.dd : o.dd == null ? null : String(o.dd),
    dt: typeof o.dt === 'string' ? o.dt : o.dt == null ? null : String(o.dt),
  };
}

export async function processOutboundWrites(args: {
  sb: SupabaseClient;
  env: GraphEnv;
  projectId: string;
  fileBytes: Uint8Array;
  /** Bieżąca migawka z właśnie sparsowanego pliku. */
  fileSnapshot: SnapshotMap;
}): Promise<{
  attempted: boolean;
  written: number;
  conflicts: number;
  skipped: number;
  upload_ok: boolean | null;
  reason?: string;
}> {
  const list = await args.sb.rpc('ksh_sync_outbound_list', {
    p_project: args.projectId,
    p_limit: 50,
  });
  if (list.error) {
    return {
      attempted: true, written: 0, conflicts: 0, skipped: 0,
      upload_ok: false, reason: 'outbound_list',
    };
  }
  const items = (Array.isArray(list.data) ? list.data : []) as OutboundItem[];
  if (items.length === 0) {
    return { attempted: false, written: 0, conflicts: 0, skipped: 0, upload_ok: null };
  }

  const toWrite: OutboundItem[] = [];
  const conflictIds: number[] = [];
  const skipIds: number[] = [];

  for (const it of items) {
    const expected = asSnap(it.expected_file);
    const current = args.fileSnapshot[it.code] ?? null;
    if (fileRowChangedSinceRead(expected, current)) {
      conflictIds.push(Number(it.id));
      await args.sb.rpc('l1b_note_file_changed', {
        p_project: args.projectId,
        p_load: it.load_id,
        p_code: it.code,
      });
      continue;
    }
    if (!args.fileSnapshot[it.code] && !current) {
      // Brak wiersza w pliku — nie twórz; KSH_ROW_GONE z importu.
      skipIds.push(Number(it.id));
      continue;
    }
    toWrite.push(it);
  }

  if (conflictIds.length) {
    await args.sb.rpc('ksh_sync_outbound_ack', {
      p_ids: conflictIds,
      p_status: 'conflict',
      p_error: 'file_changed',
    });
  }
  if (skipIds.length) {
    await args.sb.rpc('ksh_sync_outbound_ack', {
      p_ids: skipIds,
      p_status: 'skipped',
      p_error: 'no_row',
    });
  }

  if (toWrite.length === 0) {
    return {
      attempted: true,
      written: 0,
      conflicts: conflictIds.length,
      skipped: skipIds.length,
      upload_ok: null,
    };
  }

  const patches: OutboundPatch[] = toWrite.map((it) => ({
    code: it.code,
    ...it.patch,
  }));
  const patched = await patchWorkbookBytes(args.fileBytes, patches);
  if (!patched.ok) {
    return {
      attempted: true,
      written: 0,
      conflicts: conflictIds.length,
      skipped: skipIds.length + toWrite.length,
      upload_ok: false,
      reason: patched.reason,
    };
  }

  const up = await uploadSharePointFile(args.env, patched.bytes);
  if (!up.ok) {
    return {
      attempted: true,
      written: 0,
      conflicts: conflictIds.length,
      skipped: skipIds.length,
      upload_ok: false,
      reason: up.reason,
    };
  }

  const doneIds = toWrite.map((it) => Number(it.id));
  await args.sb.rpc('ksh_sync_outbound_ack', {
    p_ids: doneIds,
    p_status: 'done',
    p_error: null,
  });

  await args.sb.rpc('ksh_sync_state_upsert', {
    p_project: args.projectId,
    p_source_ok: true,
    p_last_read_at: null,
    p_last_write_at: new Date().toISOString(),
    p_last_run: null,
    p_last_error: null,
    p_snapshot: null,
  });

  return {
    attempted: true,
    written: patched.written,
    conflicts: conflictIds.length,
    skipped: skipIds.length + patched.skipped,
    upload_ok: true,
  };
}
