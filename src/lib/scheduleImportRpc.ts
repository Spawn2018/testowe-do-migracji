/**
 * I-1 — import harmonogramu w trybie produkcyjnym: czyste mapowanie (bez klienta Supabase).
 * Wiersze po parserze (ParsedRow) → argument `import_schedule(p_rows)`;
 * odpowiedź funkcji (podgląd albo zapis) → ImportDiff, który pokazuje ten sam podgląd co tryb demo.
 */
import type { ParsedRow } from './scheduleParse';
import type { ImportDiff } from './scheduleDryRun';
import type { RemovalBlock } from './importRemoval';

export interface RpcRow {
  code: string;
  item_type: string | null;
  /** I-2C: tylko dla ładunku normatywnego („Standard”) — wtedy wymiary null */
  cargo_class?: 'STANDARD';
  length_m: number | null;
  width_m: number | null;
  height_m: number | null;
  unit_weight_t: number | null;
  qty: number;
  total_weight_t: number | null;
  load_date: string | null;
  load_time: string | null;
  delivery_date: string | null;
  delivery_time: string | null;
  order_no: string | null;
  assembly_seq: number | null;
}

export function toRpcRows(rows: readonly ParsedRow[]): RpcRow[] {
  return rows.map((r) => ({
    code: r.shipmentCode,
    item_type: r.itemType == null ? null : String(r.itemType).trim() || null,
    ...(r.cargoClass === 'STANDARD' ? { cargo_class: 'STANDARD' as const } : {}),
    length_m: r.lengthM,
    width_m: r.widthM,
    height_m: r.heightM,
    unit_weight_t: r.unitWeightT,
    qty: r.qty,
    total_weight_t: r.totalWeightT,
    load_date: r.loadDate,
    load_time: r.loadTime,
    delivery_date: r.deliveryDate,
    delivery_time: r.deliveryTime,
    order_no: r.orderNo,
    assembly_seq: r.assemblySeq,
  }));
}

/** Odpowiedź `import_schedule` (jsonb). */
export interface ImportRpcResult {
  dry_run: boolean;
  version: number | null;
  import_id: string | null;
  rows: number;
  added: { code: string }[];
  changed: { code: string; load_id: string; fields: string[]; critical: boolean }[];
  unchanged: number;
  cancel_candidates: { code: string; load_id: string }[];
  blocked: { code: string; load_id: string; reason: 'INVOICED' | 'STATUS' | 'CANCELLED'; message: string }[];
  cancelled: { code: string; load_id: string }[];
  critical: { code: string; fields: string[] }[];
  /** I-18 (0061): zmiany dat POTWIERDZONYCH przez KSH; overwrite=false → data zostaje bez zmian */
  confirmed?: { code: string; load_id: string; overwrite: boolean;
    before: { load_date: string | null; delivery_date: string | null };
    after: { load_date: string | null; delivery_date: string | null } }[];
  carrier: string | null;
  ms: number;
}

export interface ParseMeta {
  filename: string;
  accepted: number;
  total: number;
  rejected: number;
  warnings: number;
  issues: ImportDiff['issues'];
}

export function rpcToDiff(res: ImportRpcResult, meta: ParseMeta): ImportDiff {
  return {
    added: res.added.map((a) => ({ code: a.code })),
    changed: res.changed.map((c) => ({ id: c.load_id, patch: {}, criticalDate: c.critical })),
    removedIds: [],
    removalCandidates: meta.accepted === 0 ? [] : res.cancel_candidates.map((c) => ({ id: c.load_id, code: c.code })),
    removalBlocked: res.blocked.map((b) => ({ id: b.load_id, code: b.code, reason: b.reason as RemovalBlock })),
    rejected: meta.rejected,
    warnings: meta.warnings,
    filename: meta.filename,
    accepted: meta.accepted,
    total: meta.total,
    issues: meta.issues,
  };
}

/** SHA-256 pliku (hex) — skrót w schedule_imports i nazwa obiektu w archiwum. */
export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
