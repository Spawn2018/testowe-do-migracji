/**
 * A6 / E23 — próg SOURCE_DOWN pliku KSH (SharePoint). Lustro Edge `_shared/ksh/sourceDown.ts`.
 */
export const KSH_SOURCE_DOWN_MIN = 30;

/**
 * - Jest lastReadAt → 30 min od ostatniego udanego odczytu.
 * - Brak udanego → 30 min od first_error_at (F7 #556).
 */
export function shouldRaiseKshSourceDown(
  lastReadAt: string | null | undefined,
  nowIso: string,
  downMin = KSH_SOURCE_DOWN_MIN,
  firstErrorAt?: string | null,
): boolean {
  const now = Date.parse(nowIso);
  if (!Number.isFinite(now)) return true;
  if (lastReadAt) {
    const t = Date.parse(lastReadAt);
    if (!Number.isFinite(t)) return true;
    return (now - t) >= downMin * 60_000;
  }
  if (!firstErrorAt) return false;
  const fe = Date.parse(firstErrorAt);
  if (!Number.isFinite(fe)) return false;
  return (now - fe) >= downMin * 60_000;
}
