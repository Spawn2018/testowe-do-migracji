/**
 * A6 — zapis WT→plik: konflikt, format dat/godzin, Graph upload (mock fetch).
 */
import { describe, expect, it, vi } from 'vitest';
import { uploadSharePointFile, type GraphEnv } from '../supabase/functions/_shared/ksh/graph';
import { fileRowChangedSinceRead } from '../supabase/functions/_shared/ksh/writeConflict';
import {
  excelDateFromIso,
  excelTimeFromHm,
} from '../supabase/functions/_shared/ksh/xlsxPatchTime';

const env = (): GraphEnv => ({
  SHAREPOINT_TENANT_ID: 't',
  SHAREPOINT_CLIENT_ID: 'c',
  SHAREPOINT_CLIENT_SECRET: 's',
  SHAREPOINT_FILE_URL: 'https://contoso.sharepoint.com/sites/x/Shared%20Documents/a.xlsx',
});

describe('A6 writeConflict', () => {
  it('bez expected → nie konflikt', () => {
    expect(fileRowChangedSinceRead(null, { ld: '2026-11-01', lt: null, dd: null, dt: null })).toBe(false);
  });

  it('brak wiersza w pliku przy expected → konflikt', () => {
    expect(fileRowChangedSinceRead(
      { ld: '2026-11-01', lt: '08:00', dd: '2026-11-05', dt: null },
      null,
    )).toBe(true);
  });

  it('ten sam snap → bez konfliktu; zmiana daty → konflikt', () => {
    const a = { ld: '2026-11-01', lt: '08:00', dd: '2026-11-05', dt: '10:00' };
    expect(fileRowChangedSinceRead(a, { ...a })).toBe(false);
    expect(fileRowChangedSinceRead(a, { ...a, ld: '2026-11-02' })).toBe(true);
  });
});

describe('A6 xlsxPatchTime', () => {
  it('ISO → UTC noon', () => {
    const d = excelDateFromIso('2026-11-15');
    expect(d?.getUTCFullYear()).toBe(2026);
    expect(d?.getUTCMonth()).toBe(10);
    expect(d?.getUTCDate()).toBe(15);
    expect(d?.getUTCHours()).toBe(12);
  });

  it('HH:MM → 1899-12-30', () => {
    const t = excelTimeFromHm('8:30');
    expect(t?.getUTCHours()).toBe(8);
    expect(t?.getUTCMinutes()).toBe(30);
    expect(excelTimeFromHm('bad')).toBeNull();
  });
});

describe('A6 Graph upload', () => {
  it('upload OK — bez URL/tokenu w meta', async () => {
    const body = new Uint8Array([1, 2, 3]);
    const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const u = String(input);
      if (u.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      }
      if (u.includes('/content') && init?.method === 'PUT') {
        expect((init.body as Uint8Array).byteLength).toBe(3);
        return new Response('{}', { status: 200 });
      }
      return new Response('no', { status: 404 });
    }) as unknown as typeof fetch;
    const r = await uploadSharePointFile(env(), body, fetchFn);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.meta.bytes).toBe(3);
      expect(JSON.stringify(r)).not.toMatch(/tempauth|tok|contoso/);
    }
  });

  it('upload network → network_upload', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      }
      throw new TypeError('reset');
    }) as unknown as typeof fetch;
    const r = await uploadSharePointFile(env(), new Uint8Array([1]), fetchFn);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('network_upload');
  });

  it('upload HTTP 403 → upload_http_403', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      }
      return new Response('denied', { status: 403 });
    }) as unknown as typeof fetch;
    const r = await uploadSharePointFile(env(), new Uint8Array([1]), fetchFn);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('upload_http_403');
  });
});
