/**
 * A6 — łatka XLSX: daty/godziny i numery zleceń po kodzie Wysyłka (bez PII w logach).
 * Formuł poza zmienianymi komórkami nie tykamy (exceljs zachowuje pozostałe).
 */
import ExcelJS from 'npm:exceljs@4.4.0';
import { COLUMN_MAP_DEFAULT } from './importColumnMap.ts';
import { excelDateFromIso, excelTimeFromHm } from './xlsxPatchTime.ts';

export type OutboundPatch = {
  code: string;
  load_date?: string | null;
  load_time?: string | null;
  delivery_date?: string | null;
  delivery_time?: string | null;
  carrier_order_no?: string | null;
  hhl_order_no?: string | null;
};

export { excelDateFromIso, excelTimeFromHm };

function unwrapCell(v: unknown): unknown {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('result' in o) return unwrapCell(o.result);
    if ('text' in o && typeof o.text === 'string') return o.text;
    if (Array.isArray(o.richText)) {
      return (o.richText as { text?: string }[]).map((t) => t.text ?? '').join('');
    }
  }
  return v;
}

function cellStr(v: unknown): string {
  const u = unwrapCell(v);
  if (u == null) return '';
  return String(u).replace(/\u00A0/g, ' ').trim();
}

/**
 * Nakłada łatki na bajty xlsx. Zwraca nowe bajty + liczby (bez kodów / treści).
 * Nieznany kod → skipped; brak arkusza → błąd.
 */
export async function patchWorkbookBytes(
  bytes: Uint8Array,
  patches: readonly OutboundPatch[],
): Promise<
  | { ok: true; bytes: Uint8Array; written: number; skipped: number }
  | { ok: false; reason: string }
> {
  if (patches.length === 0) {
    return { ok: true, bytes, written: 0, skipped: 0 };
  }
  const wb = new ExcelJS.Workbook();
  try {
    await wb.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  } catch {
    return { ok: false, reason: 'xlsx_load' };
  }
  const ws = wb.worksheets[0];
  if (!ws) return { ok: false, reason: 'no_sheet' };

  const headerRow = ws.getRow(1);
  const colByHeader = new Map<string, number>();
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    const key = cellStr(cell.value);
    if (key) colByHeader.set(key, col);
  });

  const codeCol = colByHeader.get(COLUMN_MAP_DEFAULT.shipmentCode);
  if (!codeCol) return { ok: false, reason: 'no_code_col' };

  const col = (header: string) => colByHeader.get(header);

  const byCode = new Map<string, number>();
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const code = cellStr(row.getCell(codeCol).value);
    if (code) byCode.set(code, rowNumber);
  });

  let written = 0;
  let skipped = 0;
  for (const p of patches) {
    const rowNum = byCode.get(p.code);
    if (!rowNum) {
      skipped += 1;
      continue;
    }
    const row = ws.getRow(rowNum);
    let changed = false;
    const set = (header: string, value: unknown) => {
      const c = col(header);
      if (!c) return;
      row.getCell(c).value = value as ExcelJS.CellValue;
      changed = true;
    };
    if ('load_date' in p) set(COLUMN_MAP_DEFAULT.loadDate, excelDateFromIso(p.load_date));
    if ('load_time' in p) set(COLUMN_MAP_DEFAULT.loadTime, excelTimeFromHm(p.load_time));
    if ('delivery_date' in p) set(COLUMN_MAP_DEFAULT.deliveryDate, excelDateFromIso(p.delivery_date));
    if ('delivery_time' in p) set(COLUMN_MAP_DEFAULT.deliveryTime, excelTimeFromHm(p.delivery_time));
    if ('carrier_order_no' in p) {
      set(COLUMN_MAP_DEFAULT.scxOrderNo, p.carrier_order_no ?? null);
    }
    if ('hhl_order_no' in p) {
      set(COLUMN_MAP_DEFAULT.hhlOrderNo, p.hhl_order_no ?? null);
    }
    if (changed) {
      row.commit();
      written += 1;
    } else {
      skipped += 1;
    }
  }

  const out = await wb.xlsx.writeBuffer();
  return {
    ok: true,
    bytes: new Uint8Array(out as ArrayBuffer),
    written,
    skipped,
  };
}
