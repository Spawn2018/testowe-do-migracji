/**
 * DP-116 / #691 — max_rows=1000 obcina sailingsSince bez stronicowania.
 * Etap: BN3 / ferry; źródło F7 #690 r2.
 */
import { describe, expect, it } from 'vitest';
import {
  fetchSailingsSincePaged,
  SAILINGS_PAGE_SIZE,
} from '../supabase/functions/_shared/integrations/store.ts';
import type { DbSailing } from '../supabase/functions/_shared/integrations/sync.ts';

function makeRow(i: number): DbSailing {
  const dep = new Date(Date.UTC(2026, 10, 1, 0, 0, 0) + i * 3600_000).toISOString();
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
  };
}

/** Klient jak PostgREST: bez range → max 1000; z range → właściwa strona. */
function limitingSailingsClient(all: DbSailing[], hardCap = SAILINGS_PAGE_SIZE) {
  return {
    from(_table: string) {
      const state: {
        sources?: string[];
        fromIso?: string;
        rangeFrom?: number;
        rangeTo?: number;
      } = {};
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
        order() { return api; },
        async range(from: number, to: number) {
          state.rangeFrom = from;
          state.rangeTo = to;
          let rows = all.filter((s) => !state.fromIso || s.departure_at >= state.fromIso!);
          if (state.sources?.length) rows = rows.filter((s) => state.sources!.includes(s.source));
          rows = rows.slice().sort((a, b) =>
            a.departure_at < b.departure_at ? -1 : a.departure_at > b.departure_at ? 1 : a.id.localeCompare(b.id),
          );
          const page = rows.slice(from, to + 1);
          return { data: page, error: null };
        },
        /** Symulacja starego sailingsSince bez range — obcięcie max_rows. */
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

describe('DP-116 sailingsSince stronicowanie (#691)', () => {
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
    expect(got[0]!.id).toBe('s0');
    expect(got[1204]!.id).toBe('s1204');
  });

  it('filtr sources (jak sailingsForVikingFileImport) + stronicowanie', async () => {
    const all = [
      ...Array.from({ length: 1005 }, (_, i) => ({ ...makeRow(i), source: 'VIKING' as const })),
      ...Array.from({ length: 50 }, (_, i) => ({ ...makeRow(2000 + i), source: 'TALLINK' as const })),
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
});
