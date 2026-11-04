/**
 * E49-a cz.2: job corridor-wind — SMHI/FMI na punktach korytarza (co 25 km).
 * Bez zapytań gdy brak transportu w oknie śledzenia (#783 pkt 6 / Z6.14).
 */
import {
  coordsFromGeoJson,
  E49_WIND_STEP_KM,
  samplePolylineEveryKm,
  type CorridorWindPoint,
} from './corridorWind.ts';
import {
  fmiHarmonieWindUrl,
  nearestWindSample,
  parseFmiHarmonieWind,
  parseSmhiSnow1gWind,
  smhiOutsideGrid,
  smhiSnow1gUrl,
  type WindForecastSource,
  type WindHourSample,
} from './windForecast.ts';

export type CorridorWindFetch = typeof fetch;

export type CorridorWindStore = {
  e49WindActiveCorridors?(): Promise<string[]>;
  corridorPolylineGeoJson?(code: string): Promise<unknown | null>;
  upsertCorridorWindForecast?(row: {
    corridor: string;
    km: number;
    lon: number;
    lat: number;
    bearingDeg: number;
    source: WindForecastSource;
    samples: WindHourSample[];
    fetchedAt: string;
  }): Promise<void>;
  corridorWindFreshCount?(maxAgeMin: number): Promise<number>;
};

const USER_AGENT = 'WatchTower/1.0 (E49 corridor-wind; +https://tower.log-mar.pl)';
const CONCURRENCY = 6;
const HORIZON_H = 48;

async function mapPool<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  async function worker() {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]!, i);
    }
  }
  const n = Math.min(limit, Math.max(1, items.length));
  await Promise.all(Array.from({ length: n }, () => worker()));
  return out;
}

export async function fetchWindSeriesForPoint(
  fetchFn: CorridorWindFetch,
  lon: number,
  lat: number,
  now: Date,
): Promise<{ source: WindForecastSource; samples: WindHourSample[]; warning?: string }> {
  const fromIso = now.toISOString();
  const toIso = new Date(now.getTime() + HORIZON_H * 3600_000).toISOString();
  const smhiUrl = smhiSnow1gUrl(lon, lat);
  try {
    const r = await fetchFn(smhiUrl, {
      headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
    });
    if (r.ok) {
      const json = await r.json();
      const samples = parseSmhiSnow1gWind(json);
      if (!smhiOutsideGrid(samples)) {
        return { source: 'SMHI', samples };
      }
    }
  } catch {
    /* FMI zapas */
  }

  const fmiUrl = fmiHarmonieWindUrl(lat, lon, fromIso, toIso);
  try {
    const r = await fetchFn(fmiUrl, {
      headers: { Accept: 'application/xml', 'User-Agent': USER_AGENT },
    });
    if (!r.ok) {
      return { source: 'FMI', samples: [], warning: `FMI HTTP ${r.status}` };
    }
    const xml = await r.text();
    const samples = parseFmiHarmonieWind(xml);
    return { source: 'FMI', samples };
  } catch (e) {
    return {
      source: 'FMI',
      samples: [],
      warning: e instanceof Error ? e.message : String(e),
    };
  }
}

export type CorridorWindRunResult = {
  ok: boolean;
  corridors: number;
  points: number;
  fetchedOk: number;
  sourceSmhi: number;
  sourceFmi: number;
  warnings: string[];
  reason?: string;
};

export async function runCorridorWindCore(args: {
  store: CorridorWindStore;
  fetch: CorridorWindFetch;
  now: Date;
  stepKm?: number;
}): Promise<CorridorWindRunResult> {
  const warnings: string[] = [];
  const stepKm = args.stepKm ?? E49_WIND_STEP_KM;
  const codes = args.store.e49WindActiveCorridors
    ? await args.store.e49WindActiveCorridors()
    : [];
  if (!codes.length) {
    return {
      ok: true,
      corridors: 0,
      points: 0,
      fetchedOk: 0,
      sourceSmhi: 0,
      sourceFmi: 0,
      warnings,
      reason: 'Brak transportu w oknie śledzenia — 0 zapytań prognozy',
    };
  }
  if (!args.store.corridorPolylineGeoJson || !args.store.upsertCorridorWindForecast) {
    return {
      ok: false,
      corridors: codes.length,
      points: 0,
      fetchedOk: 0,
      sourceSmhi: 0,
      sourceFmi: 0,
      warnings: ['Brak metod magazynu corridor-wind'],
    };
  }

  const work: { corridor: string; point: CorridorWindPoint }[] = [];
  for (const code of codes) {
    const geom = await args.store.corridorPolylineGeoJson(code);
    const coords = coordsFromGeoJson(geom);
    const pts = samplePolylineEveryKm(coords, stepKm);
    if (!pts.length) {
      warnings.push(`Brak geometrii / punktów: ${code}`);
      continue;
    }
    for (const point of pts) work.push({ corridor: code, point });
  }

  let fetchedOk = 0;
  let sourceSmhi = 0;
  let sourceFmi = 0;
  const fetchedAt = args.now.toISOString();

  await mapPool(work, CONCURRENCY, async ({ corridor, point }) => {
    const res = await fetchWindSeriesForPoint(args.fetch, point.lon, point.lat, args.now);
    if (res.warning) warnings.push(`${corridor}@${point.km}km: ${res.warning}`);
    if (!res.samples.length) return;
    fetchedOk++;
    if (res.source === 'SMHI') sourceSmhi++;
    else sourceFmi++;
    await args.store.upsertCorridorWindForecast!({
      corridor,
      km: point.km,
      lon: point.lon,
      lat: point.lat,
      bearingDeg: point.bearingDeg,
      source: res.source,
      samples: res.samples,
      fetchedAt,
    });
  });

  return {
    ok: warnings.length === 0 || fetchedOk > 0,
    corridors: codes.length,
    points: work.length,
    fetchedOk,
    sourceSmhi,
    sourceFmi,
    warnings: warnings.slice(0, 20),
  };
}

/** Czy punkt ma poryw ≥ thr w oknie 24 h (Z2). */
export function gustMeetsThresholdInWindow(
  samples: readonly WindHourSample[],
  nowIso: string,
  thrMs: number,
  windowH = 24,
): WindHourSample | null {
  const t0 = Date.parse(nowIso);
  const t1 = t0 + windowH * 3600_000;
  let best: WindHourSample | null = null;
  for (const s of samples) {
    const t = Date.parse(s.at);
    if (!(t >= t0 && t <= t1)) continue;
    const g = s.gustMs ?? s.windMs;
    if (g == null || !(g >= thrMs)) continue;
    if (!best || (g > (best.gustMs ?? best.windMs ?? 0))) best = s;
  }
  return best;
}

export { nearestWindSample };
