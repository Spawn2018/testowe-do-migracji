/**
 * DP-116 / #691 — max_rows=1000 obcina sailingsSince bez stronicowania.
 * Etap: BN3 / ferry; źródło F7 #690 r2; F7 #693 r1 (R1-B1/B2).
 */
import { describe, expect, it } from 'vitest';
import {
  fetchSailingsSincePaged,
  SAILINGS_MAX_PAGES,
  SAILINGS_PAGE_SIZE,
  supabaseStore,
} from '../supabase/functions/_shared/integrations/store.ts';
import type { DbSailing } from '../supabase/functions/_shared/integrations/sync.ts';

function makeRow(i: number, overrides: Partial<DbSailing> = {}): DbSailing {
  const dep = overrides.departure_at
    ?? new Date(Date.UTC(2026, 10, 1, 0, 0, 0) + i * 3600_000).toISOString();
  return {
    id: `s${i}`,
    vessel_id: 'v1',
    route: 'TLLA-HEL',
    departure_at: dep,
    arrival_at: dep,
    delayed_departure_at: null,
    delayed_arrival_at: null,
    actual_departure_at: null,
    actual_arrival_at: null,
    status: 'ZAPLANOWANY',
    source: 'VIKING',
    source_ref: null,
    ...overrides,
  };
}

type OrderCol = keyof DbSailing;

/**
 * F7 #693 R1-B1: atrapa jak PostgREST —
 * sort tylko po kolumnach z order(); remisy w losowej kolejności przy każdym zapytaniu;
 * range zwraca maks. hardCap wierszy niezależnie od `to`.
 */
function limitingSailingsClient(
  all: DbSailing[],
  hardCap = SAILINGS_PAGE_SIZE,
  opts?: { failOnPageFrom?: number },
) {
  return {
    from(_table: string) {
      const state: {
        sources?: string[];
        fromIso?: string;
        orders: OrderCol[];
      } = { orders: [] };
      const api = {
        select(_cols: string) { return api; },
        gte(col: string, val: string) {
          if (col === 'departure_at') state.fromIso = val;
          return api;
        },
        in(col: string, vals: string[]) {
          if (col === 'source') state.sources = vals;
          return api;
        },
        order(col: string) {
          state.orders.push(col as OrderCol);
          return api;
        },
        async range(from: number, to: number) {
          if (opts?.failOnPageFrom !== undefined && from === opts.failOnPageFrom) {
            return { data: null, error: { message: 'page 2 boom' } };
          }
          let rows = all.filter((s) => !state.fromIso || s.departure_at >= state.fromIso!);
          if (state.sources?.length) rows = rows.filter((s) => state.sources!.includes(s.source));
          const orders = state.orders.slice();
          rows = rows.slice().sort((a, b) => {
            for (const col of orders) {
              const av = a[col];
              const bv = b[col];
              if (av == null && bv == null) continue;
              if (av == null) return -1;
              if (bv == null) return 1;
              if (av < bv) return -1;
              if (av > bv) return 1;
            }
            return Math.random() - 0.5;
          });
          const end = Math.min(to + 1, from + hardCap);
          const page = rows.slice(from, end);
          return { data: page, error: null };
        },
        then(resolve: (v: { data: DbSailing[]; error: null }) => void) {
          let rows = all.filter((s) => !state.fromIso || s.departure_at >= state.fromIso!);
          if (state.sources?.length) rows = rows.filter((s) => state.sources!.includes(s.source));
          resolve({ data: rows.slice(0, hardCap), error: null });
        },
      };
      return api;
    },
  };
}

describe('DP-116 sailingsSince stronicowanie (#691 / F7 #693 r1)', () => {
  it('bez range (stary wzorzec) gubi rejsy powyżej max_rows', async () => {
    const all = Array.from({ length: 1205 }, (_, i) => makeRow(i));
    const sb = limitingSailingsClient(all);
    const r = await sb.from('sailings')
      .select('*')
      .gte('departure_at', makeRow(0).departure_at)
      .order('departure_at') as Promise<{ data: DbSailing[]; error: null }>;
    expect(r.data.length).toBe(SAILINGS_PAGE_SIZE);
    expect(r.data.length).toBeLessThan(all.length);
  });

  it('fetchSailingsSincePaged zbiera wszystkie strony (>1000)', async () => {
    const all = Array.from({ length: 1205 }, (_, i) => makeRow(i));
    const sb = limitingSailingsClient(all);
    const got = await fetchSailingsSincePaged(
      () => sb.from('sailings') as never,
      makeRow(0).departure_at,
    );
    expect(got.length).toBe(1205);
    expect(new Set(got.map((s) => s.id)).size).toBe(1205);
  });

  it('filtr sources (jak sailingsForVikingFileImport) + stronicowanie', async () => {
    const all = [
      ...Array.from({ length: 1005 }, (_, i) => makeRow(i, { source: 'VIKING' })),
      ...Array.from({ length: 50 }, (_, i) => makeRow(2000 + i, { source: 'TALLINK' })),
    ];
    const sb = limitingSailingsClient(all);
    const got = await fetchSailingsSincePaged(
      () => sb.from('sailings') as never,
      makeRow(0).departure_at,
      { sources: ['VIKING', 'RECZNIE'] },
    );
    expect(got.length).toBe(1005);
    expect(got.every((s) => s.source === 'VIKING')).toBe(true);
  });

  it('R1-B1: ≥300 remisów departure_at na granicy strony → komplet unikalnych id', async () => {
    const tieAt = new Date(Date.UTC(2026, 10, 1, 12, 0, 0)).toISOString();
    const before = Array.from({ length: 900 }, (_, i) => makeRow(i));
    const ties = Array.from({ length: 300 }, (_, i) =>
      makeRow(900 + i, { departure_at: tieAt }),
    );
    const after = Array.from({ length: 50 }, (_, i) => makeRow(1200 + i));
    const all = [...before, ...ties, ...after];
    const sb = limitingSailingsClient(all);
    const got = await fetchSailingsSincePaged(
      () => sb.from('sailings') as never,
      makeRow(0).departure_at,
    );
    expect(got.length).toBe(all.length);
    expect(new Set(got.map((s) => s.id)).size).toBe(all.length);
  });

  it('R1-B1: błąd na 2. stronie → wyjątek (bez częściowej listy)', async () => {
    const all = Array.from({ length: 1205 }, (_, i) => makeRow(i));
    const sb = limitingSailingsClient(all, SAILINGS_PAGE_SIZE, { failOnPageFrom: 1000 });
    await expect(
      fetchSailingsSincePaged(() => sb.from('sailings') as never, makeRow(0).departure_at),
    ).rejects.toThrow(/sailings page/);
  });

  it('R1-B1: supabaseStore.sailingsSince >1000 → komplet', async () => {
    const all = Array.from({ length: 1205 }, (_, i) => makeRow(i));
    const sb = limitingSailingsClient(all);
    const store = supabaseStore(sb);
    const got = await store.sailingsSince(makeRow(0).departure_at);
    expect(got.length).toBe(1205);
    expect(new Set(got.map((s) => s.id)).size).toBe(1205);
  });

  it('R1-B1: supabaseStore.sailingsForVikingFileImport >1000 → komplet', async () => {
    const all = [
      ...Array.from({ length: 1100 }, (_, i) => makeRow(i, { source: 'VIKING' })),
      ...Array.from({ length: 20 }, (_, i) => makeRow(3000 + i, { source: 'RECZNIE' })),
      ...Array.from({ length: 30 }, (_, i) => makeRow(4000 + i, { source: 'TALLINK' })),
    ];
    const sb = limitingSailingsClient(all);
    const store = supabaseStore(sb);
    const got = await store.sailingsForVikingFileImport!(makeRow(0).departure_at);
    expect(got.length).toBe(1120);
    expect(got.every((s) => s.source === 'VIKING' || s.source === 'RECZNIE')).toBe(true);
  });

  it('R1-B2: przekroczenie limitu stron → sailings page cap exceeded', async () => {
    const n = SAILINGS_MAX_PAGES * SAILINGS_PAGE_SIZE + 1500;
    const all = Array.from({ length: n }, (_, i) => makeRow(i));
    const sb = limitingSailingsClient(all);
    await expect(
      fetchSailingsSincePaged(() => sb.from('sailings') as never, makeRow(0).departure_at),
    ).rejects.toThrow(/sailings page cap exceeded/);
  });

  it('nieblokujące: dedupe po id przy powtórzeniu między stronami', async () => {
    const base = Array.from({ length: 1500 }, (_, i) => makeRow(i));
    /* Atrapa dokłada ten sam wiersz na każdej stronie — helper ma zostawić jeden. */
    const sb = {
      from() {
        let page = 0;
        const api = {
          select() { return api; },
          gte() { return api; },
          in() { return api; },
          order() { return api; },
          async range(from: number, _to: number) {
            const slice = base.slice(from, from + SAILINGS_PAGE_SIZE);
            page += 1;
            if (page === 2 && slice[0]) {
              return { data: [base[0]!, ...slice.slice(1)], error: null };
            }
            return { data: slice, error: null };
          },
        };
        return api;
      },
    };
    const got = await fetchSailingsSincePaged(
      () => sb.from() as never,
      makeRow(0).departure_at,
    );
    expect(got.length).toBe(1500);
    expect(new Set(got.map((s) => s.id)).size).toBe(1500);
  });
});
