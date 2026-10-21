/**
 * L-2 — kto może rozstrzygnąć. Lustro funkcji bazy l2_may_resolve.
 * Odmowa i tak jest w decision_resolve; tu tylko, żeby nie udawać przycisku.
 */
export function mayResolveDecision(
  deciderRole: string | null | undefined,
  userRole: string | null | undefined,
  /** #384 pkt 6: decyzja po terminie albo eskalowana */
  overdue = false,
): boolean {
  if (userRole === 'HHL_ADMIN') return true;
  if (deciderRole === 'HHL' && userRole === 'HHL_OPS') return true;
  if (deciderRole === 'CARRIER' && (userRole === 'CARRIER_DISPATCH' || userRole === 'CARRIER_USER')) return true;
  /* #384 pkt 5: propozycja terminu od SCX — przyjmuje albo odrzuca KSH (KSH_DATE_COUNTER, decider CLIENT) */
  if (deciderRole === 'CLIENT' && (userRole === 'CLIENT_USER' || userRole === 'CLIENT_ADMIN')) return true;
  /* #384 pkt 6: po terminie Operacje HHL zamykają sprawy przewoźnika (nie ADMIN, nie CLIENT) */
  if (overdue && userRole === 'HHL_OPS' && deciderRole === 'CARRIER') return true;
  return false;
}
