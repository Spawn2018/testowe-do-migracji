/**
 * A6 / #645 — kolejka WT→plik: konflikt + zapis komórka po komórce (Graph workbook).
 * Bez PUT całego .xlsx (423 przy współedycji). F7 #560 konflikt; #637 write bez importu;
 * #645: sesja workbook → GET komórki → PATCH; 429/503/504/423 = pending + backoff.
 */
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { GraphEnv } from './graph.ts';
import type { OutboundPatch } from './xlsxPatch.ts';
import {
  fileAlreadyHasPatch,
  missingExpectedFile,
  pickOutboundConflictNote,
  resolveOutboundExpected,
  type FileDateSnap,
} from './writeConflict.ts';
import { ackPayload } from './ackPayload.ts';
import { outboundWriteProdGate } from './outboundWriteGate.ts';
import { writePatchesViaWorkbook, type WorkbookPatch } from './workbookCellWrite.ts';
import { isOutboundTransientReason } from './outboundTransient.ts';

export {
  fileAlreadyHasPatch,
  pickOutboundConflictNote,
  resolveOutboundExpected,
} from './writeConflict.ts';
export { ackPayload } from './ackPayload.ts';
export { outboundWriteProdGate } from './outboundWriteGate.ts';
export {
  outboundTransientRetryDelayMinutes,
  outbound423RetryDelayMinutes,
  OUTBOUND_423_ERROR,
  isOutboundTransientReason,
} from './outboundTransient.ts';

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
  /** Zachowane dla wywołujących (odczyt cyklu); zapis #645 nie używa bajtów/PUT. */
  fileBytes?: Uint8Array;
  fileSnapshot: SnapshotMap;
  /** Nie wymagane przy workbook API (#645). */
  eTag?: string | null;
  /** Tryb pliku Graph. */
  fileMode?: 'test' | 'prod';
  /** F7 r2: prod dopiero po udanym teście. */
  writeTestOkAt?: string | null;
  fetchFn?: typeof fetch;
}): Promise<{
  attempted: boolean;
  written: number;
  conflicts: number;
  skipped: number;
  upload_ok: boolean | null;
  write_reason?: string;
  reason?: string;
  snapshotPatch?: SnapshotMap;
  /** Ustaw po udanym zapisie w trybie test. */
  mark_write_test_ok?: boolean;
}> {
  // #637: import_enabled nie blokuje (kolejka + write_enabled w index); prod wymaga write_test_ok_at.
  const gate = outboundWriteProdGate({
    fileMode: args.fileMode,
    writeTestOkAt: args.writeTestOkAt,
  });
  if (gate.block) {
    return {
      attempted: false, written: 0, conflicts: 0, skipped: 0,
      upload_ok: null, write_reason: gate.write_reason,
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

  const toWrite: OutboundItem[] = [];
  const alreadyDone: OutboundItem[] = [];
  const conflictItems: OutboundItem[] = [];
  const skipItems: OutboundItem[] = [];
  const skipReasons = new Map<number, string>();

  for (const it of items) {
    const codes = patchCodes(it);
    const expected = resolveOutboundExpected({
      fileMode: args.fileMode,
      expectedFile: it.expected_file,
      fileSnapshot: args.fileSnapshot,
      codes,
    });
    if (missingExpectedFile(expected)) {
      skipItems.push(it);
      skipReasons.set(Number(it.id), 'no_expected');
      continue;
    }

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
    // #569: p_code / pole sprawy = wiersz, w którym wykryto rozjazd (nie primary).
    // #637 (a): w test expected już z kopii — konflikt prod↔kopia nie blokuje próby.
    const conflictNote = pickOutboundConflictNote(
      remaining,
      expected!,
      args.fileSnapshot,
      it.patch as Record<string, unknown>,
    );
    if (conflictNote) {
      conflictItems.push(it);
      const rev = typeof it.rev === 'number' && it.rev >= 1 ? it.rev : 1;
      const note = await args.sb.rpc('l1b_note_file_changed', {
        p_project: args.projectId,
        p_load: it.load_id,
        p_code: conflictNote.code,
        p_field: conflictNote.field,
        p_rev: rev,
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
      const codesDone = patchCodes(it);
      const base = resolveOutboundExpected({
        fileMode: args.fileMode,
        expectedFile: it.expected_file,
        fileSnapshot: args.fileSnapshot,
        codes: codesDone,
      });
      for (const code of codesDone) {
        snapFromRecover[code] = applyPatchToSnap(
          asSnap(args.fileSnapshot[code]) ?? base,
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

  const patches: WorkbookPatch[] = [];
  const expectedByCode: Record<string, FileDateSnap | null | undefined> = {};
  for (const it of toWrite) {
    const codes = patchCodes(it);
    const expected = resolveOutboundExpected({
      fileMode: args.fileMode,
      expectedFile: it.expected_file,
      fileSnapshot: args.fileSnapshot,
      codes,
    });
    const itemKey = String(it.id);
    for (const code of codes) {
      patches.push({ code, ...it.patch, code, itemKey });
      expectedByCode[code] = expected;
    }
  }

  const wb = await writePatchesViaWorkbook({
    env: args.env,
    patches,
    expectedByCode,
    fetchFn: args.fetchFn,
  });

  /** R1: done tylko gdy wszystkie kody pozycji są w writtenCodes; upsert sprawdzany. */
  async function ackFullyWrittenItems(
    writtenCodes: string[],
  ): Promise<{ ok: boolean; snapshotPatch?: SnapshotMap; reason?: string }> {
    if (!writtenCodes.length) return { ok: true };
    const writtenSet = new Set(writtenCodes);
    const fullyDone = toWrite.filter((it) => {
      const codes = patchCodes(it);
      return codes.length > 0 && codes.every((c) => writtenSet.has(c));
    });
    if (!fullyDone.length) return { ok: true };
    const a = await ack(args.sb, ackPayload(fullyDone, true), 'done', null);
    if (!a.ok) return { ok: false, reason: 'ack_done' };
    const snapshotPatch: SnapshotMap = { ...args.fileSnapshot };
    for (const it of fullyDone) {
      for (const code of patchCodes(it)) {
        snapshotPatch[code] = applyPatchToSnap(snapshotPatch[code] ?? null, {
          code,
          ...it.patch,
        });
      }
    }
    const up = await args.sb.rpc('ksh_sync_state_upsert', {
      p_project: args.projectId,
      p_source_ok: true,
      p_last_read_at: null,
      p_last_write_at: new Date().toISOString(),
      p_last_run: null,
      p_last_error: null,
      p_snapshot: snapshotPatch,
    });
    if (up.error) return { ok: false, reason: 'state_upsert' };
    return { ok: true, snapshotPatch };
  }

  if (!wb.ok) {
    const partialCodes = wb.writtenCodes ?? [];
    // Pozycje z pełnym zapisem → done; reszta (w tym częściowy kod) → note_423 / failed.
    const fullyDone = toWrite.filter((it) => {
      const codes = patchCodes(it);
      return codes.length > 0 && codes.every((c) => partialCodes.includes(c));
    });
    const remaining = toWrite.filter((it) => !fullyDone.includes(it));

    if (fullyDone.length) {
      const part = await ackFullyWrittenItems(partialCodes);
      if (!part.ok) {
        return {
          attempted: true, written: fullyDone.length, conflicts: conflictItems.length,
          skipped: skipItems.length, upload_ok: true,
          reason: part.reason ?? 'ack_done', write_reason: part.reason ?? 'ack_done',
        };
      }
    }

    // B7: 401/403 → jedna sprawa HHL, bez 5 prób / bez note_423.
    if (wb.reason === 'workbook_auth_403') {
      const failReason = `workbook_auth_403 ${wb.permission ?? 'Files.ReadWrite (delegated)'}`;
      if (remaining.length) {
        const ackFail = await ack(args.sb, ackPayload(remaining, false), 'failed', failReason);
        if (!ackFail.ok) {
          return {
            attempted: true, written: partialCodes.length, conflicts: conflictItems.length,
            skipped: skipItems.length, upload_ok: partialCodes.length ? true : false,
            reason: 'ack_failed', write_reason: 'ack_failed',
          };
        }
        const first = remaining[0];
        const note = await args.sb.rpc('l1b_note_outbound_failed', {
          p_project: args.projectId,
          p_load: first.load_id,
          p_code: first.code,
          p_reason: failReason,
        });
        if (note.error) {
          return {
            attempted: true, written: partialCodes.length, conflicts: conflictItems.length,
            skipped: skipItems.length, upload_ok: partialCodes.length ? true : false,
            reason: 'note_outbound_failed', write_reason: 'note_outbound_failed',
          };
        }
      }
      return {
        attempted: true,
        written: partialCodes.length,
        conflicts: conflictItems.length,
        skipped: skipItems.length,
        upload_ok: partialCodes.length ? true : false,
        reason: wb.reason,
        write_reason: wb.reason,
      };
    }

    if (isOutboundTransientReason(wb.reason)) {
      if (remaining.length) {
        const note = await args.sb.rpc('ksh_sync_outbound_note_423', {
          p_acks: ackPayload(remaining, false),
        });
        if (note.error) {
          return {
            attempted: true, written: partialCodes.length, conflicts: conflictItems.length,
            skipped: skipItems.length, upload_ok: partialCodes.length ? true : false,
            reason: 'note_423', write_reason: 'note_423',
          };
        }
      }
      return {
        attempted: true,
        written: partialCodes.length,
        conflicts: conflictItems.length,
        skipped: skipItems.length,
        upload_ok: partialCodes.length ? true : false,
        reason: wb.reason,
        write_reason: wb.reason,
      };
    }
    const ackFail = await ack(
      args.sb,
      ackPayload(remaining.length ? remaining : toWrite, false),
      'failed',
      wb.reason,
    );
    if (!ackFail.ok) {
      return {
        attempted: true, written: partialCodes.length, conflicts: conflictItems.length,
        skipped: skipItems.length, upload_ok: false, reason: 'ack_failed', write_reason: 'ack_failed',
      };
    }
    for (const it of (remaining.length ? remaining : toWrite)) {
      const attempts = Number(it.attempts ?? 0) + 1;
      if (attempts >= 5) {
        const note = await args.sb.rpc('l1b_note_outbound_failed', {
          p_project: args.projectId,
          p_load: it.load_id,
          p_code: it.code,
          p_reason: wb.reason,
        });
        if (note.error) {
          return {
            attempted: true, written: partialCodes.length, conflicts: conflictItems.length,
            skipped: skipItems.length, upload_ok: false,
            reason: 'note_outbound_failed', write_reason: 'note_outbound_failed',
          };
        }
      }
    }
    return {
      attempted: true,
      written: partialCodes.length,
      conflicts: conflictItems.length,
      skipped: skipItems.length,
      upload_ok: partialCodes.length ? true : false,
      reason: wb.reason,
      write_reason: wb.reason,
    };
  }

  // Konflikty wykryte przy GET komórki (równoległa edycja od migawki).
  if (wb.conflicts.length) {
    const conflictCodes = new Set(wb.conflicts.map((c) => c.code));
    const cellConflictItems = toWrite.filter((it) =>
      patchCodes(it).some((c) => conflictCodes.has(c))
    );
    for (const it of cellConflictItems) {
      const hit = wb.conflicts.find((c) => patchCodes(it).includes(c.code));
      const rev = typeof it.rev === 'number' && it.rev >= 1 ? it.rev : 1;
      const note = await args.sb.rpc('l1b_note_file_changed', {
        p_project: args.projectId,
        p_load: it.load_id,
        p_code: hit?.code ?? it.code,
        p_field: hit?.field ?? 'carrier_order_no',
        p_rev: rev,
      });
      if (note.error) {
        return {
          attempted: true, written: 0, conflicts: 0, skipped: 0,
          upload_ok: false, reason: 'note_file_changed', write_reason: 'note_file_changed',
        };
      }
    }
    const ackCell = await ack(
      args.sb,
      ackPayload(cellConflictItems, false),
      'conflict',
      'file_changed',
    );
    if (!ackCell.ok) {
      return {
        attempted: true, written: 0, conflicts: 0, skipped: 0,
        upload_ok: false, reason: 'ack_conflict', write_reason: 'ack_conflict',
      };
    }
    conflictItems.push(...cellConflictItems);
  }

  const writtenSet = new Set(wb.writtenCodes);
  // R1: done tylko gdy wszystkie kody pozycji są w writtenCodes.
  const doneItems = toWrite.filter((it) => {
    const codes = patchCodes(it);
    return codes.length > 0
      && codes.every((c) => writtenSet.has(c))
      && !wb.conflicts.some((c) => codes.includes(c.code));
  });
  const skippedNoWrite = toWrite.filter((it) => {
    const codes = patchCodes(it);
    return !codes.every((c) => writtenSet.has(c))
      && !wb.conflicts.some((c) => codes.includes(c.code));
  });

  if (doneItems.length === 0 && skippedNoWrite.length) {
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
      upload_ok: alreadyDone.length ? true : null,
      write_reason: wb.conflicts.length ? 'conflict' : 'patch_no_cell',
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
        attempted: true, written: writtenSet.size, conflicts: conflictItems.length,
        skipped: skipItems.length, upload_ok: true,
        reason: 'ack_skipped', write_reason: 'ack_skipped',
      };
    }
  }

  if (doneItems.length) {
    const ackDone = await ack(args.sb, ackPayload(doneItems, true), 'done', null);
    if (!ackDone.ok) {
      return {
        attempted: true,
        written: writtenSet.size,
        conflicts: conflictItems.length,
        skipped: skipItems.length + skippedNoWrite.length,
        upload_ok: true,
        reason: 'ack_done',
        write_reason: 'ack_done',
      };
    }
  }

  const snapshotPatch: SnapshotMap = { ...args.fileSnapshot };
  for (const it of alreadyDone) {
    const codesDone = patchCodes(it);
    const base = resolveOutboundExpected({
      fileMode: args.fileMode,
      expectedFile: it.expected_file,
      fileSnapshot: args.fileSnapshot,
      codes: codesDone,
    });
    for (const code of codesDone) {
      snapshotPatch[code] = applyPatchToSnap(
        asSnap(args.fileSnapshot[code]) ?? base ?? snapshotPatch[code] ?? null,
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

  if (doneItems.length || alreadyDone.length) {
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
        written: writtenSet.size + alreadyDone.length,
        conflicts: conflictItems.length,
        skipped: skipItems.length + skippedNoWrite.length + wb.skipped,
        upload_ok: true,
        reason: 'state_upsert',
        write_reason: 'state_upsert',
        snapshotPatch,
      };
    }
    await args.sb.rpc('ksh_sync_outbound_clear_423', { p_project: args.projectId });
  }

  return {
    attempted: true,
    written: writtenSet.size + alreadyDone.length,
    conflicts: conflictItems.length,
    skipped: skipItems.length + skippedNoWrite.length + wb.skipped,
    upload_ok: doneItems.length || alreadyDone.length ? true : (wb.conflicts.length ? null : null),
    write_reason: doneItems.length || alreadyDone.length
      ? 'ok'
      : (wb.conflicts.length ? 'conflict' : 'nothing_to_write'),
    snapshotPatch: doneItems.length || alreadyDone.length ? snapshotPatch : undefined,
    mark_write_test_ok: args.fileMode === 'test' && (doneItems.length > 0),
  };
}
