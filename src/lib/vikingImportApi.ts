/**
 * BN9-c1 — wywołanie Edge `viking-schedule-import` (#690) i odczyt historii `viking_schedule_imports`.
 * Tylko build z logowaniem: moduł ładuje `SailingsPanel` dynamicznie pod warunkiem `VITE_AUTH_MODE` (paczka demo bez klienta bazy).
 * `fetchImpl` / `client` wstrzykiwane w testach.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase } from '../auth/client';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../auth/config';
import type {
  VikingCall,
  VikingImportApi,
  VikingImportHistoryRow,
  VikingImportRequest,
} from './vikingImport';

export function createVikingImportApi(deps: {
  baseUrl?: string;
  anonKey?: string;
  client?: () => Promise<SupabaseClient>;
  fetchImpl?: typeof fetch;
} = {}): VikingImportApi {
  const baseUrl = (deps.baseUrl ?? SUPABASE_URL).replace(/\/$/, '');
  const anonKey = deps.anonKey ?? SUPABASE_ANON_KEY;
  const client = deps.client ?? getSupabase;
  const doFetch = deps.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));

  async function run(req: VikingImportRequest): Promise<VikingCall<never>> {
    let token: string | undefined;
    try {
      const sb = await client();
      token = (await sb.auth.getSession()).data.session?.access_token;
    } catch {
      return { ok: false, status: 0, error: 'session' };
    }
    if (!token) return { ok: false, status: 401, error: 'Brak sesji' };
    let res: Response;
    try {
      res = await doFetch(`${baseUrl}/functions/v1/viking-schedule-import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, apikey: anonKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(req),
      });
    } catch {
      return { ok: false, status: 0, error: 'network' };
    }
    const body = (await res.json().catch(() => null)) as ({ ok?: boolean; error?: string } & Record<string, unknown>) | null;
    if (!res.ok || !body || body.ok !== true) {
      return { ok: false, status: res.ok ? 500 : res.status, error: typeof body?.error === 'string' ? body.error : '' };
    }
    return { ok: true, data: body as never };
  }

  async function history(limit: number): Promise<VikingImportHistoryRow[] | null> {
    try {
      const sb = await client();
      const { data, error } = await sb
        .from('viking_schedule_imports')
        .select('id,imported_at,file_name,sailing_count,from_at,to_at,stats')
        .order('imported_at', { ascending: false })
        .limit(limit);
      if (error) return null;
      return (data ?? []) as VikingImportHistoryRow[];
    } catch {
      return null;
    }
  }

  return { run, history } as VikingImportApi;
}
