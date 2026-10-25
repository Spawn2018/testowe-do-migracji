/**
 * A6 / E23 — próg SOURCE_DOWN pliku KSH (SharePoint). Lustro Edge `_shared/ksh/sourceDown.ts`.
 */
export const KSH_SOURCE_DOWN_MIN = 30;

export function shouldRaiseKshSourceDown(
  lastReadAt: string | null | undefined,
  nowIso: string,
  downMin = KSH_SOURCE_DOWN_MIN,
): boolean {
  if (!lastReadAt) return true;
  const t = Date.parse(lastReadAt);
  if (!Number.isFinite(t)) return true;
  const now = Date.parse(nowIso);
  if (!Number.isFinite(now)) return true;
  return (now - t) >= downMin * 60_000;
}
