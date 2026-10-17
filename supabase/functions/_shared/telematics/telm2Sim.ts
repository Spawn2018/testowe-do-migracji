/**
 * TELM-2 — czysta symulacja przebiegu naczepy (bez I/O, bez flag prod).
 * Reguły jak w `telm_infer_phase_from_position` (0176) + matchTrailer + PR5 poll.
 */
import { normalizePlate } from './emtrackWeb.ts';
import { matchFixToLoad, type LoadMatchRow } from './matchTrailer.ts';

export type TelmPhase = 'FERRY' | 'IN_TRANSIT_SE';

/** Jak SQL 0176: SE / Bałtyk → faza; inaczej null (PL / poza korytarzem). */
export function inferPhaseFromLatLon(lat: number, lon: number): TelmPhase | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat >= 55.0 && lon >= 11.0 && lon <= 25.0 && lat <= 70.0) return 'IN_TRANSIT_SE';
  if (lat >= 54.2 && lat < 55.0 && lon >= 17.0 && lon <= 20.5) return 'FERRY';
  return null;
}

/** Na promie pozycja naczepy nie prowadzi ETA — AIS statku. */
export function shouldTrackViaAis(phase: TelmPhase | null | string): boolean {
  return phase === 'FERRY';
}

/** PR5: jadąca 2 min, postój 15 min (domyślne 120 / 900 s). */
export function pollIntervalSec(speedKmh: number, ignition: boolean, movingSec = 120, stoppedSec = 900): number {
  const moving = (Number.isFinite(speedKmh) && speedKmh > 0) || ignition === true;
  return moving ? movingSec : stoppedSec;
}

export interface JourneyLoad {
  id: string;
  trailer_plate: string | null;
  telematics_vehicle_id?: string | null;
  status: string | null;
  /** ISO — początek „aktywności” (załadunek / start) */
  activeFrom?: string | null;
  /** ISO — koniec (rozładunek); null = nadal aktywny */
  activeTo?: string | null;
}

/**
 * Kolejne transporty tej samej naczepy bez mieszania:
 * wybierz load z dopasowaną płytą, statusem aktywnym i oknem [activeFrom, activeTo).
 * Gdy brak okien — pierwszy match jak `matchFixToLoad`.
 */
export function resolveActiveLoadAt(plate: string, loads: JourneyLoad[], atIso: string): JourneyLoad | null {
  const plateN = normalizePlate(plate);
  if (!plateN) return null;
  const at = Date.parse(atIso);
  const withWindow = loads.filter((l) => {
    if (normalizePlate(l.trailer_plate) !== plateN && normalizePlate(l.telematics_vehicle_id ?? '') !== plateN) {
      return false;
    }
    const s = String(l.status ?? '').toUpperCase();
    if (['DONE', 'CANCELLED', 'CANCELED', 'ARCHIVED', 'ZAKONCZONY', 'ANULOWANY', 'UNLOADED', 'DELIVERED'].includes(s)) {
      return false;
    }
    const from = l.activeFrom ? Date.parse(l.activeFrom) : NaN;
    const to = l.activeTo ? Date.parse(l.activeTo) : NaN;
    if (Number.isFinite(from) && at < from) return false;
    if (Number.isFinite(to) && at >= to) return false;
    return true;
  });
  if (withWindow.length) {
    // najpóźniejszy start = bieżący leg
    return withWindow.sort((a, b) => Date.parse(b.activeFrom ?? '0') - Date.parse(a.activeFrom ?? '0'))[0];
  }
  const fix = {
    trackingObjectId: 0,
    textId: plate,
    type: 'TRAILER' as const,
    lat: 0,
    lon: 0,
    speedKmh: 0,
    ignition: false,
    observedAt: atIso,
  };
  const rows: LoadMatchRow[] = loads.map((l) => ({
    id: l.id,
    trailer_plate: l.trailer_plate,
    telematics_vehicle_id: l.telematics_vehicle_id ?? null,
    status: l.status,
    plannedLoadDate: '2000-01-01',
  }));
  return matchFixToLoad(fix, rows) as JourneyLoad | null;
}

/** Orphan (brak match) — nie podnosi alarmu TELM-2. */
export function orphanProducesAlarm(matchedLoadId: string | null): boolean {
  return matchedLoadId != null ? false : false; // zawsze false dla orphan
}

export interface SimStep {
  at: string;
  lat: number;
  lon: number;
  speedKmh: number;
  ignition?: boolean;
  plate: string;
}

export interface SimResult {
  at: string;
  loadId: string | null;
  phase: TelmPhase | null;
  useAis: boolean;
  pollSec: number;
  orphan: boolean;
  alarm: boolean;
}

export function simulateJourney(steps: SimStep[], loads: JourneyLoad[]): SimResult[] {
  return steps.map((s) => {
    const load = resolveActiveLoadAt(s.plate, loads, s.at);
    const phase = inferPhaseFromLatLon(s.lat, s.lon);
    const orphan = load == null;
    return {
      at: s.at,
      loadId: load?.id ?? null,
      phase,
      useAis: shouldTrackViaAis(phase),
      pollSec: pollIntervalSec(s.speedKmh, s.ignition === true),
      orphan,
      alarm: orphanProducesAlarm(load?.id ?? null),
    };
  });
}
