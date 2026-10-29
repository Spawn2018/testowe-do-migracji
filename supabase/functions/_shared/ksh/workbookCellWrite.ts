/**
 * #645 — zapis WT→plik komórka po komórce (Graph workbook), bez PUT całego .xlsx.
 * Mapowanie wiersza po kodzie; konflikt per komórka vs migawka; daty jak w pliku.
 * F7 #646: dwie fazy (odczyt→PATCH), tekst z apostrofem, usedRange z przesunięciem.
 * F7 r2: R1 postęp per job; R2 konflikt per pozycja (itemKey); R3 serial tylko przy formacie daty.
 */
import { COLUMN_MAP_DEFAULT } from './importColumnMap.ts';
import {
  closeWorkbookSession,
  createWorkbookSession,
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
  for (const ch of col.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/** Początek usedRange (np. Sheet1!B3:Z50 → wiersz 3, kolumna 2). */
export function parseUsedRangeOrigin(address: string | null | undefined): {
  row0: number;
  col0: number;
} {
  if (!address) return { row0: 0, col0: 0 };
  const bang = address.includes('!') ? address.split('!').pop()! : address;
  const start = bang.split(':')[0].replace(/\$/g, '');
  const m = /^([A-Za-z]+)(\d+)$/.exec(start);
  if (!m) return { row0: 0, col0: 0 };
  return {
    col0: colLettersToIndex(m[1]) - 1,
    row0: Math.max(0, parseInt(m[2], 10) - 1),
  };
}

function cellText(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  return String(v).replace(/\u00A0/g, ' ').trim();
}

/** B2: porównanie zdejmuje wiodący apostrof (Graph text). */
export function stripLeadingApostrophe(s: string): string {
  return s.startsWith("'") ? s.slice(1) : s;
}

/** B2: tekst do PATCH z prefiksem apostrofu (formuła / wiodące zero / +tel). */
export function textValueForPatch(val: string): string {
  return `'${val}`;
}

/** R3/R4: format Excel wygląda na datę (nie General / czysty czas). */
export function formatLooksLikeDate(fmt: unknown): boolean {
  const s = String(fmt ?? '').trim().toLowerCase();
  if (!s || s === 'general' || s === '@') return false;
  // F7 r3: zdejmij [kolor/locale] i "literały" przed testem y/d ([Red]0.00 ≠ data).
  const stripped = s.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, '');
  if (/[yd]/.test(stripped)) return true;
  return /m.*d|d.*m/.test(stripped) && !/[hs]/.test(stripped);
}

/** R3: format Excel wygląda na godzinę (bez daty). */
export function formatLooksLikeTime(fmt: unknown): boolean {
  const s = String(fmt ?? '').trim().toLowerCase();
  if (!s || s === 'general' || s === '@') return false;
  if (/[yd]/.test(s)) return false;
  return /h/.test(s);
}

export type WorkbookPatch = OutboundPatch & {
  /** R2: id pozycji outbound — konflikt w jednym kodzie blokuje całą pozycję. */
  itemKey?: string;
};

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
  return normSnap(stripLeadingApostrophe(cellText(current))) === exp;
}

/** B1: komórka już ma wartość docelową — bez PATCH, bez konfliktu. */
export function cellAlreadyHasTarget(
  current: unknown,
  target: string | number,
  kind: 'date' | 'time' | 'text',
): boolean {
  if (kind === 'text') {
    return stripLeadingApostrophe(cellText(current)) === String(target).trim();
  }
  if (kind === 'date') {
    if (typeof target === 'number') {
      if (typeof current === 'number' && Number.isFinite(current)) {
        return Math.floor(current) === Math.floor(target);
      }
      const epoch = Date.UTC(1899, 11, 30) + Math.floor(target) * 86_400_000;
      const d = new Date(epoch);
      const iso = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
      return cellMatchesExpected(current, iso, 'date');
    }
    return cellMatchesExpected(current, String(target), 'date');
  }
  const want = normalizeHm(String(target));
  if (!want) return false;
  return cellMatchesExpected(current, want, 'time');
}

type SheetLayout = {
  sheetId: string;
  headerCol: Map<string, number>;
  codeRow: Map<string, number>;
  /** Siatka usedRange (do fazy odczytu bez GET). */
  values: unknown[][];
  numberFormats: unknown[][] | null;
  origin: { row0: number; col0: number };
};

function buildLayout(
  values: unknown[][],
  origin: { row0: number; col0: number },
  numberFormats: unknown[][] | null = null,
): SheetLayout | { error: string } {
  // B8: nagłówek musi być w wierszu 1 arkusza (jak importer).
  if (origin.row0 !== 0) return { error: 'no_code_col' };
  if (!values.length) return { error: 'empty_sheet' };
  const headerRow = values[0] ?? [];
  const headerCol = new Map<string, number>();
  for (let i = 0; i < headerRow.length; i++) {
    const key = cellText(headerRow[i]);
    if (key) headerCol.set(key, i + 1 + origin.col0);
  }
  const codeHeader = COLUMN_MAP_DEFAULT.shipmentCode;
  const codeColIdx = headerCol.get(codeHeader);
  if (!codeColIdx) return { error: 'no_code_col' };
  const codeRow = new Map<string, number>();
  const relCodeCol = codeColIdx - 1 - origin.col0;
  for (let r = 1; r < values.length; r++) {
    const row = values[r] ?? [];
    const code = cellText(row[relCodeCol]);
    if (code && !codeRow.has(code)) codeRow.set(code, r + 1 + origin.row0);
  }
  return { sheetId: '', headerCol, codeRow, values, numberFormats, origin };
}

/** R3: format kolumny z numberFormat wierszy danych (pomija nagłówek). */
export function columnHasDateFormat(
  numberFormats: unknown[][] | null | undefined,
  absCol: number,
  origin: { row0: number; col0: number },
): boolean {
  if (!numberFormats?.length) return false;
  const ci = absCol - 1 - origin.col0;
  if (ci < 0) return false;
  for (let ri = 1; ri < numberFormats.length; ri++) {
    if (formatLooksLikeDate(numberFormats[ri]?.[ci])) return true;
  }
  return formatLooksLikeDate(numberFormats[0]?.[ci]);
}

export function columnHasTimeFormat(
  numberFormats: unknown[][] | null | undefined,
  absCol: number,
  origin: { row0: number; col0: number },
): boolean {
  if (!numberFormats?.length) return false;
  const ci = absCol - 1 - origin.col0;
  if (ci < 0) return false;
  for (let ri = 1; ri < numberFormats.length; ri++) {
    if (formatLooksLikeTime(numberFormats[ri]?.[ci])) return true;
  }
  return formatLooksLikeTime(numberFormats[0]?.[ci]);
}

function cellFromLayout(layout: SheetLayout, absCol: number, absRow: number): unknown {
  const ri = absRow - 1 - layout.origin.row0;
  const ci = absCol - 1 - layout.origin.col0;
  if (ri < 0 || ci < 0) return null;
  return layout.values[ri]?.[ci] ?? null;
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
  itemKey: string;
  address: string;
  absCol: number;
  absRow: number;
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

function jobKey(job: CellJob): string {
  return `${job.code}|${job.conflictField}`;
}

function buildJobs(
  layout: SheetLayout,
  patches: readonly WorkbookPatch[],
  expectedByCode: Record<string, FileDateSnap | null | undefined>,
): CellJob[] {
  const jobs: CellJob[] = [];
  for (const p of patches) {
    const row = layout.codeRow.get(p.code);
    if (!row) continue;
    const expected = expectedByCode[p.code] ?? null;
    const itemKey = p.itemKey?.trim() || p.code;

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
        itemKey,
        address: `${indexToColLetters(col)}${row}`,
        absCol: col,
        absRow: row,
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
        itemKey,
        address: `${indexToColLetters(col)}${row}`,
        absCol: col,
        absRow: row,
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
        itemKey,
        address: `${indexToColLetters(col)}${row}`,
        absCol: col,
        absRow: row,
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
    addText(COLUMN_MAP_DEFAULT.driverName, p.driver, 'driver' in p, 'driver');
    addText(COLUMN_MAP_DEFAULT.driverPhone, p.driver_phone, 'driver_phone' in p, 'driver_phone');
    addText(COLUMN_MAP_DEFAULT.tractorPlate, p.tractor, 'tractor' in p, 'tractor');
    addText(COLUMN_MAP_DEFAULT.trailerPlate, p.trailer, 'trailer' in p, 'trailer');
  }
  return jobs;
}

type Planned =
  | { job: CellJob; action: 'skip_applied' }
  | { job: CellJob; action: 'conflict' }
  | { job: CellJob; action: 'write'; value: string | number };

/**
 * Faza 1: odczyt z usedRange — konflikt / już zastosowane / do PATCH.
 */
function planJobs(layout: SheetLayout, jobs: CellJob[]): Planned[] {
  const out: Planned[] = [];
  for (const job of jobs) {
    const current = cellFromLayout(layout, job.absCol, job.absRow);

    if (cellAlreadyHasTarget(current, job.value, job.kind)) {
      out.push({ job, action: 'skip_applied' });
      continue;
    }

    if (job.kind === 'date' || job.kind === 'time' || job.expected != null) {
      if (!cellMatchesExpected(current, job.expected, job.kind)) {
        out.push({ job, action: 'conflict' });
        continue;
      }
    } else if (job.kind === 'text' && job.expected == null) {
      const cur = stripLeadingApostrophe(cellText(current));
      if (cur && cur !== String(job.value)) {
        out.push({ job, action: 'conflict' });
        continue;
      }
    }

    let writeValue: string | number = job.value;
    if (job.kind === 'date') {
      if (typeof current === 'number' && Number.isFinite(current)) {
        const serial = typeof job.value === 'number' ? job.value : excelSerialFromIso(String(job.value));
        if (serial == null) {
          out.push({ job, action: 'conflict' });
          continue;
        }
        const frac = current - Math.floor(current);
        writeValue = Math.round((Math.floor(serial) + frac) * 1e9) / 1e9;
      } else {
        const isoFromSerial = (() => {
          if (typeof job.value !== 'number') return null;
          const epoch = Date.UTC(1899, 11, 30) + Math.floor(job.value) * 86_400_000;
          const d = new Date(epoch);
          return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        })();
        const formatted = formatDateTextFromIso(isoFromSerial, cellText(current));
        if (!formatted) {
          out.push({ job, action: 'conflict' });
          continue;
        }
        // R3: pusta komórka → serial tylko gdy kolumna ma format daty; inaczej tekst.
        const empty = cellText(current) === '';
        const dateCol = columnHasDateFormat(layout.numberFormats, job.absCol, layout.origin);
        writeValue = empty && typeof job.value === 'number' && dateCol
          ? job.value
          : formatted;
      }
    } else if (job.kind === 'time') {
      const want = normalizeHm(String(job.value));
      if (!want) {
        out.push({ job, action: 'conflict' });
        continue;
      }
      if (typeof current === 'number' && Number.isFinite(current)) {
        const frac = excelTimeFractionFromHm(want);
        if (frac == null) {
          out.push({ job, action: 'conflict' });
          continue;
        }
        writeValue = Math.round((Math.floor(current) + frac) * 1e9) / 1e9;
      } else if (
        cellText(current) === ''
        && columnHasTimeFormat(layout.numberFormats, job.absCol, layout.origin)
      ) {
        const frac = excelTimeFractionFromHm(want);
        writeValue = frac ?? want;
      } else {
        writeValue = want;
      }
    } else {
      writeValue = textValueForPatch(String(job.value));
    }

    out.push({ job, action: 'write', value: writeValue });
  }
  return out;
}

export type WorkbookWriteResult =
  | {
    ok: true;
    mode: 'test' | 'prod';
    writtenCodes: string[];
    /** R4: kody, dla których powstał ≥1 job (wiersz w pliku). */
    codesWithJobs: string[];
    /** R4: joby zaplanowane i nieukończone (poza zablokowanymi konfliktem). */
    incompleteCodes: string[];
    skipped: number;
    conflicts: { code: string; field: string }[];
  }
  | {
    ok: false;
    reason: string;
    http?: number;
    /** B1: kody zapisane przed błędem przejściowym. */
    writtenCodes?: string[];
    codesWithJobs?: string[];
    incompleteCodes?: string[];
    conflicts?: { code: string; field: string }[];
    permission?: string;
  };

function jobsByCodeUnblocked(
  planned: Planned[],
  blockedItemKeys: Set<string>,
): Map<string, Planned[]> {
  const byCode = new Map<string, Planned[]>();
  for (const p of planned) {
    if (blockedItemKeys.has(p.job.itemKey)) continue;
    const list = byCode.get(p.job.code) ?? [];
    list.push(p);
    byCode.set(p.job.code, list);
  }
  return byCode;
}

/** R1: kody, dla których wszystkie joby (niezablokowane konfliktem pozycji) są ukończone. */
function codesFullyWritten(
  planned: Planned[],
  blockedItemKeys: Set<string>,
  completedJobKeys: Set<string>,
): string[] {
  const out: string[] = [];
  for (const [code, list] of jobsByCodeUnblocked(planned, blockedItemKeys)) {
    if (
      list.length > 0
      && list.every((p) => completedJobKeys.has(jobKey(p.job)))
    ) {
      out.push(code);
    }
  }
  return out;
}

/** R4: kody z ≥1 jobem (także zablokowane konfliktem — miały wiersz w pliku). */
function codesThatHadJobs(planned: Planned[]): string[] {
  return [...new Set(planned.map((p) => p.job.code))];
}

/**
 * R4: kody z jobami zaplanowanymi, nieukończonymi, poza zablokowanymi.
 * (częściowy zapis / 429 w środku — nie „done”).
 */
function codesIncomplete(
  planned: Planned[],
  blockedItemKeys: Set<string>,
  completedJobKeys: Set<string>,
): string[] {
  const out: string[] = [];
  for (const [code, list] of jobsByCodeUnblocked(planned, blockedItemKeys)) {
    if (
      list.length > 0
      && !list.every((p) => completedJobKeys.has(jobKey(p.job)))
    ) {
      out.push(code);
    }
  }
  return out;
}

/**
 * Sesja → usedRange → faza odczytu/konfliktu → PATCH tylko bez konfliktu → closeSession.
 */
export async function writePatchesViaWorkbook(args: {
  env: GraphEnv;
  patches: readonly WorkbookPatch[];
  expectedByCode: Record<string, FileDateSnap | null | undefined>;
  fetchFn?: typeof fetch;
}): Promise<WorkbookWriteResult> {
  const fetchFn = args.fetchFn ?? fetch;
  if (args.patches.length === 0) {
    const mode = (args.env.SHAREPOINT_FILE_MODE || '').toLowerCase() === 'test' ? 'test' : 'prod';
    return {
      ok: true,
      mode,
      writtenCodes: [],
      codesWithJobs: [],
      incompleteCodes: [],
      skipped: 0,
      conflicts: [],
    };
  }

  const ref = await resolveWorkbookRef(args.env, fetchFn);
  if (!ref.ok) {
    return {
      ok: false,
      reason: ref.reason,
      http: ref.http,
      permission: ref.permission,
    };
  }

  const sess = await createWorkbookSession(ref.ref, fetchFn);
  if (!sess.ok) {
    return {
      ok: false,
      reason: sess.reason,
      http: sess.http,
      permission: sess.permission,
    };
  }
  const session = sess.session;

  try {
    const sheets = await listWorkbookSheets(session, fetchFn);
    if (!sheets.ok) {
      return {
        ok: false,
        reason: sheets.reason,
        http: sheets.http,
        permission: sheets.permission,
      };
    }
    const first = sheets.sheets[0];
    if (!first) return { ok: false, reason: 'no_sheet' };
    const sheetKey = first.id || first.name;

    const used = await getWorkbookUsedRange(session, sheetKey, fetchFn);
    if (!used.ok) {
      return {
        ok: false,
        reason: used.reason,
        http: used.http,
        permission: used.permission,
      };
    }
    const origin = parseUsedRangeOrigin(used.address);
    const layoutBuilt = buildLayout(used.values, origin, used.numberFormat);
    if ('error' in layoutBuilt) return { ok: false, reason: layoutBuilt.error };
    const layout: SheetLayout = { ...layoutBuilt, sheetId: sheetKey };

    const jobs = buildJobs(layout, args.patches, args.expectedByCode);
    if (jobs.length === 0) {
      return {
        ok: true,
        mode: ref.ref.mode,
        writtenCodes: [],
        codesWithJobs: [],
        incompleteCodes: [],
        skipped: args.patches.length,
        conflicts: [],
      };
    }

    const planned = planJobs(layout, jobs);
    const conflicts: { code: string; field: string }[] = [];
    const blockedItemKeys = new Set<string>();
    const completedJobKeys = new Set<string>();
    let skipped = 0;
    const withJobs = codesThatHadJobs(planned);

    // R2: konflikt w dowolnym kodzie pozycji → blokuje PATCH wszystkich kodów tej pozycji.
    for (const p of planned) {
      if (p.action === 'conflict') {
        blockedItemKeys.add(p.job.itemKey);
        if (!conflicts.some((c) => c.code === p.job.code && c.field === p.job.conflictField)) {
          conflicts.push({ code: p.job.code, field: p.job.conflictField });
        }
      }
    }

    // Faza 2: PATCH tylko dla pozycji bez konfliktu; R1 postęp per job.
    for (const p of planned) {
      if (blockedItemKeys.has(p.job.itemKey)) {
        if (p.action !== 'conflict') skipped += 1;
        continue;
      }
      if (p.action === 'skip_applied') {
        completedJobKeys.add(jobKey(p.job));
        continue;
      }
      if (p.action !== 'write') continue;

      const patched = await patchWorkbookRange(
        session,
        sheetKey,
        p.job.address,
        [[p.value]],
        fetchFn,
      );
      if (!patched.ok) {
        return {
          ok: false,
          reason: patched.reason,
          http: patched.http,
          permission: patched.permission,
          writtenCodes: codesFullyWritten(planned, blockedItemKeys, completedJobKeys),
          codesWithJobs: withJobs,
          incompleteCodes: codesIncomplete(planned, blockedItemKeys, completedJobKeys),
          conflicts,
        };
      }
      completedJobKeys.add(jobKey(p.job));
    }

    return {
      ok: true,
      mode: ref.ref.mode,
      writtenCodes: codesFullyWritten(planned, blockedItemKeys, completedJobKeys),
      codesWithJobs: withJobs,
      incompleteCodes: codesIncomplete(planned, blockedItemKeys, completedJobKeys),
      skipped,
      conflicts,
    };
  } finally {
    await closeWorkbookSession(session, fetchFn);
  }
}

/** Eksport do testów layoutu. */
export function layoutFromValuesForTest(
  values: unknown[][],
  address: string | null = null,
  numberFormats: unknown[][] | null = null,
) {
  return buildLayout(values, parseUsedRangeOrigin(address), numberFormats);
}
