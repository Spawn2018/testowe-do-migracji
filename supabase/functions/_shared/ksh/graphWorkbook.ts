/**
 * #645 — Microsoft Graph Excel workbook API (sesja + range GET/PATCH).
 * Adres pliku tylko z env; logi = status HTTP, bez URL/tokenu/treści komórek.
 * Uprawnienia: docs MS = tylko delegated Files.ReadWrite (Application: Not supported).
 * Próba tym samym tokenem aplikacji co odczyt; przy 401/403 — meldunek dla właściciela.
 */

import {
  GRAPH_ITEM_TIMEOUT_MS,
  GRAPH_TOKEN_TIMEOUT_MS,
  graphClientCredentialsToken,
  pickSharePointMode,
  resolveFileUrl,
  shareUrlToShareId,
  type GraphEnv,
} from './graph.ts';

export const GRAPH_WORKBOOK_TIMEOUT_MS = 30_000;

export type WorkbookDriveRef = {
  mode: 'test' | 'prod';
  /** Bazowy URL Graph do workbook (…/driveItem lub …/drives/x/items/y). */
  workbookBase: string;
  token: string;
};

export type WorkbookSession = {
  id: string;
  workbookBase: string;
  token: string;
};

function transientReason(http: number): string | null {
  if (http === 423) return 'workbook_http_423';
  if (http === 429) return 'workbook_http_429';
  if (http === 503) return 'workbook_http_503';
  if (http === 504) return 'workbook_http_504';
  if (http === 409) return 'workbook_http_409';
  return null;
}

export function isWorkbookTransientReason(reason: string): boolean {
  return (
    reason === 'workbook_http_423'
    || reason === 'workbook_http_429'
    || reason === 'workbook_http_503'
    || reason === 'workbook_http_504'
    || reason === 'workbook_http_409'
    || reason === 'upload_http_423'
  );
}

/** driveItem → bazowy adres workbook (preferuj drives/items gdy są id). */
export async function resolveWorkbookRef(
  env: GraphEnv,
  fetchFn: typeof fetch = fetch,
): Promise<
  | { ok: true; ref: WorkbookDriveRef }
  | { ok: false; reason: string; http: number }
> {
  const resolved = resolveFileUrl(env);
  if (!resolved.ok) {
    return { ok: false, reason: resolved.reason, http: 0 };
  }
  const tok = await graphClientCredentialsToken(env, fetchFn);
  if (!tok.ok) {
    return { ok: false, reason: tok.error, http: tok.http };
  }
  const fileUrl = resolved.mode === 'test' ? env.SHAREPOINT_TEST_FILE_URL! : env.SHAREPOINT_FILE_URL!;
  const shareId = shareUrlToShareId(fileUrl);
  let itemRes: Response;
  try {
    itemRes = await fetchFn(`https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem`, {
      headers: { Authorization: `Bearer ${tok.token}` },
      signal: AbortSignal.timeout(GRAPH_ITEM_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, reason: 'network_item', http: 0 };
  }
  const item = await itemRes.json().catch(() => ({} as Record<string, unknown>));
  if (!itemRes.ok) {
    const err = item.error as { code?: string } | undefined;
    return {
      ok: false,
      reason: err?.code ? `graph_${err.code}` : `driveItem_http_${itemRes.status}`,
      http: itemRes.status,
    };
  }
  const id = typeof item.id === 'string' ? item.id : '';
  const parent = item.parentReference as { driveId?: string } | undefined;
  const driveId = typeof parent?.driveId === 'string' ? parent.driveId : '';
  const workbookBase = driveId && id
    ? `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${id}`
    : `https://graph.microsoft.com/v1.0/shares/${shareId}/driveItem`;
  return {
    ok: true,
    ref: { mode: resolved.mode, workbookBase, token: tok.token },
  };
}

export async function createWorkbookSession(
  ref: WorkbookDriveRef,
  fetchFn: typeof fetch = fetch,
): Promise<
  | { ok: true; session: WorkbookSession }
  | { ok: false; reason: string; http: number }
> {
  let res: Response;
  try {
    res = await fetchFn(`${ref.workbookBase}/workbook/createSession`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ref.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ persistChanges: true }),
      signal: AbortSignal.timeout(GRAPH_WORKBOOK_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, reason: 'network_workbook_session', http: 0 };
  }
  // Long-running: 202 + Location — uprość: jedno ponowienie GET Location nie w CI mocku.
  if (res.status === 202) {
    const loc = res.headers.get('Location');
    if (!loc) {
      return { ok: false, reason: 'workbook_session_async', http: 202 };
    }
    let op: Response;
    try {
      op = await fetchFn(loc, {
        headers: { Authorization: `Bearer ${ref.token}` },
        signal: AbortSignal.timeout(GRAPH_WORKBOOK_TIMEOUT_MS),
      });
    } catch {
      return { ok: false, reason: 'network_workbook_session', http: 0 };
    }
    const body = await op.json().catch(() => ({} as Record<string, unknown>));
    const status = typeof body.status === 'string' ? body.status : '';
    const sid = (body.result as { id?: string } | undefined)?.id
      ?? (typeof body.id === 'string' ? body.id : '');
    if (status === 'succeeded' && sid) {
      return {
        ok: true,
        session: { id: sid, workbookBase: ref.workbookBase, token: ref.token },
      };
    }
    const tr = transientReason(op.status);
    return {
      ok: false,
      reason: tr ?? `workbook_session_http_${op.status}`,
      http: op.status,
    };
  }
  const body = await res.json().catch(() => ({} as Record<string, unknown>));
  if (!res.ok || typeof body.id !== 'string') {
    const tr = transientReason(res.status);
    return {
      ok: false,
      reason: tr ?? `workbook_session_http_${res.status}`,
      http: res.status,
    };
  }
  return {
    ok: true,
    session: { id: body.id, workbookBase: ref.workbookBase, token: ref.token },
  };
}

export async function closeWorkbookSession(
  session: WorkbookSession,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  try {
    await fetchFn(`${session.workbookBase}/workbook/closeSession`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${session.token}`,
        'Content-Type': 'application/json',
        'workbook-session-id': session.id,
      },
      body: '{}',
      signal: AbortSignal.timeout(GRAPH_TOKEN_TIMEOUT_MS),
    });
  } catch {
    // zamknięcie best-effort
  }
}

type RangePayload = {
  values?: unknown[][];
  numberFormat?: unknown[][];
};

export async function getWorkbookRange(
  session: WorkbookSession,
  sheetNameOrId: string,
  address: string,
  fetchFn: typeof fetch = fetch,
): Promise<
  | { ok: true; values: unknown[][]; numberFormat: unknown[][] | null }
  | { ok: false; reason: string; http: number }
> {
  const encSheet = encodeURIComponent(sheetNameOrId);
  const encAddr = encodeURIComponent(address);
  let res: Response;
  try {
    res = await fetchFn(
      `${session.workbookBase}/workbook/worksheets/${encSheet}/range(address='${encAddr}')`,
      {
        headers: {
          Authorization: `Bearer ${session.token}`,
          'workbook-session-id': session.id,
        },
        signal: AbortSignal.timeout(GRAPH_WORKBOOK_TIMEOUT_MS),
      },
    );
  } catch {
    return { ok: false, reason: 'network_workbook_range', http: 0 };
  }
  const body = await res.json().catch(() => ({} as RangePayload & { error?: { code?: string } }));
  if (!res.ok) {
    const tr = transientReason(res.status);
    return {
      ok: false,
      reason: tr ?? `workbook_range_http_${res.status}`,
      http: res.status,
    };
  }
  return {
    ok: true,
    values: Array.isArray(body.values) ? body.values : [],
    numberFormat: Array.isArray(body.numberFormat) ? body.numberFormat : null,
  };
}

export async function patchWorkbookRange(
  session: WorkbookSession,
  sheetNameOrId: string,
  address: string,
  values: unknown[][],
  fetchFn: typeof fetch = fetch,
): Promise<{ ok: true } | { ok: false; reason: string; http: number }> {
  const encSheet = encodeURIComponent(sheetNameOrId);
  const encAddr = encodeURIComponent(address);
  let res: Response;
  try {
    res = await fetchFn(
      `${session.workbookBase}/workbook/worksheets/${encSheet}/range(address='${encAddr}')`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.token}`,
          'Content-Type': 'application/json',
          'workbook-session-id': session.id,
        },
        body: JSON.stringify({ values }),
        signal: AbortSignal.timeout(GRAPH_WORKBOOK_TIMEOUT_MS),
      },
    );
  } catch {
    return { ok: false, reason: 'network_workbook_patch', http: 0 };
  }
  if (!res.ok) {
    const tr = transientReason(res.status);
    return {
      ok: false,
      reason: tr ?? `workbook_patch_http_${res.status}`,
      http: res.status,
    };
  }
  return { ok: true };
}

/** Lista arkuszy — pierwszy (pozycja 0) jak xlsxPatch/workbook.xml. */
export async function listWorkbookSheets(
  session: WorkbookSession,
  fetchFn: typeof fetch = fetch,
): Promise<
  | { ok: true; sheets: { id: string; name: string; position: number }[] }
  | { ok: false; reason: string; http: number }
> {
  let res: Response;
  try {
    res = await fetchFn(`${session.workbookBase}/workbook/worksheets`, {
      headers: {
        Authorization: `Bearer ${session.token}`,
        'workbook-session-id': session.id,
      },
      signal: AbortSignal.timeout(GRAPH_WORKBOOK_TIMEOUT_MS),
    });
  } catch {
    return { ok: false, reason: 'network_workbook_sheets', http: 0 };
  }
  const body = await res.json().catch(() => ({} as { value?: unknown[] }));
  if (!res.ok) {
    const tr = transientReason(res.status);
    return {
      ok: false,
      reason: tr ?? `workbook_sheets_http_${res.status}`,
      http: res.status,
    };
  }
  const value = Array.isArray(body.value) ? body.value : [];
  const sheets = value
    .map((s) => {
      const o = s as Record<string, unknown>;
      return {
        id: typeof o.id === 'string' ? o.id : '',
        name: typeof o.name === 'string' ? o.name : '',
        position: typeof o.position === 'number' ? o.position : 999,
      };
    })
    .filter((s) => s.id || s.name)
    .sort((a, b) => a.position - b.position);
  return { ok: true, sheets };
}

export async function getWorkbookUsedRange(
  session: WorkbookSession,
  sheetNameOrId: string,
  fetchFn: typeof fetch = fetch,
): Promise<
  | { ok: true; values: unknown[][]; address: string | null }
  | { ok: false; reason: string; http: number }
> {
  const encSheet = encodeURIComponent(sheetNameOrId);
  let res: Response;
  try {
    res = await fetchFn(
      `${session.workbookBase}/workbook/worksheets/${encSheet}/usedRange(valuesOnly=true)`,
      {
        headers: {
          Authorization: `Bearer ${session.token}`,
          'workbook-session-id': session.id,
        },
        signal: AbortSignal.timeout(GRAPH_WORKBOOK_TIMEOUT_MS),
      },
    );
  } catch {
    return { ok: false, reason: 'network_workbook_used', http: 0 };
  }
  const body = await res.json().catch(() => ({} as {
    values?: unknown[][];
    address?: string;
    error?: { code?: string };
  }));
  if (!res.ok) {
    const tr = transientReason(res.status);
    return {
      ok: false,
      reason: tr ?? `workbook_used_http_${res.status}`,
      http: res.status,
    };
  }
  return {
    ok: true,
    values: Array.isArray(body.values) ? body.values : [],
    address: typeof body.address === 'string' ? body.address : null,
  };
}

export { pickSharePointMode };
