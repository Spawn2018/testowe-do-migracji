import { describe, expect, it } from 'vitest';
import { orlenM3ToLitre, pickOnEkodiesel } from '../supabase/functions/_shared/fuel/orlen.ts';
import { parseOkq8GoEasyDiesel } from '../supabase/functions/_shared/fuel/okq8.ts';
import {
  isFuelPriceHour,
  orlenIngestPayload,
} from '../supabase/functions/_shared/fuel/ingest.ts';

describe('PALIWO-AUTO-B parsers', () => {
  it('Orlen m³ → PLN/l', () => {
    expect(orlenM3ToLitre(6943)).toBe(6.943);
  });

  it('pick ONEkodiesel', () => {
    const row = pickOnEkodiesel([
      { productName: 'Pb95', effectiveDate: '2026-10-03T00:00:00', value: 1 },
      { productName: 'ONEkodiesel', effectiveDate: '2026-10-03T00:00:00', value: 6943 },
    ]);
    expect(row?.value).toBe(6943);
  });

  // D-1300 F7-2: gałąź Orlen — return { row: r, … }, nie TDZ na zewnętrznym `row`.
  it('orlenIngestPayload: row.r + wartość m³, PLN/l w wierszu', () => {
    const { row, value } = orlenIngestPayload('2026-10-18', {
      value: 7110,
      effectiveDate: '2026-10-17T00:00:00',
    });
    expect(value).toBe(7110);
    expect(row.index_code).toBe('PLN');
    expect(row.value).toBe(7.11);
    expect(row.published_on).toBe('2026-10-17');
    expect(row.period).toBe('2026-10-18');
  });

  // #563: +17:15 i 23:15 Europe/Warsaw
  it('okno godzin PL: 7/9/13/17/23', () => {
    expect(isFuelPriceHour(7)).toBe(true);
    expect(isFuelPriceHour(9)).toBe(true);
    expect(isFuelPriceHour(13)).toBe(true);
    expect(isFuelPriceHour(17)).toBe(true);
    expect(isFuelPriceHour(23)).toBe(true);
    expect(isFuelPriceHour(8)).toBe(false);
    expect(isFuelPriceHour(5)).toBe(false);
    expect(isFuelPriceHour(15)).toBe(false);
  });

  it('OKQ8 GoEasy Diesel firmowa 22,29 wprost + data publikacji (nie Q8 Trucks)', () => {
    const html = `{"heading":"Q8Trucks","itemsRow":[{"title":"Diesel","cells":[{"text":"22,90 kr","links":[]}]}]},{"heading":"Drivmedel på station","headerRow":[{"title":"Drivmedel","columns":[" Företagspris","Senaste ändring","Gäller fr.om"]}],"itemsRow":[{"title":"OKQ8 GoEasy 98 (Blyfri 98)","cells":[{"text":"20,24 kr","links":[]},{"text":"- 25 öre","links":[]},{"text":"2026-10-05","links":[]}]},{"title":"OKQ8 GoEasy Diesel","cells":[{"text":"22,29kr","links":[]},{"text":"- 85 öre","links":[]},{"text":"2026-10-05","links":[]}]},{"title":"OKQ8 GoEasy Diesel Extra","cells":[{"text":"22,88 kr","links":[]}]}]}`;
    const d = parseOkq8GoEasyDiesel(html);
    expect(d.valueSek).toBe(22.29);
    expect(d.publishedOn).toBe('2026-10-05');
    expect(d.changeText).toBe('- 85 öre');
    expect(d.product).toBe('GoEasy Diesel');
  });
});
