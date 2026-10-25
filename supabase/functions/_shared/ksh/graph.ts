/**
 * A6 — Microsoft Graph: token aplikacji + odczyt pliku po SHAREPOINT_*_FILE_URL.
 * Logi i wyniki: tylko statusy HTTP i liczby; bez URL, tokenu i treści komórek.
 */

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

/** Wybór adresu pliku — wartości sekretów nie wracają w wyniku. */
export function resolveFileUrl(env: GraphEnv): { ok: true; mode: 'test' | 'prod' } | { ok: false; reason: string } {
  const mode = (env.SHAREPOINT_FILE_MODE || '').toLowerCase() === 'test' ? 'test' : 'prod';
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
  const res = await fetchFn(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: client,
      client_secret: secret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });
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
  const itemRes = await fetchFn(`https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem`, {
    headers: { Authorization: `Bearer ${tok.token}` },
  });
  const item = await itemRes.json().catch(() => ({} as Record<string, unknown>));
  const err = item.error as { code?: string } | undefined;
  const meta: DriveItemMeta = {
    http: itemRes.status,
    size: typeof item.size === 'number' ? item.size : null,
    namePresent: typeof item.name === 'string',
    errorCode: err?.code,
  };
  if (!itemRes.ok) {
    return {
      ok: false,
      reason: err?.code ? `graph_${err.code}` : `driveItem_http_${itemRes.status}`,
      meta,
    };
  }
  const dlUrl = item['@microsoft.graph.downloadUrl'];
  if (typeof dlUrl !== 'string' || !dlUrl) {
    return { ok: false, reason: 'brak downloadUrl', meta };
  }
  const dl = await fetchFn(dlUrl);
  const buf = new Uint8Array(await dl.arrayBuffer());
  meta.downloadHttp = dl.status;
  meta.bytes = buf.byteLength;
  if (!dl.ok) {
    return { ok: false, reason: `download_http_${dl.status}`, meta };
  }
  return { ok: true, mode: resolved.mode, bytes: buf, meta };
}
