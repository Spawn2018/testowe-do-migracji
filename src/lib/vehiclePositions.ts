/**
 * B-1 — ostatnia pozycja GPS transportu z `load_track` (RLS jak odczyt pozycji).
 * Brak wiersza albo błąd odczytu = brak pozycji. Nigdy współrzędnych ze statusu.
 */
import { getSupabase } from '../auth/client';
import { isServerId } from '../data/registry';

export type VehicleFix = { loadId: string; lat: number; lng: number };

type TrackPoint = { lat: number; lng: number; ts: string };

export async function fetchLatestVehicleFixes(loadIds: readonly string[]): Promise<VehicleFix[]> {
  const ids = [...new Set(loadIds.filter((id) => isServerId(id)))];
  if (!ids.length) return [];
  const sb = await getSupabase();
  const out: VehicleFix[] = [];
  await Promise.all(ids.map(async (id) => {
    const res = await sb.rpc('load_track', { p_load: id, p_limit: 1 });
    if (res.error) return;
    const rows = (res.data ?? []) as TrackPoint[];
    const p = rows[rows.length - 1];
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lng)) return;
    out.push({ loadId: id, lat: p.lat, lng: p.lng });
  }));
  return out;
}
