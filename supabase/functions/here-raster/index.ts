/**
 * B-MAPA — kafelek HERE Raster Tile API v3 (logistics.day / logistics.night). Klucz zostaje na serwerze.
 *
 * AUD-01c (polecenie właściciela 06.10 13:45): kafelki są PUBLICZNE (decyzja właściciela) — bez sesji i bez
 * nagłówka autoryzacji, żeby brzeg Vercel mógł je trzymać. Przeglądarka woła `/tiles/<styl>/<z>/<x>/<y>` na domenie
 * aplikacji → funkcja Vercel `api/tiles` (fra1, zdejmuje ciasteczko `__cf_bm` Supabase, które blokowało pamięć
 * brzegu) → ta funkcja w eu-central-1 (Frankfurt) → HERE. Ochrona bez autoryzacji:
 *  - tylko poprawna siatka z/x/y (0 ≤ z ≤ 19) i dozwolone style (light|dark|logistics.day|logistics.night),
 *  - Referer/Origin, jeśli jest, musi być jedną z dwóch domen (albo localhost przy pracy lokalnej),
 *  - limit częstości pobrań z HERE: na adres IP i łącznie na proces (429, bez pamięci),
 *  - budżet D-78 `here_tiles_open` (odczyt raz na 60 s; zamknięty → 409, klient przełącza na zapas),
 *  - licznik D-78: każde prawdziwe pobranie z HERE liczone, zapis zbiorczy co ≤ 2 s (`here_note_service(p_n)`).
 * Pamięć: 200 → `public, s-maxage=<max-age z nagłówka HERE, najwyżej 7 dni>`; 404 spoza siatki → 1 h;
 * inne błędy → `no-store`.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, corsPreflight } from '../_shared/cors.ts';

import { STYLE, gridOk, rateLimiter, refererOk, tileCacheControl } from '../_shared/map/tilePolicy.ts';

const NO_STORE = { 'cache-control': 'no-store' };
const BAD_TILE_CACHE = { 'cache-control': 'public, max-age=3600, s-maxage=3600' };
const rateOk = rateLimiter();

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;
const later = (p: Promise<unknown>) => {
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(p);
};

const sb = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
  auth: { persistSession: false },
});

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

function reply(body: unknown, status: number, extra: Record<string, string>): Response {
  const h = new Headers(corsHeaders(extra));
  h.delete('vary');
  return Response.json(body, { status, headers: h });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight();
  const url = new URL(req.url);
  const style = STYLE[url.searchParams.get('style') ?? url.searchParams.get('theme') ?? ''];
  if (!style) return reply({ error: 'styl' }, 404, NO_STORE);
  const z = Number(url.searchParams.get('z'));
  const x = Number(url.searchParams.get('x'));
  const y = Number(url.searchParams.get('y'));
  if (!gridOk(z, x, y)) {
    return reply({ error: 'zly kafel' }, 404, BAD_TILE_CACHE);
  }
  const ref = req.headers.get('x-wt-referer') ?? req.headers.get('referer') ?? req.headers.get('origin');
  if (!refererOk(ref)) return reply({ error: 'domena' }, 403, NO_STORE);
  if (!(await tilesOpen())) return reply({ fallback: true }, 409, NO_STORE);
  const key = Deno.env.get('HERE_API_KEY') ?? '';
  if (!key) return reply({ fallback: true }, 409, NO_STORE);
  const ip = (req.headers.get('x-wt-client-ip') ?? req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || '?';
  if (!rateOk(ip)) return reply({ error: 'limit' }, 429, { ...NO_STORE, 'retry-after': '60' });
  const upstream = await fetch(
    `https://maps.hereapi.com/v3/base/mc/${z}/${x}/${y}/png?style=${style}&size=256&apiKey=${encodeURIComponent(key)}`,
    { headers: { 'User-Agent': 'WatchTower/1' } },
  );
  noteHereFetch();
  const type = upstream.headers.get('content-type') ?? '';
  if (!upstream.ok || !type.startsWith('image/')) return reply({ fallback: true }, 502, NO_STORE);
  const bytes = new Uint8Array(await upstream.arrayBuffer());
  const hereCc = upstream.headers.get('cache-control');
  const headers = new Headers(corsHeaders({
    'content-type': type,
    'cache-control': tileCacheControl(hereCc),
    'x-here-cache-control': hereCc ?? '',
  }));
  headers.delete('vary');
  return new Response(bytes, { headers });
});
