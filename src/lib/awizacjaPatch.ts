/**
 * BK5 — formularz „Awizacja / Prom” wysyła wyłącznie zmienione pola.
 * Okien planowych przewoźnik nie zmienia (AN2, wymusza `trg_loads_guard`) — niezmienione
 * okna nie mogą trafiać do zapisu, bo każdy zapis przewoźnika z oknami byłby odrzucony.
 * Pusta łatka = bez zapisu kolumn (zdarzenie/komunikat jak dotąd).
 * Porównanie po chwili w czasie (formularz przelicza strefę; format ISO może się różnić).
 */
import type { Awizacja } from '../types';

const WINDOW_KEYS = ['loadWindowStart', 'loadWindowEnd', 'unloadWindowStart', 'unloadWindowEnd'] as const;

function sameInstant(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  // pole datetime-local ma dokładność minuty
  return Number.isFinite(ta) && Number.isFinite(tb) ? Math.floor(ta / 60000) === Math.floor(tb / 60000) : a === b;
}

export function awizacjaChanges(prev: Awizacja, next: Awizacja): Partial<Awizacja> {
  const out: Partial<Awizacja> = {};
  for (const k of WINDOW_KEYS) if (!sameInstant(prev[k], next[k])) out[k] = next[k];
  if (prev.confirmed !== next.confirmed) out.confirmed = next.confirmed;
  return out;
}
