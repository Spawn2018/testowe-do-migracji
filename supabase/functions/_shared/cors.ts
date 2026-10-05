/** CORS dla funkcji Edge wołanych z przeglądarki Watch Tower (SEC-OWASP D). */
export const TOWER_ORIGIN = 'https://tower.log-mar.pl';

export function corsHeaders(extra: HeadersInit = {}): HeadersInit {
  return {
    'access-control-allow-origin': TOWER_ORIGIN,
    'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    vary: 'Origin',
    ...extra,
  };
}

export function corsJson(body: unknown, status = 200, extra: HeadersInit = {}): Response {
  return Response.json(body, { status, headers: corsHeaders(extra) });
}

export function corsPreflight(): Response {
  return new Response(null, { headers: corsHeaders() });
}
