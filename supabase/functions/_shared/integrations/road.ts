/**
 * M12 — ruch drogowy (ZRODLA_DANYCH.md §2). Czyste funkcje: zapytania i parsery odpowiedzi.
 *  - SE: Trafikverket Open API (CC0), klucz TRAFIKVERKET_API_KEY — RoadCondition, WeatherMeasurepoint i Situation 1.6 wzdłuż E4
 *  - PL: KPD GDDKiA, DATEX II (rejestracja + certyfikat klienta) — utrudnienia na trasie Śrem → Gdańsk
 *  - TomTom Flow: USUNIĘTE (CLEAN-TT-HERE / D-28); ETA = II-7 OSM
 * Bez klucza Trafikverket/GDDKiA funkcja NIE działa na niby: zwraca tryb DEMO (D18).
 * Formaty odpowiedzi wg dokumentacji dostawców — przy rejestracji kluczy zweryfikować na żywo.
 */
import type { RiskInput, RiskSeverity } from './sync.ts';
import { describeCondition, describeDeviation } from '../../../../src/lib/pl/describe.ts';

type LatLon = [number, number];
/** E4 Nynäshamn → Boden (punkty węzłowe trasy). */
export const CORRIDOR_SE: LatLon[] = [
  [58.9045, 17.9562], [59.3293, 18.0686], [59.8586, 17.6389], [60.6749, 17.1413], [61.7274, 17.1056],
  [62.3908, 17.3069], [62.6323, 17.9379], [63.2909, 18.7153], [63.8258, 20.2630], [64.7507, 20.9528],
  [65.3172, 21.4794], [65.5848, 22.1547], [65.8054, 21.7591],
];
/** E22 Karlskrona → Kalmar → Norrköping, potem E4 do Boden. Flagi H-1/H-3 zostają wyłączone. */
export const CORRIDOR_SE_E22: LatLon[] = [
  [56.1616, 15.5866], [56.170, 14.862], [56.663, 16.366], [57.758, 16.637],
  [58.480, 16.320], [58.594, 16.183], [59.3293, 18.0686], [59.8586, 17.6389],
  [60.6749, 17.1413], [61.7274, 17.1056], [62.3908, 17.3069], [62.6323, 17.9379],
  [63.2909, 18.7153], [63.8258, 20.2630], [64.7507, 20.9528], [65.3172, 21.4794],
  [65.5848, 22.1547], [65.8054, 21.7591],
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
/** Län E4 (Stockholm…Norrbotten) oraz E22 (Blekinge 10, Kalmar 8, Östergötland 5). */
export const CORRIDOR_SE_COUNTIES = [1, 3, 5, 8, 10, 21, 22, 24, 25] as const;
/**
 * Situation — wypadki, zamknięcia, roboty na E4 (H-2 / B-2b).
 * Schemat 1.5 bez przestrzeni nazw: dostawca zwraca „ObjectType does not exist” (01.10.2026).
 * Działa schemat 1.6 z namespace `road.trafficinfo` (sprawdzone 04.10.2026).
 * Filtr drogi po stronie API; bufor korytarza odcina E4 poza Nynäshamn–Boden.
 */
export function trafikverketSituationQuery(apiKey: string): string {
  return `<REQUEST><LOGIN authenticationkey="${xmlEsc(apiKey)}"/><QUERY objecttype="Situation" namespace="road.trafficinfo" schemaversion="1.6" limit="400"><FILTER><AND><OR><EQ name="Deviation.RoadNumber" value="E4"/><EQ name="Deviation.RoadNumber" value="E22"/></OR><IN name="Deviation.MessageType" value="Olycka,Vägarbete,Hinder"/></AND></FILTER></QUERY></REQUEST>`;
}
/** RoadCondition — stan nawierzchni w länach korytarza (schema 1.2, zweryfikowane live 01.10.2026). */
export function trafikverketRoadConditionQuery(apiKey: string, counties: readonly number[] = CORRIDOR_SE_COUNTIES): string {
  const eqs = counties.map((c) => `<EQ name="CountyNo" value="${c}"/>`).join('');
  return `<REQUEST><LOGIN authenticationkey="${xmlEsc(apiKey)}"/><QUERY objecttype="RoadCondition" schemaversion="1.2" limit="500"><FILTER><OR>${eqs}</OR></FILTER></QUERY></REQUEST>`;
}
/** WeatherMeasurepoint — stacje pogodowe przy drodze (zastąpiły WeatherStation od 2024). */
export function trafikverketWeatherQuery(apiKey: string, radiusM = 30000): string {
  const within = [...CORRIDOR_SE, ...CORRIDOR_SE_E22].map(([la, lo]) => `<WITHIN name="Geometry.WGS84" shape="center" value="${lo} ${la}" radius="${radiusM}m"/>`).join('');
  return `<REQUEST><LOGIN authenticationkey="${xmlEsc(apiKey)}"/><QUERY objecttype="WeatherMeasurepoint" schemaversion="1" limit="200"><FILTER><OR>${within}</OR></FILTER></QUERY></REQUEST>`;
}
export interface RoadEvent {
  id: string; title: string; detail: string; severity: RiskSeverity;
  lat: number | null; lon: number | null; road: string | null; start: string | null; end: string | null; kind: string;
  original?: string | null; note?: string | null; freeText?: string | null; unknownCodes?: string[];
}
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
/** Rodzaj sytuacji na panel i ryzyko. Nie zgadujemy zdarzenia spoza tych czterech. */
export type SituationKind = 'wypadek' | 'zamkniecie' | 'roboty' | 'przeszkoda' | 'inne';
const CLOSURE_CODES = new Set(['roadClosed', 'carriagewayClosures']);
const SIT_RANK: Record<SituationKind, number> = { zamkniecie: 4, wypadek: 3, przeszkoda: 2, roboty: 1, inne: 0 };
const INFO_TYPES = new Set(['Viktig trafikinformation', 'Information', 'Trafikmeddelande']);
function deviationKind(d: Record<string, unknown>): SituationKind | null {
  if (d.Suspended === true) return null;
  const mt = String(d.MessageType ?? '');
  const code = String(d.MessageCodeValue ?? '');
  if (CLOSURE_CODES.has(code)) return 'zamkniecie';
  if (mt === 'Olycka' || code === 'accident') return 'wypadek';
  if (mt === 'Hinder') return 'przeszkoda';
  if (mt === 'Vägarbete' || mt === 'MaintenanceWorks' || code === 'roadworks') return 'roboty';
  if (!mt || INFO_TYPES.has(mt) || d.SeverityCode === 1) return null;
  return 'inne';
}

const isRoad = (road: unknown, n: string) => typeof road === 'string' && new RegExp(`^E\\s*${n}$`, 'i').test(road.trim());
function roadLine(road: string | null): LatLon[] | null {
  if (isRoad(road, '22')) return CORRIDOR_SE_E22;
  if (isRoad(road, '4')) return CORRIDOR_SE;
  return null;
}

function deviationPoint(d: Record<string, unknown>): LatLon | null {
  const g = d.Geometry as { WGS84?: string; Point?: { WGS84?: string }; Line?: { WGS84?: string } } | undefined;
  if (!g) return null;
  return wktCentroid(g.WGS84) ?? wktCentroid(g.Point?.WGS84) ?? wktCentroid(g.Line?.WGS84);
}
function situationSeverity(code: unknown, kind: SituationKind): RiskSeverity {
  return tvSeverity(code) ?? (kind === 'zamkniecie' || kind === 'wypadek' ? 'HIGH' : 'LOW');
}
/**
 * Jedno zdarzenie na sytuację (wypadek, zamknięcie, roboty, przeszkoda) w buforze E4.
 * Zawieszone, bez geometrii i poza korytarzem odpadają. Pusta odpowiedź = pusta lista.
 */

/** Błąd w kopercie 200 (RESULT.ERROR). Pusta lista sytuacji to nie błąd. */
export function trafikverketResultError(json: unknown): string | null {
  const res = (json as { RESPONSE?: { RESULT?: { ERROR?: { MESSAGE?: string } }[] } })?.RESPONSE?.RESULT ?? [];
  for (const row of res) {
    const msg = row?.ERROR?.MESSAGE;
    if (msg) return String(msg);
  }
  return null;
}
export function parseTrafikverketSituations(json: unknown, bufferKm = 8): RoadEvent[] {
  const res = (json as { RESPONSE?: { RESULT?: { Situation?: unknown[] }[] } })?.RESPONSE?.RESULT ?? [];
  const out: RoadEvent[] = [];
  for (const r of res) for (const sit of (r.Situation ?? []) as { Id?: unknown; Deleted?: unknown; Deviation?: Record<string, unknown>[] }[]) {
    if (sit.Deleted === true) continue;
    let best: { d: Record<string, unknown>; kind: SituationKind; pt: LatLon } | null = null;
    for (const d of sit.Deviation ?? []) {
      const kind = deviationKind(d);
      const pt = deviationPoint(d);
      if (!kind || !pt) continue;
      const roadNo = typeof d.RoadNumber === 'string' ? d.RoadNumber : null;
      const line = roadLine(roadNo);
      if (!line || distanceToCorridorKm(pt[0], pt[1], line) > bufferKm) continue;
      if (!best || SIT_RANK[kind] > SIT_RANK[best.kind]) best = { d, kind, pt };
    }
    if (!best) continue;
    const d = best.d;
    const roadNo = (d.RoadNumber as string) ?? 'E4';
    const pl = describeDeviation(d, best.kind, roadNo);
    out.push({
      id: String(d.Id ?? sit.Id ?? ''),
      kind: best.kind,
      severity: situationSeverity(d.SeverityCode, best.kind),
      lat: best.pt[0], lon: best.pt[1],
      title: pl.title || 'zdarzenie drogowe',
      detail: pl.note || pl.detail || 'zdarzenie drogowe',
      road: roadNo,
      start: (d.StartTime as string) ?? null,
      end: (d.EndTime as string) ?? null,
      original: pl.original,
      note: pl.note,
      freeText: pl.freeText,
      unknownCodes: pl.unknownCodes,
    });
  }
  return out.filter((e) => e.id);
}

const ADVERSE_RE = /halka|blixthalka|sn[oö]|isigt|\bis\b|frost|sn[oö]yra|modd|slask|glatt/i;
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
    const roadNo = typeof c.RoadNumber === 'string' ? c.RoadNumber : null;
    const line = roadLine(roadNo);
    if (!line) continue;
    const pt = wktCentroid((c.Geometry as { WGS84?: string } | undefined)?.WGS84);
    if (!pt || distanceToCorridorKm(pt[0], pt[1], line) > bufferKm) continue;
    const rawText = String(c.ConditionText ?? '');
    const code = typeof c.ConditionCode === 'number' ? c.ConditionCode : Number(c.ConditionCode);
    const codeN = Number.isFinite(code) ? code : null;
    const adverse = (codeN != null && codeN !== 1) || ADVERSE_RE.test(rawText);
    const pl = describeCondition(codeN, rawText, roadNo, String(c.LocationText ?? ''));
    out.push({
      id: String(c.Id), code: codeN, text: pl.title || 'stan nawierzchni', road: roadNo,
      location: '', lat: pt[0], lon: pt[1], adverse, start: (c.StartTime as string) ?? null,
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
    if (!pt) continue;
    const near = Math.min(
      distanceToCorridorKm(pt[0], pt[1], CORRIDOR_SE),
      distanceToCorridorKm(pt[0], pt[1], CORRIDOR_SE_E22),
    );
    if (near > bufferKm) continue;
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
    title: `Warunki drogowe ${c.road || 'E4'}: ${c.text}`,
    titleKey: 'rk_road_se', params: { event: c.text },
    detail: { opis: c.location || c.text, rodzaj: 'RoadCondition', kod: c.code, lat: c.lat, lon: c.lon, od: c.start, zrodlo: 'Trafikverket RoadCondition (CC0)' },
    dedup: `ROAD_SE:RC:${c.id}`, sourceUrl: 'https://www.trafikverket.se/trafikinformation/', validUntil: null,
  };
}
export function weatherRisk(w: WeatherReading): RiskInput {
  const event = w.snow ? 'śnieg' : w.rain ? 'deszcz / mróz' : 'ślisko / mróz';
  return {
    kind: 'ROAD_SE', severity: w.snow ? 'HIGH' : 'MEDIUM',
    title: `Warunki drogowe E4: ${event}, ${w.name}`,
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
    title: country === 'SE' ? `Warunki drogowe ${e.road || 'E4'}: ${e.title}` : `${e.road ? `Trasa PL ${e.road}` : 'Trasa PL'}: ${e.title}`,
    titleKey: country === 'SE' ? 'rk_road_se' : e.road ? 'rk_road_pl_road' : 'rk_road_pl',
    params: { event: e.title, ...(country === 'PL' && e.road ? { road: e.road } : {}) },
    detail: { opis: e.detail, rodzaj: e.kind, lat: e.lat, lon: e.lon, od: e.start, do: e.end, oryginal: e.original ?? null, zrodlo: country === 'SE' ? 'Trafikverket (CC0)' : 'KPD GDDKiA' },
    dedup: `${country === 'SE' ? 'ROAD_SE' : 'ROAD_PL'}:${e.id}`, sourceUrl, validUntil: e.end,
  };
}

/* ---------- TomTom Flow — USUNIĘTE (CLEAN-TT-HERE / D-28); ETA = II-7 OSM ---------- */

