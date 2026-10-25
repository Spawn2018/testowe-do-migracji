/**
 * A6 — XLSX → wiersze obiektów (nagłówek = klucz). Edge: npm:exceljs.
 * Logika jak src/lib/xlsxRead.ts; bez PII w logach wywołującego.
 */
import ExcelJS from 'npm:exceljs@4.4.0';

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
    if ('sharedFormula' in o && 'result' in o) return unwrapCell(o.result);
  }
  return v;
}

export async function readXlsxRowsFromBytes(bytes: Uint8Array): Promise<Array<Record<string, unknown>>> {
  const wb = new ExcelJS.Workbook();
  // exceljs expect Buffer-like; Uint8Array działa w Deno
  await wb.xlsx.load(bytes as unknown as ExcelJS.Buffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];

  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    const raw = unwrapCell(cell.value);
    headers[col] = raw == null ? '' : String(raw).trim();
  });

  const rows: Array<Record<string, unknown>> = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj: Record<string, unknown> = {};
    let any = false;
    for (let col = 1; col < headers.length; col++) {
      const key = headers[col];
      if (!key) continue;
      const val = unwrapCell(row.getCell(col).value);
      if (val != null && val !== '') any = true;
      obj[key] = val;
    }
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const key = headers[col];
      if (!key) return;
      const val = unwrapCell(cell.value);
      if (val != null && val !== '') any = true;
      obj[key] = val;
    });
    if (any) rows.push(obj);
  });
  return rows;
}
