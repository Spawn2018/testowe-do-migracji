/**
 * II-8 — pogoda morska Bałtyk (FMI WAM + DMI WAM + SMHI ocobs).
 * Licencje CC BY 4.0 — w UI podać źródło. Bez klucza API.
 * Progi: WAVE_M (m) / GUST_KN (kn) z ops_thresholds (D-39: 3,8 m / 40 kn).
 */
export const FMI_ATTRIBUTION = 'FMI Open Data (CC BY 4.0)';
export const DMI_ATTRIBUTION = 'DMI Open Data (CC BY 4.0)';
export const SMHI_ATTRIBUTION = 'SMHI Open Data (CC BY 4.0)';
export const MARINE_ATTRIBUTION =
  'Dane: FMI / DMI / SMHI (CC BY 4.0)';

/** Punkty trasy Gdańsk–Nynäshamn (ZLECENIE II-8) + podejście SE. */
export const MARINE_POINTS = {
  GDN: { lat: 54.4, lon: 18.67, label: 'Gdańsk' },
  MID: { lat: 56.5, lon: 18.5, label: 'środek trasy Gdańsk–Nynäshamn' },
  NYN: { lat: 58.9, lon: 17.95, label: 'podejście Nynäshamn' },
  GDY: { lat: 54.53, lon: 18.55, label: 'Gdynia' },
  MID_STENA: { lat: 55.6, lon: 16.6, label: 'środek trasy Gdynia–Karlskrona' },
  KAA: { lat: 56.16, lon: 15.59, label: 'podejście Karlskrona' },
} as const;
export type MarinePointCode = keyof typeof MARINE_POINTS;

/** Punkty oceny rejsu. SMHI Knolls Grund zostaje przy podejściu Nynäshamn. */
export function marinePointsForRoute(route: string | null | undefined): Array<MarinePointCode | 'SMHI_KNOLLS'> {
  if (route === 'GDY-KAA' || route === 'KAA-GDY') return ['GDY', 'MID_STENA', 'KAA'];
  return ['GDN', 'MID', 'NYN', 'SMHI_KNOLLS'];
}

export function marineCorridorForRoute(route: string | null | undefined): 'BALTIC_GDN_NYN' | 'BALTIC_GDY_KAA' {
  return route === 'GDY-KAA' || route === 'KAA-GDY' ? 'BALTIC_GDY_KAA' : 'BALTIC_GDN_NYN';
}

/** SMHI Knolls Grund — aktywna boja falowa na podejściu SE (obserwacje). */
export const SMHI_KNOLLS_STATION = '33008';

export const FMI_WAM_URL =
  'https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=GetFeature&storedquery_id=fmi::forecast::wam::point::timevaluepair';
export const FMI_HARMONIE_URL =
  'https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=GetFeature&storedquery_id=fmi::forecast::harmonie::surface::point::timevaluepair';
export const DMI_WAM_URL =
  'https://opendataapi.dmi.dk/v1/forecastedr/collections/wam_nsb/position';
export const SMHI_OCOBS_URL =
  `https://opendata-download-ocobs.smhi.se/api/version/1.0/parameter/1/station/${SMHI_KNOLLS_STATION}/period/latest-hour/data.json`;

export type MarineSource = 'FMI' | 'DMI' | 'SMHI';
export type MarineRiskLevel = 'niskie' | 'podwyższone' | 'wysokie';

export interface MarineSample {
  at: string;
  waveM: number | null;
  gustKn: number | null;
  windMs: number | null;
  periodS: number | null;
  source: MarineSource;
  point: MarinePointCode | 'SMHI_KNOLLS';
}

export interface MarineEval {
  maxWaveM: number | null;
  maxGustKn: number | null;
  risk: MarineRiskLevel;
  breached: boolean;
  waveThr: number;
  gustThr: number;
  sources: MarineSource[];
  attribution: string;
}

const MS_TO_KN = 1.943844;

export function msToKnots(ms: number): number {
  return ms * MS_TO_KN;
}

export function knotsToMs(kn: number): number {
  return kn / MS_TO_KN;
}

/** Buduje URL FMI WAM dla punktu i okna czasowego (UTC ISO). */
export function fmiWamUrl(lat: number, lon: number, fromIso: string, toIso: string): string {
  const q = new URLSearchParams({
    latlon: `${lat},${lon}`,
    parameters: 'SigWaveHeight,WavePeriod',
    timestep: '60',
    starttime: fromIso.replace(/\.\d{3}Z$/, 'Z'),
    endtime: toIso.replace(/\.\d{3}Z$/, 'Z'),
  });
  return `${FMI_WAM_URL}&${q.toString()}`;
}

export function fmiHarmonieUrl(lat: number, lon: number, fromIso: string, toIso: string): string {
  const q = new URLSearchParams({
    latlon: `${lat},${lon}`,
    parameters: 'WindGust,WindSpeedMS',
    timestep: '60',
    starttime: fromIso.replace(/\.\d{3}Z$/, 'Z'),
    endtime: toIso.replace(/\.\d{3}Z$/, 'Z'),
  });
  return `${FMI_HARMONIE_URL}&${q.toString()}`;
}

/** DMI EDR — zawsze zawężaj datetime (bez limitu → HTTP 413). */
export function dmiWamUrl(lon: number, lat: number, fromIso: string, toIso: string): string {
  const from = fromIso.replace(/\.\d{3}Z$/, 'Z');
  const to = toIso.replace(/\.\d{3}Z$/, 'Z');
  const params = new URLSearchParams({
    coords: `POINT(${lon} ${lat})`,
    crs: 'crs84',
    f: 'CoverageJSON',
    datetime: `${from}/${to}`,
    'parameter-name': 'significant-wave-height,wind-speed,mean-wave-period',
  });
  return `${DMI_WAM_URL}?${params.toString()}`;
}

/** Parsuje FMI WFS TimeValuePair XML → próbki (wave / gust / wind). */
export function parseFmiTimeValuePair(
  xml: string,
  point: MarinePointCode,
  kind: 'wave' | 'gust',
): MarineSample[] {
  const out: MarineSample[] = [];
  // Każdy member ma własną serię; identyfikujemy po gml:id / phenomenon
  const members = xml.split(/<wfs:member>/i).slice(1);
  for (const mem of members) {
    const idMatch = mem.match(/gml:id="([^"]+)"/i);
    const id = idMatch?.[1] ?? '';
    const isWave = /SigWaveHeight|WavePeriod/i.test(id) || (kind === 'wave' && /WAM|wam/i.test(id));
    const isGust = /WindGust/i.test(id);
    const isWind = /WindSpeedMS/i.test(id);
    const pairs = [...mem.matchAll(/<wml2:time>([^<]+)<\/wml2:time>\s*<wml2:value>([^<]*)<\/wml2:value>/gi)];
    for (const m of pairs) {
      const at = new Date(m[1]).toISOString();
      const raw = m[2].trim();
      if (!raw || raw === 'NaN' || raw.toLowerCase() === 'nan') continue;
      const num = Number(raw);
      if (!Number.isFinite(num)) continue;
      const sample: MarineSample = {
        at, waveM: null, gustKn: null, windMs: null, periodS: null, source: 'FMI', point,
      };
      if (kind === 'wave') {
        if (/WavePeriod/i.test(id)) sample.periodS = num;
        else sample.waveM = num; // SigWaveHeight albo domyślnie fala
        if (!isWave && /WavePeriod/i.test(id) === false && members.length === 1) sample.waveM = num;
      } else {
        if (isGust) sample.gustKn = msToKnots(num);
        else if (isWind) sample.windMs = num;
        else sample.gustKn = msToKnots(num); // pojedyncza seria gust
      }
      out.push(sample);
    }
  }
  return mergeSamples(out);
}

/** CoverageJSON DMI (PointSeries) → próbki. */
export function parseDmiCoverageJson(json: unknown, point: MarinePointCode): MarineSample[] {
  const cov = json as {
    domain?: { axes?: { t?: { values?: string[] } } };
    ranges?: Record<string, { values?: Array<number | null> }>;
  };
  const times = cov.domain?.axes?.t?.values ?? [];
  if (!times.length) return [];
  const wave = cov.ranges?.['significant-wave-height']?.values ?? [];
  const wind = cov.ranges?.['wind-speed']?.values ?? [];
  const period = cov.ranges?.['mean-wave-period']?.values ?? [];
  const out: MarineSample[] = [];
  for (let i = 0; i < times.length; i++) {
    const w = wave[i];
    const ws = wind[i];
    const p = period[i];
    const waveM = typeof w === 'number' && Number.isFinite(w) ? w : null;
    const windMs = typeof ws === 'number' && Number.isFinite(ws) ? ws : null;
    const periodS = typeof p === 'number' && Number.isFinite(p) ? p : null;
    if (waveM == null && windMs == null) continue;
    out.push({
      at: new Date(times[i]).toISOString(),
      waveM,
      gustKn: windMs != null ? msToKnots(windMs) : null, // DMI bez porywów — używamy prędkości jako dolnego oszacowania
      windMs,
      periodS,
      source: 'DMI',
      point,
    });
  }
  return out;
}

/** SMHI ocobs JSON (boja) → próbki obserwacji. */
export function parseSmhiOcobs(json: unknown): MarineSample[] {
  const body = json as {
    value?: Array<{ date: number; value: number }>;
    position?: Array<{ latitude: number; longitude: number }>;
  };
  const vals = body.value ?? [];
  return vals
    .filter((v) => Number.isFinite(v.value))
    .map((v) => ({
      at: new Date(v.date).toISOString(),
      waveM: v.value,
      gustKn: null,
      windMs: null,
      periodS: null,
      source: 'SMHI' as const,
      point: 'SMHI_KNOLLS' as const,
    }));
}

function mergeSamples(rows: MarineSample[]): MarineSample[] {
  const byKey = new Map<string, MarineSample>();
  for (const r of rows) {
    const k = `${r.source}|${r.point}|${r.at}`;
    const cur = byKey.get(k);
    if (!cur) { byKey.set(k, { ...r }); continue; }
    if (r.waveM != null) cur.waveM = r.waveM;
    if (r.gustKn != null) cur.gustKn = r.gustKn;
    if (r.windMs != null) cur.windMs = r.windMs;
    if (r.periodS != null) cur.periodS = r.periodS;
  }
  return [...byKey.values()].sort((a, b) => a.at.localeCompare(b.at));
}

export function samplesInWindow(samples: MarineSample[], fromIso: string, toIso: string): MarineSample[] {
  const a = Date.parse(fromIso);
  const b = Date.parse(toIso);
  return samples.filter((s) => {
    const t = Date.parse(s.at);
    return t >= a && t <= b;
  });
}

/**
 * Ocena okna (odejście ± 6 h): max fala / max porywy vs progi.
 * wysokie = ≥ próg; podwyższone = ≥ 75% progu; niskie = reszta.
 */
export function evaluateMarineWindow(
  samples: MarineSample[],
  waveThr = 3.8,
  gustThr = 40,
): MarineEval {
  let maxWaveM: number | null = null;
  let maxGustKn: number | null = null;
  const sources = new Set<MarineSource>();
  for (const s of samples) {
    sources.add(s.source);
    if (s.waveM != null && Number.isFinite(s.waveM)) {
      maxWaveM = maxWaveM == null ? s.waveM : Math.max(maxWaveM, s.waveM);
    }
    if (s.gustKn != null && Number.isFinite(s.gustKn)) {
      maxGustKn = maxGustKn == null ? s.gustKn : Math.max(maxGustKn, s.gustKn);
    }
  }
  const waveHi = maxWaveM != null && maxWaveM >= waveThr;
  const gustHi = maxGustKn != null && maxGustKn >= gustThr;
  const waveWarn = maxWaveM != null && maxWaveM >= waveThr * 0.75;
  const gustWarn = maxGustKn != null && maxGustKn >= gustThr * 0.75;
  const breached = waveHi || gustHi;
  const risk: MarineRiskLevel = breached ? 'wysokie' : (waveWarn || gustWarn) ? 'podwyższone' : 'niskie';
  const srcList = [...sources];
  const attrParts: string[] = [];
  if (srcList.includes('FMI')) attrParts.push(FMI_ATTRIBUTION);
  if (srcList.includes('DMI')) attrParts.push(DMI_ATTRIBUTION);
  if (srcList.includes('SMHI')) attrParts.push(SMHI_ATTRIBUTION);
  return {
    maxWaveM, maxGustKn, risk, breached, waveThr, gustThr,
    sources: srcList,
    attribution: attrParts.length ? attrParts.join(' · ') : MARINE_ATTRIBUTION,
  };
}

/** Ryzyko FERRY — możliwe odwołanie rejsu (progi D-39). Shape = RiskInput z sync.ts. */
export function marineWeatherRisk(args: {
  sailingId: string;
  vessel: string;
  departureUtc: string;
  eval: MarineEval;
  nowIso: string;
  route?: string | null;
}) {
  const wave = args.eval.maxWaveM?.toFixed(1) ?? '—';
  const gust = args.eval.maxGustKn?.toFixed(0) ?? '—';
  return {
    kind: 'FERRY' as const,
    severity: 'HIGH' as const,
    title: `Pogoda morska: możliwe odwołanie rejsu — fala ${wave} m / porywy ${gust} kn (${args.vessel})`,
    titleKey: 'rk_ferry_weather',
    params: {
      vessel: args.vessel,
      wave,
      gust,
      wave_thr: args.eval.waveThr,
      gust_thr: args.eval.gustThr,
    },
    detail: {
      zrodlo: args.eval.sources.join('+'),
      atrybucja: args.eval.attribution,
      fala_m: args.eval.maxWaveM,
      porywy_kn: args.eval.maxGustKn,
      prog_fala_m: args.eval.waveThr,
      prog_porywy_kn: args.eval.gustThr,
      odejscie: args.departureUtc,
      sailing_id: args.sailingId,
      trasa: args.route ?? null,
      czas: args.nowIso,
      progi: 'D-39 potwierdzone (WAVE_M / GUST_KN)',
    },
    dedup: `FERRY_WEATHER:${args.sailingId}`,
    sourceUrl: 'https://en.ilmatieteenlaitos.fi/open-data',
    validUntil: new Date(Date.parse(args.departureUtc) + 18 * 3600_000).toISOString(),
  };
}
