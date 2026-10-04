/**
 * AIS-SRC — pozycje trzech promów Stena Line z mapy tras armatora (bez klucza).
 * GET https://irm.stenalinefreight.com/ferries?imos=7907661,9862994,9863003
 *
 * Współrzędne WYŁĄCZNIE z properties.latitude / properties.longitude.
 * geometry.coordinates ma kolejność lat, lon i nie wolno jej używać.
 * Czas: properties.dt_pos_utc (UTC).
 */
import type { VesselFix } from './digitraffic.ts';

export const STENA_FERRIES_URL =
  'https://irm.stenalinefreight.com/ferries?imos=7907661,9862994,9863003';

/** IMO potwierdzone w poleceniu. MMSI ze źródła Steny (odczyt 2026-10-04 23:3x UTC), nie zgadywane. */
export const STENA_FERRIES = [
  { imo: 7907661, mmsi: 219031605, name: 'M/F Stena Spirit' },
  { imo: 9862994, mmsi: 219030885, name: 'M/F Stena Estelle' },
  { imo: 9863003, mmsi: 219031310, name: 'M/F Stena Ebba' },
] as const;

export const POLFERRIES = [
  { imo: 7814462, mmsi: 311852000, name: 'M/F Wawel' },
  { imo: 9462067, mmsi: 311000787, name: 'M/F Nova Star' },
] as const;

export const TRACKED_FERRIES = [...POLFERRIES, ...STENA_FERRIES] as const;
export const TRACKED_MMSI = new Set<number>(TRACKED_FERRIES.map((v) => v.mmsi));
export const STENA_IMO = new Set<number>(STENA_FERRIES.map((v) => v.imo));
export const STENA_MMSI = new Set<number>(STENA_FERRIES.map((v) => v.mmsi));

/** Pięć promów, listy nie rozszerzać. Stena Vision (2023) tu nie wchodzi. */
export function isTrackedMmsi(mmsi: number | null | undefined): boolean {
  return mmsi != null && TRACKED_MMSI.has(mmsi);
}

const SOURCE_RANK = { STENA: 3, AISSTREAM: 2, DIGITRAFFIC: 1 } as const;

/** Nowsza pozycja wygrywa. Przy tym samym czasie: Stena > aisstream > Digitraffic. */
export function pickNewerFix(fixes: readonly VesselFix[]): VesselFix | null {
  let best: VesselFix | null = null;
  for (const f of fixes) {
    if (!best) { best = f; continue; }
    const ta = Date.parse(f.timestampUtc);
    const tb = Date.parse(best.timestampUtc);
    if (!Number.isFinite(ta)) continue;
    if (!Number.isFinite(tb) || ta > tb) { best = f; continue; }
    if (ta < tb) continue;
    const ra = SOURCE_RANK[f.source ?? 'DIGITRAFFIC'];
    const rb = SOURCE_RANK[best.source ?? 'DIGITRAFFIC'];
    if (ra > rb) best = f;
  }
  return best;
}

/** Znacznik na mapie. Powyżej 15 min — wyszarzony. Pozycja zostaje (to nie filtr Q-18). */
export function ferryMarkerTone(observedAt: string, nowIso: string): 'fresh' | 'stale' {
  const ageMin = (Date.parse(nowIso) - Date.parse(observedAt)) / 60000;
  if (!Number.isFinite(ageMin) || ageMin > 15) return 'stale';
  return 'fresh';
}

/**
 * Kryterium pomiaru 24 h (trzy Steny, pozycja nie starsza niż 5 min).
 * Tego przebiegu nie mierzy na żywo przez dobę.
 */
export const STENA_FRESHNESS_24H = {
  hours: 24,
  maxAgeMin: 5,
  vessels: 3,
  runTonight: false,
} as const;

export function stenaTimeToUtc(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const t = raw.trim();
  const iso = t.includes('T') ? t : t.replace(' ', 'T');
  const withZone = /[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`;
  const ms = Date.parse(withZone);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

export interface StenaAisParse {
  fixes: VesselFix[];
  warning: string | null;
}

/**
 * Czyta wyłącznie properties.*. geometry.coordinates jest ignorowane
 * (nawet gdy wygląda jak lon/lat — w tym API jest lat, lon).
 */
export function parseStenaFerries(json: unknown): StenaAisParse {
  if (!json || typeof json !== 'object' || !Array.isArray((json as { data?: unknown }).data)) {
    return { fixes: [], warning: 'Stena IRM: zmiana formatu (brak tablicy data)' };
  }
  const rows = (json as { data: unknown[] }).data;
  const fixes: VesselFix[] = [];
  let bad = 0;
  for (const row of rows) {
    if (!row || typeof row !== 'object') { bad++; continue; }
    const p = (row as { properties?: unknown }).properties;
    if (!p || typeof p !== 'object') { bad++; continue; }
    const props = p as Record<string, unknown>;
    const lat = Number(props.latitude);
    const lon = Number(props.longitude);
    const mmsi = Number(props.mmsi);
    const ts = stenaTimeToUtc(props.dt_pos_utc);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(mmsi) || !ts) { bad++; continue; }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) { bad++; continue; }
    const sog = Number(props.sog);
    const cog = Number(props.cog);
    const nav = Number(props.nav_status_code);
    fixes.push({
      mmsi,
      lat,
      lon,
      sogKn: Number.isFinite(sog) ? sog : null,
      cog: Number.isFinite(cog) ? cog : null,
      navStat: Number.isFinite(nav) ? nav : null,
      timestampUtc: ts,
      source: 'STENA',
      etaAt: stenaTimeToUtc(props.eta),
      imo: Number.isFinite(Number(props.imo)) ? Number(props.imo) : null,
    });
  }
  if (rows.length === 0) return { fixes: [], warning: 'Stena IRM: pusta lista promów' };
  if (fixes.length === 0) return { fixes: [], warning: 'Stena IRM: zmiana formatu (brak latitude/longitude)' };
  if (bad > 0) return { fixes, warning: 'Stena IRM: część pozycji nieczytelna' };
  return { fixes, warning: null };
}
