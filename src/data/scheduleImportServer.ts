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
import type { ImportTemplate, PartialColumnMap } from '../lib/importMapping';
import { toFullMap } from '../lib/importMapping';

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
  /** I-22: mapowanie kolumn użyte przy odczycie (brak = układ domyślny KSH). */
  map?: PartialColumnMap;
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

export async function serverDryRun(buf: ArrayBuffer, filename: string, map?: PartialColumnMap): Promise<ServerImportDraft> {
  const parsed = map ? parseSchedule(await readXlsxRows(buf), toFullMap(map)) : parseSchedule(await readXlsxRows(buf));
  const meta: ParseMeta = {
    filename,
    accepted: parsed.stats.accepted,
    total: parsed.stats.total,
    rejected: parsed.stats.rejected,
    warnings: parsed.stats.warnings,
    skippedStandard: parsed.stats.skippedStandard,
    issues: parsed.issues.filter((i) => i.severity === 'ERROR').slice(0, 12)
      .map((i) => ({ code: i.code, message: i.message, shipmentCode: i.shipmentCode })),
  };
  const rows = toRpcRows(parsed.rows);
  const [pid, hash] = await Promise.all([projectId(), sha256Hex(buf)]);
  const preview = await call(pid, rows, [], { name: filename }, true);
  return { diff: rpcToDiff(preview, meta), preview, rows, meta, hash, buf, projectId: pid, map };
}

/** overwriteCodes — I-18: kody, dla których HHL świadomie nadpisuje daty potwierdzone przez KSH (osobna zgoda). */
export async function serverCommit(d: ServerImportDraft, cancelCodes: string[], overwriteCodes: string[] = []): Promise<ImportRpcResult> {
  if (d.meta.accepted === 0) throw new Error('Plik bez poprawnych wierszy — nic nie zapisano');
  const sb = await getSupabase();
  const path = `${d.projectId}/${d.hash}.xlsx`.replace(/\.\.\//g, '');
  const up = await sb.storage.from('harmonogramy').upload(path, new Blob([d.buf], { type: XLSX_MIME }), { contentType: XLSX_MIME, upsert: false });
  if (up.error && !/exists|duplicate/i.test(up.error.message)) throw new Error(`Archiwum pliku: ${up.error.message}`);
  return call(d.projectId, d.rows, cancelCodes, {
    name: d.meta.filename, hash: d.hash, path: `harmonogramy/${path}`,
    column_map: d.map ?? COLUMN_MAP_DEFAULT, rejected: d.meta.rejected,
    skipped_standard: d.meta.skippedStandard,
    ...(overwriteCodes.length ? { overwrite_confirmed: overwriteCodes } : {}),
  }, false);
}

/** I-22: zapisane szablony mapowania (RLS: tylko HHL). */
export async function loadTemplates(): Promise<ImportTemplate[]> {
  const sb = await getSupabase();
  const r = await sb.from('import_column_templates').select('id,name,column_map,header_signature').order('updated_at', { ascending: false });
  if (r.error) throw new Error(r.error.message);
  return (r.data ?? []) as ImportTemplate[];
}

/** I-22: zapis szablonu (RPC import_template_save — HHL, walidacja pól, audit_log). */
export async function saveTemplate(t: ImportTemplate): Promise<string> {
  const sb = await getSupabase();
  const pid = await projectId();
  const r = await sb.rpc('import_template_save', { p_project: pid, p_name: t.name, p_map: t.column_map, p_signature: t.header_signature });
  if (r.error) throw new Error(r.error.message);
  return r.data as string;
}
