/** A6 — wartości dat/godzin do komórek Excela (bez zależności exceljs). */

/** YYYY-MM-DD → Date UTC noon (jak typowe daty w pliku KSH). */
export function excelDateFromIso(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12, 0, 0));
}

/** HH:MM → Date 1899-12-30 (Excel time). */
export function excelTimeFromHm(hm: string | null | undefined): Date | null {
  if (!hm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  return new Date(Date.UTC(1899, 11, 30, +m[1], +m[2], 0));
}
