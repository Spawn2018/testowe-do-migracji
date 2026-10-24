/** Audyt 25.10 (F7 #539 pkt A): rozkład rejsów stronami po 1000 — bez obcięcia najnowszych i przyszłych rejsów. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fetchAllSailings } from '../src/data/supabaseProvider';

type Row = { id: string; departure_at: string };
function fakeSb(total: number, error: { message: string } | null = null) {
  const calls: [number, number][] = [];
  const rows: Row[] = Array.from({ length: total }, (_, i) => ({ id: `s${i}`, departure_at: new Date(Date.UTC(2026, 8, 25) + i * 3_600_000).toISOString() }));
  const q = {
    select: () => q,
    order: () => q,
    range: async (a: number, b: number) => {
      calls.push([a, b]);
      return error ? { data: null, error } : { data: rows.slice(a, b + 1), error: null };
    },
  };
  return { sb: { from: () => q } as never, calls };
}

describe('rejsy — wszystkie, nie 1000 najstarszych', () => {
  it('provider czyta sailings przez fetchAllSailings (bez pojedynczego zapytania z limitem max_rows)', () => {
    const src = readFileSync('src/data/supabaseProvider.ts', 'utf8');
    expect(src).toContain('fetchAllSailings(sb, SAILING_COLUMNS)');
    expect(src).not.toContain("sb.from('sailings').select(SAILING_COLUMNS).order('departure_at', { ascending: true }),");
  });
  it('2350 rejsów = 3 strony; ostatni (najnowszy) jest w wyniku, kolejność rosnąco', async () => {
    const { sb, calls } = fakeSb(2350);
    const r = await fetchAllSailings<Row>(sb, 'id,departure_at');
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    expect(r.data).toHaveLength(2350);
    expect(r.data?.[2349].id).toBe('s2349');
  });
  it('348 rejsów (stan 25.10) — jedna strona', async () => {
    const { sb, calls } = fakeSb(348);
    expect((await fetchAllSailings(sb, 'id')).data).toHaveLength(348);
    expect(calls).toHaveLength(1);
  });
  it('błąd zapytania → błąd, bez częściowych danych', async () => {
    const { sb } = fakeSb(10, { message: 'x' });
    const r = await fetchAllSailings(sb, 'id');
    expect(r.data).toBeNull();
    expect(r.error?.message).toBe('x');
  });
});
