/**
 * TOWER — pozycja promu z AIS przez Digitraffic (Fintraffic, Finlandia).
 *
 * Licencja danych: CC BY 4.0 — w interfejsie OBOWIĄZKOWY dopisek:
 *   „Dane AIS: Fintraffic / digitraffic.fi, licencja CC BY 4.0"
 * Bez klucza. Wymagany nagłówek Accept-Encoding: gzip; zalecany Digitraffic-User.
 *
 * ZASIĘG — zmierzony na żywo 25.09.2026 (Polferries) i 01.10.2026 (Stena):
 *   Zatoka Gdańska / Gdynia — BRAK
 *   podejście do Nynäshamn — TAK (Nova Star)
 *   Karlskrona / Spirit/Estelle/Ebba — BRAK (0 pozycji w dniu sprawdzenia)
 * Digitraffic potwierdza stronę szwedzką gdy jest sygnał (Nynäshamn albo Karlskrona).
 * Brak pozycji ≠ opóźnienie. Nie służy do potwierdzania odejścia z PL.
 *
 * MMSI: Nova Star 311000787; Stena Spirit/Estelle/Ebba — w rejestrze vessels (0119),
 * zasięg Digitraffic do potwierdzenia w kolejnych odczytach.
 */

export type PositionSource = 'DIGITRAFFIC' | 'AISSTREAM' | 'STENA';

export interface VesselFix {
  mmsi: number; lon: number; lat: number;
  sogKn: number | null; cog: number | null; navStat: number | null;
  timestampUtc: string;
  /** AIS-SRC. Brak = DIGITRAFFIC (stare wywołania). */
  source?: PositionSource;
  /** properties.eta ze Steny (UTC) — dodatkowe wejście ETA promu, nie zastępuje pozycji. */
  etaAt?: string | null;
  imo?: number | null;
}

export async function fetchVesselFix(mmsi: number, appId: string): Promise<VesselFix | null> {
  const res = await fetch(`https://meri.digitraffic.fi/api/ais/v1/locations?mmsi=${mmsi}`, {
    headers: { 'Accept-Encoding': 'gzip', 'Digitraffic-User': appId },
  });
  if (!res.ok) return null;
  return parseDigitrafficLocations(await res.json(), mmsi);
}

export function parseDigitrafficLocations(json: any, mmsi: number): VesselFix | null {
  // Digitraffic: mmsi bywa na feature i w properties — obu szukamy (#421).
  const f = (json?.features ?? []).find((x: any) => Number(x?.mmsi ?? x?.properties?.mmsi) === mmsi);
  if (!f) return null;
  const [lon, lat] = f.geometry.coordinates;
  const p = f.properties ?? {};
  return {
    mmsi, lon, lat,
    sogKn: p.sog ?? null, cog: p.cog ?? null, navStat: p.navStat ?? null,
    timestampUtc: new Date(p.timestampExternal).toISOString(),
    source: 'DIGITRAFFIC',
  };
}

/** Nynäshamn Färjeterminal — zweryfikowane z mapą w M9 (jak strefa PORT_IN w 0017; wcześniej ~3,4 km na północ). */
export const NYNASHAMN = { lat: 58.90453, lon: 17.95621 };
/** Terminal Stena Line Karlskrona — współrzędne jak geofence STENA-3 (0119); do potwierdzenia mapą właściciela. */
export const KARLSKRONA = { lat: 56.16460, lon: 15.63080 };

export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLon = (bLon - aLon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type FerryObservation =
  | 'W_PORCIE_NYNASHAMN'
  | 'W_PORCIE_KARLSKRONA'
  | 'W_REJSIE'
  | 'POSTOJ_POZA_PORTEM'
  | 'BRAK_SWIEZEGO_SYGNALU';

/**
 * Interpretacja pozycji. Sygnał starszy niż maxAgeMin → BRAK_SWIEZEGO_SYGNALU —
 * to NIE jest informacja o statku, tylko o zasięgu odbiorników.
 * `port`: NYN (domyślnie) albo KAA (Stena).
 */
export function interpretFix(
  fix: VesselFix, nowUtc: string, maxAgeMin = 60, port: 'NYN' | 'KAA' = 'NYN',
): FerryObservation {
  const ageMin = (Date.parse(nowUtc) - Date.parse(fix.timestampUtc)) / 60000;
  if (ageMin > maxAgeMin) return 'BRAK_SWIEZEGO_SYGNALU';
  const hub = port === 'KAA' ? KARLSKRONA : NYNASHAMN;
  const inPort = distanceKm(fix.lat, fix.lon, hub.lat, hub.lon) <= 3;
  const moving = (fix.sogKn ?? 0) >= 3;
  if (inPort && !moving) return port === 'KAA' ? 'W_PORCIE_KARLSKRONA' : 'W_PORCIE_NYNASHAMN';
  if (moving) return 'W_REJSIE';
  return 'POSTOJ_POZA_PORTEM';
}

export const DIGITRAFFIC_ATTRIBUTION = 'Dane AIS: Fintraffic / digitraffic.fi, licencja CC BY 4.0';

/** Terminal Polferries Gdańsk — M9 / geofence PORT_OUT. */
export const GDANSK = { lat: 54.40372, lon: 18.68130 };
/** Terminal Stena Gdynia — STENA-3 (do potwierdzenia mapą — D-STENA-COORDS). */
export const GDYNIA = { lat: 54.53321, lon: 18.54425 };

export type DeparturePort = 'GDN' | 'GDY' | 'NYN' | 'KAA';

export function departurePortForRoute(route: string): DeparturePort {
  if (route === 'GDY-KAA') return 'GDY';
  if (route === 'KAA-GDY') return 'KAA';
  if (route === 'NYN-GDN') return 'NYN';
  return 'GDN';
}

export function portCoords(port: DeparturePort): { lat: number; lon: number } {
  if (port === 'GDY') return GDYNIA;
  if (port === 'NYN') return NYNASHAMN;
  if (port === 'KAA') return KARLSKRONA;
  return GDANSK;
}

/**
 * II-9: czy AIS mówi, że prom nie zdąży do portu odejścia przed planowanym wypłynięciem.
 * Brak pozycji / brak prędkości / zasięg Digitraffic (PL) → null (brak ≠ opóźnienie).
 * Zwraca szacowane spóźnienie [min] albo null.
 */
export function aisDepartureDelayMin(
  fix: VesselFix,
  nowUtc: string,
  departureAtIso: string,
  route: string,
  maxAgeMin = 60,
  minSogKn = 3,
): number | null {
  const ageMin = (Date.parse(nowUtc) - Date.parse(fix.timestampUtc)) / 60000;
  if (!Number.isFinite(ageMin) || ageMin > maxAgeMin) return null;
  const depMs = Date.parse(departureAtIso);
  const nowMs = Date.parse(nowUtc);
  if (!Number.isFinite(depMs) || depMs <= nowMs) return null; // już odpłynął / w toku — nie II-9
  const sog = fix.sogKn;
  if (sog == null || sog < minSogKn) return null; // postoju nie interpretujemy jako opóźnienia
  const hub = portCoords(departurePortForRoute(route));
  const distKm = distanceKm(fix.lat, fix.lon, hub.lat, hub.lon);
  if (distKm <= 3) return null; // już w porcie odejścia
  const hoursNeed = distKm / (sog * 1.852); // kn → km/h
  const hoursLeft = (depMs - nowMs) / 3.6e6;
  if (hoursNeed <= hoursLeft) return null;
  return Math.round((hoursNeed - hoursLeft) * 60);
}
