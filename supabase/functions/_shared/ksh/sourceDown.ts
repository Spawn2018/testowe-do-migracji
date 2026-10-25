/**
 * A6 / E23: SOURCE_DOWN „Plik KSH (SharePoint)” po 30 min bez udanego odczytu.
 * Czysta funkcja — testy unit w tests/ksh-sharepoint-source-down.test.ts.
 */
export const KSH_SOURCE_DOWN_MIN = 30;

/** Czy podnieść alarm: brak udanego odczytu albo starszy niż próg. */
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

/** Migawka HH do konfliktu (kolejny krok): kod → daty/godziny (bez PII). */
export function buildCodeSnapshot(
  rows: readonly { code: string; load_date: string | null; load_time: string | null; delivery_date: string | null; delivery_time: string | null }[],
): Record<string, { ld: string | null; lt: string | null; dd: string | null; dt: string | null }> {
  const out: Record<string, { ld: string | null; lt: string | null; dd: string | null; dt: string | null }> = {};
  for (const r of rows) {
    out[r.code] = { ld: r.load_date, lt: r.load_time, dd: r.delivery_date, dt: r.delivery_time };
  }
  return out;
}
