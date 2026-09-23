/**
 * M12 ETA — szacunek odcinkowy.
 * Confidence LOW/MED/HIGH + earliest–latest + reason chips.
 * Recalc on status / load_event / ferry change.
 */
import type { EtaConfidence, EtaSegment, FerryBooking, LoadStatus } from '../types';

export const ETA_METHOD_LABEL = 'Szacunek z czasów odcinków (prom + drogi)';

const BASE_SEGMENTS: Omit<EtaSegment, 'hours' | 'confidence' | 'earliestHours' | 'latestHours' | 'reasons'>[] = [
  { id: 's1', label: 'Droga PL Śrem→Gdańsk', kind: 'PL_ROAD' },
  { id: 's2', label: 'Oczekiwanie / check-in promu', kind: 'WAIT_FERRY' },
  { id: 's3', label: 'Przeprawa GDN→NYN', kind: 'CROSSING' },
  { id: 's4', label: 'Droga SE Nynäshamn→Boden', kind: 'SE_ROAD' },
  { id: 's5', label: 'Przerwy 561/2006', kind: 'BREAK' },
];

const BASE_HOURS: Record<EtaSegment['kind'], number> = {
  PL_ROAD: 4.5,
  WAIT_FERRY: 2.0,
  CROSSING: 18.0,
  SE_ROAD: 14.0,
  BREAK: 4.5,
};

/** Remaining fraction of segment by corridor status (heuristic). */
function remainingFactor(status: LoadStatus, kind: EtaSegment['kind']): number {
  if (status === 'DELIVERED') return 0;
  if (status === 'UNLOADING') {
    if (kind === 'SE_ROAD' || kind === 'BREAK') return 0.15;
    return 0;
  }
  if (status === 'APPROACHING_SITE') {
    if (kind === 'SE_ROAD') return 0.25;
    if (kind === 'BREAK') return 0.3;
    return 0;
  }
  if (status === 'IN_TRANSIT_SE') {
    if (kind === 'PL_ROAD' || kind === 'WAIT_FERRY' || kind === 'CROSSING') return 0;
    if (kind === 'SE_ROAD') return 0.55;
    return 0.6;
  }
  if (status === 'ON_FERRY') {
    if (kind === 'PL_ROAD' || kind === 'WAIT_FERRY') return 0;
    if (kind === 'CROSSING') return 0.45;
    return 1;
  }
  if (status === 'AT_PORT') {
    if (kind === 'PL_ROAD') return 0;
    if (kind === 'WAIT_FERRY') return 0.5;
    return 1;
  }
  if (status === 'IN_TRANSIT_PL' || status === 'LOADING') {
    if (kind === 'PL_ROAD') return status === 'LOADING' ? 0.95 : 0.55;
    return 1;
  }
  return 1;
}

function bandFor(kind: EtaSegment['kind'], hours: number, status: LoadStatus): {
  confidence: EtaConfidence;
  earliestHours: number;
  latestHours: number;
  reasons: string[];
} {
  const reasons: string[] = [];
  let lo = 0.88;
  let hi = 1.12;
  let confidence: EtaConfidence = 'MED';

  if (kind === 'CROSSING') {
    reasons.push('rozkład Polferries (schedule)');
    lo = 0.95;
    hi = 1.08;
    confidence = 'HIGH';
  } else if (kind === 'WAIT_FERRY') {
    reasons.push('bufor check-in / boarding');
    lo = 0.7;
    hi = 1.6;
    confidence = 'LOW';
  } else if (kind === 'SE_ROAD') {
    reasons.push('E4 + Trafikverket seed');
    lo = 0.85;
    hi = 1.25;
    confidence = 'MED';
  } else if (kind === 'PL_ROAD') {
    reasons.push('dystans÷planowana prędkość');
    lo = 0.9;
    hi = 1.2;
    confidence = 'MED';
  } else {
    reasons.push('przerwy 561/2006');
    lo = 0.8;
    hi = 1.3;
    confidence = 'MED';
  }

  if (status === 'SILENT') {
    reasons.push('silent >90 min');
    confidence = 'LOW';
    hi *= 1.35;
  }
  if (status === 'DELAYED') {
    reasons.push('DELAYED flag');
    confidence = 'LOW';
    hi *= 1.25;
  }
  if (kind === 'SE_ROAD' && ['IN_TRANSIT_SE', 'APPROACHING_SITE'].includes(status)) {
    reasons.push('GPS en-route');
  }

  return {
    confidence,
    earliestHours: Math.max(0, +(hours * lo).toFixed(1)),
    latestHours: +(hours * hi).toFixed(1),
    reasons,
  };
}

export interface EtaSnapshot {
  segments: EtaSegment[];
  totalHours: number;
  confidence: EtaConfidence;
  earliestHours: number;
  latestHours: number;
  reasons: string[];
  method: string;
  etaBodenIso: string | null;
  updatedAt: string;
}

function rollupConfidence(segs: EtaSegment[]): EtaConfidence {
  if (segs.some((s) => s.confidence === 'LOW' && s.hours > 0)) return 'LOW';
  if (segs.every((s) => s.hours === 0 || s.confidence === 'HIGH')) return 'HIGH';
  return 'MED';
}

export function computeEta(opts: {
  status: LoadStatus;
  ferry?: FerryBooking | null;
  delayed?: boolean;
  silentMinutes?: number | null;
  nowIso?: string;
}): EtaSnapshot {
  const status = opts.delayed && opts.status !== 'DELIVERED' ? 'DELAYED' : opts.status;
  const now = opts.nowIso ?? new Date().toISOString();
  const segments: EtaSegment[] = BASE_SEGMENTS.map((base) => {
    const raw = BASE_HOURS[base.kind] * remainingFactor(status, base.kind);
    // Ferry booking slip expands wait
    let hours = raw;
    if (base.kind === 'WAIT_FERRY' && opts.ferry?.status === 'DELAYED') {
      hours += 2;
    }
    if (base.kind === 'CROSSING' && opts.ferry?.status === 'ONBOARD') {
      hours = Math.max(0, hours * 0.5);
    }
    hours = +hours.toFixed(1);
    const band = bandFor(base.kind, hours, status);
    if (opts.silentMinutes != null && opts.silentMinutes > 90 && base.kind === 'SE_ROAD') {
      band.reasons.push(`silent ${opts.silentMinutes} min`);
      band.confidence = 'LOW';
    }
    return {
      ...base,
      hours,
      ...band,
    };
  });

  const totalHours = +segments.reduce((a, s) => a + s.hours, 0).toFixed(1);
  const earliestHours = +segments.reduce((a, s) => a + s.earliestHours, 0).toFixed(1);
  const latestHours = +segments.reduce((a, s) => a + s.latestHours, 0).toFixed(1);
  const confidence = rollupConfidence(segments);
  const reasons = [
    ...new Set(segments.flatMap((s) => (s.hours > 0 ? s.reasons.slice(0, 1) : []))),
  ].slice(0, 6);
  if (opts.ferry?.vessel) reasons.unshift(`prom ${opts.ferry.vessel}`);

  let etaBodenIso: string | null = null;
  if (totalHours > 0 && status !== 'DELIVERED') {
    const t = Date.parse(now);
    if (!Number.isNaN(t)) {
      etaBodenIso = new Date(t + totalHours * 3600_000).toISOString();
    }
  }

  return {
    segments,
    totalHours,
    confidence,
    earliestHours,
    latestHours,
    reasons,
    method: ETA_METHOD_LABEL,
    etaBodenIso,
    updatedAt: now,
  };
}

/** Apply snapshot onto a load-shaped object. */
export function applyEtaToLoad<T extends { status: LoadStatus; ferry: FerryBooking; delayed: boolean; silentMinutes: number | null; etaSegments: EtaSegment[]; etaBoden: string | null }>(
  load: T,
  nowIso?: string,
): T & {
  etaConfidence: EtaConfidence;
  etaEarliestHours: number;
  etaLatestHours: number;
  etaReasons: string[];
  etaMethod: string;
  etaUpdatedAt: string;
} {
  const snap = computeEta({
    status: load.status,
    ferry: load.ferry,
    delayed: load.delayed,
    silentMinutes: load.silentMinutes,
    nowIso,
  });
  return {
    ...load,
    etaSegments: snap.segments,
    etaBoden: snap.etaBodenIso ?? load.etaBoden,
    etaConfidence: snap.confidence,
    etaEarliestHours: snap.earliestHours,
    etaLatestHours: snap.latestHours,
    etaReasons: snap.reasons,
    etaMethod: snap.method,
    etaUpdatedAt: snap.updatedAt,
  };
}
