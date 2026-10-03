/**
 * L-2 — kto może rozstrzygnąć. Lustro funkcji bazy l2_may_resolve.
 * Odmowa i tak jest w decision_resolve; tu tylko, żeby nie udawać przycisku.
 */
export function mayResolveDecision(deciderRole: string | null | undefined, userRole: string | null | undefined): boolean {
  if (userRole === 'HHL_ADMIN') return true;
  if (deciderRole === 'HHL' && userRole === 'HHL_OPS') return true;
  if (deciderRole === 'CARRIER' && (userRole === 'CARRIER_DISPATCH' || userRole === 'CARRIER_USER')) return true;
  return false;
}
