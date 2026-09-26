/**
 * M12 — ruch drogowy (ZRODLA_DANYCH.md §2). Czyste funkcje: zapytania i parsery odpowiedzi.
 *  - SE: Trafikverket Open API (CC0), klucz TRAFIKVERKET_API_KEY — Situation wzdłuż E4 Nynäshamn → Boden
 *  - PL: KPD GDDKiA, DATEX II (rejestracja + certyfikat klienta) — utrudnienia na trasie Śrem → Gdańsk
 *  - cała trasa: TomTom Flow Segment Data, klucz TOMTOM_API_KEY — prędkość bieżąca wobec swobodnej
 * Bez klucza funkcja NIE działa na niby: zwraca tryb DEMO, panel zostaje oznaczony jako demonstracyjny (D18).
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
/** Zapytanie XML: Situation (utrudnienia) w promieniu `radiusM` od punktów E4. */
export function trafikverketSituationQuery(apiKey: string, radiusM = 20000): string {
  const within = CORRIDOR_SE.map(([la, lo]) => `<WITHIN name="Deviation.Geometry.WGS84" shape="center" value="${lo} ${la}" radius="${radiusM}m"/>`).join('');
  return `<REQUEST><LOGIN authenticationkey="${xmlEsc(apiKey)}"/><QUERY objecttype="Situation" schemaversion="1.5" limit="500"><FILTER><OR>${within}</OR></FILTER></QUERY></REQUEST>`;
}
export interface RoadEvent { id: string; title: string; detail: string; severity: RiskSeverity; lat: number | null; lon: number | null; road: string | null; start: string | null; end: string | null; kind: string }
const wkt = (s: unknown): LatLon | null => {
  const m = typeof s === 'string' ? s.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i) : null;
  return m ? [Number(m[2]), Number(m[1])] : null;
};
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

/* ---------- TomTom Flow Segment Data ---------- */
export const tomtomFlowUrl = (lat: number, lon: number, key: string) =>
  `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${lat},${lon}&unit=KMPH&key=${encodeURIComponent(key)}`;
export interface FlowReading { currentKmh: number; freeKmh: number; ratio: number; closed: boolean; confidence: number | null }
export function parseTomTomFlow(json: unknown): FlowReading | null {
  const f = (json as { flowSegmentData?: Record<string, unknown> })?.flowSegmentData;
  if (!f || typeof f.currentSpeed !== 'number' || typeof f.freeFlowSpeed !== 'number' || f.freeFlowSpeed <= 0) return null;
  return {
    currentKmh: f.currentSpeed, freeKmh: f.freeFlowSpeed, ratio: Math.round((f.currentSpeed / f.freeFlowSpeed) * 100) / 100,
    closed: f.roadClosure === true, confidence: typeof f.confidence === 'number' ? f.confidence : null,
  };
}
/** Próg: zamknięcie → HIGH; prędkość < 50% swobodnej → MEDIUM; niska pewność (<0,5) → brak ryzyka. */
export function flowRisk(loadId: string, code: string, lat: number, lon: number, r: FlowReading, nowIso: string): (RiskInput & { loadId: string }) | null {
  if (r.confidence != null && r.confidence < 0.5) return null;
  if (!r.closed && r.ratio >= 0.5) return null;
  const se = lat > 55.3;
  return {
    loadId, kind: se ? 'ROAD_SE' : 'ROAD_PL', severity: r.closed ? 'HIGH' : 'MEDIUM',
    title: `${code}: ${r.closed ? 'droga zamknięta' : `ruch ${r.currentKmh} km/h wobec ${r.freeKmh} km/h swobodnie`} przy pozycji auta`,
    titleKey: r.closed ? 'rk_flow_closed' : 'rk_flow_slow',
    params: r.closed ? { code } : { code, kmh: r.currentKmh, free: r.freeKmh },
    detail: { lat, lon, predkosc: r.currentKmh, swobodna: r.freeKmh, stosunek: r.ratio, zrodlo: 'TomTom' },
    dedup: `TRAFFIC_FLOW:${loadId}:${nowIso.slice(0, 13)}`,
  };
}
