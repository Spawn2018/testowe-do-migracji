/**
 * OKQ8 GoEasy Diesel — cena listowa dla klientów firmowych (zał. 1 pkt 3 umowy SEFS, decyzja 05.10 / 0187).
 * Wartość wprost ze strony (sekcja „Drivmedel på station”, kolumna „Företagspris”), bez przeliczania VAT.
 * Ta sama wartość co kolumna „Diesel” w foretagspriser-RRRR-MM-DD.xlsx. NIE Q8 Trucks.
 * „Gäller fr.om” = data publikacji ceny (published_on).
 */
export const OKQ8_PRICES_URL = 'https://www.okq8.se/foretag/priser/';
export const OKQ8_UA = 'Watch Tower/1.0 (+https://tower.log-mar.pl; fuel-index)';
export const OKQ8_PRODUCT = 'OKQ8 GoEasy Diesel';

export type Okq8Diesel = {
  product: 'GoEasy Diesel';
  section: 'Företagspris';
  /** SEK/l jak na stronie (np. 22.29) */
  valueSek: number;
  /** „Gäller fr.om” — data publikacji ceny, np. 2026-10-05 */
  publishedOn: string | null;
  /** „Senaste ändring”, np. „- 85 öre” */
  changeText: string | null;
  rawPriceText: string;
};

/** Wyciąga GoEasy Diesel (cena firmowa) z JSON osadzonego w stronie. */
export function parseOkq8GoEasyDiesel(html: string): Okq8Diesel {
  const idx = html.search(/"title"\s*:\s*"OKQ8 GoEasy Diesel"\s*,\s*"cells"/);
  if (idx < 0) throw new Error('OKQ8: brak wiersza „OKQ8 GoEasy Diesel” (Företagspris)');
  const rest = html.slice(idx + 10, idx + 1200);
  const next = rest.search(/"title"\s*:/);
  const chunk = next >= 0 ? rest.slice(0, next) : rest;
  const cells = [...chunk.matchAll(/"text"\s*:\s*"([^"]*)"/g)].map((x) => x[1]);
  const raw = cells[0] ?? '';
  const numM = raw.replace(/\s/g, '').match(/(\d+),(\d{2})/);
  if (!numM) throw new Error(`OKQ8: nieczytelna cena GoEasy Diesel: ${raw}`);
  const valueSek = Number(`${numM[1]}.${numM[2]}`);
  if (!(valueSek > 0 && valueSek < 100)) throw new Error(`OKQ8: cena poza zakresem: ${valueSek}`);
  const dateCell = cells.find((c) => /^\d{4}-\d{2}-\d{2}$/.test(c.trim()));
  return {
    product: 'GoEasy Diesel',
    section: 'Företagspris',
    valueSek,
    publishedOn: dateCell ? dateCell.trim() : null,
    changeText: cells[1] ?? null,
    rawPriceText: raw,
  };
}
