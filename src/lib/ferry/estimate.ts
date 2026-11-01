/**
 * #429 C (decyzja koordynatora 22.10.2026) + BN4 (#573): pozycja promu szacowana z rozkładu.
 * Gdy prom jest w rejsie wyjazdowym (PL/EE → SE/FI; Q-18 / isOutbound — powroty ukryte), a ostatni AIS
 * jest starszy niż 30 min (albo go brak), mapa pokazuje punkt na odcinku port A → port B według
 * upływu czasu rejsu. Świeży AIS zawsze wygrywa. Źródło: RPC `ferry_sailings_map` (0258 / 0366).
 */
import { isOutbound } from '../ferryCatalog';

export interface SailingMapRow {
  sailing_id: string;
  vessel_id: string;
  vessel_name: string | null;
  mmsi: number | null;
  route: string | null;
  status: string | null;
  departure_at: string | null;
  arrival_at: string | null;
  departed_at: string | null;
  arrived_at: string | null;
  dep_port: string;
  arr_port: string;
  dep_lat: number;
  dep_lon: number;
  arr_lat: number;
  arr_lon: number;
  ais_lat: number | null;
  ais_lon: number | null;
  ais_observed_at: string | null;
}

export interface FerryEstimate {
  vesselId: string;
  name: string;
  mmsi: string;
  lat: number;
  lng: number;
  heading: number;
  lastAisTs: string | null;
}

/** Ostatni AIS starszy niż ten próg → pozycja szacowana. */
export const ESTIMATE_AIS_STALE_MIN = 30;
/** Bez potwierdzonego wypłynięcia szacujemy tylko, gdy ostatni AIS jest już poza portem odejścia. */
export const LEFT_PORT_KM = 10;

function km(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
}

function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const r = Math.PI / 180;
  const y = Math.sin((lon2 - lon1) * r) * Math.cos(lat2 * r);
  const x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lon2 - lon1) * r);
  return (Math.atan2(y, x) / r + 360) % 360;
}

/** Jeden szacunek na statek (rejs w drodze, najwcześniej wypłynięty). */
export function estimateFerryPositions(rows: readonly SailingMapRow[], nowMs: number): FerryEstimate[] {
  const out = new Map<string, FerryEstimate>();
  for (const r of rows) {
    if (out.has(r.vessel_id)) continue;
    if (r.status === 'ODWOLANY' || r.arrived_at) continue;
    /* BN4: PL→SE i EE→FI/SE (isOutbound); powroty bez szacunku. */
    if (!isOutbound(r.route)) continue;
    const dep = Date.parse(r.departed_at ?? r.departure_at ?? '');
    const arr = Date.parse(r.arrival_at ?? '');
    if (!Number.isFinite(dep) || !Number.isFinite(arr) || arr <= dep) continue;
    /* przed wypłynięciem (bez potwierdzenia z AIS) i po planowym dopłynięciu — nie zgadujemy */
    if (nowMs < dep || nowMs >= arr) continue;
    const aisMs = r.ais_observed_at ? Date.parse(r.ais_observed_at) : NaN;
    if (Number.isFinite(aisMs) && nowMs - aisMs <= ESTIMATE_AIS_STALE_MIN * 60_000) continue;
    /* F7 #439 pkt 3: bez departed_at prom mógł nie wypłynąć (opóźnienie) — szacunek tylko, gdy AIS jest już poza portem */
    if (!r.departed_at) {
      if (r.ais_lat == null || r.ais_lon == null) continue;
      if (km(r.ais_lat, r.ais_lon, r.dep_lat, r.dep_lon) <= LEFT_PORT_KM) continue;
      if (!Number.isFinite(aisMs) || aisMs < dep - 2 * 3600_000) continue;
    }
    const f = Math.min(1, Math.max(0, (nowMs - dep) / (arr - dep)));
    out.set(r.vessel_id, {
      vesselId: r.vessel_id,
      name: r.vessel_name ?? '',
      mmsi: r.mmsi != null ? String(r.mmsi) : '',
      lat: r.dep_lat + (r.arr_lat - r.dep_lat) * f,
      lng: r.dep_lon + (r.arr_lon - r.dep_lon) * f,
      heading: Math.round(bearing(r.dep_lat, r.dep_lon, r.arr_lat, r.arr_lon)),
      lastAisTs: Number.isFinite(aisMs) ? (r.ais_observed_at as string) : null,
    });
  }
  return [...out.values()];
}
