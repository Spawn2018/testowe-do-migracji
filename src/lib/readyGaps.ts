/**
 * L6 / L9 / L29 / E32 pkt 6 — jedna definicja braków do „Gotowy” (awizacja, zlecenia, zezwolenia, piloci).
 * Polisa HHL nie blokuje (L6). Używane w demo i w produkcji, dopóki baza nie zwraca gotowej listy.
 * D-20261014-1320-01 K2.2.
 */
import type { Document, Load, LoadStatus, ReadyGap } from '../types';
import { isReadyBlocked } from './permits';

const PREP: LoadStatus[] = ['PLANNED', 'RESOURCES_PENDING', 'DOC_MISSING'];

export function computeReadyGaps(load: Load, docs: readonly Document[]): ReadyGap[] {
  if (!PREP.includes(load.status)) return [];
  const r = load.resources;
  const gaps: ReadyGap[] = [];
  const awiz = [
    !r.driverName?.trim() ? 'kierowca' : null,
    !r.driverPhone?.trim() ? 'telefon' : null,
    !r.tractorPlate?.trim() ? 'ciągnik' : null,
    !r.trailerPlate?.trim() ? 'naczepa' : null,
    r.trailerSwap && !r.tractorDeliveryPlate?.trim() ? 'ciągnik SE' : null,
  ].filter(Boolean) as string[];
  if (awiz.length) gaps.push({ kind: 'AWIZ', items: awiz, who: 'SCX' });

  const pilotsReq = load.permit?.plPilotsRequired ?? 0;
  const sePilots = (load.permit as { sePilotsRequired?: number } | undefined)?.sePilotsRequired ?? 0;
  if ((pilotsReq > 0 || sePilots > 0 || r.escort) && !r.escortPlate?.trim()) {
    const items: string[] = [];
    if (pilotsReq > 0) items.push('pilot PL');
    if (sePilots > 0) items.push('pilot SE');
    if (!items.length) items.push('pilot');
    gaps.push({ kind: 'PILOTS', items, who: 'SCX' });
  }

  if (!load.carrierOrderNo?.trim()) gaps.push({ kind: 'ORDER_SCX', who: 'SCX' });
  if (!load.hhlOrderNo?.trim()) gaps.push({ kind: 'ORDER_HHL', who: 'HHL' });
  if (load.dims && isReadyBlocked(load, [...docs]).blocked) gaps.push({ kind: 'PERMIT', who: 'SCX' });
  return gaps;
}
