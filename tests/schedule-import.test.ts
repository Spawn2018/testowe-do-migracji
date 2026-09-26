import { beforeEach, describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import rawLoads from '../src/data/loads.json';
import {
  COLUMN_MAP_DEFAULT,
  diffSchedule,
  parseSchedule,
} from '../src/lib/scheduleParse';
import { dryRunFromXlsx, type ImportDiff } from '../src/lib/scheduleDryRun';
import { readXlsxRows } from '../src/lib/xlsxRead';
import { useTowerStore } from '../src/store/useTowerStore';
import { buildDemoSnapshot } from '../src/data/demoProvider';
import type { Load } from '../src/types';

/** Known non-empty schedule. SG-01 and neighbours — the P9 wipe was 72→1. */
const KNOWN_CODES = ['SG-01', 'SG-02', 'T-01', 'SG-03', 'SG-04', 'T-02'] as const;

type ScheduleField = keyof typeof COLUMN_MAP_DEFAULT;
type ScheduleCells = Partial<Record<ScheduleField, string | number | null>>;

const FIELD_ORDER = Object.keys(COLUMN_MAP_DEFAULT) as ScheduleField[];

function knownLoads(): Load[] {
  const all = rawLoads as Load[];
  return KNOWN_CODES.map((code) => {
    const load = all.find((item) => item.code === code);
    if (!load) throw new Error(`fixture load missing: ${code}`);
    return structuredClone(load);
  });
}

function toArrayBuffer(data: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (data instanceof ArrayBuffer) return data;
  const copy = new ArrayBuffer(data.byteLength);
  new Uint8Array(copy).set(data);
  return copy;
}

async function buildScheduleXlsx(
  rows: ScheduleCells[],
  options?: { fieldOrder?: ScheduleField[]; headers?: string[] },
): Promise<ArrayBuffer> {
  const fieldOrder = options?.fieldOrder ?? FIELD_ORDER;
  const headers = options?.headers ?? fieldOrder.map((field) => COLUMN_MAP_DEFAULT[field]);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Harmonogram');
  sheet.addRow(headers);
  for (const row of rows) {
    const values = fieldOrder.map((field) => {
      const value = row[field];
      return value == null || value === '' ? null : value;
    });
    const added = sheet.addRow(values);
    values.forEach((value, index) => {
      added.getCell(index + 1).value = value;
    });
  }
  const raw = await workbook.xlsx.writeBuffer();
  return toArrayBuffer(raw as ArrayBuffer | Uint8Array);
}

async function buildSheetWithoutRows(): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet('Harmonogram');
  const raw = await workbook.xlsx.writeBuffer();
  return toArrayBuffer(raw as ArrayBuffer | Uint8Array);
}

function sg01Row(deliveryDate = '05.10.2026'): ScheduleCells {
  return {
    shipmentCode: 'SG-01',
    itemType: 'SG',
    dimensions: '18,21 x 2,45 x 2,45',
    qty: '7',
    totalWeight: '20,74',
    loadDate: '30.09.2026',
    deliveryDate,
  };
}

function freshRow(code: string): ScheduleCells {
  return {
    shipmentCode: code,
    itemType: 'SG',
    dimensions: '12,00 x 2,40 x 2,40',
    unitWeight: '18,00',
    qty: '1',
    totalWeight: '18,00',
    loadDate: '01.10.2026',
    deliveryDate: '03.10.2026',
  };
}

function installLoads(loads: Load[]): Load[] {
  const clone = structuredClone(loads);
  useTowerStore.setState({ loads: clone, toasts: [], scheduleVersions: [] });
  return useTowerStore.getState().loads;
}

/** Same payload ScheduleView sends on Zatwierdź — removals stay off unless a test opts in. */
function commitDryRun(
  diff: ImportDiff,
  extra?: { removedIds?: string[]; allowRemovals?: boolean; omitAccepted?: boolean },
) {
  useTowerStore.getState().commitImport({
    added: diff.added,
    changed: diff.changed,
    removedIds: extra?.removedIds ?? diff.removedIds,
    rejected: diff.rejected,
    filename: diff.filename,
    ...(extra?.omitAccepted ? {} : { accepted: diff.accepted }),
    ...(extra?.allowRemovals ? { allowRemovals: true } : {}),
  });
}

function assertExistingSurvive(before: Load[], after: Load[]) {
  expect(after.length).toBeGreaterThanOrEqual(before.length);
  for (const load of before) {
    const found = after.find((item) => item.id === load.id);
    expect(found, `${load.code} (${load.id}) missing after import`).toBeTruthy();
    expect(found?.code).toBe(load.code);
  }
}

describe('schedule XLSX import regression (P9 / D23)', () => {
  beforeEach(() => {
    installLoads(knownLoads());
  });

  it('1. valid partial update patches SG-01, adds a row, and keeps every existing load', async () => {
    const before = useTowerStore.getState().loads;
    const buf = await buildScheduleXlsx([sg01Row('06.10.2026'), freshRow('QA-D23-ADD')]);
    const diff = await dryRunFromXlsx(buf, 'valid-partial.xlsx', before);

    expect(diff.removedIds).toEqual([]);
    expect(diff.accepted).toBeGreaterThan(0);
    expect(diff.added.map((row) => row.code)).toEqual(['QA-D23-ADD']);
    expect(diff.changed.map((row) => row.id)).toEqual(['load-001']);
    expect(diff.changed[0]?.patch.plannedDeliverDate).toBe('2026-10-06');

    const parsedIncoming = parseSchedule(await readXlsxRows(buf));
    const parsedExisting = parseSchedule(
      await readXlsxRows(await buildScheduleXlsx(KNOWN_CODES.map((code) => (
        code === 'SG-01' ? sg01Row() : freshRow(code)
      )))),
    );
    // Logical row diff still lists codes absent from a partial file. Dry-run must not.
    const logical = diffSchedule(parsedIncoming.rows, parsedExisting.rows);
    expect(logical.removed.length).toBeGreaterThan(0);
    expect(logical.removed).toEqual(expect.arrayContaining(['SG-02', 'T-01', 'SG-03', 'SG-04', 'T-02']));

    commitDryRun(diff);
    const after = useTowerStore.getState().loads;
    assertExistingSurvive(before, after);
    expect(after).toHaveLength(before.length + 1);
    const sg01 = after.find((load) => load.code === 'SG-01');
    expect(sg01?.id).toBe('load-001');
    expect(sg01?.plannedDeliverDate).toBe('2026-10-06');
    expect(sg01?.resources.driverName).toBe('Marek Kowalski');
    expect(sg01?.dims.weightT).toBe(20.74);
    expect(after.some((load) => load.code === 'QA-D23-ADD')).toBe(true);
    for (const code of ['SG-02', 'T-01', 'SG-03', 'SG-04', 'T-02']) {
      expect(after.some((load) => load.code === code)).toBe(true);
    }
  });

  it('2. empty file / zero data rows keeps accepted at 0 and does not touch loads', async () => {
    const before = useTowerStore.getState().loads;
    const headerOnly = await buildScheduleXlsx([]);
    const blankSheet = await buildSheetWithoutRows();

    for (const [name, buf] of [
      ['empty-header-only.xlsx', headerOnly],
      ['empty-blank-sheet.xlsx', blankSheet],
    ] as const) {
      installLoads(knownLoads());
      const current = useTowerStore.getState().loads;
      const diff = await dryRunFromXlsx(buf, name, current);
      expect(diff.removedIds).toEqual([]);
      expect(diff.accepted).toBe(0);
      expect(diff.added).toEqual([]);
      expect(diff.changed).toEqual([]);
      expect(diff.total).toBe(0);

      commitDryRun(diff);
      expect(useTowerStore.getState().loads).toBe(current);

      commitDryRun(diff, { removedIds: current.map((load) => load.id) });
      expect(useTowerStore.getState().loads).toBe(current);
      expect(useTowerStore.getState().loads.map((load) => load.code)).toEqual([...KNOWN_CODES]);
    }

    expect(before.map((load) => load.code)).toEqual([...KNOWN_CODES]);
  });

  it('3. reordered columns still parse by header name and preserve existing loads', async () => {
    const before = useTowerStore.getState().loads;
    const fieldOrder: ScheduleField[] = [
      'deliveryDate',
      'totalWeight',
      'qty',
      'dimensions',
      'itemType',
      'loadDate',
      'driverName',
      'orderNo',
      'assemblySeq',
      'deliveryTime',
      'loadTime',
      'driverPhone',
      'unitWeight',
      'shipmentCode',
    ];
    expect(fieldOrder[0]).not.toBe('shipmentCode');
    expect(new Set(fieldOrder)).toEqual(new Set(FIELD_ORDER));

    const buf = await buildScheduleXlsx(
      [sg01Row('07.10.2026'), freshRow('QA-D23-ORD')],
      { fieldOrder },
    );
    const raw = await readXlsxRows(buf);
    expect(raw[0]?.['Wysyłka']).toBe('SG-01');
    expect(Object.keys(raw[0] ?? {})[0]).not.toBe('Wysyłka');

    const diff = await dryRunFromXlsx(buf, 'reordered.xlsx', before);
    expect(diff.removedIds).toEqual([]);
    expect(diff.accepted).toBe(2);
    expect(diff.added.map((row) => row.code)).toEqual(['QA-D23-ORD']);
    expect(diff.changed[0]?.patch.plannedDeliverDate).toBe('2026-10-07');

    commitDryRun(diff);
    const after = useTowerStore.getState().loads;
    assertExistingSurvive(before, after);
    expect(after.find((load) => load.id === 'load-001')?.plannedDeliverDate).toBe('2026-10-07');
    expect(after.some((load) => load.code === 'QA-D23-ORD')).toBe(true);
    expect(after).toHaveLength(before.length + 1);
  });

  it('4. foreign headers accept nothing and do not wipe existing loads', async () => {
    const before = useTowerStore.getState().loads;
    const foreignHeaders = [
      'Lp.',
      'Numer',
      'Gabaryt',
      'Masa szt.',
      'Sztuki',
      'Masa całość',
      'Start',
      'Godzina start',
      'Kierowca',
      'Telefon',
      'Zlecenie',
      'Koniec',
      'Godzina koniec',
      'Montaż',
    ];
    expect(foreignHeaders).not.toContain('Wysyłka');

    const buf = await buildScheduleXlsx(
      [sg01Row(), freshRow('QA-D23-FOREIGN')],
      { headers: foreignHeaders },
    );
    const diff = await dryRunFromXlsx(buf, 'foreign-headers.xlsx', before);

    expect(diff.removedIds).toEqual([]);
    expect(diff.accepted).toBe(0);
    expect(diff.added).toEqual([]);
    expect(diff.changed).toEqual([]);
    expect(diff.rejected).toBeGreaterThan(0);
    expect(diff.issues.map((issue) => issue.code)).toContain('NO_SHIPMENT_CODE');

    commitDryRun(diff);
    expect(useTowerStore.getState().loads).toBe(before);
    expect(useTowerStore.getState().loads.map((load) => load.code)).toEqual([...KNOWN_CODES]);
    expect(useTowerStore.getState().loads.some((load) => load.code === 'QA-D23-FOREIGN')).toBe(false);
  });

  it('5. rejected rows do not delete existing loads; a valid sibling still applies', async () => {
    const before = useTowerStore.getState().loads;
    const buf = await buildScheduleXlsx([
      sg01Row('08.10.2026'),
      {
        shipmentCode: 'QA-D23-DIM',
        itemType: 'SG',
        dimensions: 'przesunięte kolumny',
        qty: '1',
        totalWeight: '10',
        loadDate: '01.10.2026',
        deliveryDate: '03.10.2026',
      },
      {
        shipmentCode: 'QA-D23-WGT',
        itemType: 'T',
        dimensions: '14,62 x 2,45 x 2,45',
        unitWeight: '20,17',
        qty: '55',
        totalWeight: '20,17',
        loadDate: '01.10.2026',
        deliveryDate: '03.10.2026',
      },
      {
        shipmentCode: '',
        itemType: 'SG',
        dimensions: '12,00 x 2,40 x 2,40',
        qty: '1',
        totalWeight: '18,00',
        loadDate: '01.10.2026',
        deliveryDate: '03.10.2026',
      },
      {
        shipmentCode: 'QA-D23-DATE',
        itemType: 'SG',
        dimensions: '12,00 x 2,40 x 2,40',
        qty: '1',
        totalWeight: '18,00',
        loadDate: '10.10.2026',
        deliveryDate: '01.10.2026',
      },
      freshRow('QA-D23-OK'),
    ]);

    const diff = await dryRunFromXlsx(buf, 'invalid-rows.xlsx', before);
    expect(diff.removedIds).toEqual([]);
    expect(diff.accepted).toBe(2);
    expect(diff.rejected).toBe(4);
    expect(diff.issues.map((issue) => issue.code)).toEqual([
      'BAD_DIMENSIONS',
      'WEIGHT_INCONSISTENT',
      'NO_SHIPMENT_CODE',
      'DATE_ORDER',
    ]);
    expect(diff.added.map((row) => row.code)).toEqual(['QA-D23-OK']);
    expect(diff.changed.map((row) => row.id)).toEqual(['load-001']);

    commitDryRun(diff);
    const after = useTowerStore.getState().loads;
    assertExistingSurvive(before, after);
    expect(after).toHaveLength(before.length + 1);
    expect(after.find((load) => load.id === 'load-001')?.plannedDeliverDate).toBe('2026-10-08');
    expect(after.find((load) => load.id === 'load-001')?.resources.driverName).toBe('Marek Kowalski');
    expect(after.some((load) => load.code === 'QA-D23-OK')).toBe(true);
    for (const code of ['QA-D23-DIM', 'QA-D23-WGT', 'QA-D23-DATE']) {
      expect(after.some((load) => load.code === code)).toBe(false);
    }
  });

  it('normal dry-runs never report removedIds', async () => {
    const before = useTowerStore.getState().loads;
    const files = [
      await buildScheduleXlsx([sg01Row('06.10.2026'), freshRow('QA-D23-ADD')]),
      await buildScheduleXlsx([]),
      await buildScheduleXlsx([freshRow('QA-D23-ORD')], {
        fieldOrder: [...FIELD_ORDER].reverse() as ScheduleField[],
      }),
      await buildScheduleXlsx([sg01Row()], {
        headers: FIELD_ORDER.map((field) => `X-${COLUMN_MAP_DEFAULT[field]}`),
      }),
      await buildScheduleXlsx([
        { shipmentCode: 'QA-D23-DIM', dimensions: 'nope', qty: '1', totalWeight: '1' },
        freshRow('QA-D23-OK'),
      ]),
    ];

    for (const buf of files) {
      const diff = await dryRunFromXlsx(buf, 'matrix.xlsx', before);
      expect(diff.removedIds).toEqual([]);
    }
  });

  it('commitImport ignores removals unless allowRemovals is set', async () => {
    const before = useTowerStore.getState().loads;
    const victimId = before.find((load) => load.code === 'T-02')?.id;
    expect(victimId).toBeTruthy();
    const diff = await dryRunFromXlsx(
      await buildScheduleXlsx([freshRow('QA-D23-ADD')]),
      'poisoned-removals.xlsx',
      before,
    );
    expect(diff.removedIds).toEqual([]);
    expect(diff.accepted).toBe(1);

    commitDryRun(diff, { removedIds: before.map((load) => load.id) });
    const kept = useTowerStore.getState().loads;
    assertExistingSurvive(before, kept);
    expect(kept.some((load) => load.code === 'QA-D23-ADD')).toBe(true);
    expect(kept).toHaveLength(before.length + 1);

    installLoads(knownLoads());
    const again = useTowerStore.getState().loads;
    const victim = again.find((load) => load.code === 'T-02');
    expect(victim).toBeTruthy();
    commitDryRun(
      { ...diff, filename: 'allow-removals.xlsx' },
      { removedIds: [victim!.id], allowRemovals: true },
    );
    const after = useTowerStore.getState().loads;
    expect(after.some((load) => load.id === victim!.id)).toBe(false);
    expect(after.some((load) => load.code === 'T-02')).toBe(false);
    for (const load of again) {
      if (load.id === victim!.id) continue;
      expect(after.some((item) => item.id === load.id && item.code === load.code)).toBe(true);
    }
    expect(after.some((load) => load.code === 'QA-D23-ADD')).toBe(true);
  });

  it('omitted accepted with only removals leaves the schedule untouched', () => {
    const before = useTowerStore.getState().loads;
    useTowerStore.getState().commitImport({
      added: [],
      changed: [],
      removedIds: before.map((load) => load.id),
      rejected: before.length,
      filename: 'stale-caller.xlsx',
    });
    expect(useTowerStore.getState().loads).toBe(before);
    expect(useTowerStore.getState().loads.map((load) => load.code)).toEqual([...KNOWN_CODES]);
  });
});

describe('D26 — usunięcia wyłącznie za wyraźną zgodą', () => {
  beforeEach(() => {
    installLoads(knownLoads());
  });

  it('podgląd: pozycje spoza pliku to kandydaci (liczba + kody), removedIds puste — bez zgody nic nie znika', async () => {
    const before = useTowerStore.getState().loads;
    const diff = await dryRunFromXlsx(await buildScheduleXlsx([sg01Row('06.10.2026'), freshRow('QA-D26-ADD')]), 'd26.xlsx', before);
    expect(diff.removedIds).toEqual([]);
    expect(diff.removalCandidates.map((c) => c.code)).toEqual(['SG-02', 'T-01', 'SG-03', 'SG-04', 'T-02']);
    // ScheduleView bez zaznaczenia: removedIds [] i allowRemovals false
    useTowerStore.getState().commitImport({ added: diff.added, changed: diff.changed, removedIds: [], rejected: diff.rejected, filename: diff.filename, accepted: diff.accepted, allowRemovals: false });
    const after = useTowerStore.getState().loads;
    assertExistingSurvive(before, after);
    expect(useTowerStore.getState().scheduleVersions[0].removed).toBe(0);
    expect(useTowerStore.getState().toasts.some((t) => /pominięto usuwanie/.test(t.message))).toBe(false);
  });

  it('zgoda zaznaczona: usuwa dokładnie kandydatów z podglądu (i nic więcej), wersja harmonogramu liczy usunięcia', async () => {
    const before = useTowerStore.getState().loads;
    const diff = await dryRunFromXlsx(await buildScheduleXlsx([sg01Row('06.10.2026'), freshRow('QA-D26-ADD')]), 'd26-allow.xlsx', before);
    const ids = diff.removalCandidates.map((c) => c.id);
    useTowerStore.getState().commitImport({ added: diff.added, changed: diff.changed, removedIds: ids, rejected: diff.rejected, filename: diff.filename, accepted: diff.accepted, allowRemovals: true });
    const after = useTowerStore.getState().loads;
    expect(after.map((l) => l.code).sort()).toEqual(['QA-D26-ADD', 'SG-01']);
    expect(after.find((l) => l.code === 'SG-01')?.plannedDeliverDate).toBe('2026-10-06');
    expect(useTowerStore.getState().scheduleVersions[0].removed).toBe(5);
  });

  it('pusty albo nieczytelny plik → zero kandydatów do usunięcia (P9: 72→1)', async () => {
    const before = useTowerStore.getState().loads;
    for (const buf of [await buildScheduleXlsx([]), await buildSheetWithoutRows(),
      await buildScheduleXlsx([{ shipmentCode: 'QA-D26-BAD', dimensions: 'nope', qty: '1', totalWeight: '1' }])]) {
      const diff = await dryRunFromXlsx(buf, 'bad.xlsx', before);
      expect(diff.accepted).toBe(0);
      expect(diff.removalCandidates).toEqual([]);
    }
  });

  it('pełny plik (wszystkie kody) → brak kandydatów, pola zgody w podglądzie nie ma', async () => {
    const before = useTowerStore.getState().loads;
    const rows = before.map((l) => ({ ...freshRow(l.code), itemType: l.itemType }));
    const diff = await dryRunFromXlsx(await buildScheduleXlsx(rows), 'full.xlsx', before);
    expect(diff.removalCandidates).toEqual([]);
  });
});

describe('D23-S — import na realnej skali (72 transporty, jak w usterce historycznej 72→1)', () => {
  /* 72 transporty demo (loads.json ma 62 + seed) — ta sama skala co usterka historyczna */
  const all = () => structuredClone(buildDemoSnapshot().loads);
  const pl = (n: number) => String(n).replace('.', ',');
  const dmy = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}.${m}.${y}`; };
  const rowOf = (l: Load, patch: Partial<ScheduleCells> = {}): ScheduleCells => ({
    shipmentCode: l.code, itemType: l.itemType,
    dimensions: `${pl(l.dims.lengthM)} x ${pl(l.dims.widthM)} x ${pl(l.dims.heightM)}`,
    qty: String(l.qty), totalWeight: pl(l.dims.weightT),
    loadDate: dmy(l.plannedLoadDate), deliveryDate: dmy(l.plannedDeliverDate), ...patch,
  });

  beforeEach(() => { installLoads(all()); });

  it('ten sam harmonogram 72 wierszy: 0 dodanych, 0 zmian, 0 kandydatów do usunięcia, nic nie znika', async () => {
    const before = useTowerStore.getState().loads;
    expect(before).toHaveLength(72);
    const diff = await dryRunFromXlsx(await buildScheduleXlsx(before.map((l) => rowOf(l))), 'full-72.xlsx', before);
    expect(diff.total).toBe(72);
    expect(diff.accepted).toBe(72);
    expect(diff.added).toHaveLength(0);
    expect(diff.changed).toHaveLength(0);
    expect(diff.removalCandidates).toHaveLength(0);
    commitDryRun(diff);
    assertExistingSurvive(before, useTowerStore.getState().loads);
    expect(useTowerStore.getState().loads).toHaveLength(72);
  });

  it('74 wiersze (72 + 2 nowe, 3 zmiany dat, 1 wiersz błędny): +2, ~3, odrzucony 1, 74 transporty po imporcie', async () => {
    const before = useTowerStore.getState().loads;
    const rows = before.map((l, i) => (i < 3 ? rowOf(l, { deliveryDate: '28.10.2026' }) : rowOf(l)));
    rows.push(freshRow('QA-D23S-01'), freshRow('QA-D23S-02'), { shipmentCode: 'QA-D23S-BAD', dimensions: 'nope', qty: '1', totalWeight: '1' });
    const diff = await dryRunFromXlsx(await buildScheduleXlsx(rows), 'scale-75.xlsx', before);
    expect(diff.total).toBe(75);
    expect(diff.rejected).toBe(1);
    expect(diff.added.map((a) => a.code)).toEqual(['QA-D23S-01', 'QA-D23S-02']);
    expect(diff.changed).toHaveLength(3);
    expect(diff.removalCandidates).toHaveLength(0);
    commitDryRun(diff);
    const after = useTowerStore.getState().loads;
    assertExistingSurvive(before, after);
    expect(after).toHaveLength(74);
    for (const l of before.slice(0, 3)) expect(after.find((x) => x.id === l.id)?.plannedDeliverDate).toBe('2026-10-28');
    expect(useTowerStore.getState().scheduleVersions[0]).toMatchObject({ added: 2, changed: 3, removed: 0, rejected: 1 });
  });

  it('71 z 72 wierszy: 1 kandydat do usunięcia; bez zgody zostaje 72, ze zgodą znika wyłącznie ten jeden', async () => {
    const before = useTowerStore.getState().loads;
    const gone = before[40];
    const diff = await dryRunFromXlsx(await buildScheduleXlsx(before.filter((l) => l.id !== gone.id).map((l) => rowOf(l))), 'scale-71.xlsx', before);
    expect(diff.removalCandidates).toEqual([{ id: gone.id, code: gone.code }]);
    expect(diff.removedIds).toEqual([]);
    commitDryRun(diff);
    expect(useTowerStore.getState().loads).toHaveLength(72);
    installLoads(all());
    const again = useTowerStore.getState().loads;
    const d2 = await dryRunFromXlsx(await buildScheduleXlsx(again.filter((l) => l.id !== gone.id).map((l) => rowOf(l))), 'scale-71-allow.xlsx', again);
    commitDryRun(d2, { removedIds: d2.removalCandidates.map((c) => c.id), allowRemovals: true });
    const after = useTowerStore.getState().loads;
    expect(after).toHaveLength(71);
    expect(after.some((l) => l.id === gone.id)).toBe(false);
  });

  it('72 wiersze, wszystkie błędne (zła kolumna wymiarów): 0 zaakceptowanych → baza nietknięta, 0 kandydatów', async () => {
    const before = useTowerStore.getState().loads;
    const diff = await dryRunFromXlsx(await buildScheduleXlsx(before.map((l) => rowOf(l, { dimensions: 'brak' }))), 'scale-bad.xlsx', before);
    expect(diff.accepted).toBe(0);
    expect(diff.removalCandidates).toEqual([]);
    commitDryRun(diff, { removedIds: before.map((l) => l.id), allowRemovals: true });
    expect(useTowerStore.getState().loads).toBe(before);
  });
});
