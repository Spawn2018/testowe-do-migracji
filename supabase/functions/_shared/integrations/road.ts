/**
 * M12 — ruch drogowy (ZRODLA_DANYCH.md §2). Czyste funkcje: zapytania i parsery odpowiedzi.
 *  - SE: Trafikverket Open API (CC0), klucz TRAFIKVERKET_API_KEY — Situation wzdłuż E4 Nynäshamn → Boden
 *  - PL: KPD GDDKiA, DATEX II (rejestracja + certyfikat klienta) — utrudnienia na trasie Śrem → Gdańsk
 *  - TomTom Flow: USUNIĘTE (CLEAN-TT-HERE / D-28); ETA = II-7 OSM
 * Bez klucza Trafikverket/GDDKiA funkcja NIE działa na niby: zwraca tryb DEMO (D18).
 * Formaty odpowiedzi wg dokumentacji dostawców — przy rejestracji kluczy zweryfikować na żywo.
 */
import type { RiskInput, RiskSeverity } from './sync.ts';

type LatLon = [number, number];
/** E4 Nynäshamn → Boden (punkty węzłowe trasy). */
export const CORRIDOR_SE: LatLon[] = [
  [58.9045, 17.9562], [59.3293, 18.0686], [59.8586, 17.6389], [60.6749, 17.1413], [61.7274, 17.1056],
  [62.3908, 17.3069], [62.6323, 17.9379], [63.2909, 18.7153], [63.8258, 20.2630], [64.7507, 20.9528],
  [65.3172, 21.4794], [65.5848, 22.1547], [65.8054, 21.7591],
];
/** KSH Śrem → Poznań → S5 Bydgoszcz → A1 → Gdańsk Westerplatte. */
export const CORRIDOR_PL: LatLon[] = [
  [52.0739, 17.0246], [52.4064, 16.9252], [52.8, 17.6], [53.1235, 18.0084], [53.4000, 18.4400],
  [53.4837, 18.7536], [54.0, 18.75], [54.3520, 18.6466], [54.4037, 18.6813],
];

/** Odległość punktu od łamanej [km] (rzut równoodległościowy — wystarcza przy buforze kilku km). */
export function distanceToCorridorKm(lat: number, lon: number, line: LatLon[]): number {
  const R = 6371; const rad = Math.PI / 180; const k = Math.cos(lat * rad);
  const xy = ([a, b]: LatLon) => [b * rad * R * k, a * rad * R] as const;
  const [px, py] = xy([lat, lon]);
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = xy(line[i]); const [bx, by] = xy(line[i + 1]);
    const dx = bx - ax; const dy = by - ay; const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
    best = Math.min(best, Math.hypot(px - (ax + t * dx), py - (ay + t * dy)));
  }
  return best;
}

export type IntegrationMode = { mode: 'LIVE' } | { mode: 'DEMO'; reason: string };
export function integrationMode(env: Record<string, string | undefined>, keyName: string): IntegrationMode {
  return env[keyName] ? { mode: 'LIVE' } : { mode: 'DEMO', reason: `Brak ${keyName} — panel oznaczony jako dane demonstracyjne (D18)` };
}

/* ---------- Trafikverket ---------- */
export const TRAFIKVERKET_URL = 'https://api.trafikinfo.trafikverket.se/v2/data.json';
const xmlEsc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
/** Län wzdłuż E4 Nynäshamn → Boden (Stockholm…Norrbotten). */
export const CORRIDOR_SE_COUNTIES = [1, 3, 21, 22, 24, 25] as const;
/**
 * Zapytanie XML: Situation (utrudnienia) — **historyczne**.
 * Live API (01.10.2026): ObjectType `Situation` nie istnieje — road-se używa RoadCondition + WeatherMeasurepoint.
 * Parser zostaje do testów / ewentualnego powrotu obiektu.
 */
export function trafikverketSituationQuery(apiKey: string, radiusM = 20000): string {
  const within = CORRIDOR_SE.map(([la, lo]) => `<WITHIN name="Deviation.Geometry.WGS84" shape="center" value="${lo} ${la}" radius="${radiusM}m"/>`).join('');
  return `<REQUEST><LOGIN authenticationkey="${xmlEsc(apiKey)}"/><QUERY objecttype="Situation" schemaversion="1.5" limit="500"><FILTER><OR>${within}</OR></FILTER></QUERY></REQUEST>`;
}
/** RoadCondition — stan nawierzchni w länach korytarza (schema 1.2, zweryfikowane live 01.10.2026). */
export function trafikverketRoadConditionQuery(apiKey: string, counties: readonly number[] = CORRIDOR_SE_COUNTIES): string {
  const eqs = counties.map((c) => `<EQ name="CountyNo" value="${c}"/>`).join('');
  return `<REQUEST><LOGIN authenticationkey="${xmlEsc(apiKey)}"/><QUERY objecttype="RoadCondition" schemaversion="1.2" limit="500"><FILTER><OR>${eqs}</OR></FILTER></QUERY></REQUEST>`;
}
/** WeatherMeasurepoint — stacje pogodowe przy drodze (zastąpiły WeatherStation od 2024). */
export function trafikverketWeatherQuery(apiKey: string, radiusM = 30000): string {
  const within = CORRIDOR_SE.map(([la, lo]) => `<WITHIN name="Geometry.WGS84" shape="center" value="${lo} ${la}" radius="${radiusM}m"/>`).join('');
  return `<REQUEST><LOGIN authenticationkey="${xmlEsc(apiKey)}"/><QUERY objecttype="WeatherMeasurepoint" schemaversion="1" limit="200"><FILTER><OR>${within}</OR></FILTER></QUERY></REQUEST>`;
}
export interface RoadEvent { id: string; title: string; detail: string; severity: RiskSeverity; lat: number | null; lon: number | null; road: string | null; start: string | null; end: string | null; kind: string }
const wkt = (s: unknown): LatLon | null => {
  const m = typeof s === 'string' ? s.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i) : null;
  return m ? [Number(m[2]), Number(m[1])] : null;
};
/** Środek LINESTRING / POINT WGS84 (lon lat …). */
export function wktCentroid(s: unknown): LatLon | null {
  if (typeof s !== 'string') return null;
  const pt = wkt(s);
  if (pt) return pt;
  const m = s.match(/LINESTRING\s*\(([^)]+)\)/i);
  if (!m) return null;
  const pts = m[1].split(',').map((p) => p.trim().split(/\s+/).map(Number)).filter((xy) => xy.length >= 2 && Number.isFinite(xy[0]) && Number.isFinite(xy[1]));
  if (!pts.length) return null;
  const lon = pts.reduce((a, p) => a + p[0], 0) / pts.length;
  const lat = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  return [lat, lon];
}
/** SeverityCode Trafikverket: 1 brak wpływu, 2 mały, 4 duży, 5 bardzo duży. */
const tvSeverity = (c: unknown): RiskSeverity | null => (c === 5 ? 'HIGH' : c === 4 ? 'MEDIUM' : c === 2 || c === 3 ? 'LOW' : null);
export function parseTrafikverketSituations(json: unknown, bufferKm = 5): RoadEvent[] {
  const res = (json as { RESPONSE?: { RESULT?: { Situation?: unknown[] }[] } })?.RESPONSE?.RESULT ?? [];
  const out: RoadEvent[] = [];
  for (const r of res) for (const sit of (r.Situation ?? []) as { Deviation?: Record<string, unknown>[] }[]) {
    for (const d of sit.Deviation ?? []) {
      const sev = tvSeverity(d.SeverityCode);
      const pt = wkt((d.Geometry as { WGS84?: string } | undefined)?.WGS84 ?? (d.Geometry as { Point?: { WGS84?: string } } | undefined)?.Point?.WGS84);
      if (!sev || !pt) continue;
      if (distanceToCorridorKm(pt[0], pt[1], CORRIDOR_SE) > bufferKm) continue;
      out.push({
        id: String(d.Id), kind: String(d.MessageType ?? ''), severity: sev, lat: pt[0], lon: pt[1],
        title: String(d.Header ?? d.MessageCode ?? d.MessageType ?? 'Utrudnienie'),
        detail: String(d.Message ?? d.LocationDescriptor ?? ''), road: (d.RoadNumber as string) ?? null,
        start: (d.StartTime as string) ?? null, end: (d.EndTime as string) ?? null,
      });
    }
  }
  return out;
}

const ADVERSE_RE = /halka|blixthalka|sn[oö]|isigt|\bis\b|frost|sn[oö]yra|modd|slask|glatt/i;
const isE4 = (road: unknown) => typeof road === 'string' && /^E\s*4$/i.test(road.trim());
export interface RoadConditionReading {
  id: string; code: number | null; text: string; road: string | null; location: string;
  lat: number; lon: number; adverse: boolean; start: string | null;
}
/** RoadCondition → odcinki E4 w buforze; ConditionCode 1 + „Normalt” = bez ryzyka. */
export function parseTrafikverketRoadConditions(json: unknown, bufferKm = 8): RoadConditionReading[] {
  const res = (json as { RESPONSE?: { RESULT?: { RoadCondition?: Record<string, unknown>[] }[] } })?.RESPONSE?.RESULT ?? [];
  const out: RoadConditionReading[] = [];
  for (const r of res) for (const c of r.RoadCondition ?? []) {
    if (c.Deleted === true) continue;
    if (!isE4(c.RoadNumber)) continue;
    const pt = wktCentroid((c.Geometry as { WGS84?: string } | undefined)?.WGS84);
    if (!pt || distanceToCorridorKm(pt[0], pt[1], CORRIDOR_SE) > bufferKm) continue;
    const text = String(c.ConditionText ?? '');
    const code = typeof c.ConditionCode === 'number' ? c.ConditionCode : Number(c.ConditionCode);
    const codeN = Number.isFinite(code) ? code : null;
    const adverse = (codeN != null && codeN !== 1) || ADVERSE_RE.test(text);
    out.push({
      id: String(c.Id), code: codeN, text: text || 'stan nawierzchni', road: (c.RoadNumber as string) ?? null,
      location: String(c.LocationText ?? ''), lat: pt[0], lon: pt[1], adverse, start: (c.StartTime as string) ?? null,
    });
  }
  return out;
}
export interface WeatherReading {
  id: string; name: string; lat: number; lon: number;
  airC: number | null; surfaceC: number | null; windMs: number | null; rain: boolean; snow: boolean; adverse: boolean;
}
/** WeatherMeasurepoint — śnieg / mróz / silny deszcz na stacjach przy E4. */
export function parseTrafikverketWeather(json: unknown, bufferKm = 30): WeatherReading[] {
  const res = (json as { RESPONSE?: { RESULT?: { WeatherMeasurepoint?: Record<string, unknown>[] }[] } })?.RESPONSE?.RESULT ?? [];
  const out: WeatherReading[] = [];
  for (const r of res) for (const s of r.WeatherMeasurepoint ?? []) {
    if (s.Deleted === true) continue;
    const pt = wkt((s.Geometry as { WGS84?: string } | undefined)?.WGS84);
    if (!pt || distanceToCorridorKm(pt[0], pt[1], CORRIDOR_SE) > bufferKm) continue;
    const obs = s.Observation as Record<string, unknown> | undefined;
    if (!obs) continue;
    const num = (path: unknown) => (typeof path === 'number' ? path : typeof (path as { Value?: unknown })?.Value === 'number' ? (path as { Value: number }).Value : null);
    const airC = num((obs.Air as { Temperature?: unknown } | undefined)?.Temperature);
    const surfaceC = num((obs.Surface as { Temperature?: unknown } | undefined)?.Temperature);
    const windMs = num(((obs.Wind as { Speed?: unknown }[] | undefined)?.[0])?.Speed);
    const p5 = (obs.Aggregated5minutes as { Precipitation?: { Rain?: boolean; Snow?: boolean } } | undefined)?.Precipitation;
    const rain = p5?.Rain === true;
    const snow = p5?.Snow === true;
    const icy = (surfaceC != null && surfaceC <= 0) || (airC != null && airC <= -2);
    const adverse = snow || (rain && icy) || (icy && (windMs ?? 0) >= 8);
    out.push({
      id: String(s.Id), name: String(s.Name ?? s.Id), lat: pt[0], lon: pt[1],
      airC, surfaceC, windMs, rain, snow, adverse,
    });
  }
  return out;
}
/** II-6: wstępnie +15% przy śniegu/śliskości (parametr do kalibracji II-7b). */
export function seRoadSlowdownMult(args: {
  conditions: RoadConditionReading[]; weather: WeatherReading[]; pct?: number;
}): { mult: number; reason: string | null; adverseConditions: number; adverseWeather: number } {
  const pct = args.pct ?? 15;
  const adverseConditions = args.conditions.filter((c) => c.adverse).length;
  const adverseWeather = args.weather.filter((w) => w.adverse).length;
  if (!adverseConditions && !adverseWeather) return { mult: 1, reason: null, adverseConditions: 0, adverseWeather: 0 };
  const bits: string[] = [];
  if (adverseConditions) bits.push(`nawierzchnia ${adverseConditions}`);
  if (adverseWeather) bits.push(`pogoda ${adverseWeather}`);
  return { mult: Math.round((1 + pct / 100) * 100) / 100, reason: bits.join(', '), adverseConditions, adverseWeather };
}
export function roadConditionRisk(c: RoadConditionReading): RiskInput {
  return {
    kind: 'ROAD_SE', severity: 'MEDIUM',
    title: `E4: ${c.text}${c.location ? ` · ${c.location}` : ''}`,
    titleKey: 'rk_road_se', params: { event: c.text },
    detail: { opis: c.location || c.text, rodzaj: 'RoadCondition', kod: c.code, lat: c.lat, lon: c.lon, od: c.start, zrodlo: 'Trafikverket RoadCondition (CC0)' },
    dedup: `ROAD_SE:RC:${c.id}`, sourceUrl: 'https://www.trafikverket.se/trafikinformation/', validUntil: null,
  };
}
export function weatherRisk(w: WeatherReading): RiskInput {
  const event = w.snow ? 'śnieg' : w.rain ? 'deszcz / mróz' : 'ślisko / mróz';
  return {
    kind: 'ROAD_SE', severity: w.snow ? 'HIGH' : 'MEDIUM',
    title: `E4 ${w.name}: ${event}`,
    titleKey: 'rk_road_se', params: { event },
    detail: {
      opis: `powietrze ${w.airC ?? '—'}°C, nawierzchnia ${w.surfaceC ?? '—'}°C, wiatr ${w.windMs ?? '—'} m/s`,
      rodzaj: 'WeatherMeasurepoint', lat: w.lat, lon: w.lon, zrodlo: 'Trafikverket WeatherMeasurepoint (CC0)',
    },
    dedup: `ROAD_SE:WX:${w.id}`, sourceUrl: 'https://www.trafikverket.se/trafikinformation/', validUntil: null,
  };
}

/* ---------- KPD GDDKiA (DATEX II) ---------- */
const DATEX_SEV: Record<string, RiskSeverity> = { highest: 'HIGH', high: 'HIGH', medium: 'MEDIUM', low: 'LOW', lowest: 'LOW' };
/** DATEX II (v2/v3) — rekordy sytuacji niezależnie od prefiksów przestrzeni nazw; filtr bufora trasy PL. */
export function parseDatexSituations(xml: string, bufferKm = 5): RoadEvent[] {
  const out: RoadEvent[] = [];
  const recs = xml.split(/<(?:\w+:)?situationRecord\b/).slice(1);
  for (const raw of recs) {
    const rec = raw.split(/<\/(?:\w+:)?situationRecord>/)[0];
    const attr = rec.slice(0, rec.indexOf('>'));
    const id = attr.match(/\bid="([^"]+)"/)?.[1] ?? '';
    const type = attr.match(/type="(?:\w+:)?(\w+)"/)?.[1] ?? 'SituationRecord';
    const tag = (n: string) => rec.match(new RegExp(`<(?:\\w+:)?${n}\\b[^>]*>([^<]*)<`))?.[1]?.trim();
    const lat = Number(tag('latitude')); const lon = Number(tag('longitude'));
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || !tag('latitude')) continue;
    if (distanceToCorridorKm(lat, lon, CORRIDOR_PL) > bufferKm) continue;
    const comment = [...rec.matchAll(/<(?:\w+:)?value\b[^>]*lang="pl"[^>]*>([^<]*)</g)].map((m) => m[1].trim())[0]
      ?? [...rec.matchAll(/<(?:\w+:)?value\b[^>]*>([^<]*)</g)].map((m) => m[1].trim())[0] ?? '';
    out.push({
      id, kind: type, severity: DATEX_SEV[(tag('severity') ?? '').toLowerCase()] ?? 'LOW', lat, lon,
      title: `${type}${tag('roadNumber') ? ` · ${tag('roadNumber')}` : ''}`, detail: comment, road: tag('roadNumber') ?? null,
      start: tag('overallStartTime') ?? null, end: tag('overallEndTime') ?? null,
    });
  }
  return out;
}

export function roadRisk(country: 'SE' | 'PL', e: RoadEvent, sourceUrl: string): RiskInput {
  return {
    kind: country === 'SE' ? 'ROAD_SE' : 'ROAD_PL', severity: e.severity,
    title: `${country === 'SE' ? 'E4' : 'Trasa PL'}${e.road && country === 'PL' ? ` ${e.road}` : ''}: ${e.title}`,
    titleKey: country === 'SE' ? 'rk_road_se' : e.road ? 'rk_road_pl_road' : 'rk_road_pl',
    params: { event: e.title, ...(country === 'PL' && e.road ? { road: e.road } : {}) },
    detail: { opis: e.detail, rodzaj: e.kind, lat: e.lat, lon: e.lon, od: e.start, do: e.end, zrodlo: country === 'SE' ? 'Trafikverket (CC0)' : 'KPD GDDKiA' },
    dedup: `${country === 'SE' ? 'ROAD_SE' : 'ROAD_PL'}:${e.id}`, sourceUrl, validUntil: e.end,
  };
}

/* ---------- TomTom Flow — USUNIĘTE (CLEAN-TT-HERE / D-28); ETA = II-7 OSM ---------- */

