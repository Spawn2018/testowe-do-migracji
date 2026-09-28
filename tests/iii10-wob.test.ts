/**
 * III-10 — parser EU Weekly Oil Bulletin. Dane: prawdziwy plik KE „Prices with taxes, latest prices”
 * (ceny z 21.09.2026), pobrany 28.09.2026 do tests/fixtures/.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import JSZip from 'jszip';
import {
  readWobXlsx, parseWobPricesWithTaxes, isoWeek, excelSerialToIso, wobSourceUrl, WOB_LATEST_URL,
} from '../supabase/functions/_shared/fuel/wob';

const BYTES = readFileSync(new URL('./fixtures/wob-prices-with-taxes-2026-09-21.xlsx', import.meta.url));
const load = (b: Uint8Array | ArrayBuffer) => JSZip.loadAsync(b);

async function xml() {
  const z = await JSZip.loadAsync(BYTES);
  return { sheet: await z.file('xl/worksheets/sheet1.xml')!.async('string'), shared: await z.file('xl/sharedStrings.xml')!.async('string') };
}

describe('III-10 WOB — prawdziwy plik 2026-09-21', () => {
  it('data cen, tydzień ISO i olej napędowy PL/SE w EUR/l', async () => {
    const r = await readWobXlsx(BYTES, load);
    expect(r.priceDate).toBe('2026-09-21');
    expect(r.readings).toEqual([
      { index_code: 'WOB_DIESEL_PL', period: '2026-W39', reading_date: '2026-09-21', value: 2.0391, eur_per_1000l: 2039.12 },
      { index_code: 'WOB_DIESEL_SE', period: '2026-W39', reading_date: '2026-09-21', value: 2.0902, eur_per_1000l: 2090.2 },
    ]);
  });
  it('wartości mieszczą się w ograniczeniach tabeli (0 < v < 1000, okres YYYY-Www)', async () => {
    const r = await readWobXlsx(BYTES, load);
    for (const x of r.readings) {
      expect(x.value).toBeGreaterThan(0);
      expect(x.value).toBeLessThan(1000);
      expect(x.period).toMatch(/^[0-9]{4}-W(0[1-9]|[1-4][0-9]|5[0-3])$/);
    }
  });
  it('adres dowodowy: stały link KE + nazwa pliku z datą', () => {
    const u = wobSourceUrl('2026-09-21');
    expect(u.startsWith(WOB_LATEST_URL + '?filename=')).toBe(true);
    expect(decodeURIComponent(u)).toContain('Weekly prices with Taxes - 2026-09-21.xlsx');
    expect(u).toMatch(/^https:\/\/energy\.ec\.europa\.eu\//);
  });
});

describe('III-10 WOB — zmiana układu pliku = błąd, nie cichy zapis', () => {
  it('brak kolumny oleju napędowego', async () => {
    const { sheet, shared } = await xml();
    expect(() => parseWobPricesWithTaxes(sheet, shared.replace(/Automotive gas oil/g, 'Something else'))).toThrow(/Automotive gas oil/);
  });
  it('waluta inna niż EUR', async () => {
    const { sheet, shared } = await xml();
    expect(() => parseWobPricesWithTaxes(sheet, shared.replace('<t>in EUR</t>', '<t>in national currency</t>'))).toThrow(/EUR/);
  });
  it('jednostka inna niż 1000 l', async () => {
    const { sheet, shared } = await xml();
    expect(() => parseWobPricesWithTaxes(sheet, shared.replace('<t>1000 l</t>', '<t>1 l</t>'))).toThrow(/1000 l/);
  });
  it('brak wiersza Szwecji', async () => {
    const { sheet, shared } = await xml();
    expect(() => parseWobPricesWithTaxes(sheet, shared.replace('<t>Sweden</t>', '<t>Sverige</t>'))).toThrow(/Sweden/);
  });
  it('cena spoza zakresu', async () => {
    const { sheet, shared } = await xml();
    const bad = sheet.replace(/(<c r="C23"[^>]*><v>)[^<]+/, '$19999999');
    expect(() => parseWobPricesWithTaxes(bad, shared)).toThrow(/poza zakresem/);
  });
  it('plik bez arkusza', async () => {
    const z = new JSZip(); z.file('a.txt', 'x');
    const b = await z.generateAsync({ type: 'uint8array' });
    await expect(readWobXlsx(b, load)).rejects.toThrow(/bez arkusza/);
  });
});

describe('III-10 WOB — daty', () => {
  it('liczba seryjna Excela', () => { expect(excelSerialToIso(46286)).toBe('2026-09-21'); });
  it('tydzień ISO na przełomie roku', () => {
    expect(isoWeek('2026-01-01')).toBe('2026-W01');
    expect(isoWeek('2027-01-01')).toBe('2026-W53');
    expect(isoWeek('2024-12-30')).toBe('2025-W01');
  });
});
