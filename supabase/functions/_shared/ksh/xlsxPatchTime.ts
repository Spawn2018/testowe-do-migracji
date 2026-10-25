/** A6 — wartości dat/godzin do komórek Excela (bez zależności exceljs). */

/** YYYY-MM-DD → Date UTC noon (jak typowe daty w pliku KSH). */
export function excelDateFromIso(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], 12, 0, 0));
}

/** YYYY-MM-DD → numer seryjny Excela (system 1900 / epoch 1899-12-30). */
export function excelSerialFromIso(iso: string | null | undefined): number | null {
  const d = excelDateFromIso(iso);
  if (!d) return null;
  return (d.getTime() - Date.UTC(1899, 11, 30)) / 86_400_000;
}

/** HH:MM → Date 1899-12-30 (Excel time). */
export function excelTimeFromHm(hm: string | null | undefined): Date | null {
  if (!hm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  return new Date(Date.UTC(1899, 11, 30, +m[1], +m[2], 0));
}

/** HH:MM → ułamek dnia Excela (gdy komórka jest liczbą). */
export function excelTimeFractionFromHm(hm: string | null | undefined): number | null {
  if (!hm) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const h = +m[1];
  const min = +m[2];
  if (h > 23 || min > 59) return null;
  return (h * 60 + min) / (24 * 60);
}

/** HH:MM znormalizowane (albo null gdy nieparsowalne — F7: nie czyść komórki). */
export function normalizeHm(hm: string | null | undefined): string | null {
  if (hm == null) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hm).trim());
  if (!m) return null;
  return `${String(+m[1]).padStart(2, '0')}:${m[2]}`;
}
