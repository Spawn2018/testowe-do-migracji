/**
 * B-MAPA — kafelek HERE Raster Tile API v3 (logistics.day / logistics.night).
 * Klucz zostaje na serwerze. Od 80% budżetu funkcja nie woła HERE.
 *
 * AUD-01 (audyt 06.10, A1): przeglądarka pobiera kafelki z `/tiles/<motyw>/<z>/<x>/<y>` na domenie aplikacji;
 * Vercel przepisuje to tutaj i trzyma odpowiedź 200 w pamięci brzegu (`Vercel-CDN-Cache-Control`). Żądanie
 * z nagłówkiem `Authorization` Vercel zawsze pomija pamięć, więc token sesji przychodzi w `x-wt-token`
 * (lokalnie dalej może przyjść w `Authorization`). Wdrożenie z `--no-verify-jwt` (jak driver-photo) — sesję
 * sprawdza funkcja sama (`auth.getUser`), bez ważnej sesji: 401 bez pamięci. Licznik D-78 (`here_note_service`)
 * liczy każde pobranie z HERE (trafienie w pamięć brzegu HERE nie kosztuje i nie jest liczone).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, corsPreflight } from '../_shared/cors.ts';

const NO_STORE = { 'cache-control': 'no-store' };
/** Pamięć brzegu Vercel: 7 dni; przeglądarka: 1 dzień. */
export const TILE_CACHE = {
  'cache-control': 'public, max-age=86400',
  'vercel-cdn-cache-control': 'max-age=604800',
};

export function tileToken(req: Request): string {
  const own = (req.headers.get('x-wt-token') ?? '').trim();
  if (own) return own;
  const auth = req.headers.get('Authorization') ?? '';
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
}

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight();
  const url = new URL(req.url);
  const z = Number(url.searchParams.get('z'));
  const x = Number(url.searchParams.get('x'));
  const y = Number(url.searchParams.get('y'));
  const theme = url.searchParams.get('theme') === 'dark' ? 'dark' : 'light';
  const max = 2 ** z;
  if (!Number.isInteger(z) || z < 0 || z > 19 || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= max || y >= max) {
    return Response.json({ error: 'zly kafel' }, { status: 400, headers: corsHeaders(NO_STORE) });
  }
  const token = tileToken(req);
  if (!token || token.split('.').length !== 3) return Response.json({ fallback: true }, { status: 401, headers: corsHeaders(NO_STORE) });
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  // Sesja i budżet równolegle (wcześniej po kolei).
  const [user, open] = await Promise.all([sb.auth.getUser(token), sb.rpc('here_tiles_open')]);
  if (!user.data.user) return Response.json({ fallback: true }, { status: 401, headers: corsHeaders(NO_STORE) });
  if (open.error || open.data !== true) {
    return Response.json({ fallback: true }, { status: 409, headers: corsHeaders(NO_STORE) });
  }
  const key = Deno.env.get('HERE_API_KEY') ?? '';
  if (!key) return Response.json({ fallback: true }, { status: 409, headers: corsHeaders(NO_STORE) });
  const style = theme === 'dark' ? 'logistics.night' : 'logistics.day';
  const upstream = await fetch(
    `https://maps.hereapi.com/v3/base/mc/${z}/${x}/${y}/png?style=${style}&size=256&apiKey=${encodeURIComponent(key)}`,
    { headers: { 'User-Agent': 'WatchTower/1' } },
  );
  if (!upstream.ok) return Response.json({ fallback: true }, { status: 502, headers: corsHeaders(NO_STORE) });
  const note = sb.rpc('here_note_service', { p_service: 'tiles', p_n: 1, p_usd: 0 }).then(() => undefined, () => undefined);
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(note);
  else await note;
  const bytes = new Uint8Array(await upstream.arrayBuffer());
  // Stały origin w CORS — bez `Vary: Origin`, żeby brzeg Vercel trzymał jeden wpis na kafelek.
  const headers = new Headers(corsHeaders({ 'content-type': 'image/png', ...TILE_CACHE }));
  headers.delete('vary');
  return new Response(bytes, { headers });
});
