/**
 * A6 / #650 — typ łatki outbound WT→plik.
 * Zapis bajtów (patchWorkbookBytes / JSZip) usunięty — tylko workbook PATCH (#645/#650 F7 r2).
 */

export type OutboundPatch = {
  code: string;
  load_date?: string | null;
  load_time?: string | null;
  delivery_date?: string | null;
  delivery_time?: string | null;
  carrier_order_no?: string | null;
  hhl_order_no?: string | null;
  /** #597: złożone „PL / SE” (tekst, nigdy formuła). */
  driver?: string | null;
  driver_phone?: string | null;
  tractor?: string | null;
  trailer?: string | null;
};
