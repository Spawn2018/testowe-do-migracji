import { describe, expect, it } from 'vitest';
import { orlenM3ToLitre, pickOnEkodiesel } from '../supabase/functions/_shared/fuel/orlen.ts';
import { parseOkq8Q8TrucksDiesel } from '../supabase/functions/_shared/fuel/okq8.ts';

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

  it('OKQ8 Q8Trucks Diesel 22,90 wprost', () => {
    const html = `"heading":"Q8Trucks","bodyText":"Priser gäller endast för tankningar på Q8Truck-Dieselstationer i Sverige. 2026-10-05.","headerRow":[{"title":"Produkt","columns":["Pris inkl. moms","Pris exkl. moms"]}],"itemsRow":[{"title":"Diesel","cells":[{"text":"22,90 kr","links":[]},{"text":"18,32 kr","links":[]}]}]`;
    const d = parseOkq8Q8TrucksDiesel(html);
    expect(d.valueSek).toBe(22.9);
    expect(d.asOf).toBe('2026-10-05');
    expect(d.section).toBe('Q8Trucks');
  });
});
