/**
 * DP-117 / F7 #693 r1 — odczyt `loads` do H-1 ze stronicowaniem (max_rows=1000).
 * Bez `.limit(500)` i bez losowego podzbioru: filtr statusów terminalnych + order(id) + range.
 */

export const ROUTE_CHECK_LOADS_PAGE_SIZE = 1000;
/** Po MAX_PAGES pełnych stron — błąd (nie ciche obcięcie). */
export const ROUTE_CHECK_LOADS_MAX_PAGES = 50;

/** Jak `store` / E49 — zamknięte nie wymagają ponownej kontroli HERE. */
export const ROUTE_CHECK_TERMINAL_STATUSES =
  '("CANCELLED","REMOVED","UNLOADED","DELIVERED","READY_TO_INVOICE","INVOICED")';

export const ROUTE_CHECK_LOAD_COLS =
  'id, combo_height_m, combo_width_m, combo_length_m, combo_weight_t, combo_axle_count, combo_axle_load_t, sailings(route)';

type LoadsPageQuery = {
  select: (cols: string) => LoadsPageQuery;
  not: (col: string, op: string, val: string) => LoadsPageQuery;
  order: (col: string, opts?: { ascending?: boolean }) => LoadsPageQuery;
  range: (from: number, to: number) => Promise<{
    data: Record<string, unknown>[] | null;
    error: { message: string } | null;
  }>;
};

/**
 * Aktywne transporty stronami. Page cap → throw (nie ciche obcięcie).
 * Dedupe po `id` przy przesunięciu między stronami.
 */
export async function fetchRouteCheckLoadRowsPaged(
  fromTable: () => LoadsPageQuery,
  opts?: {
    pageSize?: number;
    must?: <T>(r: { data: T; error: { message: string } | null }, what: string) => T;
  },
): Promise<Record<string, unknown>[]> {
  const pageSize = opts?.pageSize ?? ROUTE_CHECK_LOADS_PAGE_SIZE;
  const mustFn = opts?.must ?? (<T>(r: { data: T; error: { message: string } | null }, what: string): T => {
    if (r.error) throw new Error(`${what}: ${r.error.message}`);
    return r.data;
  });
  const out: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  let from = 0;
  for (;;) {
    if (from >= ROUTE_CHECK_LOADS_MAX_PAGES * pageSize) {
      throw new Error('route-check loads page cap exceeded');
    }
    const r = mustFn(
      await fromTable()
        .select(ROUTE_CHECK_LOAD_COLS)
        .not('status', 'in', ROUTE_CHECK_TERMINAL_STATUSES)
        .order('id', { ascending: true })
        .range(from, from + pageSize - 1),
      'loads route-check page',
    ) as Record<string, unknown>[];
    for (const row of r) {
      const id = String(row.id ?? '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out.push(row);
    }
    if (r.length < pageSize) break;
    from += pageSize;
  }
  return out;
}
