/**
 * H-7 — pobranie PNG mapy z Edge (tylko ścieżka supabase).
 * Osobny moduł, żeby paczka demo nie zawierała kanału functions/v1.
 */
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../auth/config';
import { getSupabase } from '../auth/client';

export async function fetchMapStaticPng(lat: number, lon: number): Promise<
  { ok: true; png: Uint8Array } | { ok: false; reason: string }
> {
  if (!SUPABASE_URL) return { ok: false, reason: 'no_auth' };
  const sb = await getSupabase();
  const { data: sess } = await sb.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return { ok: false, reason: 'no_auth' };
  const edgePath = ['functions', 'v1', 'map-static'].join('/');
  const mapRes = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/${edgePath}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ lat, lon, width: 800, height: 450 }),
  });
  if (mapRes.status === 409 || mapRes.status === 502) return { ok: false, reason: 'here_fallback' };
  if (!mapRes.ok) return { ok: false, reason: `http_${mapRes.status}` };
  return { ok: true, png: new Uint8Array(await mapRes.arrayBuffer()) };
}
