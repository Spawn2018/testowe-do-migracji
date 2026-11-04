/**
 * E49-a (DP-205): prognoza porywów — SMHI SNOW1g + FMI HARMONIE (Z1 / D-20261104-0105-01).
 * Podpis źródła per punkt: „SMHI” / „FMI” (dane przetworzone). Bez IMGW / Open-Meteo.
 */
import {
  FMI_HARMONIE_URL,
  SMHI_SNOW1G_BASE,
  fmiHarmonieUrl,
  smhiSnow1gUrl,
} from '../ferry/marineWeather.ts';

export type WindForecastSource = 'SMHI' | 'FMI';

export interface WindHourSample {
  at: string;
  gustMs: number | null;
  windMs: number | null;
  /** Kierunek, skąd wieje (stopnie, 0–360). */
  windFromDeg: number | null;
  source: WindForecastSource;
}

export { fmiHarmonieUrl, smhiSnow1gUrl, SMHI_SNOW1G_BASE, FMI_HARMONIE_URL };

/** SMHI snow1g JSON → próbki z kierunkiem (E49 Z1). */
export function parseSmhiSnow1gWind(json: unknown): WindHourSample[] {
  const body = json as {
    timeSeries?: Array<{
      time?: string;
      data?: {
        wind_speed?: number;
        wind_speed_of_gust?: number;
        wind_from_direction?: number;
      };
    }>;
  };
  const out: WindHourSample[] = [];
  for (const row of body.timeSeries ?? []) {
    if (!row.time) continue;
    const speed = row.data?.wind_speed;
    const gust = row.data?.wind_speed_of_gust;
    const dir = row.data?.wind_from_direction;
    const windMs = typeof speed === 'number' && Number.isFinite(speed) ? speed : null;
    const gustMs = typeof gust === 'number' && Number.isFinite(gust) ? gust : null;
    const windFromDeg = typeof dir === 'number' && Number.isFinite(dir) ? ((dir % 360) + 360) % 360 : null;
    if (windMs == null && gustMs == null) continue;
    out.push({
      at: new Date(row.time).toISOString(),
      gustMs,
      windMs,
      windFromDeg,
      source: 'SMHI',
    });
  }
  return out;
}

/**
 * Czy odpowiedź SMHI jest „pusta / poza siatką” → brać FMI.
 * Pusta seria albo brak jakiegokolwiek porywu/prędkości.
 */
export function smhiOutsideGrid(samples: readonly WindHourSample[]): boolean {
  return samples.length === 0 || samples.every((s) => s.gustMs == null && s.windMs == null);
}

/** FMI HARMONIE TimeValuePair XML → poryw / średni wiatr (m/s). Kierunek — osobna seria WindDirection gdy jest. */
export function parseFmiHarmonieWind(xml: string): WindHourSample[] {
  const byAt = new Map<string, WindHourSample>();
  const members = xml.split(/<wfs:member>/i).slice(1);
  for (const mem of members) {
    const idMatch = mem.match(/gml:id="([^"]+)"/i);
    const id = idMatch?.[1] ?? '';
    const isGust = /WindGust/i.test(id);
    const isWind = /WindSpeedMS/i.test(id);
    const isDir = /WindDirection/i.test(id);
    if (!isGust && !isWind && !isDir) continue;
    const pairs = [...mem.matchAll(/<wml2:time>([^<]+)<\/wml2:time>\s*<wml2:value>([^<]*)<\/wml2:value>/gi)];
    for (const m of pairs) {
      const raw = m[2].trim();
      if (!raw || raw === 'NaN' || raw.toLowerCase() === 'nan') continue;
      const num = Number(raw);
      if (!Number.isFinite(num)) continue;
      const at = new Date(m[1]).toISOString();
      const cur = byAt.get(at) ?? {
        at, gustMs: null, windMs: null, windFromDeg: null, source: 'FMI' as const,
      };
      if (isGust) cur.gustMs = num;
      else if (isWind) cur.windMs = num;
      else if (isDir) cur.windFromDeg = ((num % 360) + 360) % 360;
      byAt.set(at, cur);
    }
  }
  return [...byAt.values()]
    .filter((s) => s.gustMs != null || s.windMs != null)
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function windSourceLabel(source: WindForecastSource): string {
  return source === 'SMHI'
    ? 'Źródło: SMHI (CC BY 4.0), dane przetworzone'
    : 'Źródło: FMI (CC BY 4.0), dane przetworzone';
}
