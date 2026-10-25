/**
 * A6 / E23: SOURCE_DOWN „Plik KSH (SharePoint)” po 30 min bez udanego odczytu.
 * Czysta funkcja — testy unit w tests/ksh-sharepoint-source-down.test.ts.
 */
export const KSH_SOURCE_DOWN_MIN = 30;

/**
 * Czy podnieść alarm.
 * - Jest lastReadAt → 30 min od ostatniego udanego odczytu.
 * - Brak udanego odczytu → 30 min od first_error_at (nie od razu po pierwszej awarii / sekretach).
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

/** Migawka HH do konfliktu: kod → daty/godziny + numery (bez PII/nazwisk). */
export function buildCodeSnapshot(
  rows: readonly {
    code: string;
    load_date: string | null;
    load_time: string | null;
    delivery_date: string | null;
    delivery_time: string | null;
    carrier_order_no?: string | null;
    hhl_order_no?: string | null;
  }[],
): Record<string, {
  ld: string | null;
  lt: string | null;
  dd: string | null;
  dt: string | null;
  co: string | null;
  ho: string | null;
}> {
  const out: Record<string, {
    ld: string | null;
    lt: string | null;
    dd: string | null;
    dt: string | null;
    co: string | null;
    ho: string | null;
  }> = {};
  for (const r of rows) {
    out[r.code] = {
      ld: r.load_date,
      lt: r.load_time,
      dd: r.delivery_date,
      dt: r.delivery_time,
      co: r.carrier_order_no ?? null,
      ho: r.hhl_order_no ?? null,
    };
  }
  return out;
}
