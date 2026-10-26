/**
 * A6 — łatka XLSX przez JSZip (XML arkusza), bez przepisywania całego skoroszytu (F7 #560).
 * F7 r2: atrybuty stylu `s=…`, serial daty całkowity, DEFLATE, kolejność komórek,
 * pierwszy arkusz z workbook.xml+rels, tekst daty dd.mm.yyyy.
 */
import { COLUMN_MAP_DEFAULT } from './importColumnMap.ts';
import {
  excelSerialFromIso,
  excelTimeFractionFromHm,
  formatDateTextFromIso,
  normalizeHm,
} from './xlsxPatchTime.ts';

export type ZipLike = {
  files: Record<string, { async(type: 'string'): Promise<string> }>;
  file(name: string, data: string): void;
  generateAsync(options: {
    type: 'uint8array';
    compression?: 'DEFLATE' | 'STORE';
    compressionOptions?: { level?: number };
  }): Promise<Uint8Array>;
};

export type OutboundPatch = {
  code: string;
  load_date?: string | null;
  load_time?: string | null;
  delivery_date?: string | null;
  delivery_time?: string | null;
  carrier_order_no?: string | null;
  hhl_order_no?: string | null;
};

export {
  excelDateFromIso,
  excelTimeFromHm,
  excelSerialFromIso,
  excelTimeFractionFromHm,
  formatDateTextFromIso,
  normalizeHm,
} from './xlsxPatchTime.ts';

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, '&');
}

function encodeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  for (const si of xml.match(/<si>[\s\S]*?<\/si>/g) ?? []) {
    const parts = [...si.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decodeXml(m[1]));
    out.push(parts.join(''));
  }
  return out;
}

function colLettersToIndex(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function indexToColLetters(idx: number): string {
  let n = idx;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** Atrybuty komórki poza r i t (F7 r2: zachowaj s=…). */
function attrsExtra(attrs: string): string {
  return attrs
    .replace(/\sr="[^"]*"/g, '')
    .replace(/\st="[^"]*"/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

type CellKind = 'shared' | 'inline' | 'str' | 'number' | 'empty';

type CellInfo = {
  ref: string;
  kind: CellKind;
  text: string;
  num: number | null;
  raw: string;
  /** Atrybuty poza r/t (np. s="3"). */
  extra: string;
};

function readCell(attrs: string, body: string, shared: string[]): CellInfo {
  const ref = /r="([A-Z]+\d+)"/.exec(attrs)?.[1] ?? '';
  const extra = attrsExtra(attrs);
  const t = /\st="([^"]+)"/.exec(attrs)?.[1];
  if (t === 'inlineStr') {
    const text = decodeXml([...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((x) => x[1]).join(''));
    return { ref, kind: 'inline', text, num: null, raw: '', extra };
  }
  const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
  if (v === undefined) {
    return { ref, kind: 'empty', text: '', num: null, raw: '', extra };
  }
  if (t === 's') {
    return { ref, kind: 'shared', text: shared[Number(v)] ?? '', num: null, raw: v, extra };
  }
  if (t === 'str') {
    return { ref, kind: 'str', text: decodeXml(v), num: null, raw: v, extra };
  }
  const num = Number(v);
  return {
    ref,
    kind: 'number',
    text: Number.isFinite(num) ? String(num) : decodeXml(v),
    num: Number.isFinite(num) ? num : null,
    raw: v,
    extra,
  };
}

function cellDisplay(c: CellInfo): string {
  return (c.text ?? '').replace(/\u00A0/g, ' ').trim();
}

function buildCellXml(
  ref: string,
  kind: CellKind,
  value: string | number,
  extra = '',
): string {
  const ex = extra ? ` ${extra}` : '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"${ex}><v>${value}</v></c>`;
  }
  const t = encodeXml(String(value));
  if (kind === 'str') {
    return `<c r="${ref}"${ex} t="str"><v>${t}</v></c>`;
  }
  return `<c r="${ref}"${ex} t="inlineStr"><is><t>${t}</t></is></c>`;
}

type SheetModel = {
  path: string;
  xml: string;
  shared: string[];
  cells: Map<string, CellInfo>;
  codeRow: Map<string, number>;
  headerCol: Map<string, number>;
  codeColLetters: string;
};

async function resolveFirstSheetPath(zip: ZipLike): Promise<string | null> {
  const wbFile = zip.files['xl/workbook.xml'];
  const relsFile = zip.files['xl/_rels/workbook.xml.rels'];
  if (!wbFile || !relsFile) return null;
  const wbXml = await wbFile.async('string');
  const first = /<sheet\b([^>]*?)\s*\/?>/.exec(wbXml);
  if (!first) return null;
  const rid = /\br:id="([^"]+)"/.exec(first[1])?.[1];
  if (!rid) return null;
  const relsXml = await relsFile.async('string');
  const reA = new RegExp(`<Relationship[^>]*\\bId="${rid}"[^>]*\\bTarget="([^"]+)"`);
  const reB = new RegExp(`<Relationship[^>]*\\bTarget="([^"]+)"[^>]*\\bId="${rid}"`);
  const m = reA.exec(relsXml) ?? reB.exec(relsXml);
  if (!m?.[1]) return null;
  let target = m[1].replace(/^\//, '');
  if (target.startsWith('worksheets/')) target = `xl/${target}`;
  if (!target.startsWith('xl/')) target = `xl/${target}`;
  return target;
}

async function loadFirstSheet(
  bytes: Uint8Array,
  loadAsync: (b: Uint8Array) => Promise<ZipLike>,
): Promise<
  | { ok: true; zip: ZipLike; sheet: SheetModel }
  | { ok: false; reason: string }
> {
  let zip: ZipLike;
  try {
    zip = await loadAsync(bytes);
  } catch {
    return { ok: false, reason: 'xlsx_load' };
  }
  const path = (await resolveFirstSheetPath(zip))
    ?? Object.keys(zip.files)
      .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
      .sort()[0]
    ?? null;
  if (!path || !zip.files[path]) return { ok: false, reason: 'no_sheet' };
  const xml = await zip.files[path]!.async('string');
  const sharedXml = zip.files['xl/sharedStrings.xml']
    ? await zip.files['xl/sharedStrings.xml']!.async('string')
    : '';
  const shared = parseSharedStrings(sharedXml);

  const cells = new Map<string, CellInfo>();
  for (const m of xml.matchAll(/<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const [, col, rowS, attrsRest, body = ''] = m;
    const attrs = ` r="${col}${rowS}"${attrsRest}`;
    const info = readCell(attrs, body ?? '', shared);
    info.ref = `${col}${rowS}`;
    cells.set(info.ref, info);
  }

  const headerCol = new Map<string, number>();
  for (const [ref, cell] of cells) {
    const row = Number(/(\d+)$/.exec(ref)?.[1] ?? 0);
    if (row !== 1) continue;
    const col = /^([A-Z]+)/.exec(ref)?.[1] ?? '';
    const key = cellDisplay(cell);
    if (key) headerCol.set(key, colLettersToIndex(col));
  }

  const codeHeader = COLUMN_MAP_DEFAULT.shipmentCode;
  const codeColIdx = headerCol.get(codeHeader);
  if (!codeColIdx) return { ok: false, reason: 'no_code_col' };
  const codeColLetters = indexToColLetters(codeColIdx);

  const codeRow = new Map<string, number>();
  for (const [ref, cell] of cells) {
    const m = /^([A-Z]+)(\d+)$/.exec(ref);
    if (!m || m[1] !== codeColLetters) continue;
    const row = Number(m[2]);
    if (row <= 1) continue;
    const code = cellDisplay(cell);
    if (code && !codeRow.has(code)) codeRow.set(code, row);
  }

  return {
    ok: true,
    zip,
    sheet: { path, xml, shared, cells, codeRow, headerCol, codeColLetters },
  };
}

/** Wstaw komórkę we właściwej kolejności kolumn; obsłuż `<row r="N"/>`. */
function insertOrReplaceCell(sheet: SheetModel, ref: string, cellXml: string): boolean {
  const row = Number(/(\d+)$/.exec(ref)?.[1] ?? 0);
  if (!row) return false;
  const re = new RegExp(`<c r="${ref}"[^>]*?(?:\\/>|>[\\s\\S]*?<\\/c>)`);
  if (re.test(sheet.xml)) {
    sheet.xml = sheet.xml.replace(re, cellXml);
    return true;
  }
  const colIdx = colLettersToIndex(/^([A-Z]+)/.exec(ref)?.[1] ?? 'A');
  // Self-closing row
  const selfRe = new RegExp(`<row([^>]*\\sr="${row}"[^>]*)/>`);
  if (selfRe.test(sheet.xml)) {
    sheet.xml = sheet.xml.replace(selfRe, `<row$1>${cellXml}</row>`);
    return true;
  }
  const rowRe = new RegExp(`(<row[^>]*\\sr="${row}"[^>]*>)([\\s\\S]*?)(<\\/row>)`);
  if (!rowRe.test(sheet.xml)) return false;
  sheet.xml = sheet.xml.replace(rowRe, (_all, open: string, body: string, close: string) => {
    const cellRe = /<c r="([A-Z]+)(\d+)"[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g;
    let insertAt = body.length;
    let m: RegExpExecArray | null;
    while ((m = cellRe.exec(body))) {
      if (colLettersToIndex(m[1]) > colIdx) {
        insertAt = m.index;
        break;
      }
    }
    return `${open}${body.slice(0, insertAt)}${cellXml}${body.slice(insertAt)}${close}`;
  });
  return true;
}

/** F7 r2b: nowa komórka daty bez stylu → weź s= z sąsiada tej kolumny. */
function neighborExtra(sheet: SheetModel, colIdx: number, row: number): string {
  for (const dr of [-1, 1, -2, 2]) {
    const r = row + dr;
    if (r < 2) continue;
    const ref = `${indexToColLetters(colIdx)}${r}`;
    const c = sheet.cells.get(ref);
    if (c?.extra) return c.extra;
  }
  return '';
}

function setCellValue(
  sheet: SheetModel,
  row: number,
  header: string,
  value: string | number,
): boolean {
  const colIdx = sheet.headerCol.get(header);
  if (!colIdx) return false;
  const ref = `${indexToColLetters(colIdx)}${row}`;
  const prev = sheet.cells.get(ref);
  const kind: CellKind = prev?.kind === 'number' && typeof value === 'number'
    ? 'number'
    : prev?.kind === 'str'
    ? 'str'
    : prev?.kind === 'number' && typeof value === 'string'
    ? 'inline'
    : (prev?.kind === 'shared' ? 'inline' : (prev?.kind ?? 'inline'));
  const extra = prev?.extra || neighborExtra(sheet, colIdx, row);
  const xml = buildCellXml(ref, kind === 'shared' ? 'inline' : kind, value, extra);
  if (!insertOrReplaceCell(sheet, ref, xml)) return false;
  sheet.cells.set(ref, {
    ref,
    kind: typeof value === 'number' ? 'number' : 'inline',
    text: String(value),
    num: typeof value === 'number' ? value : null,
    raw: '',
    extra,
  });
  return true;
}

/**
 * Nakłada łatki na bajty xlsx (JSZip). Zwraca bajty + listę zapisanych kodów.
 */
export async function patchWorkbookBytes(
  bytes: Uint8Array,
  patches: readonly OutboundPatch[],
  loadAsync: (b: Uint8Array) => Promise<ZipLike>,
): Promise<
  | { ok: true; bytes: Uint8Array; written: number; skipped: number; writtenCodes: string[] }
  | { ok: false; reason: string }
> {
  if (patches.length === 0) {
    return { ok: true, bytes, written: 0, skipped: 0, writtenCodes: [] };
  }
  const loaded = await loadFirstSheet(bytes, loadAsync);
  if (!loaded.ok) return loaded;
  const { zip, sheet } = loaded;

  let written = 0;
  let skipped = 0;
  const writtenCodes: string[] = [];

  for (const p of patches) {
    const rowNum = sheet.codeRow.get(p.code);
    if (!rowNum) {
      skipped += 1;
      continue;
    }
    let changed = false;
    const applyDate = (header: string, iso: string | null | undefined, present: boolean) => {
      if (!present) return;
      const serial = excelSerialFromIso(iso ?? undefined);
      if (serial == null) return;
      const refCol = sheet.headerCol.get(header);
      if (!refCol) return;
      const ref = `${indexToColLetters(refCol)}${rowNum}`;
      const prev = sheet.cells.get(ref);
      if (prev?.kind === 'inline' || prev?.kind === 'str' || prev?.kind === 'shared') {
        const text = formatDateTextFromIso(iso, prev.text);
        if (text && setCellValue(sheet, rowNum, header, text)) changed = true;
      } else {
        // F7 r2b N2: komórka data+godzina (ułamek) — zachowaj część czasu.
        const prevNum = prev?.kind === 'number' ? prev.num : null;
        const frac = prevNum != null && !Number.isInteger(prevNum)
          ? prevNum - Math.floor(prevNum)
          : 0;
        // F7 r3: bez ogona float (1e-9).
        const merged = Math.round((serial + frac) * 1e9) / 1e9;
        if (setCellValue(sheet, rowNum, header, merged)) changed = true;
      }
    };
    const applyTime = (header: string, hm: string | null | undefined, present: boolean) => {
      if (!present) return;
      const norm = normalizeHm(hm ?? undefined);
      if (!norm) return;
      const refCol = sheet.headerCol.get(header);
      if (!refCol) return;
      const ref = `${indexToColLetters(refCol)}${rowNum}`;
      const prev = sheet.cells.get(ref);
      if (prev?.kind === 'number') {
        const frac = excelTimeFractionFromHm(norm);
        if (frac == null) return;
        // F7 r2b N2: zachowaj część daty (całkowitą) z poprzedniej wartości.
        const day = Math.floor(prev.num ?? 0);
        const merged = Math.round((day + frac) * 1e9) / 1e9;
        if (setCellValue(sheet, rowNum, header, merged)) changed = true;
      } else if (setCellValue(sheet, rowNum, header, norm)) {
        changed = true;
      }
    };
    const applyText = (header: string, val: string | null | undefined, present: boolean) => {
      if (!present) return;
      if (val == null || !String(val).trim()) return;
      if (setCellValue(sheet, rowNum, header, String(val).trim())) changed = true;
    };

    applyDate(COLUMN_MAP_DEFAULT.loadDate, p.load_date, 'load_date' in p);
    applyTime(COLUMN_MAP_DEFAULT.loadTime, p.load_time, 'load_time' in p);
    applyDate(COLUMN_MAP_DEFAULT.deliveryDate, p.delivery_date, 'delivery_date' in p);
    applyTime(COLUMN_MAP_DEFAULT.deliveryTime, p.delivery_time, 'delivery_time' in p);
    applyText(COLUMN_MAP_DEFAULT.scxOrderNo, p.carrier_order_no, 'carrier_order_no' in p);
    applyText(COLUMN_MAP_DEFAULT.hhlOrderNo, p.hhl_order_no, 'hhl_order_no' in p);

    if (changed) {
      written += 1;
      writtenCodes.push(p.code);
    } else {
      skipped += 1;
    }
  }

  zip.file(sheet.path, sheet.xml);
  const out = await zip.generateAsync({
    type: 'uint8array',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });
  return { ok: true, bytes: out, written, skipped, writtenCodes };
}
