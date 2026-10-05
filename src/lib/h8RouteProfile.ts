/** H-8 — wywołanie Edge route-profile (tylko supabase). */
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../auth/config';
import { getSupabase } from '../auth/client';

export type H8Leg = {
  leg: string;
  ok?: boolean;
  minM?: number | null;
  maxM?: number | null;
  maxDeltaM?: number | null;
  samples?: number;
  notices?: string;
};

export async function fetchRouteProfile(loadId: string): Promise<
  { ok: true; dimsMode: string; legs: H8Leg[] } | { ok: false; reason: string }
> {
  const sb = await getSupabase();
  const { data: sess } = await sb.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return { ok: false, reason: 'auth' };
  const edge = ['functions', 'v1', 'route-profile'].join('/');
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/${edge}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ loadId }),
  });
  if (res.status === 409) return { ok: false, reason: 'budget' };
  if (!res.ok) return { ok: false, reason: `http_${res.status}` };
  const json = await res.json() as { dimsMode?: string; legs?: H8Leg[] };
  return { ok: true, dimsMode: json.dimsMode ?? '', legs: Array.isArray(json.legs) ? json.legs : [] };
}
