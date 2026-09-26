/**
 * ANEKS 3 §2.1 — import nie kasuje transportów.
 * Usunięcie przez import = anulowanie (CANCELLED), wyłącznie dla statusów sprzed wjazdu
 * na załadunek i transportów spoza faktur. Ten sam werdykt co w bazie
 * (`import_removal_check()` w 0019) — baza jest ostatecznym strażnikiem.
 */
import type { Load } from '../types';
import { statusToDb, type DbLoadStatus } from '../data/mappers';

export const IMPORT_CANCELLABLE: readonly DbLoadStatus[] = ['PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING', 'READY'];

export type RemovalBlock = 'INVOICED' | 'STATUS';
export interface RemovalCandidate { id: string; code: string }
export interface RemovalBlocked extends RemovalCandidate { reason: RemovalBlock }

/** Transporty obecne na jakiejkolwiek fakturze (koszt albo przychód). */
export function invoicedLoadIds(...docs: readonly (readonly { lines?: readonly { loadId: string }[] }[])[]): Set<string> {
  const ids = new Set<string>();
  for (const list of docs) for (const b of list) for (const ln of b.lines ?? []) ids.add(ln.loadId);
  return ids;
}

/** null = import może anulować; inaczej powód blokady (faktura ma pierwszeństwo przed statusem). */
export function removalBlock(load: Load, invoiced: ReadonlySet<string>): RemovalBlock | null {
  if (invoiced.has(load.id)) return 'INVOICED';
  const db = statusToDb(load.status);
  // DELAYED / SILENT to flagi transportu w drodze — status w bazie nieznany → blokada
  if (!db || !IMPORT_CANCELLABLE.includes(db)) return 'STATUS';
  return null;
}

export function splitRemovals(loads: readonly Load[], invoiced: ReadonlySet<string>): {
  cancellable: RemovalCandidate[];
  blocked: RemovalBlocked[];
} {
  const cancellable: RemovalCandidate[] = [];
  const blocked: RemovalBlocked[] = [];
  for (const l of loads) {
    const reason = removalBlock(l, invoiced);
    if (reason) blocked.push({ id: l.id, code: l.code, reason });
    else cancellable.push({ id: l.id, code: l.code });
  }
  return { cancellable, blocked };
}
