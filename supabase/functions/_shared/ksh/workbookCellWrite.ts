/**
 * #645 — zapis WT→plik komórka po komórce (Graph workbook), bez PUT całego .xlsx.
 * Mapowanie wiersza po kodzie; konflikt per komórka vs migawka; daty jak w pliku.
 */
import { COLUMN_MAP_DEFAULT } from './importColumnMap.ts';
import {
  closeWorkbookSession,
  createWorkbookSession,
  getWorkbookRange,
  getWorkbookUsedRange,
  listWorkbookSheets,
  patchWorkbookRange,
  resolveWorkbookRef,
  type WorkbookSession,
} from './graphWorkbook.ts';
import type { GraphEnv } from './graph.ts';
import type { OutboundPatch } from './xlsxPatch.ts';
import type { FileDateSnap } from './writeConflict.ts';
import {
  excelSerialFromIso,
  excelTimeFractionFromHm,
  formatDateTextFromIso,
  normalizeHm,
} from './xlsxPatchTime.ts';

export function indexToColLetters(idx: number): string {
  let n = idx;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function colLettersToIndex(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function cellText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v).replace(/\u00A0/g, ' ').trim();
}

function normSnap(v: string | null | undefined): string | null {
  if (v == null) return null;
  const t = String(v).trim();
  return t === '' ? null : t;
}

/** Porównanie wartości komórki z oczekiwaną z migawki (daty/godziny/tekst). */
export function cellMatchesExpected(
  current: unknown,
  expected: string | null,
  kind: 'date' | 'time' | 'text',
): boolean {
  const exp = normSnap(expected);
  if (exp == null) {
    return cellText(current) === '';
  }
  if (kind === 'date') {
    if (typeof current === 'number' && Number.isFinite(current)) {
      const serial = excelSerialFromIso(exp);
      if (serial == null) return false;
      return Math.floor(current) === Math.floor(serial);
    }
    const cur = cellText(current);
    const asText = formatDateTextFromIso(exp, cur);
    return normSnap(cur) === normSnap(asText) || normSnap(cur) === exp;
  }
  if (kind === 'time') {
    const want = normalizeHm(exp);
    if (!want) return false;
    if (typeof current === 'number' && Number.isFinite(current)) {
      const frac = excelTimeFractionFromHm(want);
      if (frac == null) return false;
      const curFrac = current - Math.floor(current);
      return Math.abs(curFrac - frac) < 1e-6;
    }
    return normalizeHm(cellText(current)) === want;
  }
  return normSnap(cellText(current)) === exp;
}

type SheetLayout = {
  sheetId: string;
  headerCol: Map<string, number>;
  codeRow: Map<string, number>;
};

function buildLayout(values: unknown[][]): SheetLayout | { error: string } {
  if (!values.length) return { error: 'empty_sheet' };
  const headerRow = values[0] ?? [];
  const headerCol = new Map<string, number>();
  for (let i = 0; i < headerRow.length; i++) {
    const key = cellText(headerRow[i]);
    if (key) headerCol.set(key, i + 1);
  }
  const codeHeader = COLUMN_MAP_DEFAULT.shipmentCode;
  const codeColIdx = headerCol.get(codeHeader);
  if (!codeColIdx) return { error: 'no_code_col' };
  const codeRow = new Map<string, number>();
  for (let r = 1; r < values.length; r++) {
    const row = values[r] ?? [];
    const code = cellText(row[codeColIdx - 1]);
    if (code && !codeRow.has(code)) codeRow.set(code, r + 1);
  }
  return { sheetId: '', headerCol, codeRow };
}

function snapField(
  snap: FileDateSnap | null | undefined,
  field: 'load_date' | 'load_time' | 'delivery_date' | 'delivery_time' | 'carrier_order_no' | 'hhl_order_no',
): string | null {
  if (!snap) return null;
  switch (field) {
    case 'load_date': return normSnap(snap.ld);
    case 'load_time': return normSnap(snap.lt);
    case 'delivery_date': return normSnap(snap.dd);
    case 'delivery_time': return normSnap(snap.dt);
    case 'carrier_order_no': return normSnap(snap.co);
    case 'hhl_order_no': return normSnap(snap.ho);
  }
}

type CellJob = {
  code: string;
  address: string;
  value: string | number;
  expected: string | null;
  kind: 'date' | 'time' | 'text';
  conflictField:
    | 'load_date'
    | 'load_time'
    | 'delivery_date'
    | 'delivery_time'
    | 'carrier_order_no'
    | 'hhl_order_no'
    | 'driver'
    | 'driver_phone'
    | 'tractor'
    | 'trailer';
};

function buildJobs(
  layout: SheetLayout,
  patches: readonly OutboundPatch[],
  expectedByCode: Record<string, FileDateSnap | null | undefined>,
): CellJob[] {
  const jobs: CellJob[] = [];
  for (const p of patches) {
    const row = layout.codeRow.get(p.code);
    if (!row) continue;
    const expected = expectedByCode[p.code] ?? null;

    const addDate = (
      header: string,
      iso: string | null | undefined,
      present: boolean,
      field: 'load_date' | 'delivery_date',
    ) => {
      if (!present) return;
      const col = layout.headerCol.get(header);
      if (!col) return;
      const serial = excelSerialFromIso(iso ?? undefined);
      if (serial == null) return;
      jobs.push({
        code: p.code,
        address: `${indexToColLetters(col)}${row}`,
        value: serial,
        expected: snapField(expected, field),
        kind: 'date',
        conflictField: field,
      });
    };
    const addTime = (
      header: string,
      hm: string | null | undefined,
      present: boolean,
      field: 'load_time' | 'delivery_time',
    ) => {
      if (!present) return;
      const col = layout.headerCol.get(header);
      if (!col) return;
      const norm = normalizeHm(hm ?? undefined);
      if (!norm) return;
      jobs.push({
        code: p.code,
        address: `${indexToColLetters(col)}${row}`,
        value: norm,
        expected: snapField(expected, field),
        kind: 'time',
        conflictField: field,
      });
    };
    const addText = (
      header: string,
      val: string | null | undefined,
      present: boolean,
      field: CellJob['conflictField'],
      expectedOverride?: string | null,
    ) => {
      if (!present) return;
      if (val == null || !String(val).trim()) return;
      const col = layout.headerCol.get(header);
      if (!col) return;
      jobs.push({
        code: p.code,
        address: `${indexToColLetters(col)}${row}`,
        value: String(val).trim(),
        expected: expectedOverride !== undefined ? expectedOverride : null,
        kind: 'text',
        conflictField: field,
      });
    };

    addDate(COLUMN_MAP_DEFAULT.loadDate, p.load_date, 'load_date' in p, 'load_date');
    addTime(COLUMN_MAP_DEFAULT.loadTime, p.load_time, 'load_time' in p, 'load_time');
    addDate(COLUMN_MAP_DEFAULT.deliveryDate, p.delivery_date, 'delivery_date' in p, 'delivery_date');
    addTime(COLUMN_MAP_DEFAULT.deliveryTime, p.delivery_time, 'delivery_time' in p, 'delivery_time');
    addText(
      COLUMN_MAP_DEFAULT.scxOrderNo, p.carrier_order_no, 'carrier_order_no' in p,
      'carrier_order_no', snapField(expected, 'carrier_order_no'),
    );
    addText(
      COLUMN_MAP_DEFAULT.hhlOrderNo, p.hhl_order_no, 'hhl_order_no' in p,
      'hhl_order_no', snapField(expected, 'hhl_order_no'),
    );
    // Awizacja: brak w migawce dat — konflikt tylko gdy ktoś zmienił komórkę od odczytu
    // (expected = null → puste OK; niepuste bez naszej łatki = konflikt w GET).
    addText(COLUMN_MAP_DEFAULT.driverName, p.driver, 'driver' in p, 'driver');
    addText(COLUMN_MAP_DEFAULT.driverPhone, p.driver_phone, 'driver_phone' in p, 'driver_phone');
    addText(COLUMN_MAP_DEFAULT.tractorPlate, p.tractor, 'tractor' in p, 'tractor');
    addText(COLUMN_MAP_DEFAULT.trailerPlate, p.trailer, 'trailer' in p, 'trailer');
  }
  return jobs;
}

/**
 * Dla dat/czasu: jeśli komórka jest liczbą — zapisz serial/ułamek; tekst — tekst w formacie pliku.
 */
async function resolveWriteValue(
  session: WorkbookSession,
  sheetId: string,
  job: CellJob,
  fetchFn: typeof fetch,
): Promise<
  | { ok: true; value: string | number; current: unknown }
  | { ok: false; reason: string; http?: number; conflict?: true }
> {
  const got = await getWorkbookRange(session, sheetId, job.address, fetchFn);
  if (!got.ok) return got;
  const current = got.values[0]?.[0] ?? null;

  // Konflikt: komórka ≠ expected (dla dat/numerów/awizacji bez expected — tylko gdy empty→niepuste obce).
  if (job.kind === 'date' || job.kind === 'time' || job.expected != null) {
    if (!cellMatchesExpected(current, job.expected, job.kind)) {
      return { ok: false, reason: 'cell_conflict', conflict: true };
    }
  } else if (job.kind === 'text' && job.expected == null) {
    // awizacja: nie nadpisuj niepustej komórki, która nie jest jeszcze naszą wartością
    const cur = cellText(current);
    if (cur && cur !== String(job.value)) {
      return { ok: false, reason: 'cell_conflict', conflict: true };
    }
  }

  if (job.kind === 'date') {
    const isoFromSerial = (() => {
      if (typeof job.value !== 'number') return null;
      const epoch = Date.UTC(1899, 11, 30) + Math.floor(job.value) * 86_400_000;
      const d = new Date(epoch);
      const y = d.getUTCFullYear();
      const m = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    })();
    if (typeof current === 'number' && Number.isFinite(current)) {
      const serial = typeof job.value === 'number' ? job.value : excelSerialFromIso(String(job.value));
      if (serial == null) return { ok: false, reason: 'bad_date' };
      const frac = current - Math.floor(current);
      const merged = Math.round((Math.floor(serial) + frac) * 1e9) / 1e9;
      return { ok: true, value: merged, current };
    }
    const formatted = formatDateTextFromIso(isoFromSerial, cellText(current));
    if (!formatted) return { ok: false, reason: 'bad_date' };
    return { ok: true, value: formatted, current };
  }

  if (job.kind === 'time') {
    const want = normalizeHm(String(job.value));
    if (!want) return { ok: false, reason: 'bad_time' };
    if (typeof current === 'number' && Number.isFinite(current)) {
      const frac = excelTimeFractionFromHm(want);
      if (frac == null) return { ok: false, reason: 'bad_time' };
      const day = Math.floor(current);
      return { ok: true, value: Math.round((day + frac) * 1e9) / 1e9, current };
    }
    return { ok: true, value: want, current };
  }

  return { ok: true, value: job.value, current };
}

export type WorkbookWriteResult =
  | {
    ok: true;
    mode: 'test' | 'prod';
    writtenCodes: string[];
    skipped: number;
    conflicts: { code: string; field: string }[];
  }
  | { ok: false; reason: string; http?: number };

/**
 * Sesja → usedRange → GET komórki → konflikt → PATCH → closeSession.
 */
export async function writePatchesViaWorkbook(args: {
  env: GraphEnv;
  patches: readonly OutboundPatch[];
  /** expected per code (test = kopia; prod = expected_file). */
  expectedByCode: Record<string, FileDateSnap | null | undefined>;
  fetchFn?: typeof fetch;
}): Promise<WorkbookWriteResult> {
  const fetchFn = args.fetchFn ?? fetch;
  if (args.patches.length === 0) {
    const mode = (args.env.SHAREPOINT_FILE_MODE || '').toLowerCase() === 'test' ? 'test' : 'prod';
    return { ok: true, mode, writtenCodes: [], skipped: 0, conflicts: [] };
  }

  const ref = await resolveWorkbookRef(args.env, fetchFn);
  if (!ref.ok) return { ok: false, reason: ref.reason, http: ref.http };

  const sess = await createWorkbookSession(ref.ref, fetchFn);
  if (!sess.ok) return { ok: false, reason: sess.reason, http: sess.http };
  const session = sess.session;

  try {
    const sheets = await listWorkbookSheets(session, fetchFn);
    if (!sheets.ok) return { ok: false, reason: sheets.reason, http: sheets.http };
    const first = sheets.sheets[0];
    if (!first) return { ok: false, reason: 'no_sheet' };
    const sheetKey = first.id || first.name;

    const used = await getWorkbookUsedRange(session, sheetKey, fetchFn);
    if (!used.ok) return { ok: false, reason: used.reason, http: used.http };
    const layoutBuilt = buildLayout(used.values);
    if ('error' in layoutBuilt) return { ok: false, reason: layoutBuilt.error };
    const layout: SheetLayout = { ...layoutBuilt, sheetId: sheetKey };

    const jobs = buildJobs(layout, args.patches, args.expectedByCode);
    if (jobs.length === 0) {
      return {
        ok: true,
        mode: ref.ref.mode,
        writtenCodes: [],
        skipped: args.patches.length,
        conflicts: [],
      };
    }

    const conflicts: { code: string; field: string }[] = [];
    const conflictCodes = new Set<string>();
    const writtenCodes = new Set<string>();
    let skipped = 0;

    for (const job of jobs) {
      if (conflictCodes.has(job.code)) {
        skipped += 1;
        continue;
      }
      const resolved = await resolveWriteValue(session, sheetKey, job, fetchFn);
      if (!resolved.ok) {
        if (resolved.conflict) {
          conflicts.push({ code: job.code, field: job.conflictField });
          conflictCodes.add(job.code);
          continue;
        }
        return { ok: false, reason: resolved.reason, http: resolved.http };
      }
      const patched = await patchWorkbookRange(
        session,
        sheetKey,
        job.address,
        [[resolved.value]],
        fetchFn,
      );
      if (!patched.ok) {
        return { ok: false, reason: patched.reason, http: patched.http };
      }
      writtenCodes.add(job.code);
    }

    return {
      ok: true,
      mode: ref.ref.mode,
      writtenCodes: [...writtenCodes],
      skipped,
      conflicts,
    };
  } finally {
    await closeWorkbookSession(session, fetchFn);
  }
}

/** Eksport do testów layoutu. */
export function layoutFromValuesForTest(values: unknown[][]) {
  return buildLayout(values);
}
