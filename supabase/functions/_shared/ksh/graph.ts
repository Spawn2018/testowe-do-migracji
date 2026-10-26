/**
 * A6 — Microsoft Graph: token aplikacji + odczyt pliku po SHAREPOINT_*_FILE_URL.
 * Logi i wyniki: tylko statusy HTTP i liczby; bez URL, tokenu i treści komórek.
 * F7 #556: try/catch na każdym fetch (stały powód), timeout, limit 10 MB.
 */

export const GRAPH_TOKEN_TIMEOUT_MS = 15_000;
export const GRAPH_ITEM_TIMEOUT_MS = 15_000;
export const GRAPH_DOWNLOAD_TIMEOUT_MS = 30_000;
/** Odrzuć plik większy niż 10 MB (meta.size i byteLength). */
export const GRAPH_MAX_BYTES = 10 * 1024 * 1024;

export type GraphEnv = {
  SHAREPOINT_TENANT_ID?: string;
  SHAREPOINT_CLIENT_ID?: string;
  SHAREPOINT_CLIENT_SECRET?: string;
  /** Plik produkcyjny (odczyt). */
  SHAREPOINT_FILE_URL?: string;
  /** Plik testowy (odczyt + zapis po włączeniu). */
  SHAREPOINT_TEST_FILE_URL?: string;
  /** `test` → TEST_FILE_URL; inaczej FILE_URL. */
  SHAREPOINT_FILE_MODE?: string;
};

export function shareUrlToShareId(fileUrl: string): string {
  const bytes = new TextEncoder().encode(fileUrl);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  const b64 = btoa(bin).replace(/=+$/, '').replace(/\//g, '_').replace(/\+/g, '-');
  return `u!${b64}`;
}

export function pickSharePointMode(fileMode: string | undefined): 'test' | 'prod' {
  return (fileMode || '').toLowerCase() === 'test' ? 'test' : 'prod';
}

/** Czy są sekrety do Graph + adres pliku (bez wycieku wartości). */
export function hasSharePointSecrets(env: GraphEnv): boolean {
  const mode = pickSharePointMode(env.SHAREPOINT_FILE_MODE);
  const url = mode === 'test' ? env.SHAREPOINT_TEST_FILE_URL : env.SHAREPOINT_FILE_URL;
  return Boolean(
    env.SHAREPOINT_TENANT_ID?.trim()
    && env.SHAREPOINT_CLIENT_ID?.trim()
    && env.SHAREPOINT_CLIENT_SECRET?.trim()
    && url?.trim(),
  );
}

/** Wybór adresu pliku — wartości sekretów nie wracają w wyniku. */
export function resolveFileUrl(env: GraphEnv): { ok: true; mode: 'test' | 'prod' } | { ok: false; reason: string } {
  const mode = pickSharePointMode(env.SHAREPOINT_FILE_MODE);
  const url = mode === 'test' ? env.SHAREPOINT_TEST_FILE_URL : env.SHAREPOINT_FILE_URL;
  if (!url || !String(url).trim()) {
    return { ok: false, reason: mode === 'test' ? 'brak SHAREPOINT_TEST_FILE_URL' : 'brak SHAREPOINT_FILE_URL' };
  }
  return { ok: true, mode };
}

export async function graphClientCredentialsToken(
  env: GraphEnv,
  fetchFn: typeof fetch = fetch,
): Promise<{ ok: true; token: string } | { ok: false; http: number; error: string }> {
  const tenant = env.SHAREPOINT_TENANT_ID?.trim();
  const client = env.SHAREPOINT_CLIENT_ID?.trim();
  const secret = env.SHAREPOINT_CLIENT_SECRET?.trim();
  if (!tenant || !client || !secret) {
    return { ok: false, http: 0, error: 'brak SHAREPOINT_TENANT_ID/CLIENT_ID/CLIENT_SECRET' };
  }
  let res: Response;
  try {
    res = await fetchFn(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: client,
        client_secret: secret,
        scope: 'https://graph.microsoft.com/.default',
        grant_type: 'client_credentials',
      }),
      signal: AbortSignal.timeout(GRAPH_TOKEN_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, http: 0, error: 'network_token' };
  }
  const body = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok || typeof body.access_token !== 'string') {
    return {
      ok: false,
      http: res.status,
      error: typeof body.error === 'string' ? body.error : `token_http_${res.status}`,
    };
  }
  return { ok: true, token: body.access_token };
}

export type DriveItemMeta = {
  http: number;
  size: number | null;
  namePresent: boolean;
  downloadHttp?: number;
  bytes?: number;
  errorCode?: string;
  /** eTag z driveItem — do PUT If-Match (F7 #560). Nie logować treści URL. */
  eTag?: string | null;
};

/**
 * Odczyt meta + bajty pliku po share URL z env (URL nie jest argumentem — nie trafia do logów wywołującego).
 */
export async function downloadSharePointFile(
  env: GraphEnv,
  fetchFn: typeof fetch = fetch,
): Promise<
  | { ok: true; mode: 'test' | 'prod'; bytes: Uint8Array; meta: DriveItemMeta }
  | { ok: false; reason: string; meta: DriveItemMeta }
> {
  const resolved = resolveFileUrl(env);
  if (!resolved.ok) {
    return { ok: false, reason: resolved.reason, meta: { http: 0, size: null, namePresent: false } };
  }
  const fileUrl = resolved.mode === 'test' ? env.SHAREPOINT_TEST_FILE_URL! : env.SHAREPOINT_FILE_URL!;
  const tok = await graphClientCredentialsToken(env, fetchFn);
  if (!tok.ok) {
    return {
      ok: false,
      reason: tok.error,
      meta: { http: tok.http, size: null, namePresent: false, errorCode: tok.error },
    };
  }
  const shareId = shareUrlToShareId(fileUrl);
  let itemRes: Response;
  try {
    itemRes = await fetchFn(`https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem`, {
      headers: { Authorization: `Bearer ${tok.token}` },
      signal: AbortSignal.timeout(GRAPH_ITEM_TIMEOUT_MS),
    });
  } catch {
    return {
      ok: false,
      reason: 'network_item',
      meta: { http: 0, size: null, namePresent: false, errorCode: 'network_item' },
    };
  }
  const item = await itemRes.json().catch(() => ({} as Record<string, unknown>));
  const err = item.error as { code?: string } | undefined;
  const eTagRaw = item.eTag ?? item['@odata.etag'];
  const meta: DriveItemMeta = {
    http: itemRes.status,
    size: typeof item.size === 'number' ? item.size : null,
    namePresent: typeof item.name === 'string',
    errorCode: err?.code,
    eTag: typeof eTagRaw === 'string' && eTagRaw.trim() ? eTagRaw.trim() : null,
  };
  if (!itemRes.ok) {
    return {
      ok: false,
      reason: err?.code ? `graph_${err.code}` : `driveItem_http_${itemRes.status}`,
      meta,
    };
  }
  if (typeof item.size === 'number' && item.size > GRAPH_MAX_BYTES) {
    return { ok: false, reason: 'file_too_large', meta };
  }
  const dlUrl = item['@microsoft.graph.downloadUrl'];
  if (typeof dlUrl !== 'string' || !dlUrl) {
    return { ok: false, reason: 'brak downloadUrl', meta };
  }
  let dl: Response;
  try {
    dl = await fetchFn(dlUrl, { signal: AbortSignal.timeout(GRAPH_DOWNLOAD_TIMEOUT_MS) });
  } catch {
    return {
      ok: false,
      reason: 'network_download',
      meta: { ...meta, errorCode: 'network_download' },
    };
  }
  let buf: Uint8Array;
  try {
    buf = new Uint8Array(await dl.arrayBuffer());
  } catch {
    return {
      ok: false,
      reason: 'network_download',
      meta: { ...meta, downloadHttp: dl.status, errorCode: 'network_download' },
    };
  }
  meta.downloadHttp = dl.status;
  meta.bytes = buf.byteLength;
  if (!dl.ok) {
    return { ok: false, reason: `download_http_${dl.status}`, meta };
  }
  if (buf.byteLength > GRAPH_MAX_BYTES) {
    return { ok: false, reason: 'file_too_large', meta };
  }
  return { ok: true, mode: resolved.mode, bytes: buf, meta };
}

/**
 * Zapis bajtów xlsx przez Graph (PUT content). Adres tylko z env — nie w wyniku.
 * F7 #560: If-Match z eTag odczytu; 412 → etag_mismatch (pending bez sprawy).
 * A6: tylko gdy write_enabled (Edge); CI bez SharePoint — mock fetch.
 */
export async function uploadSharePointFile(
  env: GraphEnv,
  bytes: Uint8Array,
  fetchFn: typeof fetch = fetch,
  opts?: { ifMatch?: string | null },
): Promise<
  | { ok: true; mode: 'test' | 'prod'; meta: { http: number; bytes: number } }
  | { ok: false; reason: string; meta: { http: number; bytes: number } }
> {
  const resolved = resolveFileUrl(env);
  if (!resolved.ok) {
    return { ok: false, reason: resolved.reason, meta: { http: 0, bytes: bytes.byteLength } };
  }
  if (bytes.byteLength > GRAPH_MAX_BYTES) {
    return { ok: false, reason: 'file_too_large', meta: { http: 0, bytes: bytes.byteLength } };
  }
  // F7 r2 BLOKER 3: brak eTag → bez PUT i bez tokenu (nie nadpisuj bez warunku).
  const ifMatch = opts?.ifMatch?.trim();
  if (!ifMatch) {
    return {
      ok: false,
      reason: 'no_etag',
      meta: { http: 0, bytes: bytes.byteLength },
    };
  }
  const fileUrl = resolved.mode === 'test' ? env.SHAREPOINT_TEST_FILE_URL! : env.SHAREPOINT_FILE_URL!;
  const tok = await graphClientCredentialsToken(env, fetchFn);
  if (!tok.ok) {
    return {
      ok: false,
      reason: tok.error,
      meta: { http: tok.http, bytes: bytes.byteLength },
    };
  }
  const shareId = shareUrlToShareId(fileUrl);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${tok.token}`,
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'If-Match': ifMatch,
  };
  let putRes: Response;
  try {
    putRes = await fetchFn(`https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem/content`, {
      method: 'PUT',
      headers,
      body: bytes,
      signal: AbortSignal.timeout(GRAPH_DOWNLOAD_TIMEOUT_MS),
    });
  } catch {
    return {
      ok: false,
      reason: 'network_upload',
      meta: { http: 0, bytes: bytes.byteLength },
    };
  }
  if (putRes.status === 412) {
    return {
      ok: false,
      reason: 'etag_mismatch',
      meta: { http: 412, bytes: bytes.byteLength },
    };
  }
  if (!putRes.ok) {
    return {
      ok: false,
      reason: `upload_http_${putRes.status}`,
      meta: { http: putRes.status, bytes: bytes.byteLength },
    };
  }
  return {
    ok: true,
    mode: resolved.mode,
    meta: { http: putRes.status, bytes: bytes.byteLength },
  };
}
