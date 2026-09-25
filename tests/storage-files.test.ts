/** BK4 — pliki w Supabase Storage: sink (RPC + upload + link 15 min), mapowanie, brak bajtów w localStorage. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createStorageSink, splitStoragePath } from '../src/data/storageFiles';
import { DOC_CAT_TO_DB, documentFromRow } from '../src/data/mappers';
import { SIGNED_URL_TTL_S, getFileSink, isStoredDoc, registerFileSink, type FileSink } from '../src/data/registry';
import { attachDocumentFile, usesStorage } from '../src/lib/docFiles';
import { useTowerStore } from '../src/store/useTowerStore';
import type { Document } from '../src/types';

const LOAD = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DOC = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const PATH = `dokumenty/pppp/${LOAD}/${DOC}/cmr.pdf`;

function fakeClient(opts: { uploadError?: string } = {}) {
  const calls: { rpc: [string, unknown][]; upload: unknown[][]; signed: unknown[][] } = { rpc: [], upload: [], signed: [] };
  const sb = {
    rpc: vi.fn(async (fn: string, args: unknown) => {
      calls.rpc.push([fn, args]);
      if (fn === 'create_document') {
        return { data: [{ id: DOC, bucket: 'dokumenty', object_path: PATH.slice('dokumenty/'.length), storage_path: PATH }], error: null };
      }
      return { data: true, error: null };
    }),
    storage: {
      from: (bucket: string) => ({
        upload: async (...a: unknown[]) => {
          calls.upload.push([bucket, ...a]);
          return opts.uploadError ? { data: null, error: { message: opts.uploadError } } : { data: { path: a[0] }, error: null };
        },
        createSignedUrl: async (...a: unknown[]) => {
          calls.signed.push([bucket, ...a]);
          return { data: { signedUrl: `https://x.supabase.co/storage/v1/object/sign/${bucket}/${String(a[0])}?token=t` }, error: null };
        },
      }),
    },
  };
  return { sb: sb as unknown as SupabaseClient, calls };
}

afterEach(() => registerFileSink(null));

describe('BK4 storage sink', () => {
  it('signed links are valid for exactly 15 minutes', () => {
    expect(SIGNED_URL_TTL_S).toBe(15 * 60);
  });
  it('upload: RPC registers (DB category) → upload to the server path without upsert → doc with storagePath, no bytes', async () => {
    const { sb, calls } = fakeClient();
    const file = new File([new Uint8Array(1234)], 'mocowanie.jpg', { type: 'image/jpeg' });
    const doc = await createStorageSink(sb, () => '2026-09-26T00:00:00Z').upload({
      loadId: LOAD, category: 'LASHING_PHOTOS', file, name: file.name, mimeType: file.type,
    });
    expect(calls.rpc[0]).toEqual(['create_document', {
      p_load_id: LOAD, p_category: 'LASHING_PHOTO', p_file_name: 'mocowanie.jpg', p_mime: 'image/jpeg', p_size: 1234,
    }]);
    expect(calls.upload[0][0]).toBe('dokumenty');
    expect(calls.upload[0][1]).toBe(PATH.slice('dokumenty/'.length));
    expect(calls.upload[0][3]).toEqual({ contentType: 'image/jpeg', upsert: false });
    expect(doc).toMatchObject({ id: DOC, loadId: LOAD, storagePath: PATH, dataUrl: null, bytes: 1234, status: 'UPLOADED' });
  });
  it('failed upload withdraws the registration and throws', async () => {
    const { sb, calls } = fakeClient({ uploadError: 'mime type not supported' });
    const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    await expect(createStorageSink(sb).upload({ loadId: LOAD, category: 'CMR', file, name: 'a.pdf', mimeType: 'application/pdf' }))
      .rejects.toThrow('mime type not supported');
    expect(calls.rpc.map((c) => c[0])).toEqual(['create_document', 'discard_document']);
    expect(calls.rpc[1][1]).toEqual({ p_id: DOC });
  });
  it('signedUrl: bucket/path split, TTL 900 s, optional download name', async () => {
    const { sb, calls } = fakeClient();
    const sink = createStorageSink(sb);
    const d = { storagePath: PATH, name: 'cmr.pdf' } as Document;
    expect(await sink.signedUrl(d)).toContain('/object/sign/dokumenty/');
    await sink.signedUrl(d, { download: 'cmr.pdf' });
    expect(calls.signed[0]).toEqual(['dokumenty', PATH.slice('dokumenty/'.length), 900, undefined]);
    expect(calls.signed[1][3]).toEqual({ download: 'cmr.pdf' });
    await expect(sink.signedUrl({ storagePath: null } as Document)).rejects.toThrow();
  });
  it('splitStoragePath / category mapping / row mapping', () => {
    expect(splitStoragePath('faktury/a/b.pdf')).toEqual(['faktury', 'a/b.pdf']);
    expect(() => splitStoragePath('bez-koszyka')).toThrow();
    expect(DOC_CAT_TO_DB).toMatchObject({ LASHING_PHOTOS: 'LASHING_PHOTO', DRAWING: 'SPEC', CMR: 'CMR', INVOICE: 'INVOICE' });
    const d = documentFromRow({
      id: DOC, load_id: LOAD, category: 'CMR', file_name: 'cmr.pdf', mime_type: 'application/pdf', size_bytes: 10,
      valid_until: null, visible_to: ['FORWARDER', 'CLIENT', 'CARRIER'], uploaded_at: '2026-09-26T00:00:00Z', storage_path: PATH,
    });
    expect(d?.storagePath).toBe(PATH);
    expect(isStoredDoc(d!)).toBe(true);
  });
});

describe('BK4 app flow', () => {
  it('with a file sink and a server load → document goes to Storage (store keeps metadata only)', async () => {
    const stored: Document = {
      id: DOC, loadId: LOAD, category: 'POD', name: 'pod.pdf', uploadedAt: '2026-09-26T00:00:00Z', deadline: null,
      status: 'UPLOADED', permitFits: null, visibleTo: ['HHL', 'KSH', 'SCX'], dataUrl: null, mimeType: 'application/pdf',
      bytes: 3, source: 'tower', storagePath: PATH,
    };
    const sink: FileSink = { upload: vi.fn(async () => stored), signedUrl: vi.fn(async () => 'https://signed') };
    registerFileSink(sink);
    expect(getFileSink()).toBe(sink);
    expect(usesStorage(LOAD)).toBe(true);
    expect(usesStorage('load-001')).toBe(false); // id demo nigdy do Storage
    const ok = await attachDocumentFile(new File(['abc'], 'pod.pdf', { type: 'application/pdf' }), LOAD, 'POD', { driverToken: 'demo-active' });
    expect(ok).toBe(true);
    const inStore = useTowerStore.getState().documents.find((d) => d.id === DOC)!;
    expect(inStore).toMatchObject({ storagePath: PATH, dataUrl: null, source: 'driver' });
    expect(useTowerStore.getState().events.some((e) => e.type === 'DOC_UPLOADED' && e.payload?.documentId === DOC)).toBe(true);
  });
  it('sink error → PL toast, nothing stored', async () => {
    registerFileSink({ upload: async () => { throw new Error('Transport niewidoczny dla konta'); }, signedUrl: async () => '' });
    const before = useTowerStore.getState().documents.length;
    const ok = await attachDocumentFile(new File(['x'], 'x.pdf', { type: 'application/pdf' }), LOAD, 'CMR');
    expect(ok).toBe(false);
    expect(useTowerStore.getState().documents.length).toBe(before);
    expect(useTowerStore.getState().toasts.at(-1)?.message ?? useTowerStore.getState().toasts[0]?.message).toContain('Nie zapisano pliku');
  });
  it('demo persist: file bytes (driver photos) never go to localStorage', () => {
    const partialize = useTowerStore.persist.getOptions().partialize!;
    const st = useTowerStore.getState();
    const withBytes = { ...st, documents: [{ ...st.documents[0], dataUrl: 'data:image/jpeg;base64,AAAA', source: 'driver' as const }] };
    const out = partialize(withBytes) as { documents: Document[] };
    expect(out.documents[0].dataUrl).toBeNull();
    expect(out.documents[0].name).toBe(st.documents[0].name);
  });
  it('Storage code stays out of the demo bundle: only the lazy bridge imports storageFiles', () => {
    expect(readFileSync('src/data/supabaseBridge.ts', 'utf8')).toContain("from './storageFiles'");
    for (const f of ['src/lib/docFiles.ts', 'src/lib/zipDocs.ts', 'src/components/ui/DocPreview.tsx', 'src/store/useTowerStore.ts']) {
      const src = readFileSync(f, 'utf8');
      expect(src).not.toMatch(/storageFiles|@supabase\/supabase-js/);
    }
  });
});
