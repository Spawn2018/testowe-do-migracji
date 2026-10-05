import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { COLUMN_MAP_DEFAULT, parseSchedule } from '../src/lib/scheduleParse';
import { standardSkipMessage } from '../src/lib/standardSkipMessage';
import { readXlsxRows } from '../src/lib/xlsxRead';

/** Plik z wierszami TYP = STANDARD i jednym zwykłym transportem. */
async function mixedFile(): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Harmonogram');
  const headers = Object.values(COLUMN_MAP_DEFAULT);
  ws.addRow(headers);
  const row = (cells: Record<string, string | number>) => {
    const values = Object.keys(COLUMN_MAP_DEFAULT).map((k) => cells[k] ?? null);
    ws.addRow(values);
  };
  row({
    shipmentCode: 'QA-01',
    itemType: 'KR',
    dimensions: '18,21 x 2,45 x 2,45',
    qty: 7,
    totalWeight: '20,74',
    loadDate: '30.09.2026',
    deliveryDate: '05.10.2026',
  });
  row({
    shipmentCode: 'NTG-1',
    itemType: 'STANDARD',
    dimensions: '10,00 x 2,00 x 2,00',
    qty: 1,
    totalWeight: '5',
    loadDate: '01.10.2026',
    deliveryDate: '06.10.2026',
  });
  row({
    shipmentCode: 'NTG-2',
    itemType: ' standard ',
    dimensions: '12,00 x 2,40 x 2,40',
    qty: 1,
    totalWeight: '6',
    loadDate: '02.10.2026',
    deliveryDate: '07.10.2026',
  });
  row({
    shipmentCode: 'QA-02',
    itemType: 'T',
    dimensions: '14,00 x 2,40 x 2,40',
    qty: 2,
    totalWeight: '12,00',
    loadDate: '03.10.2026',
    deliveryDate: '08.10.2026',
  });
  const raw = await wb.xlsx.writeBuffer();
  const u8 = raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer);
  const copy = new ArrayBuffer(u8.byteLength);
  new Uint8Array(copy).set(u8);
  return copy;
}

describe('B-8-IMP: TYP = STANDARD pomijany', () => {
  it('plik: wiersze STANDARD pominięte, reszta wchodzi, komunikat ma X i Y', async () => {
    const parsed = parseSchedule(await readXlsxRows(await mixedFile()));
    expect(parsed.stats.skippedStandard).toBe(2);
    expect(parsed.stats.accepted).toBe(2);
    expect(parsed.rows.map((r) => r.shipmentCode)).toEqual(['QA-01', 'QA-02']);
    expect(parsed.issues.filter((i) => i.severity === 'ERROR')).toEqual([]);
    expect(parsed.rows.every((r) => r.cargoClass !== 'STANDARD')).toBe(true);
    const msg = standardSkipMessage(parsed.stats.accepted, parsed.stats.skippedStandard);
    expect(msg).toBe(
      'Zaimportowano 2 transporty. Pominięto 2 wiersze typu STANDARD (ładunki NTG — poza zakresem Watch Tower).',
    );
  });
});
