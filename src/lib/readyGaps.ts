/**
 * L6 / L9 / L29 / E32 pkt 6 — jedna definicja braków do „Gotowy” (awizacja, rejs, zlecenia, zezwolenia, piloci).
 * A9 (audyt 17.10): ta sama lista co `awiz_missing(load)` w bazie — po A9 produkcja bierze listę z bazy (`load.readyGaps`).
 * Polisa HHL nie blokuje (L6). Używane w demo i w produkcji, dopóki baza nie zwraca gotowej listy.
 * D-20261014-1320-01 K2.2.
 */
import type { Document, Load, LoadStatus, ReadyGap } from '../types';
import { isReadyBlocked } from './permits';

/** Statusy przygotowania — tylko w nich liczą się braki do „Gotowy” (także „rejs niewybrany” w Przeglądzie i Awizacji). */
export const READY_PREP: readonly LoadStatus[] = ['PLANNED', 'RESOURCES_PENDING', 'DOC_MISSING'];
const PREP = READY_PREP;

export function computeReadyGaps(load: Load, docs: readonly Document[]): ReadyGap[] {
  if (!PREP.includes(load.status)) return [];
  const r = load.resources;
  const gaps: ReadyGap[] = [];
  const awiz = [
    !r.driverName?.trim() ? 'kierowca' : null,
    !r.driverPhone?.trim() ? 'telefon' : null,
    !r.tractorPlate?.trim() ? 'ciągnik' : null,
    !r.trailerPlate?.trim() ? 'naczepa' : null,
    /* A9 (audyt 17.10): przy przepięciu naczepy także kierowca SE z telefonem */
    r.trailerSwap && !r.driverDeliveryName?.trim() ? 'kierowca SE' : null,
    r.trailerSwap && !r.driverDeliveryPhone?.trim() ? 'telefon SE' : null,
    r.trailerSwap && !r.tractorDeliveryPlate?.trim() ? 'ciągnik SE' : null,
  ].filter(Boolean) as string[];
  if (awiz.length) gaps.push({ kind: 'AWIZ', items: awiz, who: 'SCX' });
  /* A9 + A5: rejs przy trasie promowej (każdy transport Śrem → Boden płynie promem) — SCX wybiera w awizacji */
  if (!load.sailingId) gaps.push({ kind: 'SAILING', who: 'SCX' });

  /* B5 / D-0300: piloci z wymogu symbolu (`permit.plPilotsRequired`), nie z wierszy zezwoleń (0).
   * Do tabeli symboli (D1) — gdy wymóg > 0 albo awizacja ma escort bez tablicy. */
  const pilotsNeed = Math.max(0, Number(load.permit?.plPilotsRequired ?? 0));
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
