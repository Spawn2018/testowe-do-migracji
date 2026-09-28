/** III-6 (SCOPE 6.2) — nowa wersja dokumentu: sink wywołuje document_supersede po wgraniu; mapowanie wersji. */
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createStorageSink } from '../src/data/storageFiles';
import { documentFromRow } from '../src/data/mappers';

const LOAD = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NEW = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const OLD = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

function fake(supersede: { data: unknown; error: { message: string } | null }) {
  const rpc: [string, unknown][] = [];
  const sb = {
    rpc: vi.fn(async (fn: string, args: unknown) => {
      rpc.push([fn, args]);
      if (fn === 'create_document') return { data: [{ id: NEW, bucket: 'dokumenty', object_path: 'p/x.pdf', storage_path: 'dokumenty/p/x.pdf' }], error: null };
      if (fn === 'document_supersede') return supersede;
      return { data: null, error: null };
    }),
    storage: { from: () => ({ upload: async () => ({ data: {}, error: null }) }) },
  };
  return { sb: sb as unknown as SupabaseClient, rpc };
}
const file = new File([new Uint8Array(10)], 'cmr2.pdf', { type: 'application/pdf' });

describe('III-6 wersje dokumentów', () => {
  it('supersedes → document_supersede(nowy, poprzedni) po wgraniu; wersja z serwera', async () => {
    const { sb, rpc } = fake({ data: 2, error: null });
    const doc = await createStorageSink(sb).upload({ loadId: LOAD, category: 'CMR', file, name: file.name, mimeType: file.type, supersedes: OLD });
    expect(rpc.map((r) => r[0])).toEqual(['create_document', 'document_supersede']);
    expect(rpc[1][1]).toEqual({ p_new: NEW, p_old: OLD });
    expect(doc.version).toBe(2);
    expect(doc.versionError).toBeUndefined();
  });
  it('bez supersedes — bez wywołania; błąd serwera → plik zostaje, versionError', async () => {
    const a = fake({ data: 2, error: null });
    const d1 = await createStorageSink(a.sb).upload({ loadId: LOAD, category: 'CMR', file, name: file.name, mimeType: file.type });
    expect(a.rpc.map((r) => r[0])).toEqual(['create_document']);
    expect(d1.version).toBe(1);
    const b = fake({ data: null, error: { message: 'Poprzednia wersja jest już zastąpiona' } });
    const d2 = await createStorageSink(b.sb).upload({ loadId: LOAD, category: 'CMR', file, name: file.name, mimeType: file.type, supersedes: OLD });
    expect(d2).toMatchObject({ id: NEW, version: 1, versionError: 'Poprzednia wersja jest już zastąpiona' });
  });
  it('mapowanie wiersza: version i superseded_at', () => {
    const base = { id: NEW, load_id: LOAD, category: 'CMR', file_name: 'a.pdf', mime_type: null, size_bytes: null, valid_until: null, visible_to: [], uploaded_at: '2026-09-28T00:00:00Z' };
    expect(documentFromRow({ ...base, version: 3, superseded_at: null })).toMatchObject({ version: 3, superseded: false });
    expect(documentFromRow({ ...base, version: 1, superseded_at: '2026-09-28T01:00:00Z' })).toMatchObject({ superseded: true });
  });
});
