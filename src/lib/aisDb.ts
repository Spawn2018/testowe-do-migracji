/**
 * I-2j — pozycje promów z bazy (`vessel_positions`, zapis: zadanie ferry-ais → Digitraffic, CC BY 4.0).
 * Tylko build produkcyjny (Supabase). Mapa pokazuje ostatnią pozycję każdego statku z czasem sygnału AIS;
 * brak wierszy = „brak źródła danych”. Nigdy pozycji przykładowych.
 */
import { getSupabase } from '../auth/client';
import type { AisPosition } from './ais';
import { FERRY_VESSELS } from './ferry';

export interface VesselPositionRow {
  vessel_id: string;
  lat: number;
  lon: number;
  sog_kn: number | null;
  cog: number | null;
  observed_at: string;
  vessels: { name: string; mmsi: number | null } | null;
}

/** Ostatnia pozycja każdego statku (wiersze w dowolnej kolejności). */
export function latestPerVessel(rows: readonly VesselPositionRow[]): AisPosition[] {
  const best = new Map<string, VesselPositionRow>();
  for (const r of rows) {
    const cur = best.get(r.vessel_id);
    if (!cur || Date.parse(r.observed_at) > Date.parse(cur.observed_at)) best.set(r.vessel_id, r);
  }
  return [...best.values()]
    .sort((a, b) => (a.vessels?.name ?? '').localeCompare(b.vessels?.name ?? ''))
    .map((r) => {
      const mmsi = r.vessels?.mmsi != null ? String(r.vessels.mmsi) : '';
      const known = FERRY_VESSELS.find((v) => v.mmsi === mmsi);
      return {
        mmsi,
        vesselId: known?.id ?? FERRY_VESSELS[0].id,
        name: r.vessels?.name ?? known?.name ?? mmsi,
        lat: r.lat,
        lng: r.lon,
        sog: r.sog_kn ?? undefined,
        cog: r.cog ?? undefined,
        ts: r.observed_at,
        source: 'db' as const,
      };
    });
}

export async function fetchVesselPositions(): Promise<AisPosition[]> {
  const sb = await getSupabase();
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const res = await sb
    .from('vessel_positions')
    .select('vessel_id,lat,lon,sog_kn,cog,observed_at,vessels(name,mmsi)')
    .gte('observed_at', since)
    .order('observed_at', { ascending: false })
    .limit(200);
  if (res.error) throw new Error(res.error.message);
  return latestPerVessel((res.data ?? []) as unknown as VesselPositionRow[]);
}

/** Odświeżanie co 2 min (zadanie ferry-ais zapisuje co 10 min). */
export function subscribeAisDb(onUpdate: (pos: AisPosition[]) => void, everyMs = 120_000): () => void {
  let stopped = false;
  const tick = () => {
    fetchVesselPositions().then(
      (p) => { if (!stopped) onUpdate(p); },
      () => { if (!stopped) onUpdate([]); },
    );
  };
  tick();
  const id = setInterval(tick, everyMs);
  return () => { stopped = true; clearInterval(id); };
}
