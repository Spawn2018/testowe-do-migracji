/** Orlen hurtowe ceny — ONEkodiesel (id 43), PLN/m³ netto → SEFS przechowuje PLN/l (= value/1000). */
export const ORLEN_PRODUCTS_URL = 'https://tool.orlen.pl/api/wholesalefuelprices/Products';
export const ORLEN_CURRENT_URL = 'https://tool.orlen.pl/api/wholesalefuelprices';
export const ORLEN_SOURCE_PAGE = 'https://www.orlen.pl/pl/dla-biznesu/hurtowe-ceny-paliw';
export const ORLEN_UA = 'Watch Tower/1.0 (+https://tower.log-mar.pl; fuel-index)';
export const ORLEN_PRODUCT_SYMBOL = 'ONEkodiesel';
export const ORLEN_PRODUCT_ID = 43;

export type OrlenRow = {
  productName: string;
  effectiveDate: string;
  value: number;
};

export function orlenByProductUrl(from: string, to: string): string {
  return `https://tool.orlen.pl/api/wholesalefuelprices/ByProduct?productId=${ORLEN_PRODUCT_ID}&from=${from}&to=${to}`;
}

/** PLN/m³ → PLN/l (4 miejsca, jak w SEFS). */
export function orlenM3ToLitre(valueM3: number): number {
  return Math.round((valueM3 / 1000) * 10000) / 10000;
}

export function pickOnEkodiesel(rows: OrlenRow[]): OrlenRow | null {
  const hit = rows.find((r) => r.productName === ORLEN_PRODUCT_SYMBOL);
  return hit && Number.isFinite(hit.value) ? hit : null;
}
