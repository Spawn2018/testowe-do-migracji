/**
 * TOWER — pozycja promu z AIS przez Digitraffic (Fintraffic, Finlandia).
 *
 * Licencja danych: CC BY 4.0 — w interfejsie OBOWIĄZKOWY dopisek:
 *   „Dane AIS: Fintraffic / digitraffic.fi, licencja CC BY 4.0"
 * Bez klucza. Wymagany nagłówek Accept-Encoding: gzip; zalecany Digitraffic-User.
 *
 * ZASIĘG — zmierzony na żywo 25.09.2026:
 *   Zatoka Gdańska        — BRAK (0 statków)
 *   środek trasy          — praktycznie brak
 *   podejście do Nynäshamn — TAK (Nova Star widziany ~100 km na S od portu)
 * Dlatego Digitraffic potwierdza WYŁĄCZNIE stronę szwedzką: przypłynięcie
 * do Nynäshamn i odejście stamtąd. Nie służy do potwierdzania odejścia z Gdańska.
 *
 * MMSI potwierdzone w rejestrze Digitraffic: Nova Star 311000787 (IMO 9462067).
 * Wawel — nieobecny w rejestrze w dniu sprawdzenia; MMSI do potwierdzenia.
 */

export interface VesselFix {
  mmsi: number; lon: number; lat: number;
  sogKn: number | null; cog: number | null; navStat: number | null;
  timestampUtc: string;
}

export async function fetchVesselFix(mmsi: number, appId: string): Promise<VesselFix | null> {
  const res = await fetch(`https://meri.digitraffic.fi/api/ais/v1/locations?mmsi=${mmsi}`, {
    headers: { 'Accept-Encoding': 'gzip', 'Digitraffic-User': appId },
  });
  if (!res.ok) return null;
  return parseDigitrafficLocations(await res.json(), mmsi);
}

export function parseDigitrafficLocations(json: any, mmsi: number): VesselFix | null {
  const f = (json?.features ?? []).find((x: any) => x?.mmsi === mmsi);
  if (!f) return null;
  const [lon, lat] = f.geometry.coordinates;
  const p = f.properties ?? {};
  return {
    mmsi, lon, lat,
    sogKn: p.sog ?? null, cog: p.cog ?? null, navStat: p.navStat ?? null,
    timestampUtc: new Date(p.timestampExternal).toISOString(),
  };
}

const NYNASHAMN = { lat: 58.9350, lon: 17.9500 };

function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad, dLon = (bLon - aLon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export type FerryObservation = 'W_PORCIE_NYNASHAMN' | 'W_REJSIE' | 'POSTOJ_POZA_PORTEM' | 'BRAK_SWIEZEGO_SYGNALU';

/**
 * Interpretacja pozycji. Sygnał starszy niż maxAgeMin → BRAK_SWIEZEGO_SYGNALU —
 * to NIE jest informacja o statku, tylko o zasięgu odbiorników.
 */
export function interpretFix(fix: VesselFix, nowUtc: string, maxAgeMin = 60): FerryObservation {
  const ageMin = (Date.parse(nowUtc) - Date.parse(fix.timestampUtc)) / 60000;
  if (ageMin > maxAgeMin) return 'BRAK_SWIEZEGO_SYGNALU';
  const inPort = distanceKm(fix.lat, fix.lon, NYNASHAMN.lat, NYNASHAMN.lon) <= 3;
  const moving = (fix.sogKn ?? 0) >= 3;
  if (inPort && !moving) return 'W_PORCIE_NYNASHAMN';
  if (moving) return 'W_REJSIE';
  return 'POSTOJ_POZA_PORTEM';
}

export const DIGITRAFFIC_ATTRIBUTION = 'Dane AIS: Fintraffic / digitraffic.fi, licencja CC BY 4.0';
