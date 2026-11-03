/**
 * DP-119 / F7 #693 r1 — front documents/invoices ze stronicowaniem (max_rows=1000);
 * RPC latest_vehicle_positions też pod Range.
 * Etap: C2 / front·API; źródło PLAN rejestr DP.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fetchAllDocuments, fetchAllInvoices } from '../src/data/supabaseProvider';
import { SAILINGS_PAGE_SIZE, supabaseStore } from '../supabase/functions/_shared/integrations/store.ts';

type Doc = { id: string };
type Inv = { id: string; issue_date: string; direction: string };

function fakeDocsSb(total: number, error: { message: string } | null = null) {
  const calls: [number, number][] = [];
  const rows: Doc[] = Array.from({ length: total }, (_, i) => ({ id: `d${String(i).padStart(4, '0')}` }));
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

function fakeInvSb(total: number, error: { message: string } | null = null) {
  const calls: [number, number][] = [];
  const rows: Inv[] = Array.from({ length: total }, (_, i) => ({
    id: `i${String(i).padStart(4, '0')}`,
    issue_date: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`,
    direction: 'KOSZT',
  }));
  const q = {
    select: () => q,
    not: () => q,
    order: () => q,
    range: async (a: number, b: number) => {
      calls.push([a, b]);
      return error ? { data: null, error } : { data: rows.slice(a, b + 1), error: null };
    },
  };
  return { sb: { from: () => q } as never, calls };
}

describe('DP-119 — documents / invoices / latest_vehicle_positions (max_rows)', () => {
  it('provider czyta documents i invoices przez fetchAll* (bez pojedynczego select bez range)', () => {
    const src = readFileSync('src/data/supabaseProvider.ts', 'utf8');
    expect(src).toContain('fetchAllDocuments(sb)');
    expect(src).toContain('fetchAllInvoices(sb)');
    expect(src).not.toContain(
      "sb.from('documents').select('id,load_id,category,file_name,mime_type,size_bytes,valid_until,visible_to,uploaded_at,storage_path,version,superseded_at')",
    );
    expect(src).not.toContain(
      "sb.from('invoices').select(BILL_COLUMNS).not('direction', 'is', null).order('issue_date', { ascending: false }),",
    );
  });

  it('2350 dokumentów = 3 strony; komplet id', async () => {
    const { sb, calls } = fakeDocsSb(2350);
    const r = await fetchAllDocuments(sb);
    expect(calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    expect(r.data).toHaveLength(2350);
    expect(r.data?.[2349].id).toBe('d2349');
  });

  it('1200 faktur = 2 strony; błąd → bez częściowych danych', async () => {
    const { sb, calls } = fakeInvSb(1200);
    expect((await fetchAllInvoices(sb)).data).toHaveLength(1200);
    expect(calls).toEqual([[0, 999], [1000, 1999]]);
    const bad = fakeInvSb(10, { message: 'x' });
    const r = await fetchAllInvoices(bad.sb);
    expect(r.data).toBeNull();
    expect(r.error?.message).toBe('x');
  });

  it('latestPositions: RPC ze stronami Range; >1000 pozycji → komplet', async () => {
    const calls: [number, number][] = [];
    const total = 1500;
    const all = Array.from({ length: total }, (_, i) => ({
      load_id: `l${i}`, code: `C${i}`, lat: 1, lon: 2, ts: '2026-11-03T12:00:00Z',
    }));
    const sb = {
      rpc: (_name: string, _args: unknown) => {
        const q = {
          range: async (a: number, b: number) => {
            calls.push([a, b]);
            return { data: all.slice(a, b + 1), error: null };
          },
        };
        return q;
      },
    };
    const store = supabaseStore(sb as never);
    const rows = await store.latestPositions(30);
    expect(calls).toEqual([[0, SAILINGS_PAGE_SIZE - 1], [SAILINGS_PAGE_SIZE, 2 * SAILINGS_PAGE_SIZE - 1]]);
    expect(rows).toHaveLength(1500);
    expect(rows[1499]?.load_id).toBe('l1499');
  });

  it('latestPositions: błąd na 2. stronie → wyjątek (bez częściowej listy jako pełnej)', async () => {
    const sb = {
      rpc: () => ({
        range: async (a: number) => {
          if (a >= SAILINGS_PAGE_SIZE) return { data: null, error: { message: 'rpc-fail' } };
          return {
            data: Array.from({ length: SAILINGS_PAGE_SIZE }, (_, i) => ({
              load_id: `l${i}`, code: 'c', lat: 0, lon: 0, ts: '2026-11-03T00:00:00Z',
            })),
            error: null,
          };
        },
      }),
    };
    await expect(supabaseStore(sb as never).latestPositions(30)).rejects.toThrow(/rpc-fail/);
  });
});
