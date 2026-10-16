/**
 * wyglad/P7-b — „Zestaw z ładunkiem” › „Zmień” (E32 pkt 7, E9 D-83): czyste sprawdzenie pól formularza.
 * Liczby z przecinkiem albo kropką, w metrach, do 2 miejsc po przecinku. Granice są szerokie (zestawy ponadnormatywne):
 * długość 5–40 m, szerokość i wysokość 1,5–6 m. Bez porównania z wymiarami ładunku — w produkcji wymiary ładunku
 * bez danych z pliku biorą się z zestawu (mappers), więc takie porównanie blokowałoby poprawki (przegląd F7).
 */
import type { SetDims } from './p7Source';

export type SetKey = 'l' | 'w' | 'h';
export type SetCheck = { ok: true; set: SetDims } | { ok: false; error: 'fmt' | 'range'; bad: SetKey[] };

const RANGE: Record<SetKey, [number, number]> = { l: [5, 40], w: [1.5, 6], h: [1.5, 6] };

const num = (s: string): number | null => {
  const t = s.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

export function checkSet(l: string, w: string, h: string): SetCheck {
  const v: Record<SetKey, number | null> = { l: num(l), w: num(w), h: num(h) };
  const keys: SetKey[] = ['l', 'w', 'h'];
  const fmt = keys.filter((k) => v[k] == null);
  if (fmt.length) return { ok: false, error: 'fmt', bad: fmt };
  const range = keys.filter((k) => v[k]! < RANGE[k][0] || v[k]! > RANGE[k][1]);
  if (range.length) return { ok: false, error: 'range', bad: range };
  return { ok: true, set: { l: v.l!, w: v.w!, h: v.h! } };
}

/** Wartość startowa pola: „21,69”. */
export function setFieldValue(n: number | null | undefined): string {
  return n == null ? '' : String(Math.round(n * 100) / 100).replace('.', ',');
}
