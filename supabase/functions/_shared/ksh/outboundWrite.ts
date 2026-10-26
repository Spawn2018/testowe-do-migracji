/**
 * A6 — przetworzenie kolejki WT→plik: konflikt / łatka JSZip / upload Graph + If-Match.
 * F7 #560 / r2: no_etag; konflikt per kod; PUT zgubiony→ack; sprawdzaj ack/l1b;
 * import_enabled + write_test_ok_at (prod).
 * F7 r3 N4: ack(id, rev, sent) — schedule_row z sent; rozjazd rev → pending.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import JSZip from 'npm:jszip@3';
import { uploadSharePointFile, type GraphEnv } from './graph.ts';
import { patchWorkbookBytes, type OutboundPatch } from './xlsxPatch.ts';
import {
  fileAlreadyHasPatch,
  fileRowChangedSinceRead,
  missingExpectedFile,
  type FileDateSnap,
} from './writeConflict.ts';

export { fileAlreadyHasPatch } from './writeConflict.ts';

export type OutboundItem = {
  id: number;
  load_id: string;
  code: string;
  codes?: string[];
  patch: OutboundPatch & Record<string, unknown>;
  expected_file?: FileDateSnap | null;
  attempts?: number;
  rev?: number;
};

export type SnapshotMap = Record<string, FileDateSnap>;

type AckItem = { id: number; rev: number; sent?: Record<string, unknown> | null };

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

function ackPayload(
  items: OutboundItem[],
  withSent: boolean,
): AckItem[] {
  return items.map((it) => ({
    id: Number(it.id),
    rev: Number(it.rev ?? 1),
    ...(withSent ? { sent: { ...it.patch } } : {}),
  }));
}

async function ack(
  sb: SupabaseClient,
  items: AckItem[],
  status: 'done' | 'conflict' | 'skipped' | 'failed',
  error: string | null,
): Promise<{ ok: boolean }> {
  if (!items.length) return { ok: true };
  const { error: err } = await sb.rpc('ksh_sync_outbound_ack', {
    p_acks: items,
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
  fileSnapshot: SnapshotMap;
  eTag?: string | null;
  /** F7 r2: zapis tylko przy włączonym imporcie. */
  importEnabled?: boolean;
  /** Tryb pliku Graph. */
  fileMode?: 'test' | 'prod';
  /** F7 r2: prod dopiero po udanym teście. */
  writeTestOkAt?: string | null;
}): Promise<{
  attempted: boolean;
  written: number;
  conflicts: number;
  skipped: number;
  upload_ok: boolean | null;
  write_reason?: string;
  reason?: string;
  snapshotPatch?: SnapshotMap;
  /** Ustaw po udanym PUT w trybie test. */
  mark_write_test_ok?: boolean;
}> {
  if (args.importEnabled !== true) {
    return {
      attempted: false, written: 0, conflicts: 0, skipped: 0,
      upload_ok: null, write_reason: 'import_disabled',
    };
  }
  if (args.fileMode === 'prod' && !args.writeTestOkAt) {
    return {
      attempted: false, written: 0, conflicts: 0, skipped: 0,
      upload_ok: null, write_reason: 'write_test_required',
    };
  }

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

  // F7 r2 BLOKER 3: brak eTag → bez PUT.
  if (!args.eTag?.trim()) {
    return {
      attempted: true, written: 0, conflicts: 0, skipped: 0,
      upload_ok: false, reason: 'no_etag', write_reason: 'no_etag',
    };
  }

  const toWrite: OutboundItem[] = [];
  const alreadyDone: OutboundItem[] = [];
  const conflictItems: OutboundItem[] = [];
  const skipItems: OutboundItem[] = [];
  const skipReasons = new Map<number, string>();

  for (const it of items) {
    const expected = asSnap(it.expected_file);
    if (missingExpectedFile(expected)) {
      skipItems.push(it);
      skipReasons.set(Number(it.id), 'no_expected');
      continue;
    }
    const codes = patchCodes(it);
    const primary = codes[0] ?? it.code;

    // F7 r2 / r2b: PUT zgubiony lub częściowa łatka — pomiń kody już w pliku.
    const remaining = codes.filter((code) =>
      !fileAlreadyHasPatch(expected!, { code, ...it.patch }, args.fileSnapshot[code] ?? null)
    );
    if (codes.length > 0 && remaining.length === 0) {
      alreadyDone.push(it);
      continue;
    }

    const anyCodeInFile = (remaining.length ? remaining : codes).some((c) => args.fileSnapshot[c]);
    if (!anyCodeInFile) {
      skipItems.push(it);
      skipReasons.set(Number(it.id), 'KSH_ROW_GONE');
      continue;
    }

    // F7 r2 UWAGA: konflikt tylko dla kodów jeszcze nie zastosowanych.
    let conflict = false;
    for (const code of remaining) {
      const current = args.fileSnapshot[code] ?? null;
      if (fileRowChangedSinceRead(expected, current)) {
        conflict = true;
        break;
      }
    }
    if (conflict) {
      conflictItems.push(it);
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
    toWrite.push({ ...it, codes: remaining.length ? remaining : codes });
  }

  if (alreadyDone.length) {
    const a = await ack(args.sb, ackPayload(alreadyDone, true), 'done', null);
    if (!a.ok) {
      return {
        attempted: true, written: 0, conflicts: 0, skipped: 0,
        upload_ok: false, reason: 'ack_done_recover', write_reason: 'ack_done_recover',
      };
    }
  }

  const ackConflict = await ack(
    args.sb,
    ackPayload(conflictItems, false),
    'conflict',
    'file_changed',
  );
  if (!ackConflict.ok) {
    return {
      attempted: true, written: 0, conflicts: 0, skipped: 0,
      upload_ok: false, reason: 'ack_conflict', write_reason: 'ack_conflict',
    };
  }
  if (skipItems.length) {
    const byReason = new Map<string, OutboundItem[]>();
    for (const it of skipItems) {
      const r = skipReasons.get(Number(it.id)) ?? 'no_row';
      if (!byReason.has(r)) byReason.set(r, []);
      byReason.get(r)!.push(it);
    }
    for (const [reason, group] of byReason) {
      const a = await ack(args.sb, ackPayload(group, false), 'skipped', reason);
      if (!a.ok) {
        return {
          attempted: true, written: 0, conflicts: conflictItems.length, skipped: 0,
          upload_ok: false, reason: 'ack_skipped', write_reason: 'ack_skipped',
        };
      }
    }
  }

  if (toWrite.length === 0) {
    const snapFromRecover: SnapshotMap = { ...args.fileSnapshot };
    for (const it of alreadyDone) {
      for (const code of patchCodes(it)) {
        snapFromRecover[code] = applyPatchToSnap(
          asSnap(it.expected_file),
          { code, ...it.patch },
        );
      }
    }
    return {
      attempted: true,
      written: alreadyDone.length,
      conflicts: conflictItems.length,
      skipped: skipItems.length,
      upload_ok: alreadyDone.length ? true : null,
      write_reason: alreadyDone.length
        ? 'recovered_ack'
        : (conflictItems.length ? 'conflict' : 'nothing_to_write'),
      snapshotPatch: alreadyDone.length ? snapFromRecover : undefined,
    };
  }

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
      conflicts: conflictItems.length,
      skipped: skipItems.length + toWrite.length,
      upload_ok: false,
      reason: patched.reason,
      write_reason: patched.reason,
    };
  }

  const writtenSet = new Set(patched.writtenCodes);
  const doneItems = toWrite.filter((it) => patchCodes(it).some((c) => writtenSet.has(c)));
  const skippedNoWrite = toWrite.filter((it) => !patchCodes(it).some((c) => writtenSet.has(c)));

  if (doneItems.length === 0) {
    const a = await ack(
      args.sb,
      ackPayload(skippedNoWrite, false),
      'skipped',
      'patch_no_cell',
    );
    if (!a.ok) {
      return {
        attempted: true, written: 0, conflicts: conflictItems.length,
        skipped: skipItems.length, upload_ok: false,
        reason: 'ack_skipped', write_reason: 'ack_skipped',
      };
    }
    return {
      attempted: true,
      written: alreadyDone.length,
      conflicts: conflictItems.length,
      skipped: skipItems.length + skippedNoWrite.length,
      upload_ok: null,
      write_reason: 'patch_no_cell',
    };
  }

  const up = await uploadSharePointFile(args.env, patched.bytes, fetch, {
    ifMatch: args.eTag,
  });
  if (!up.ok) {
    if (up.reason === 'etag_mismatch' || up.reason === 'no_etag') {
      return {
        attempted: true,
        written: 0,
        conflicts: conflictItems.length,
        skipped: skipItems.length,
        upload_ok: false,
        reason: up.reason,
        write_reason: up.reason,
      };
    }
    // 423 = plik otwarty: normalne ponowienie; failed dopiero po 5 (ack failed liczy attempts).
    const ackFail = await ack(
      args.sb,
      ackPayload(doneItems, false),
      'failed',
      up.reason,
    );
    if (!ackFail.ok) {
      return {
        attempted: true, written: 0, conflicts: conflictItems.length, skipped: skipItems.length,
        upload_ok: false, reason: 'ack_failed', write_reason: 'ack_failed',
      };
    }
    for (const it of doneItems) {
      const attempts = Number(it.attempts ?? 0) + 1;
      if (attempts >= 5) {
        const note = await args.sb.rpc('l1b_note_outbound_failed', {
          p_project: args.projectId,
          p_load: it.load_id,
          p_code: it.code,
          p_reason: up.reason,
        });
        if (note.error) {
          return {
            attempted: true, written: 0, conflicts: conflictItems.length, skipped: skipItems.length,
            upload_ok: false, reason: 'note_outbound_failed', write_reason: 'note_outbound_failed',
          };
        }
      }
    }
    return {
      attempted: true,
      written: 0,
      conflicts: conflictItems.length,
      skipped: skipItems.length,
      upload_ok: false,
      reason: up.reason,
      write_reason: up.reason,
    };
  }

  if (skippedNoWrite.length) {
    const a = await ack(
      args.sb,
      ackPayload(skippedNoWrite, false),
      'skipped',
      'patch_no_cell',
    );
    if (!a.ok) {
      return {
        attempted: true, written: patched.written, conflicts: conflictItems.length,
        skipped: skipItems.length, upload_ok: true,
        reason: 'ack_skipped', write_reason: 'ack_skipped',
      };
    }
  }

  const ackDone = await ack(args.sb, ackPayload(doneItems, true), 'done', null);
  if (!ackDone.ok) {
    return {
      attempted: true,
      written: patched.written,
      conflicts: conflictItems.length,
      skipped: skipItems.length + skippedNoWrite.length,
      upload_ok: true,
      reason: 'ack_done',
      write_reason: 'ack_done',
    };
  }

  const snapshotPatch: SnapshotMap = { ...args.fileSnapshot };
  for (const it of alreadyDone) {
    for (const code of patchCodes(it)) {
      snapshotPatch[code] = applyPatchToSnap(
        asSnap(it.expected_file) ?? snapshotPatch[code] ?? null,
        { code, ...it.patch },
      );
    }
  }
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
      conflicts: conflictItems.length,
      skipped: skipItems.length + skippedNoWrite.length,
      upload_ok: true,
      reason: 'state_upsert',
      write_reason: 'state_upsert',
      snapshotPatch,
    };
  }

  return {
    attempted: true,
    written: patched.written + alreadyDone.length,
    conflicts: conflictItems.length,
    skipped: skipItems.length + skippedNoWrite.length + patched.skipped,
    upload_ok: true,
    write_reason: 'ok',
    snapshotPatch,
    mark_write_test_ok: args.fileMode === 'test',
  };
}
