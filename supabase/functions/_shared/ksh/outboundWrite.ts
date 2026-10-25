/**
 * A6 — przetworzenie kolejki WT→plik: konflikt / łatka JSZip / upload Graph + If-Match.
 * F7 #560: etag_mismatch→pending; brak expected→skip; numery w konflikcie; attempts;
 * done tylko dla zapisanych kodów; snapshot po PUT.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import JSZip from 'npm:jszip@3';
import { uploadSharePointFile, type GraphEnv } from './graph.ts';
import { patchWorkbookBytes, type OutboundPatch } from './xlsxPatch.ts';
import {
  fileRowChangedSinceRead,
  missingExpectedFile,
  type FileDateSnap,
} from './writeConflict.ts';

export type OutboundItem = {
  id: number;
  load_id: string;
  code: string;
  codes?: string[];
  patch: OutboundPatch & Record<string, unknown>;
  expected_file?: FileDateSnap | null;
  attempts?: number;
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
    co: typeof o.co === 'string' ? o.co : o.co == null ? null : String(o.co),
    ho: typeof o.ho === 'string' ? o.ho : o.ho == null ? null : String(o.ho),
  };
}

function patchCodes(it: OutboundItem): string[] {
  if (Array.isArray(it.codes) && it.codes.length) {
    return it.codes.map(String).filter(Boolean);
  }
  return it.code ? [it.code] : [];
}

function applyPatchToSnap(base: FileDateSnap | null, patch: OutboundPatch): FileDateSnap {
  const next: FileDateSnap = {
    ld: base?.ld ?? null,
    lt: base?.lt ?? null,
    dd: base?.dd ?? null,
    dt: base?.dt ?? null,
    co: base?.co ?? null,
    ho: base?.ho ?? null,
  };
  if ('load_date' in patch && patch.load_date != null) next.ld = String(patch.load_date);
  if ('load_time' in patch && patch.load_time != null) next.lt = String(patch.load_time);
  if ('delivery_date' in patch && patch.delivery_date != null) next.dd = String(patch.delivery_date);
  if ('delivery_time' in patch && patch.delivery_time != null) next.dt = String(patch.delivery_time);
  if ('carrier_order_no' in patch && patch.carrier_order_no != null) {
    next.co = String(patch.carrier_order_no);
  }
  if ('hhl_order_no' in patch && patch.hhl_order_no != null) {
    next.ho = String(patch.hhl_order_no);
  }
  return next;
}

async function ack(
  sb: SupabaseClient,
  ids: number[],
  status: 'done' | 'conflict' | 'skipped' | 'failed',
  error: string | null,
): Promise<{ ok: boolean }> {
  if (!ids.length) return { ok: true };
  const { error: err } = await sb.rpc('ksh_sync_outbound_ack', {
    p_ids: ids,
    p_status: status,
    p_error: error,
  });
  return { ok: !err };
}

export async function processOutboundWrites(args: {
  sb: SupabaseClient;
  env: GraphEnv;
  projectId: string;
  fileBytes: Uint8Array;
  /** Bieżąca migawka z właśnie sparsowanego pliku. */
  fileSnapshot: SnapshotMap;
  /** eTag z odczytu driveItem (If-Match). */
  eTag?: string | null;
}): Promise<{
  attempted: boolean;
  written: number;
  conflicts: number;
  skipped: number;
  upload_ok: boolean | null;
  write_reason?: string;
  reason?: string;
  /** Zaktualizowana migawka po udanym PUT (do upsert stanu). */
  snapshotPatch?: SnapshotMap;
}> {
  const list = await args.sb.rpc('ksh_sync_outbound_list', {
    p_project: args.projectId,
    p_limit: 50,
  });
  if (list.error) {
    return {
      attempted: true, written: 0, conflicts: 0, skipped: 0,
      upload_ok: false, reason: 'outbound_list', write_reason: 'outbound_list',
    };
  }
  const items = (Array.isArray(list.data) ? list.data : []) as OutboundItem[];
  if (items.length === 0) {
    return { attempted: false, written: 0, conflicts: 0, skipped: 0, upload_ok: null };
  }

  const toWrite: OutboundItem[] = [];
  const conflictIds: number[] = [];
  const skipIds: number[] = [];
  const skipReasons = new Map<number, string>();

  for (const it of items) {
    const expected = asSnap(it.expected_file);
    // F7: brak expected → nie zapisuj
    if (missingExpectedFile(expected)) {
      skipIds.push(Number(it.id));
      skipReasons.set(Number(it.id), 'no_expected');
      continue;
    }
    const codes = patchCodes(it);
    const primary = codes[0] ?? it.code;
    const current = args.fileSnapshot[primary] ?? null;
    // Brak wiersza przy istniejącym expected → KSH_ROW_GONE (nie „Plik zmieniony”)
    if (!current && !args.fileSnapshot[primary]) {
      const anyCodeInFile = codes.some((c) => args.fileSnapshot[c]);
      if (!anyCodeInFile) {
        skipIds.push(Number(it.id));
        skipReasons.set(Number(it.id), 'KSH_ROW_GONE');
        continue;
      }
    }
    if (fileRowChangedSinceRead(expected, current ?? args.fileSnapshot[primary] ?? null)) {
      conflictIds.push(Number(it.id));
      const note = await args.sb.rpc('l1b_note_file_changed', {
        p_project: args.projectId,
        p_load: it.load_id,
        p_code: primary,
      });
      if (note.error) {
        return {
          attempted: true, written: 0, conflicts: 0, skipped: 0,
          upload_ok: false, reason: 'note_file_changed', write_reason: 'note_file_changed',
        };
      }
      continue;
    }
    toWrite.push(it);
  }

  const ackConflict = await ack(args.sb, conflictIds, 'conflict', 'file_changed');
  if (!ackConflict.ok) {
    return {
      attempted: true, written: 0, conflicts: 0, skipped: 0,
      upload_ok: false, reason: 'ack_conflict', write_reason: 'ack_conflict',
    };
  }
  if (skipIds.length) {
    // Grupuj po powodzie
    const byReason = new Map<string, number[]>();
    for (const id of skipIds) {
      const r = skipReasons.get(id) ?? 'no_row';
      if (!byReason.has(r)) byReason.set(r, []);
      byReason.get(r)!.push(id);
    }
    for (const [reason, ids] of byReason) {
      const a = await ack(args.sb, ids, 'skipped', reason);
      if (!a.ok) {
        return {
          attempted: true, written: 0, conflicts: conflictIds.length, skipped: 0,
          upload_ok: false, reason: 'ack_skipped', write_reason: 'ack_skipped',
        };
      }
    }
  }

  if (toWrite.length === 0) {
    return {
      attempted: true,
      written: 0,
      conflicts: conflictIds.length,
      skipped: skipIds.length,
      upload_ok: null,
      write_reason: conflictIds.length ? 'conflict' : 'nothing_to_write',
    };
  }

  // Wszystkie kody transportu (F7).
  const patches: OutboundPatch[] = [];
  for (const it of toWrite) {
    for (const code of patchCodes(it)) {
      patches.push({ code, ...it.patch, code } as OutboundPatch);
    }
  }
  const patched = await patchWorkbookBytes(
    args.fileBytes,
    patches,
    (b) => JSZip.loadAsync(b) as Promise<import('./xlsxPatch.ts').ZipLike>,
  );
  if (!patched.ok) {
    return {
      attempted: true,
      written: 0,
      conflicts: conflictIds.length,
      skipped: skipIds.length + toWrite.length,
      upload_ok: false,
      reason: patched.reason,
      write_reason: patched.reason,
    };
  }

  const writtenSet = new Set(patched.writtenCodes);
  const doneItems = toWrite.filter((it) => patchCodes(it).some((c) => writtenSet.has(c)));
  const skippedNoWrite = toWrite.filter((it) => !patchCodes(it).some((c) => writtenSet.has(c)));

  if (doneItems.length === 0) {
    await ack(
      args.sb,
      skippedNoWrite.map((it) => Number(it.id)),
      'skipped',
      'patch_no_cell',
    );
    return {
      attempted: true,
      written: 0,
      conflicts: conflictIds.length,
      skipped: skipIds.length + skippedNoWrite.length,
      upload_ok: null,
      write_reason: 'patch_no_cell',
    };
  }

  const up = await uploadSharePointFile(args.env, patched.bytes, fetch, {
    ifMatch: args.eTag,
  });
  if (!up.ok) {
    if (up.reason === 'etag_mismatch') {
      // F7 BLOKER 1: zostaje pending, bez sprawy; następny przebieg pobierze plik.
      return {
        attempted: true,
        written: 0,
        conflicts: conflictIds.length,
        skipped: skipIds.length,
        upload_ok: false,
        reason: 'etag_mismatch',
        write_reason: 'etag_mismatch',
      };
    }
    // Próby → failed po 5.
    const failIds = doneItems.map((it) => Number(it.id));
    await ack(args.sb, failIds, 'failed', up.reason);
    for (const it of doneItems) {
      const attempts = Number(it.attempts ?? 0) + 1;
      if (attempts >= 5) {
        await args.sb.rpc('l1b_note_outbound_failed', {
          p_project: args.projectId,
          p_load: it.load_id,
          p_code: it.code,
          p_reason: up.reason,
        });
      }
    }
    return {
      attempted: true,
      written: 0,
      conflicts: conflictIds.length,
      skipped: skipIds.length,
      upload_ok: false,
      reason: up.reason,
      write_reason: up.reason,
    };
  }

  if (skippedNoWrite.length) {
    await ack(
      args.sb,
      skippedNoWrite.map((it) => Number(it.id)),
      'skipped',
      'patch_no_cell',
    );
  }

  const doneIds = doneItems.map((it) => Number(it.id));
  const ackDone = await ack(args.sb, doneIds, 'done', null);
  if (!ackDone.ok) {
    return {
      attempted: true,
      written: patched.written,
      conflicts: conflictIds.length,
      skipped: skipIds.length + skippedNoWrite.length,
      upload_ok: true,
      reason: 'ack_done',
      write_reason: 'ack_done',
    };
  }

  // Fałszywy konflikt przy 2. edycji: nadpisz snapshot wartościami z łatki.
  const snapshotPatch: SnapshotMap = { ...args.fileSnapshot };
  for (const it of doneItems) {
    for (const code of patchCodes(it)) {
      if (!writtenSet.has(code)) continue;
      snapshotPatch[code] = applyPatchToSnap(snapshotPatch[code] ?? null, {
        code,
        ...it.patch,
      });
    }
  }

  const upState = await args.sb.rpc('ksh_sync_state_upsert', {
    p_project: args.projectId,
    p_source_ok: true,
    p_last_read_at: null,
    p_last_write_at: new Date().toISOString(),
    p_last_run: null,
    p_last_error: null,
    p_snapshot: snapshotPatch,
  });
  if (upState.error) {
    return {
      attempted: true,
      written: patched.written,
      conflicts: conflictIds.length,
      skipped: skipIds.length + skippedNoWrite.length,
      upload_ok: true,
      reason: 'state_upsert',
      write_reason: 'state_upsert',
      snapshotPatch,
    };
  }

  return {
    attempted: true,
    written: patched.written,
    conflicts: conflictIds.length,
    skipped: skipIds.length + skippedNoWrite.length + patched.skipped,
    upload_ok: true,
    write_reason: 'ok',
    snapshotPatch,
  };
}
