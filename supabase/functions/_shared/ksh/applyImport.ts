/**
 * A6 — bajty xlsx → parseSchedule → wiersze RPC + meta (liczby, bez PII w polach meta).
 */
import { COLUMN_MAP_DEFAULT, parseSchedule } from './scheduleParse.ts';
import { readXlsxRowsFromBytes } from './xlsxRows.ts';
import { toRpcRows, type RpcRow } from './toRpcRows.ts';
import { buildCodeSnapshot } from './sourceDown.ts';

export type ApplyParseResult = {
  rows: RpcRow[];
  meta: {
    accepted: number;
    total: number;
    rejected: number;
    warnings: number;
    skippedStandard: number;
    skippedCarrier: number;
    skippedCarrierRows: Array<{ code: string; carrier_text: string }>;
    skippedEmpty: number;
    datesToCheck: number;
  };
  snapshot: ReturnType<typeof buildCodeSnapshot>;
  columnMap: typeof COLUMN_MAP_DEFAULT;
};

export async function parseWorkbookBytes(bytes: Uint8Array): Promise<ApplyParseResult> {
  const raw = await readXlsxRowsFromBytes(bytes);
  const parsed = parseSchedule(raw);
  const rows = toRpcRows(parsed.rows);
  return {
    rows,
    meta: {
      accepted: parsed.stats.accepted,
      total: parsed.stats.total,
      rejected: parsed.stats.rejected,
      warnings: parsed.stats.warnings,
      skippedStandard: parsed.stats.skippedStandard,
      skippedCarrier: parsed.stats.skippedCarrier,
      skippedCarrierRows: parsed.stats.skippedCarrierRows,
      skippedEmpty: parsed.stats.skippedEmpty,
      datesToCheck: parsed.stats.datesToCheck,
    },
    snapshot: buildCodeSnapshot(rows),
    columnMap: COLUMN_MAP_DEFAULT,
  };
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
