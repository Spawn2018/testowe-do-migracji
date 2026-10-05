/**
 * OKQ8 Q8 Trucks / Diesel — wartość wprost ze strony (U-14), bez przeliczania VAT.
 * Źródło: https://www.okq8.se/foretag/priser/ (sekcja Q8Trucks).
 */
export const OKQ8_PRICES_URL = 'https://www.okq8.se/foretag/priser/';
export const OKQ8_UA = 'Watch Tower/1.0 (+https://tower.log-mar.pl; fuel-index)';

export type Okq8Diesel = {
  product: 'Diesel';
  section: 'Q8Trucks';
  /** SEK/l jak na stronie (np. 22.90) — bez odjęcia VAT */
  valueSek: number;
  /** Data z bodyText sekcji, np. 2026-10-05 */
  asOf: string | null;
  rawPriceText: string;
};

/** Wyciąga Diesel z bloku Q8Trucks w HTML/JSON osadzonego w stronie. */
export function parseOkq8Q8TrucksDiesel(html: string): Okq8Diesel {
  const sectionIdx = html.search(/"heading"\s*:\s*"Q8Trucks"/);
  if (sectionIdx < 0) throw new Error('OKQ8: brak sekcji Q8Trucks');
  const chunk = html.slice(sectionIdx, sectionIdx + 8000);
  const asOfM = chunk.match(/(\d{4}-\d{2}-\d{2})/);
  const dieselM = chunk.match(/"title"\s*:\s*"Diesel"\s*,\s*"cells"\s*:\s*\[\s*\{\s*"text"\s*:\s*"([^"]+)"/);
  if (!dieselM) throw new Error('OKQ8: brak wiersza Diesel w Q8Trucks');
  const raw = dieselM[1];
  const numM = raw.replace(/\s/g, '').match(/(\d+),(\d{2})/);
  if (!numM) throw new Error(`OKQ8: nieczytelna cena Diesel: ${raw}`);
  const valueSek = Number(`${numM[1]}.${numM[2]}`);
  if (!(valueSek > 0 && valueSek < 100)) throw new Error(`OKQ8: cena poza zakresem: ${valueSek}`);
  return {
    product: 'Diesel',
    section: 'Q8Trucks',
    valueSek,
    asOf: asOfM ? asOfM[1] : null,
    rawPriceText: raw,
  };
}
