/**
 * B-MAPA — geometria trasy ciężarówki HERE do rysowania. Bez wymiarów, bez myta.
 * Zapis na 30 dni. Przy pełnym budżecie (100 USD) nie woła HERE.
 * #572 BN0 / F7 #585 r2: SE-KAA z via co ~100 km na SE_KAA_TRACK (osobny od E22);
 * odświeżenie przy zmianie korytarza; odrzucenie nie kasuje punktów (ponów po 24 h).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { decodeFlexiblePolyline } from '../_shared/here/routeCheck.ts';
import { HERE_BILLING_DEFAULTS } from '../_shared/here/billing.ts';
import {
  ROAD_PL,
  ROAD_SE,
  ROAD_KAA,
  looseRoadOk,
  roadGeometryOk,
  maxDeviationSymmetricKm,
  type LatLng,
} from '../_shared/map/draw.ts';
import { corsHeaders, corsPreflight } from '../_shared/cors.ts';

const LEGS = [
  { leg: 'PL-GDN', origin: '52.07391,17.0246', destination: '54.40372,18.6813', spec: ROAD_PL, summary: 'Trasa drogowa Śrem–Gdańsk' },
  { leg: 'SE-NYN', origin: '58.90453,17.95621', destination: '65.80539,21.75914', spec: ROAD_SE, summary: 'Trasa drogowa Nynäshamn–Boden' },
  { leg: 'PL-GDY', origin: '52.07391,17.0246', destination: '54.53321,18.54425', spec: 'loose' as const, summary: 'Trasa drogowa Śrem–Gdynia' },
  { leg: 'SE-KAA', origin: '56.1646,15.6308', destination: '65.80539,21.75914', spec: ROAD_KAA, summary: 'Trasa drogowa Karlskrona–Boden' },
] as const;

const DAY_MS = 30 * 864e5;
const RETRY_REJECT_MS = 24 * 3600e3;
const MAX_DEV_KM = 2;
const CORRIDOR_KAA = 'SE_KAA_TRACK';

function parseCorridorPoints(raw: unknown): LatLng[] {
  if (!Array.isArray(raw)) return [];
  const out: LatLng[] = [];
  for (const p of raw) {
    if (!Array.isArray(p) || p.length < 2) continue;
    const lat = Number(p[0]);
    const lng = Number(p[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) out.push([lat, lng]);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return corsPreflight();
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
  if (!user.data.user) return Response.json({ ok: false }, { status: 401, headers: corsHeaders() });
  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const spend = await sb.rpc('here_month_spend');
  if (spend.error || Number(spend.data) >= HERE_BILLING_DEFAULTS.budgetUsd) {
    return Response.json({ ok: false, reason: 'budzet' }, { headers: corsHeaders() });
  }
  const key = Deno.env.get('HERE_API_KEY') ?? '';
  if (!key) return Response.json({ ok: false, reason: 'brak' }, { headers: corsHeaders() });
  const fresh = await sb.from('here_road_geometry').select('leg,fetched_at,points');
  const have = new Map<string, { fetched_at: string; points: unknown }>();
  for (const row of fresh.data ?? []) {
    have.set(String(row.leg), { fetched_at: String(row.fetched_at), points: row.points });
  }

  let corridorPts: LatLng[] = [];
  let viaPts: LatLng[] = [];
  let corridorUpdatedAt = 0;
  {
    const corrRow = await sb.from('corridor_polylines').select('updated_at').eq('code', CORRIDOR_KAA).maybeSingle();
    corridorUpdatedAt = Date.parse(String(corrRow.data?.updated_at ?? '')) || 0;
    const ptsRpc = await sb.rpc('here_corridor_points', { p_code: CORRIDOR_KAA });
    if (!ptsRpc.error) corridorPts = parseCorridorPoints(ptsRpc.data);
    const viaRpc = await sb.rpc('here_corridor_via_points', { p_code: CORRIDOR_KAA, p_max: 14 });
    if (!viaRpc.error) viaPts = parseCorridorPoints(viaRpc.data);
  }

  let stored = 0;
  for (const leg of LEGS) {
    const prev = have.get(leg.leg);
    const age = prev ? Date.now() - Date.parse(prev.fetched_at) : Infinity;
    const corridorNewer =
      leg.leg === 'SE-KAA' && corridorUpdatedAt > 0 && prev != null && corridorUpdatedAt > Date.parse(prev.fetched_at);
    if (prev && age < DAY_MS && !corridorNewer) continue;

    // F7 #585: SE-KAA bez korytarza — pomiń (bez zapytania „na ślepo”).
    if (leg.leg === 'SE-KAA' && corridorPts.length < 2) continue;

    const routeUrl = new URL('https://router.hereapi.com/v8/routes');
    routeUrl.searchParams.set('transportMode', 'truck');
    routeUrl.searchParams.set('origin', leg.origin);
    routeUrl.searchParams.set('destination', leg.destination);
    routeUrl.searchParams.set('return', 'polyline');
    routeUrl.searchParams.set('apiKey', key);
    if (leg.leg === 'SE-KAA') {
      for (const v of viaPts) {
        routeUrl.searchParams.append('via', `${v[0]},${v[1]}!passThrough=true`);
      }
    }
    const res = await fetch(routeUrl, { headers: { 'User-Agent': 'WatchTower/1' } });
    if (!res.ok) continue;
    // D-78: koszt jednostkowy routing ponad pulę (here_note_service i tak przelicza z stawek).
    await sb.rpc('here_note_service', {
      p_service: 'routing',
      p_n: 1,
      p_usd: HERE_BILLING_DEFAULTS.routesRateUsd,
    });
    let body: { routes?: Array<{ sections?: Array<{ polyline?: string }> }> };
    try {
      body = await res.json();
    } catch {
      continue;
    }
    const sections = body?.routes?.[0]?.sections ?? [];
    const line: LatLng[] = [];
    for (const section of sections) {
      if (typeof section?.polyline !== 'string') continue;
      try {
        line.push(...decodeFlexiblePolyline(section.polyline));
      } catch {
        /* zła polilinia */
      }
    }
    const okGeom = leg.spec === 'loose' ? looseRoadOk(line) : roadGeometryOk(line, leg.spec);
    const okDev =
      leg.leg !== 'SE-KAA' ||
      corridorPts.length < 2 ||
      maxDeviationSymmetricKm(line, corridorPts) <= MAX_DEV_KM;
    if (!okGeom || !okDev) {
      // F7 N9: nie blokuj 30 dni — ponów po 24 h (fetched_at tak, by age ≥ DAY_MS za 24 h).
      const retryAt = new Date(Date.now() - DAY_MS + RETRY_REJECT_MS).toISOString();
      await sb.rpc('here_store_road', {
        p_leg: leg.leg,
        p_points: null,
        p_summary: leg.summary + (okGeom ? ' — odchyłka od SE_KAA_TRACK' : ' — geometria odrzucona'),
        p_now: retryAt,
      });
      continue;
    }
    const save = await sb.rpc('here_store_road', { p_leg: leg.leg, p_points: line, p_summary: leg.summary });
    if (save.error) continue;
    stored += 1;
  }
  return Response.json({ ok: true, stored }, { headers: corsHeaders() });
});
