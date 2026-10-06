/**
 * B-MAPA — kafelek HERE Raster Tile API v3 (logistics.day / logistics.night).
 * Klucz zostaje na serwerze. Od 80% budżetu funkcja nie woła HERE.
 *
 * AUD-01 (audyt 06.10, A1): przeglądarka pobiera kafelki z `/tiles/<motyw>/<z>/<x>/<y>` na domenie aplikacji;
 * Vercel przepisuje to tutaj (region funkcji przypięty: `forceFunctionRegion=eu-west-1`, jak baza) i trzyma
 * odpowiedź w pamięci brzegu (`Vercel-CDN-Cache-Control`). Żądanie z `Authorization` Vercel zawsze pomija
 * pamięć, więc token sesji przychodzi w `x-wt-token` (lokalnie może przyjść w `Authorization`).
 * Wdrożenie z `--no-verify-jwt` (jak driver-photo) — sesję sprawdza funkcja.
 *
 * AUD-01b (06.10 11:30): pomiar po zalogowaniu — każdy kafelek robił `auth/v1/user` + `here_tiles_open` +
 * `here_note_service` (3 wywołania bazy/Auth na kafelek, 24 kafelki = 72); w zimnym starcie kolejka do bazy
 * dochodziła do 14 s i dusiła zapytania aplikacji (latest_vehicle_fixes → statement timeout 8 s → 500). Teraz:
 *  - sesja: podpis JWT sprawdzany lokalnie kluczem publicznym Auth (JWKS, ES256; pamięć klucza w procesie) —
 *    zero wywołań bazy; zapasowo `auth.getUser` (np. starszy klucz HS256),
 *  - budżet `here_tiles_open`: odczyt raz na 60 s na proces,
 *  - licznik D-78: każde pobranie z HERE liczone, zapis zbiorczy co ≤ 2 s (`here_note_service(p_n)`) w tle.
 * Do pamięci brzegu trafia tylko 200 (kafelek) i 404 (kafelek spoza siatki); 401/409/502 — `no-store`.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@5.9.6';
import { corsHeaders, corsPreflight } from '../_shared/cors.ts';

const NO_STORE = { 'cache-control': 'no-store' };
/** Pamięć brzegu Vercel: 7 dni; przeglądarka: 1 dzień. */
export const TILE_CACHE = {
  'cache-control': 'public, max-age=86400',
  'vercel-cdn-cache-control': 'max-age=604800',
};
/** Kafelek spoza siatki (z/x/y) — stała odpowiedź, też w pamięci brzegu (1 h). */
const BAD_TILE_CACHE = { 'cache-control': 'public, max-age=3600', 'vercel-cdn-cache-control': 'max-age=3600' };

export function tileToken(req: Request): string {
  const own = (req.headers.get('x-wt-token') ?? '').trim();
  if (own) return own;
  const auth = req.headers.get('Authorization') ?? '';
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
}

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
const later = (p: Promise<unknown>) => {
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(p);
};

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
const JWKS = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`), { cooldownDuration: 60_000, cacheMaxAge: 3_600_000 });

async function sessionOk(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, JWKS, { issuer: `${supabaseUrl}/auth/v1`, audience: 'authenticated' });
    return payload.role === 'authenticated' && typeof payload.sub === 'string' && payload.sub.length > 0;
  } catch (e) {
    const code = (e as { code?: string }).code ?? '';
    // podpis/wygaśnięcie/wystawca złe → odmowa bez sieci; brak klucza (np. HS256) → zapasowo Auth
    if (code === 'ERR_JWT_EXPIRED' || code === 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' || code === 'ERR_JWT_CLAIM_VALIDATION_FAILED') return false;
    const user = await createClient(supabaseUrl, anon, { auth: { persistSession: false } }).auth.getUser(token);
    return Boolean(user.data.user);
  }
}

let openCache: { at: number; open: boolean } | null = null;
async function tilesOpen(): Promise<boolean> {
  const now = Date.now();
  if (openCache && now - openCache.at < 60_000) return openCache.open;
  const r = await sb.rpc('here_tiles_open');
  const open = !r.error && r.data === true;
  openCache = { at: now, open };
  return open;
}

let pending = 0;
let flushing: Promise<void> | null = null;
function noteHereFetch(): void {
  pending += 1;
  if (flushing) return;
  flushing = (async () => {
    await new Promise((r) => setTimeout(r, 2000));
    const n = pending;
    pending = 0;
    flushing = null;
    if (n > 0) await sb.rpc('here_note_service', { p_service: 'tiles', p_n: n, p_usd: 0 }).then(() => undefined, () => undefined);
  })();
  later(flushing);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight();
  const url = new URL(req.url);
  const z = Number(url.searchParams.get('z'));
  const x = Number(url.searchParams.get('x'));
  const y = Number(url.searchParams.get('y'));
  const theme = url.searchParams.get('theme') === 'dark' ? 'dark' : 'light';
  const max = 2 ** z;
  if (!Number.isInteger(z) || z < 0 || z > 19 || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= max || y >= max) {
    const h = new Headers(corsHeaders(BAD_TILE_CACHE));
    h.delete('vary');
    return Response.json({ error: 'zly kafel' }, { status: 404, headers: h });
  }
  const token = tileToken(req);
  if (!token || token.split('.').length !== 3) return Response.json({ fallback: true }, { status: 401, headers: corsHeaders(NO_STORE) });
  const [ok, open] = await Promise.all([sessionOk(token), tilesOpen()]);
  if (!ok) return Response.json({ fallback: true }, { status: 401, headers: corsHeaders(NO_STORE) });
  if (!open) return Response.json({ fallback: true }, { status: 409, headers: corsHeaders(NO_STORE) });
  const key = Deno.env.get('HERE_API_KEY') ?? '';
  if (!key) return Response.json({ fallback: true }, { status: 409, headers: corsHeaders(NO_STORE) });
  const style = theme === 'dark' ? 'logistics.night' : 'logistics.day';
  const upstream = await fetch(
    `https://maps.hereapi.com/v3/base/mc/${z}/${x}/${y}/png?style=${style}&size=256&apiKey=${encodeURIComponent(key)}`,
    { headers: { 'User-Agent': 'WatchTower/1' } },
  );
  if (!upstream.ok) return Response.json({ fallback: true }, { status: 502, headers: corsHeaders(NO_STORE) });
  noteHereFetch();
  const bytes = new Uint8Array(await upstream.arrayBuffer());
  // Stały origin w CORS — bez `Vary: Origin`, żeby brzeg Vercel trzymał jeden wpis na kafelek.
  const headers = new Headers(corsHeaders({ 'content-type': 'image/png', ...TILE_CACHE }));
  headers.delete('vary');
  return new Response(bytes, { headers });
});
