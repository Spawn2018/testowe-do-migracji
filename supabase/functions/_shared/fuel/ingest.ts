/**
 * D-1300 / F7-2 / #563 — wspólne helpery fuel-prices (bez Deno.serve; testowane w vitest).
 */
import { ORLEN_SOURCE_PAGE, orlenM3ToLitre } from './orlen.ts';

export type FuelSourceRow = {
  index_code: string;
  period: string;
  reading_date: string;
  value: number;
  source_url: string;
  published_on: string | null;
  source_note: string;
};

/** Godzina 0–23 w Europe/Warsaw. */
export function warsawHour(d = new Date()): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Warsaw',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(d),
  );
}

/** #563: 07:15, 09:15, 13:15, 17:15, 23:15 Europe/Warsaw (cron :15). */
export const FUEL_PRICE_HOURS_PL = [7, 9, 13, 17, 23] as const;

export function isFuelPriceHour(hour: number): boolean {
  return (FUEL_PRICE_HOURS_PL as readonly number[]).includes(hour);
}

/**
 * Wiersz Orlen do fuel_se_pl_ingest.
 * Zwraca `{ row: r, value }` — nigdy `{ row, value }` przy zewnętrznym `const row = …`
 * (TDZ / ReferenceError w Edge — F7-2).
 */
export function orlenIngestPayload(
  period: string,
  orlen: { value: number; effectiveDate?: string | null },
): { row: FuelSourceRow; value: number } {
  const r: FuelSourceRow = {
    index_code: 'PLN',
    period,
    reading_date: period,
    value: orlenM3ToLitre(orlen.value),
    source_url: ORLEN_SOURCE_PAGE,
    published_on: String(orlen.effectiveDate ?? '').slice(0, 10) || null,
    source_note: `ORLEN ONEkodiesel ${orlen.value} PLN/m³ netto (effective ${orlen.effectiveDate}); zapis ${orlenM3ToLitre(orlen.value)} PLN/l`,
  };
  return { row: r, value: orlen.value };
}
