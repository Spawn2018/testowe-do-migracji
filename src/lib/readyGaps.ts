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

  /* B5 / D-0300: piloci z wymogu symbolu (`plPilotsRequired`), nie z permits (0 wierszy).
   * Do tabeli symboli (D1) — gdy wymóg > 0 albo awizacja ma escort bez tablicy. */
  const pilotsNeed = Math.max(0, Number(load.plPilotsRequired ?? 0));
  if (pilotsNeed > 0 || (r.escort && !r.escortPlate?.trim())) {
    if (!r.escortPlate?.trim()) {
      gaps.push({
        kind: 'PILOTS',
        items: pilotsNeed > 1 ? [`pilot ×${pilotsNeed}`] : ['pilot'],
        who: 'SCX',
      });
    }
  }

  if (!load.carrierOrderNo?.trim()) gaps.push({ kind: 'ORDER_SCX', who: 'SCX' });
  if (!load.hhlOrderNo?.trim()) gaps.push({ kind: 'ORDER_HHL', who: 'HHL' });
  /* B5 K2.2: polisa SCX wymagana do Gotowy */
  const hasPolicyScx = docs.some((d) => d.loadId === load.id && d.category === 'INSURANCE');
  if (!hasPolicyScx) gaps.push({ kind: 'POLICY_SCX', who: 'SCX' });
  if (load.dims && isReadyBlocked(load, [...docs]).blocked) gaps.push({ kind: 'PERMIT', who: 'SCX' });
  return gaps;
}
