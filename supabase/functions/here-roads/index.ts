/**
 * B-MAPA — geometria trasy ciężarówki HERE do rysowania. Bez wymiarów, bez myta.
 * Zapis na 30 dni. Przy pełnym budżecie (100 USD) nie woła HERE.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { decodeFlexiblePolyline, HERE_TRUCK_TX_USD } from '../_shared/here/routeCheck.ts';
import { ROAD_PL, ROAD_SE, looseRoadOk, roadGeometryOk, type LatLng } from '../_shared/map/draw.ts';

const LEGS = [
  { leg: 'PL-GDN', origin: '52.07391,17.0246', destination: '54.40372,18.6813', spec: ROAD_PL, summary: 'Trasa drogowa Śrem–Gdańsk' },
  { leg: 'SE-NYN', origin: '58.90453,17.95621', destination: '65.80539,21.75914', spec: ROAD_SE, summary: 'Trasa drogowa Nynäshamn–Boden' },
  { leg: 'PL-GDY', origin: '52.07391,17.0246', destination: '54.53321,18.54425', spec: 'loose' as const, summary: 'Trasa drogowa Śrem–Gdynia' },
  { leg: 'SE-KAA', origin: '56.1646,15.6308', destination: '65.80539,21.75914', spec: 'loose' as const, summary: 'Trasa drogowa Karlskrona–Boden' },
] as const;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'authorization, apikey, content-type' } });
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
  if (!user.data.user) return Response.json({ ok: false }, { status: 401 });
  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const spend = await sb.rpc('here_month_spend');
  if (spend.error || Number(spend.data) >= 100) return Response.json({ ok: false, reason: 'budzet' });
  const key = Deno.env.get('HERE_API_KEY') ?? '';
  if (!key) return Response.json({ ok: false, reason: 'brak' });
  const fresh = await sb.from('here_road_geometry').select('leg,fetched_at,points');
  const have = new Map<string, { fetched_at: string; points: unknown }>();
  for (const row of fresh.data ?? []) have.set(String(row.leg), { fetched_at: String(row.fetched_at), points: row.points });
  let stored = 0;
  for (const leg of LEGS) {
    const prev = have.get(leg.leg);
    const age = prev ? Date.now() - Date.parse(prev.fetched_at) : Infinity;
    if (prev && age < 30 * 864e5) continue;
    const routeUrl = new URL('https://router.hereapi.com/v8/routes');
    routeUrl.searchParams.set('transportMode', 'truck');
    routeUrl.searchParams.set('origin', leg.origin);
    routeUrl.searchParams.set('destination', leg.destination);
    routeUrl.searchParams.set('return', 'polyline');
    routeUrl.searchParams.set('apiKey', key);
    const res = await fetch(routeUrl, { headers: { 'User-Agent': 'WatchTower/1' } });
    if (!res.ok) continue;
    await sb.rpc('here_note_service', { p_service: 'routing', p_n: 1, p_usd: HERE_TRUCK_TX_USD });
    const body = await res.json();
    const sections = body?.routes?.[0]?.sections ?? [];
    const line: LatLng[] = [];
    for (const section of sections) {
      if (typeof section?.polyline !== 'string') continue;
      try { line.push(...decodeFlexiblePolyline(section.polyline)); } catch { /* zła polilinia */ }
    }
    const ok = leg.spec === 'loose' ? looseRoadOk(line) : roadGeometryOk(line, leg.spec);
    if (!ok) {
      await sb.rpc('here_store_road', { p_leg: leg.leg, p_points: null, p_summary: leg.summary + ' — geometria odrzucona' });
      continue;
    }
    const save = await sb.rpc('here_store_road', { p_leg: leg.leg, p_points: line, p_summary: leg.summary });
    if (save.error) continue;
    stored += 1;
  }
  return Response.json({ ok: true, stored });
});
