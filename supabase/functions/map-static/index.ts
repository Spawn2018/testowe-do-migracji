/**
 * H-7 — statyczna mapa HERE (pojazd / trasa) do e-maila i PDF.
 * Odpowiedź: image/png. Przy braku budżetu / klucza → 409 JSON { fallback: true }.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildMapImageUrl } from '../_shared/here/mapImage.ts';

function cors(): HeadersInit {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, apikey, content-type',
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors() });
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const auth = req.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const user = await userClient.auth.getUser();
  const isService = auth.includes(serviceKey) && serviceKey.length > 20;
  if (!user.data.user && !isService) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: cors() });
  }
  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const open = await sb.rpc('here_tiles_open');
  if (open.error || open.data !== true) {
    return Response.json({ fallback: true }, { status: 409, headers: cors() });
  }
  const key = Deno.env.get('HERE_API_KEY') ?? '';
  if (!key) return Response.json({ fallback: true }, { status: 409, headers: cors() });

  let body: {
    lat?: number; lon?: number; lat2?: number; lon2?: number;
    polyline?: string; width?: number; height?: number;
  } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'json' }, { status: 400, headers: cors() });
  }
  const points = [];
  if (typeof body.lat === 'number' && typeof body.lon === 'number') {
    points.push({ lat: body.lat, lon: body.lon, label: 'P' });
  }
  if (typeof body.lat2 === 'number' && typeof body.lon2 === 'number') {
    points.push({ lat: body.lat2, lon: body.lon2, label: 'D' });
  }
  if (!points.length && !body.polyline) {
    return Response.json({ error: 'brak punktu/trasy' }, { status: 400, headers: cors() });
  }
  const url = buildMapImageUrl({
    apiKey: key,
    points,
    polyline: body.polyline,
    width: body.width,
    height: body.height,
  });
  const upstream = await fetch(url, { headers: { 'User-Agent': 'WatchTower/1' } });
  if (!upstream.ok) {
    return Response.json({ fallback: true, status: upstream.status }, { status: 502, headers: cors() });
  }
  await sb.rpc('here_note_service', { p_service: 'tiles', p_n: 1, p_usd: 0 });
  const bytes = new Uint8Array(await upstream.arrayBuffer());
  return new Response(bytes, {
    headers: { 'content-type': 'image/png', 'cache-control': 'private, max-age=3600', ...cors() },
  });
});
