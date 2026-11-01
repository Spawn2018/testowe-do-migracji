/**
 * DP-116 / #691 — max_rows=1000 obcina sailingsSince bez stronicowania.
 * Etap: BN3 / ferry; źródło F7 #690 r2; F7 #693 r1–r2 (R1-B1/B2, R2-B1 Fisher–Yates).
 */
import { describe, expect, it } from 'vitest';
import {
  CANCEL_SUSPECT_RISK_MAX_PAGES,
  CANCEL_SUSPECT_RISK_PAGE_SIZE,
  CANCEL_SUSPECT_SAILING_IN_BATCH,
  fetchOpenCancelSuspectDedupKeysPaged,
  fetchSailingsByIdsBatched,
  fetchSailingsSincePaged,
  SAILINGS_MAX_PAGES,
  SAILINGS_PAGE_SIZE,
  supabaseStore,
} from '../supabase/functions/_shared/integrations/store.ts';
import { cancelSuspectRiskDedup } from '../supabase/functions/_shared/ferry/cancelSuspect.ts';
import type { DbSailing } from '../supabase/functions/_shared/integrations/sync.ts';

/** Unikalne czasy co 1 h od 2026-11-01 — nie używaj przy remisach (kolizja z godziną 12 = i=12). */
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

/** Prosty LCG — ziarno na każde zapytanie (deterministyczne, różne między page). */
function makeLcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function fisherYates<T>(arr: T[], rand: () => number): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/**
 * F7 #693 R2-B1: atrapa jak PostgREST —
 * przy każdym zapytaniu: Fisher–Yates na kopii, potem stabilny sort tylko po order()
 * (bez Math.random w komparatorze — TimSort prawie nie miesza remisów).
 * range zwraca maks. hardCap wierszy niezależnie od `to`.
 */
function limitingSailingsClient(
  all: DbSailing[],
  hardCap = SAILINGS_PAGE_SIZE,
  opts?: { failOnPageFrom?: number; seedBase?: number },
) {
  let querySeq = 0;
  const seedBase = opts?.seedBase ?? 0xC0FFEE;
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
          const rand = makeLcg(seedBase + (++querySeq) * 9973);
          /* R2-B1: najpierw pełne przemieszanie, potem stabilny sort po order(). */
          rows = fisherYates(rows, rand).sort((a, b) => {
            for (const col of orders) {
              const av = a[col];
              const bv = b[col];
              if (av == null && bv == null) continue;
              if (av == null) return -1;
              if (bv == null) return 1;
              if (av < bv) return -1;
              if (av > bv) return 1;
            }
            return 0;
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

describe('DP-116 sailingsSince stronicowanie (#691 / F7 #693 r1–r2)', () => {
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

  it('R1-B1 / R2-B1: ≥300 remisów departure_at na granicy → komplet unikalnych id', async () => {
    /* 900 przed + 300 remisów na granicy strony 1000 + 50 po — bez kolizji godzin makeRow(i). */
    const tieAt = new Date(Date.UTC(2026, 10, 1, 12, 0, 0)).toISOString();
    const before = Array.from({ length: 900 }, (_, i) =>
      makeRow(i, {
        departure_at: new Date(Date.UTC(2026, 9, 1, 0, 0, 0) + i * 60_000).toISOString(),
      }),
    );
    const ties = Array.from({ length: 300 }, (_, i) =>
      makeRow(900 + i, { departure_at: tieAt }),
    );
    const after = Array.from({ length: 50 }, (_, i) =>
      makeRow(1200 + i, {
        departure_at: new Date(Date.UTC(2026, 10, 1, 13, 0, 0) + i * 60_000).toISOString(),
      }),
    );
    const all = [...before, ...ties, ...after];
    const fromIso = before[0]!.departure_at;
    /* Kilka przebiegów: bez order(id) atrapa miesza remisy między stronami → braki/duplikaty. */
    for (let run = 0; run < 5; run++) {
      const sb = limitingSailingsClient(all, SAILINGS_PAGE_SIZE, { seedBase: 0xA11CE + run * 17 });
      const got = await fetchSailingsSincePaged(
        () => sb.from('sailings') as never,
        fromIso,
      );
      expect(got.length).toBe(all.length);
      expect(new Set(got.map((s) => s.id)).size).toBe(all.length);
    }
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

  // ~51k wierszy × Fisher–Yates na stronę — na Windows w pełnym suite >15 s (pre-push DP-136).
  it('R1-B2: przekroczenie limitu stron → sailings page cap exceeded', async () => {
    const n = SAILINGS_MAX_PAGES * SAILINGS_PAGE_SIZE + 1500;
    const all = Array.from({ length: n }, (_, i) => makeRow(i));
    const sb = limitingSailingsClient(all);
    await expect(
      fetchSailingsSincePaged(() => sb.from('sailings') as never, makeRow(0).departure_at),
    ).rejects.toThrow(/sailings page cap exceeded/);
  }, 60_000);

  it('R2: dedupe po id przy wstawce między stronami (przesunięcie offsetu)', async () => {
    /* Strona 0: s0…s999. Między zapytaniami wstawka na początku → strona 1 z offset 1000
       zawiera s999 ponownie (przesunięcie) + s1000… — bez seen: duplikat s999. */
    const base = Array.from({ length: 1500 }, (_, i) => makeRow(i));
    const inserted = makeRow(9999, {
      departure_at: new Date(Date.UTC(2025, 0, 1)).toISOString(),
    });
    let page = 0;
    const sb = {
      from() {
        const api = {
          select() { return api; },
          gte() { return api; },
          in() { return api; },
          order() { return api; },
          async range(from: number, _to: number) {
            page += 1;
            const live = page === 1 ? base : [inserted, ...base];
            const slice = live.slice(from, from + SAILINGS_PAGE_SIZE);
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
    /* Strona 2 przesuwa s999 ponownie; bez `seen` → 1501 wierszy / 1500 id. */
    expect(got.filter((s) => s.id === 's999').length).toBe(1);
    expect(new Set(got.map((s) => s.id)).size).toBe(got.length);
    expect(got.length).toBe(1500);
  });
});

/** F7 #696 r4 / DP-116: openCancelSuspectSailings — atrapa PostgREST risk_signals + sailings.in. */
function limitingCancelSuspectClient(
  risks: { id: string; dedup_key: string }[],
  sailings: DbSailing[],
  opts?: { failRiskFrom?: number; hardCap?: number },
) {
  const hardCap = opts?.hardCap ?? CANCEL_SUSPECT_RISK_PAGE_SIZE;
  const inBatches: string[][] = [];
  return {
    inBatches,
    from(table: string) {
      if (table === 'risk_signals') {
        const api = {
          select() { return api; },
          like() { return api; },
          is() { return api; },
          order() { return api; },
          async range(from: number, to: number) {
            if (opts?.failRiskFrom !== undefined && from === opts.failRiskFrom) {
              return { data: null, error: { message: 'risk page boom' } };
            }
            const sorted = risks.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
            const end = Math.min(to + 1, from + hardCap);
            return { data: sorted.slice(from, end), error: null };
          },
        };
        return api;
      }
      if (table === 'sailings') {
        const api = {
          select() { return api; },
          async in(_col: string, vals: string[]) {
            inBatches.push(vals.slice());
            const set = new Set(vals);
            return { data: sailings.filter((s) => set.has(s.id)), error: null };
          },
        };
        return api;
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

describe('DP-116 openCancelSuspectSailings (#696 r4)', () => {
  it('>1000 otwartych dedupów → komplet; .in paczki ≤150', async () => {
    const n = 1205;
    const risks = Array.from({ length: n }, (_, i) => ({
      id: `r${String(i).padStart(5, '0')}`,
      dedup_key: cancelSuspectRiskDedup(`s${i}`),
    }));
    const sailings = Array.from({ length: n }, (_, i) => makeRow(i, { id: `s${i}` }));
    const sb = limitingCancelSuspectClient(risks, sailings);
    const store = supabaseStore(sb);
    const got = await store.openCancelSuspectSailings!();
    expect(got.length).toBe(n);
    expect(new Set(got.map((s) => s.id)).size).toBe(n);
    expect(sb.inBatches.length).toBe(Math.ceil(n / CANCEL_SUSPECT_SAILING_IN_BATCH));
    expect(sb.inBatches.every((b) => b.length <= CANCEL_SUSPECT_SAILING_IN_BATCH)).toBe(true);
  });

  it('błąd strony risk_signals → throw (bez obcięcia)', async () => {
    const risks = Array.from({ length: 1205 }, (_, i) => ({
      id: `r${String(i).padStart(5, '0')}`,
      dedup_key: cancelSuspectRiskDedup(`s${i}`),
    }));
    const sb = limitingCancelSuspectClient(risks, [], { failRiskFrom: 1000 });
    const store = supabaseStore(sb);
    await expect(store.openCancelSuspectSailings!()).rejects.toThrow(/cancel-suspect page/);
  });

  it('fetchOpenCancelSuspectDedupKeysPaged page cap → throw', async () => {
    const n = CANCEL_SUSPECT_RISK_MAX_PAGES * CANCEL_SUSPECT_RISK_PAGE_SIZE + 10;
    const risks = Array.from({ length: n }, (_, i) => ({
      id: `r${String(i).padStart(6, '0')}`,
      dedup_key: cancelSuspectRiskDedup(`s${i}`),
    }));
    const sb = limitingCancelSuspectClient(risks, []);
    await expect(
      fetchOpenCancelSuspectDedupKeysPaged(
        () => sb.from('risk_signals') as never,
        'FERRY_CANCEL_SUSPECT:%',
      ),
    ).rejects.toThrow(/page cap exceeded/);
  });

  it('fetchSailingsByIdsBatched dzieli .in', async () => {
    const ids = Array.from({ length: 320 }, (_, i) => `s${i}`);
    const sailings = ids.map((id, i) => makeRow(i, { id }));
    const sb = limitingCancelSuspectClient([], sailings);
    const got = await fetchSailingsByIdsBatched(
      () => sb.from('sailings') as never,
      ids,
    );
    expect(got.length).toBe(320);
    expect(sb.inBatches).toEqual([
      ids.slice(0, 150),
      ids.slice(150, 300),
      ids.slice(300),
    ]);
  });
});
