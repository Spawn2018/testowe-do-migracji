import { describe, expect, it, vi } from 'vitest';
import {
  GRAPH_MAX_BYTES,
  downloadSharePointFile,
  graphClientCredentialsToken,
  hasSharePointSecrets,
  pickSharePointMode,
  resolveFileUrl,
  shareUrlToShareId,
  type GraphEnv,
} from '../supabase/functions/_shared/ksh/graph';

function env(partial: Partial<GraphEnv> = {}): GraphEnv {
  return {
    SHAREPOINT_TENANT_ID: 'tenant-example',
    SHAREPOINT_CLIENT_ID: 'client-example',
    SHAREPOINT_CLIENT_SECRET: 'secret-example',
    SHAREPOINT_FILE_URL: 'https://contoso.sharepoint.com/sites/x/Shared%20Documents/a.xlsx',
    ...partial,
  };
}

describe('A6 SharePoint Graph helpers (_shared/ksh/graph)', () => {
  it('shareId: base64url bez paddingu, prefiks u!', () => {
    const id = shareUrlToShareId('https://example.sharepoint.com/:x:/g/demo');
    expect(id.startsWith('u!')).toBe(true);
    expect(id.includes('=')).toBe(false);
    expect(id.includes('/')).toBe(false);
    expect(id.includes('+')).toBe(false);
  });

  it('ten sam URL → ten sam shareId', () => {
    const u = 'https://contoso.sharepoint.com/sites/x/Shared%20Documents/a.xlsx';
    expect(shareUrlToShareId(u)).toBe(shareUrlToShareId(u));
  });

  it('tryb pliku: test vs prod', () => {
    expect(pickSharePointMode('test')).toBe('test');
    expect(pickSharePointMode('TEST')).toBe('test');
    expect(pickSharePointMode(undefined)).toBe('prod');
    expect(pickSharePointMode('')).toBe('prod');
  });

  it('hasSharePointSecrets: brak sekretów / URL', () => {
    expect(hasSharePointSecrets({})).toBe(false);
    expect(hasSharePointSecrets(env({ SHAREPOINT_CLIENT_SECRET: undefined }))).toBe(false);
    expect(hasSharePointSecrets(env())).toBe(true);
    expect(hasSharePointSecrets(env({
      SHAREPOINT_FILE_MODE: 'test',
      SHAREPOINT_TEST_FILE_URL: 'https://contoso.sharepoint.com/test.xlsx',
    }))).toBe(true);
  });

  it('resolveFileUrl: brak URL → reason bez sekretu', () => {
    const r = resolveFileUrl({ SHAREPOINT_FILE_MODE: 'test' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toContain('SHAREPOINT_TEST_FILE_URL');
  });

  it('token: brak sekretów', async () => {
    const r = await graphClientCredentialsToken({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/brak SHAREPOINT/);
  });

  it('token: HTTP 401 → error bez URL', async () => {
    const fetchFn = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'invalid_client' }), { status: 401 }),
    ) as unknown as typeof fetch;
    const r = await graphClientCredentialsToken(env(), fetchFn);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.http).toBe(401);
      expect(r.error).toBe('invalid_client');
      expect(JSON.stringify(r)).not.toMatch(/contoso|secret-example/);
    }
  });

  it('token: wyjątek sieciowy → network_token', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('error sending request for url (https://login.microsoftonline.com/…)');
    }) as unknown as typeof fetch;
    const r = await graphClientCredentialsToken(env(), fetchFn);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('network_token');
  });

  it('download: driveItem 404', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: { code: 'itemNotFound' } }), { status: 404 });
    }) as unknown as typeof fetch;
    const r = await downloadSharePointFile(env(), fetchFn);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('graph_itemNotFound');
  });

  it('download: brak downloadUrl', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      }
      return new Response(JSON.stringify({ size: 10, name: 'a.xlsx' }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await downloadSharePointFile(env(), fetchFn);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('brak downloadUrl');
  });

  it('download: file_too_large (meta.size)', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      }
      return new Response(JSON.stringify({
        size: GRAPH_MAX_BYTES + 1,
        name: 'a.xlsx',
        '@microsoft.graph.downloadUrl': 'https://example.com/dl',
      }), { status: 200 });
    }) as unknown as typeof fetch;
    const r = await downloadSharePointFile(env(), fetchFn);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('file_too_large');
  });

  it('download: network_item', async () => {
    let n = 0;
    const fetchFn = vi.fn(async () => {
      n += 1;
      if (n === 1) return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      throw new TypeError('reset');
    }) as unknown as typeof fetch;
    const r = await downloadSharePointFile(env(), fetchFn);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('network_item');
  });

  it('download: network_download (fetch)', async () => {
    let n = 0;
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      n += 1;
      const u = String(input);
      if (u.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      }
      if (u.includes('/driveItem')) {
        return new Response(JSON.stringify({
          size: 4,
          name: 'a.xlsx',
          '@microsoft.graph.downloadUrl': 'https://example.com/dl?tempauth=SECRET',
        }), { status: 200 });
      }
      throw new TypeError('timeout');
    }) as unknown as typeof fetch;
    const r = await downloadSharePointFile(env(), fetchFn);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe('network_download');
      expect(JSON.stringify(r)).not.toMatch(/tempauth|SECRET/);
    }
    expect(n).toBe(3);
  });

  it('download: network_download (arrayBuffer)', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      }
      if (u.includes('/driveItem')) {
        return new Response(JSON.stringify({
          size: 4,
          name: 'a.xlsx',
          '@microsoft.graph.downloadUrl': 'https://example.com/dl',
        }), { status: 200 });
      }
      return {
        ok: true,
        status: 200,
        arrayBuffer: async () => {
          throw new TypeError('body reset');
        },
      } as unknown as Response;
    }) as unknown as typeof fetch;
    const r = await downloadSharePointFile(env(), fetchFn);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('network_download');
  });

  it('download: download_http_403', async () => {
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      }
      if (u.includes('/driveItem')) {
        return new Response(JSON.stringify({
          size: 4,
          name: 'a.xlsx',
          '@microsoft.graph.downloadUrl': 'https://example.com/dl',
        }), { status: 200 });
      }
      return new Response('nope', { status: 403 });
    }) as unknown as typeof fetch;
    const r = await downloadSharePointFile(env(), fetchFn);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('download_http_403');
  });

  it('download: file_too_large po pobraniu (byteLength)', async () => {
    const big = new Uint8Array(GRAPH_MAX_BYTES + 1);
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      }
      if (u.includes('/driveItem')) {
        return new Response(JSON.stringify({
          size: 10, // meta.size OK — za duży dopiero body
          name: 'a.xlsx',
          '@microsoft.graph.downloadUrl': 'https://example.com/dl',
        }), { status: 200 });
      }
      return new Response(big, { status: 200 });
    }) as unknown as typeof fetch;
    const r = await downloadSharePointFile(env(), fetchFn);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('file_too_large');
  });

  it('download: OK — bajty bez URL w wyniku', async () => {
    const body = new Uint8Array([1, 2, 3, 4]);
    const fetchFn = vi.fn(async (input: RequestInfo | URL) => {
      const u = String(input);
      if (u.includes('/token')) {
        return new Response(JSON.stringify({ access_token: 'tok' }), { status: 200 });
      }
      if (u.includes('/driveItem')) {
        return new Response(JSON.stringify({
          size: 4,
          name: 'a.xlsx',
          '@microsoft.graph.downloadUrl': 'https://example.com/dl?tempauth=SECRET',
        }), { status: 200 });
      }
      return new Response(body, { status: 200 });
    }) as unknown as typeof fetch;
    const r = await downloadSharePointFile(env(), fetchFn);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.bytes.byteLength).toBe(4);
      expect(r.mode).toBe('prod');
      expect(JSON.stringify(r.meta)).not.toMatch(/tempauth|SECRET|contoso/);
    }
  });
});
