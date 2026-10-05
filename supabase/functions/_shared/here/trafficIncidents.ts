/**
 * H-2-PL — HERE Traffic API v7 /incidents wzdłuż korytarza PL (1 zapytanie / przebieg).
 * Pula: HERE_TRAFFIC_FREE (domyślnie 5000), stawka ponad pulę z app_parameters.
 */
import { encodeFlexiblePolyline } from './flexPolyline.ts';
import { CORRIDOR_PL, distanceToCorridorKm, type RoadEvent } from '../integrations/road.ts';
import type { RiskSeverity } from '../integrations/sync.ts';

export const HERE_TRAFFIC_INCIDENTS_URL = 'https://data.traffic.hereapi.com/v7/incidents';
/** Promień korytarza [m] — max HERE = 5000. */
export const PL_TRAFFIC_CORRIDOR_RADIUS_M = 5000;

export function plTrafficCorridorIn(points: readonly [number, number][] = CORRIDOR_PL): string {
  const poly = encodeFlexiblePolyline(points);
  return `corridor:${poly};r=${PL_TRAFFIC_CORRIDOR_RADIUS_M}`;
}

export function buildTrafficIncidentsUrl(args: {
  apiKey: string;
  inFilter?: string;
  lang?: string;
}): string {
  const u = new URL(HERE_TRAFFIC_INCIDENTS_URL);
  u.searchParams.set('in', args.inFilter ?? plTrafficCorridorIn());
  u.searchParams.set('locationReferencing', 'shape');
  u.searchParams.set('lang', args.lang ?? 'pl-PL');
  u.searchParams.set('apiKey', args.apiKey);
  return u.toString();
}

const CRIT: Record<string, RiskSeverity> = {
  critical: 'HIGH',
  major: 'HIGH',
  minor: 'MEDIUM',
  low: 'LOW',
};

function shapeCentroid(shape: unknown): { lat: number; lon: number } | null {
  let lat = 0;
  let lon = 0;
  let n = 0;
  const add = (a: number, b: number) => {
    if (!Number.isFinite(a) || !Number.isFinite(b)) return;
    lat += a;
    lon += b;
    n++;
  };
  // Oficjalny shape: { links: [{ points: [{ lat, lng }] }] }
  if (shape && typeof shape === 'object' && !Array.isArray(shape)) {
    const links = (shape as { links?: unknown }).links;
    if (Array.isArray(links)) {
      for (const link of links) {
        const pts = (link as { points?: unknown })?.points;
        if (!Array.isArray(pts)) continue;
        for (const pt of pts) {
          const o = pt as { lat?: number; lng?: number; lon?: number };
          add(Number(o.lat), Number(o.lng ?? o.lon));
        }
      }
    }
  } else if (Array.isArray(shape)) {
    // Uproszczony format testowy: [[lat,lon], ...]
    for (const p of shape) {
      if (!Array.isArray(p) || p.length < 2) continue;
      add(Number(p[0]), Number(p[1]));
    }
  }
  if (!n) return null;
  return { lat: lat / n, lon: lon / n };
}

function incidentKind(type: string, roadClosed: boolean): string {
  if (roadClosed) return 'zamkniecie';
  const t = type.toLowerCase();
  if (t.includes('accident') || t.includes('collision')) return 'wypadek';
  if (t.includes('construction') || t.includes('roadworks') || t.includes('works')) return 'roboty';
  if (t.includes('obstruction') || t.includes('hazard') || t.includes('object')) return 'przeszkoda';
  return type || 'inne';
}

/** Parsuje JSON Traffic v7 → zdarzenia w buforze korytarza PL. */
export function parseHereTrafficIncidents(json: unknown, bufferKm = 8): RoadEvent[] {
  const root = json as { results?: unknown[] };
  if (!root || !Array.isArray(root.results)) return [];
  const out: RoadEvent[] = [];
  for (const row of root.results) {
    const r = row as {
      location?: { shape?: unknown; length?: number };
      incidentDetails?: {
        id?: string;
        originalId?: string;
        startTime?: string;
        endTime?: string;
        roadClosed?: boolean;
        criticality?: string;
        type?: string;
        description?: { value?: string };
        summary?: { value?: string };
      };
    };
    const d = r.incidentDetails;
    if (!d) continue;
    const id = String(d.originalId || d.id || '');
    if (!id) continue;
    const c = shapeCentroid(r.location?.shape);
    if (!c) continue;
    if (distanceToCorridorKm(c.lat, c.lon, CORRIDOR_PL) > bufferKm) continue;
    const title = (d.summary?.value || d.description?.value || d.type || 'Utrudnienie').slice(0, 200);
    const detail = (d.description?.value || d.summary?.value || '').slice(0, 800);
    const closed = !!d.roadClosed;
    out.push({
      id: `HERE:${id}`,
      title,
      detail,
      severity: closed ? 'HIGH' : (CRIT[(d.criticality || '').toLowerCase()] ?? 'MEDIUM'),
      lat: c.lat,
      lon: c.lon,
      road: null,
      start: d.startTime ?? null,
      end: d.endTime ?? null,
      kind: incidentKind(String(d.type || ''), closed),
    });
  }
  return out;
}
