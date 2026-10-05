/**
 * H-8 A — profil wysokości trasy (standard truck). Auth użytkownika.
 * Pula routing; 0 USD ponad gdy w limicie budżetu.
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { CORRIDOR_LEGS } from '../_shared/here/corridorObstacles.ts';
import {
  buildRouteProfileUrl,
  extractElevations,
  pickLegsForRoute,
  summarizeElevation,
} from '../_shared/here/routeProfile.ts';
import { completeDims } from '../_shared/here/routeCheck.ts';
import { corsHeaders, corsPreflight } from '../_shared/cors.ts';


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsPreflight();
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const auth = req.headers.get('Authorization') ?? '';
  const userClient = createClient(supabaseUrl, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false },
  });
  const user = await userClient.auth.getUser();
  if (!user.data.user) {
    return Response.json({ error: 'unauthorized' }, { status: 401, headers: corsHeaders() });
  }
  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  let body: { loadId?: string } = {};
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'json' }, { status: 400, headers: corsHeaders() });
  }
  const loadId = body.loadId;
  if (!loadId) return Response.json({ error: 'loadId' }, { status: 400, headers: corsHeaders() });

  // dostęp: ten sam co odczyt load (RLS przez user client)
  const loadRes = await userClient.from('loads').select(
    'id,route,combo_height_m,combo_width_m,combo_length_m,combo_weight_t,combo_axle_count,combo_axle_load_t',
  ).eq('id', loadId).maybeSingle();
  if (loadRes.error || !loadRes.data) {
    return Response.json({ error: 'brak_transportu' }, { status: 404, headers: corsHeaders() });
  }

  const spend = await sb.rpc('here_month_spend');
  const budget = 100 * 0.8;
  if (spend.error || Number(spend.data ?? 0) >= budget) {
    return Response.json({ fallback: true, reason: 'budget' }, { status: 409, headers: corsHeaders() });
  }

  const key = Deno.env.get('HERE_API_KEY') ?? '';
  if (!key) return Response.json({ fallback: true, reason: 'no_key' }, { status: 409, headers: corsHeaders() });

  const h1 = await sb.rpc('h1_route_check_enabled').then((r) => r.data === true).catch(() => false);
  const h3 = await sb.rpc('h3_corridor_enabled').then((r) => r.data === true).catch(() => false);
  const dimsOn = h1 || h3;
  const row = loadRes.data;
  const dims = dimsOn
    ? completeDims({
      heightM: row.combo_height_m != null ? Number(row.combo_height_m) : null,
      widthM: row.combo_width_m != null ? Number(row.combo_width_m) : null,
      lengthM: row.combo_length_m != null ? Number(row.combo_length_m) : null,
      weightT: row.combo_weight_t != null ? Number(row.combo_weight_t) : null,
      axleCount: row.combo_axle_count != null ? Number(row.combo_axle_count) : null,
      axleLoadT: row.combo_axle_load_t != null ? Number(row.combo_axle_load_t) : null,
    })
    : null;

  // cache 24h
  const cached = await sb.from('load_route_profiles').select('*').eq('load_id', loadId)
    .gte('fetched_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString()).maybeSingle();
  if (cached.data && !cached.error) {
    return Response.json({
      ok: true,
      cached: true,
      dimsMode: cached.data.dims_mode,
      legs: cached.data.payload,
    }, { headers: corsHeaders() });
  }

  const legNames = pickLegsForRoute(row.route as string | null);
  const legsOut = [];
  let queried = 0;
  for (const name of legNames) {
    const leg = CORRIDOR_LEGS.find((l) => l.leg === name);
    if (!leg) continue;
    const url = buildRouteProfileUrl({
      apiKey: key,
      origin: leg.origin,
      destination: leg.destination,
      dims: dims ?? undefined,
      withNotices: !!(dimsOn && dims),
    });
    const upstream = await fetch(url, { headers: { 'User-Agent': 'WatchTower/1' } });
    queried++;
    if (!upstream.ok) {
      legsOut.push({ leg: name, ok: false, status: upstream.status });
      continue;
    }
    const json = await upstream.json();
    const elev = extractElevations(json);
    const sum = summarizeElevation(elev);
    legsOut.push({
      leg: name,
      ok: true,
      minM: sum.minM,
      maxM: sum.maxM,
      maxDeltaM: sum.maxGradePct,
      samples: sum.samples,
      points: sum.points,
      notices: dimsOn && dims ? 'enabled' : 'after_d83',
    });
  }
  if (queried > 0) {
    await sb.rpc('here_note_service', { p_service: 'routing', p_n: queried, p_usd: 0 });
  }
  const dimsMode = dimsOn && dims ? 'with_dims' : 'standard_truck';
  await sb.from('load_route_profiles').upsert({
    load_id: loadId,
    fetched_at: new Date().toISOString(),
    dims_mode: dimsMode,
    payload: legsOut,
  }, { onConflict: 'load_id' });

  return Response.json({ ok: true, cached: false, dimsMode, legs: legsOut }, { headers: corsHeaders() });
});
