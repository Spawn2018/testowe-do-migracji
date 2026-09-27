/**
 * I-2k — paczka dokumentów „tydzień”: wyłącznie dokumenty transportów z wybranego tygodnia ISO.
 * Tydzień transportu = tydzień rozładunku (jak w fakturach tygodniowych: `unloadedAtOf`), a przed rozładunkiem —
 * planowanej dostawy; bez daty dostawy — planowanego załadunku. Strefa operacyjna Europe/Warsaw.
 */
import type { Document, Load } from '../types';
import { isoWeekKeyLocal } from './money/engine';
import { unloadedAtOf } from './money/loadMoney';

const noon = (day: string) => `${day}T12:00:00+02:00`;

export function loadWeekKey(load: Load): string | null {
  const at = unloadedAtOf(load)
    ?? (load.plannedDeliverDate ? noon(load.plannedDeliverDate.slice(0, 10)) : null)
    ?? (load.plannedLoadDate ? noon(load.plannedLoadDate.slice(0, 10)) : null);
  if (!at) return null;
  try { return isoWeekKeyLocal(at); } catch { return null; }
}

/** Tygodnie, w których są transporty (rosnąco, bez duplikatów). */
export function weeksWithLoads(loads: readonly Load[]): string[] {
  return [...new Set(loads.map(loadWeekKey).filter((w): w is string => !!w))].sort();
}

/** Domyślny tydzień: bieżący, jeśli ma transporty; inaczej najbliższy następny; inaczej ostatni. */
export function defaultDocWeek(weeks: readonly string[], now: Date = new Date()): string {
  if (!weeks.length) return '';
  const cur = isoWeekKeyLocal(now.toISOString());
  return weeks.find((w) => w >= cur) ?? weeks[weeks.length - 1];
}

/** Dokumenty wyłącznie transportów z tygodnia `week` (dokument bez transportu nie trafia do paczki). */
export function docsForWeek(docs: readonly Document[], loads: readonly Load[], week: string): Document[] {
  const ids = new Set(loads.filter((l) => loadWeekKey(l) === week).map((l) => l.id));
  return docs.filter((d) => !!d.loadId && ids.has(d.loadId));
}
