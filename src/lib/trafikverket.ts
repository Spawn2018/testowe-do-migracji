/** Trafikverket Open API v2 Situation client. Live via /api/trafikverket proxy; else seed mock. */

export type SituationSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type SituationKind =
  | 'roadworks'
  | 'weather'
  | 'accident'
  | 'restriction'
  | 'other';

export interface RoadSituation {
  id: string;
  title: string;
  detail: string;
  severity: SituationSeverity;
  lng: number;
  lat: number;
  road: string;
  updatedAt: string;
  source: 'live' | 'seed';
  /** Estimated extra delay on corridor (minutes). */
  delayMin: number;
  kind: SituationKind;
}

const BBOX = { swLng: 17.5, swLat: 58.7, neLng: 22.5, neLat: 66.0 };

/** Realistic E4 corridor situations Nynäshamn → Boden (demo when no API key). */
export const SEED_SITUATIONS: RoadSituation[] = [
  {
    id: 'seed-sit-nyn',
    title: 'E4 Nynäshamn — tymczasowe ograniczenie',
    detail: 'Wyjazd z portu · zwężenie · kolejka po zejściu z promu · +20–35 min',
    severity: 'MEDIUM',
    lng: 17.948,
    lat: 58.903,
    road: 'E4',
    updatedAt: '2026-09-23T01:20:00+02:00',
    source: 'seed',
    delayMin: 28,
    kind: 'restriction',
  },
  {
    id: 'seed-sit-1',
    title: 'E4 Gävle — roboty drogowe',
    detail: 'Zamknięty pas · ograniczona przepustowość na północ · +25–40 min',
    severity: 'HIGH',
    lng: 17.141,
    lat: 60.674,
    road: 'E4',
    updatedAt: '2026-09-22T22:10:00+02:00',
    source: 'seed',
    delayMin: 35,
    kind: 'roadworks',
  },
  {
    id: 'seed-sit-2',
    title: 'E4 Sundsvall — wypadek',
    detail: 'Kolizja usunięta · pozostały korek · eskorty ponadgabarytowe: ostrożnie · +45–70 min',
    severity: 'HIGH',
    lng: 17.306,
    lat: 62.39,
    road: 'E4',
    updatedAt: '2026-09-22T20:40:00+02:00',
    source: 'seed',
    delayMin: 55,
    kind: 'accident',
  },
  {
    id: 'seed-sit-3',
    title: 'E4 Umeå N — ślisko / lód',
    detail: 'Ostrzeżenie SMHI · mokra / oblodzona nawierzchnia · zwolnij przy W>3,2 m · +30–50 min',
    severity: 'MEDIUM',
    lng: 20.263,
    lat: 63.825,
    road: 'E4',
    updatedAt: '2026-09-22T18:00:00+02:00',
    source: 'seed',
    delayMin: 40,
    kind: 'weather',
  },
  {
    id: 'seed-sit-4',
    title: 'E4 Luleå — tymczasowy limit masy',
    detail: 'Ograniczenie BK na moście w nocy · ponadgabaryt może wymagać okna objazdu · +90–150 min',
    severity: 'CRITICAL',
    lng: 22.154,
    lat: 65.584,
    road: 'E4',
    updatedAt: '2026-09-22T16:15:00+02:00',
    source: 'seed',
    delayMin: 120,
    kind: 'restriction',
  },
  {
    id: 'seed-sit-5',
    title: 'E4 Södertälje — kolejka',
    detail: 'Duży ruch na południe od Sztokholmu · kumulacja przyjazdów promów · +15–25 min',
    severity: 'LOW',
    lng: 17.625,
    lat: 59.195,
    road: 'E4',
    updatedAt: '2026-09-22T14:00:00+02:00',
    source: 'seed',
    delayMin: 20,
    kind: 'restriction',
  },
  {
    id: 'seed-sit-boden',
    title: 'E4 Boden S — śnieżyca / zamknięcie odcinka',
    detail: 'Siła wyższa · przejazd tylko za pługiem · kolumna HGV · +180–240 min',
    severity: 'CRITICAL',
    lng: 21.69,
    lat: 65.825,
    road: 'E4',
    updatedAt: '2026-09-23T00:45:00+02:00',
    source: 'seed',
    delayMin: 210,
    kind: 'weather',
  },
];

function inBbox(lng: number, lat: number) {
  return lng >= BBOX.swLng && lng <= BBOX.neLng && lat >= BBOX.swLat && lat <= BBOX.neLat;
}

function mapSeverity(text: string): SituationSeverity {
  const u = text.toUpperCase();
  if (u.includes('STOPP') || u.includes('AVSTÄNG') || u.includes('CLOSED') || u.includes('STÄNGD'))
    return 'CRITICAL';
  if (u.includes('OLYCKA') || u.includes('ACCIDENT') || u.includes('KÖ')) return 'HIGH';
  if (u.includes('VÄGLAG') || u.includes('VÄDER') || u.includes('ARBETE') || u.includes('IS'))
    return 'MEDIUM';
  return 'LOW';
}

function mapKind(text: string): SituationKind {
  const u = text.toUpperCase();
  if (u.includes('ARBETE') || u.includes('ROADWORK') || u.includes('ROBOT')) return 'roadworks';
  if (u.includes('OLYCKA') || u.includes('ACCIDENT')) return 'accident';
  if (u.includes('VÄDER') || u.includes('IS') || u.includes('SNÖ') || u.includes('VÄGLAG'))
    return 'weather';
  if (u.includes('AVSTÄNG') || u.includes('LIMIT') || u.includes('RESTRICT') || u.includes('BK'))
    return 'restriction';
  return 'other';
}

function estimateDelayMin(severity: SituationSeverity, text: string): number {
  const m = text.match(/\+(\d+)\s*[–-]\s*(\d+)\s*min/i) || text.match(/\+(\d+)\s*min/i);
  if (m) {
    if (m[2]) return Math.round((Number(m[1]) + Number(m[2])) / 2);
    return Number(m[1]);
  }
  switch (severity) {
    case 'CRITICAL':
      return 120;
    case 'HIGH':
      return 45;
    case 'MEDIUM':
      return 25;
    default:
      return 10;
  }
}

function parseLivePayload(data: unknown): RoadSituation[] {
  const root = data as {
    RESPONSE?: { RESULT?: Array<{ Situation?: Array<Record<string, unknown>> }> };
  };
  const situations: RoadSituation[] = [];
  for (const block of root.RESPONSE?.RESULT ?? []) {
    for (const sit of block.Situation ?? []) {
      const id = String(sit.Id ?? sit.id ?? Math.random());
      const deviations = (sit.Deviation as Array<Record<string, unknown>> | undefined) ?? [sit];
      for (const d of deviations) {
        const geom = d.Geometry as { WGS84?: string } | undefined;
        const wgs = geom?.WGS84;
        let lng = 17.5;
        let lat = 60.0;
        if (typeof wgs === 'string') {
          const m = wgs.match(/(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/);
          if (m) {
            lng = Number(m[1]);
            lat = Number(m[2]);
          }
        }
        const title = String(d.Header ?? d.LocationDescriptor ?? sit.Id ?? 'Situation');
        const detail = String(d.Message ?? d.TemporaryLimit ?? d.LocationDescriptor ?? '');
        if (!inBbox(lng, lat) && !String(d.LocationDescriptor ?? '').includes('E4')) continue;
        const severity = mapSeverity(`${title} ${detail}`);
        const kind = mapKind(`${title} ${detail}`);
        situations.push({
          id: `${id}-${situations.length}`,
          title,
          detail,
          severity,
          lng,
          lat,
          road: 'E4',
          updatedAt: String(d.StartTime ?? sit.PublicationTime ?? new Date().toISOString()),
          source: 'live',
          delayMin: estimateDelayMin(severity, `${title} ${detail}`),
          kind,
        });
      }
    }
  }
  return situations;
}

export async function fetchSituations(): Promise<{ items: RoadSituation[]; mode: 'live' | 'seed' }> {
  try {
    const res = await fetch('/api/trafikverket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ objecttype: 'Situation', schemaversion: '1.5', limit: 50 }),
    });
    if (!res.ok) throw new Error(`TV ${res.status}`);
    const json = await res.json();
    if (json?.mode === 'seed' || json?.demo) {
      return { items: SEED_SITUATIONS, mode: 'seed' };
    }
    const items = parseLivePayload(json);
    if (!items.length) return { items: SEED_SITUATIONS, mode: 'seed' };
    return { items, mode: 'live' };
  } catch {
    return { items: SEED_SITUATIONS, mode: 'seed' };
  }
}

/** Map TV severity → risk type: CRITICAL → FORCE_MAJEURE, else ROAD_SE. */
export function riskTypeForSituation(severity: SituationSeverity): 'FORCE_MAJEURE' | 'ROAD_SE' {
  return severity === 'CRITICAL' ? 'FORCE_MAJEURE' : 'ROAD_SE';
}
