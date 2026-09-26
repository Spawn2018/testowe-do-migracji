/**
 * F-KLUCZ — czy wywołanie pochodzi od zadania systemowego (pg_cron → pg_net z kluczem service role z Vault).
 * Platforma wstrzykuje do funkcji SUPABASE_SERVICE_ROLE_KEY w innej postaci niż klucz legacy w Vault
 * (26.09.2026: porównanie wprost dawało 403 dla każdego zadania). Kolejność:
 *  1) token równy kluczowi z env — przyjęty;
 *  2) token JWT z rolą service_role — podpis potwierdza PostgREST (tabela bez GRANT dla anon/authenticated:
 *     200 wyłącznie dla ważnego klucza service role; podrobiony podpis → 401).
 */
export function jwtRole(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(parts[1].length / 4) * 4, '=');
    const claims = JSON.parse(atob(b64)) as { role?: unknown };
    return typeof claims.role === 'string' ? claims.role : null;
  } catch {
    return null;
  }
}

export async function isServiceRequest(
  req: Request,
  env: { url: string; service: string },
  fetchFn: typeof fetch = fetch,
): Promise<boolean> {
  const auth = req.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7).trim();
  if (!token) return false;
  if (env.service && token === env.service) return true;
  if (jwtRole(token) !== 'service_role' || !env.url) return false;
  try {
    const r = await fetchFn(`${env.url}/rest/v1/system_heartbeat?select=id&limit=1`, {
      headers: { apikey: token, Authorization: `Bearer ${token}` },
    });
    return r.ok;
  } catch {
    return false;
  }
}
