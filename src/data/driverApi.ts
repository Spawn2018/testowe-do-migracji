/**
 * ANEKS 3 §2.3 + ANEKS 4 PR6 — aplikacja kierowcy na tokenie (bez logowania).
 * Pozycje i zdarzenia etapów przez funkcje SQL (API bazy, rola anon) — nie zużywają limitu
 * funkcji Edge; zdjęcia przez funkcję Edge `driver-photo`. Token nigdy nie trafia do localStorage.
 */
import type { DriverFix, DriverMilestone } from '../lib/driverTracking';

export interface RpcClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

/** Instrukcje dla kierowcy — lista pól zamknięta po stronie bazy (bez cen). */
export interface DriverInstructions {
  load_id: string;
  order_no: string | null;
  status: string;
  plan_load_from: string | null;
  plan_load_to: string | null;
  plan_delivery_from: string | null;
  plan_delivery_to: string | null;
  tractor_plate: string | null;
  trailer_plate: string | null;
  ferry_booking_ref: string | null;
  vessel: string | null;
  sailing_departure: string | null;
}

/** Prawdziwy token z bazy (issue_driver_token): `wt_` + 64 znaki hex. Tokeny demo nie pasują. */
export const isServerDriverToken = (token: string): boolean => /^wt_[0-9a-f]{64}$/.test(token);

export const MILESTONE_EVENT: Record<DriverMilestone, string> = {
  LOADED: 'MILESTONE_LOADED',
  ON_FERRY: 'DRIVER_ON_FERRY',
  UNLOADED: 'MILESTONE_UNLOADED',
  PROBLEM: 'DRIVER_PROBLEM',
};

export function createDriverApi(sb: RpcClient) {
  const call = async (fn: string, args: Record<string, unknown>) => {
    const r = await sb.rpc(fn, args);
    if (r.error) throw new Error(r.error.message);
    return r.data;
  };
  return {
    instructions: async (token: string) => (await call('driver_get_instructions', { p_token: token })) as DriverInstructions,
    position: (token: string, loadId: string, f: DriverFix) =>
      call('driver_post_position', {
        p_token: token, p_load_id: loadId, p_lat: f.lat, p_lon: f.lng, p_ts: f.at,
        p_accuracy: f.accuracy, p_speed: f.speedKmh, p_heading: f.heading,
      }),
    milestone: (token: string, loadId: string, m: DriverMilestone, at: string, note: string | null = null) =>
      call('driver_post_event', { p_token: token, p_load_id: loadId, p_event_type: MILESTONE_EVENT[m], p_ts: at, p_note: note }),
  };
}

/** Zdjęcie / skan → funkcja Edge `driver-photo` (multipart). */
export async function uploadDriverFile(
  baseUrl: string, anonKey: string, token: string, loadId: string, category: 'CMR' | 'POD' | 'LASHING_PHOTO', file: Blob, name: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ id: string }> {
  const form = new FormData();
  form.set('token', token);
  form.set('load_id', loadId);
  form.set('category', category);
  form.set('file', file, name);
  const res = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/functions/v1/driver-photo`, {
    method: 'POST', headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }, body: form,
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; error?: string };
  if (!res.ok || !body.id) throw new Error(body.error ?? `Wysyłka pliku: ${res.status}`);
  return { id: body.id };
}
