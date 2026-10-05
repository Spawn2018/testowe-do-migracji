/**
 * B-MAPA — kafelek HERE Raster Tile API v3 (logistics.day / logistics.night).
 * Klucz zostaje na serwerze. Od 80% budżetu funkcja nie woła HERE.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, corsPreflight } from '../_shared/cors.ts';


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight();
  const url = new URL(req.url);
  const z = Number(url.searchParams.get('z'));
  const x = Number(url.searchParams.get('x'));
  const y = Number(url.searchParams.get('y'));
  const theme = url.searchParams.get('theme') === 'dark' ? 'dark' : 'light';
  const max = 2 ** z;
  if (!Number.isInteger(z) || z < 0 || z > 19 || !Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= max || y >= max) {
    return Response.json({ error: 'zly kafel' }, { status: 400, headers: corsHeaders() });
  }
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const auth = req.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const user = await userClient.auth.getUser();
  if (!user.data.user) return Response.json({ fallback: true }, { status: 401, headers: corsHeaders() });
  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const open = await sb.rpc('here_tiles_open');
  if (open.error || open.data !== true) {
    return Response.json({ fallback: true }, { status: 409, headers: corsHeaders() });
  }
  const key = Deno.env.get('HERE_API_KEY') ?? '';
  if (!key) return Response.json({ fallback: true }, { status: 409, headers: corsHeaders() });
  const style = theme === 'dark' ? 'logistics.night' : 'logistics.day';
  const upstream = await fetch(
    `https://maps.hereapi.com/v3/base/mc/${z}/${x}/${y}/png?style=${style}&size=256&apiKey=${encodeURIComponent(key)}`,
    { headers: { 'User-Agent': 'WatchTower/1' } },
  );
  if (!upstream.ok) return Response.json({ fallback: true }, { status: 502, headers: corsHeaders() });
  await sb.rpc('here_note_service', { p_service: 'tiles', p_n: 1, p_usd: 0 });
  const bytes = new Uint8Array(await upstream.arrayBuffer());
  return new Response(bytes, {
    headers: { 'content-type': 'image/png', 'cache-control': 'private, max-age=3600', ...corsHeaders() },
  });
});
