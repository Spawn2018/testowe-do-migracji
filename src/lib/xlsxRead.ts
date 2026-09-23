/**
 * Browser-side XLSX → row objects for KSH schedule import (ExcelJS).
 * Formula cells use .result; empty rows skipped later by parseSchedule.
 */
import ExcelJS from 'exceljs';

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

export async function readXlsxRows(buf: ArrayBuffer): Promise<Array<Record<string, unknown>>> {
  const wb = new ExcelJS.Workbook();
  // ExcelJS typings expect Buffer; browser ArrayBuffer works at runtime
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer);
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
    // also walk cells beyond sparse header length
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
