/**
 * I-2j — pozycje promów z bazy (`vessel_positions`, zapis: zadanie ferry-ais → Digitraffic, CC BY 4.0).
 * Tylko build produkcyjny (Supabase). Mapa pokazuje ostatnią pozycję każdego statku z czasem sygnału AIS;
 * brak wierszy = „brak źródła danych”. Nigdy pozycji przykładowych.
 */
import { getSupabase } from '../auth/client';
import type { AisPosition } from './ais';
import { FERRY_VESSELS } from './ferry';
import { visibleFerryMarkers, type TrackFix } from './map/draw';
import { estimateFerryPositions, type SailingMapRow } from './ferry/estimate';

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

/** Odświeżanie co 2 min. Q-18 (05.10 07:16): widoczny w porcie PL, w rejsie PL→SE i w porcie SE; znika w rejsie SE→PL. */
export async function fetchMapFerryMarkers(): Promise<AisPosition[]> {
  const sb = await getSupabase();
  const [res, sail] = await Promise.all([
    sb.rpc('ferry_track_sample'),
    sb.rpc('ferry_sailings_map').then((r) => r, () => ({ data: null, error: true })),
  ]);
  /* 22.10.2026: błąd odczytu = wyjątek — mapa zostawia ostatnie pozycje promów zamiast pustej listy */
  if (res.error || !Array.isArray(res.data)) throw new Error(res.error?.message ?? 'ferry_track_sample: brak danych');
  const sailRows = !sail.error && Array.isArray(sail.data) ? (sail.data as SailingMapRow[]) : [];
  return withEstimates(markersFromTrack(res.data), sailRows, Date.now());
}

type TrackRow = {
  vessel_id: string;
  name: string | null;
  mmsi: number | null;
  lat: number;
  lon: number;
  observed_at: string;
  cog: number | null;
  sog_kn: number | null;
};

/** #429 C: prom w rejsie PL→SE bez świeżego AIS — punkt z rozkładu zamiast (albo zamiast braku) ostatniej pozycji. */
export function withEstimates(markers: AisPosition[], sailRows: readonly SailingMapRow[], nowMs: number): AisPosition[] {
  const est = estimateFerryPositions(sailRows, nowMs);
  if (!est.length) return markers;
  const out = markers.slice();
  for (const e of est) {
    const known = FERRY_VESSELS.find((v) => v.mmsi === e.mmsi);
    const i = out.findIndex((m) => (e.mmsi && m.mmsi === e.mmsi) || (!!e.name && m.name === e.name));
    const base: AisPosition = i >= 0 ? out[i] : {
      mmsi: e.mmsi,
      vesselId: known?.id ?? FERRY_VESSELS[0].id,
      name: e.name || known?.name || e.mmsi,
      lat: e.lat,
      lng: e.lng,
      ts: e.lastAisTs ?? new Date(nowMs).toISOString(),
      source: 'db',
    };
    const next: AisPosition = { ...base, lat: e.lat, lng: e.lng, cog: e.heading, sog: undefined, estimated: { lastAisTs: e.lastAisTs } };
    if (i >= 0) out[i] = next; else out.push(next);
  }
  return out;
}

function markersFromTrack(data: unknown[]): AisPosition[] {
  const rows = data as TrackRow[];
  const fixes: TrackFix[] = rows.map((r) => ({
    id: r.vessel_id,
    lat: r.lat,
    lng: r.lon,
    ts: r.observed_at,
    cog: r.cog,
  }));
  return visibleFerryMarkers(fixes).map((v) => {
    const r = rows.find((x) => x.vessel_id === v.id && x.observed_at === v.ts);
    const mmsi = r?.mmsi != null ? String(r.mmsi) : '';
    const known = FERRY_VESSELS.find((vessel) => vessel.mmsi === mmsi);
    return {
      mmsi,
      vesselId: known?.id ?? FERRY_VESSELS[0].id,
      name: r?.name ?? known?.name ?? mmsi,
      lat: v.lat,
      lng: v.lng,
      sog: r?.sog_kn ?? undefined,
      cog: r?.cog ?? undefined,
      ts: v.ts,
      source: 'db' as const,
    };
  });
}

export function subscribeAisDb(onUpdate: (pos: AisPosition[]) => void, everyMs = 120_000): () => void {
  let stopped = false;
  let fails = 0;
  const tick = () => {
    fetchMapFerryMarkers().then(
      (p) => { fails = 0; if (!stopped) onUpdate(p); },
      /* 22.10.2026: chwilowy błąd — zostają ostatnie pozycje; po 3 błędach z rzędu (~6 min) mapa bez promów */
      () => { fails += 1; if (!stopped && fails >= 3) onUpdate([]); },
    );
  };
  tick();
  const id = setInterval(tick, everyMs);
  return () => { stopped = true; clearInterval(id); };
}
