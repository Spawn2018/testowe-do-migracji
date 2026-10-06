/**
 * B-1 — ostatnia pozycja GPS transportów (RLS jak odczyt pozycji). Brak wiersza albo błąd odczytu = brak pozycji.
 * Nigdy współrzędnych ze statusu.
 *
 * AUD-01 (audyt 06.10, A1): jedno zapytanie `latest_vehicle_fixes(ids[])` (0190) dla wszystkich widocznych
 * transportów — baza zwraca tylko te z pozycją GPS. Wcześniej N × `load_track(id, 1)` z Mapy i z mapy korytarza
 * osobno (2 × 94 wywołania przy otwarciu Mapy). Ten sam zestaw transportów w ciągu `FIX_TTL_MS` = jedno zapytanie
 * współdzielone (Mapa: licznik nagłówka + mapa; kokpit; panel zlecenia).
 */
import { getSupabase } from '../auth/client';
import { isServerId } from '../data/registry';

export type VehicleFix = { loadId: string; lat: number; lng: number };

type FixRow = { load_id: string; lat: number; lng: number };

/** Maksymalna liczba identyfikatorów w jednym zapytaniu (jak limit w funkcji SQL). */
export const FIX_BATCH_MAX = 500;
export const FIX_TTL_MS = 30_000;

const cache = new Map<string, { at: number; p: Promise<VehicleFix[]> }>();

export function fixIds(loadIds: readonly string[]): string[] {
  return [...new Set(loadIds.filter((id) => isServerId(id)))].sort();
}

export function parseFixRows(data: unknown): VehicleFix[] {
  if (!Array.isArray(data)) return [];
  const out: VehicleFix[] = [];
  for (const r of data as FixRow[]) {
    if (!r || typeof r.load_id !== 'string') continue;
    const lat = Number(r.lat);
    const lng = Number(r.lng);
    if (r.lat == null || r.lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({ loadId: r.load_id, lat, lng });
  }
  return out;
}

async function query(ids: string[]): Promise<VehicleFix[]> {
  const sb = await getSupabase();
  const out: VehicleFix[] = [];
  for (let i = 0; i < ids.length; i += FIX_BATCH_MAX) {
    const res = await sb.rpc('latest_vehicle_fixes', { p_loads: ids.slice(i, i + FIX_BATCH_MAX) });
    if (res.error) continue;
    out.push(...parseFixRows(res.data));
  }
  return out;
}

export function fetchLatestVehicleFixes(loadIds: readonly string[], now: number = Date.now()): Promise<VehicleFix[]> {
  const ids = fixIds(loadIds);
  if (!ids.length) return Promise.resolve([]);
  const key = ids.join(',');
  const hit = cache.get(key);
  if (hit && now - hit.at < FIX_TTL_MS) return hit.p;
  const p = query(ids).catch(() => [] as VehicleFix[]);
  cache.set(key, { at: now, p });
  if (cache.size > 20) cache.delete(cache.keys().next().value as string);
  return p;
}

/** Tylko testy. */
export function __resetFixCache(): void {
  cache.clear();
}
