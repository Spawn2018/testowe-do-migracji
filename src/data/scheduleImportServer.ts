/**
 * I-1 — import harmonogramu w trybie Supabase (chunk leniwy, paczka demo go nie zawiera).
 * Podgląd = import_schedule(dry_run=true) — bez zapisu. Zatwierdzenie: plik źródłowy do prywatnego
 * koszyka „harmonogramy” (archiwum, SCOPE 3.6), potem import_schedule(dry_run=false) — jedna transakcja.
 */
import { getSupabase } from '../auth/client';
import { COLUMN_MAP_DEFAULT, parseSchedule } from '../lib/scheduleParse';
import { readXlsxRows } from '../lib/xlsxRead';
import { rpcToDiff, sha256Hex, toRpcRows, type ImportRpcResult, type ParseMeta, type RpcRow } from '../lib/scheduleImportRpc';
import type { ImportDiff } from '../lib/scheduleDryRun';

const PROJECT_CODE = 'STEGRA_BODEN';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface ServerImportDraft {
  diff: ImportDiff;
  preview: ImportRpcResult;
  rows: RpcRow[];
  meta: ParseMeta;
  hash: string;
  buf: ArrayBuffer;
  projectId: string;
}

async function projectId(): Promise<string> {
  const sb = await getSupabase();
  const r = await sb.from('projects').select('id').eq('code', PROJECT_CODE).maybeSingle();
  if (r.error) throw new Error(r.error.message);
  if (!r.data) throw new Error('Brak projektu w bazie');
  return (r.data as { id: string }).id;
}

async function call(pid: string, rows: RpcRow[], cancel: string[], file: Record<string, unknown>, dryRun: boolean): Promise<ImportRpcResult> {
  const sb = await getSupabase();
  const r = await sb.rpc('import_schedule', { p_project: pid, p_rows: rows, p_cancel_codes: cancel, p_file: file, p_dry_run: dryRun });
  if (r.error) throw new Error(r.error.message);
  return r.data as ImportRpcResult;
}

export async function serverDryRun(buf: ArrayBuffer, filename: string): Promise<ServerImportDraft> {
  const parsed = parseSchedule(await readXlsxRows(buf));
  const meta: ParseMeta = {
    filename,
    accepted: parsed.stats.accepted,
    total: parsed.stats.total,
    rejected: parsed.stats.rejected,
    warnings: parsed.stats.warnings,
    issues: parsed.issues.filter((i) => i.severity === 'ERROR').slice(0, 12)
      .map((i) => ({ code: i.code, message: i.message, shipmentCode: i.shipmentCode })),
  };
  const rows = toRpcRows(parsed.rows);
  const [pid, hash] = await Promise.all([projectId(), sha256Hex(buf)]);
  const preview = await call(pid, rows, [], { name: filename }, true);
  return { diff: rpcToDiff(preview, meta), preview, rows, meta, hash, buf, projectId: pid };
}

/** overwriteCodes — I-18: kody, dla których HHL świadomie nadpisuje daty potwierdzone przez KSH (osobna zgoda). */
export async function serverCommit(d: ServerImportDraft, cancelCodes: string[], overwriteCodes: string[] = []): Promise<ImportRpcResult> {
  if (d.meta.accepted === 0) throw new Error('Plik bez poprawnych wierszy — nic nie zapisano');
  const sb = await getSupabase();
  const path = `${d.projectId}/${d.hash}.xlsx`;
  const up = await sb.storage.from('harmonogramy').upload(path, new Blob([d.buf], { type: XLSX_MIME }), { contentType: XLSX_MIME, upsert: false });
  if (up.error && !/exists|duplicate/i.test(up.error.message)) throw new Error(`Archiwum pliku: ${up.error.message}`);
  return call(d.projectId, d.rows, cancelCodes, {
    name: d.meta.filename, hash: d.hash, path: `harmonogramy/${path}`,
    column_map: COLUMN_MAP_DEFAULT, rejected: d.meta.rejected,
    ...(overwriteCodes.length ? { overwrite_confirmed: overwriteCodes } : {}),
  }, false);
}
