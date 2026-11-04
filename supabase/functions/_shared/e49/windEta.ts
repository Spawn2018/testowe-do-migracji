/**
 * E49-a (DP-205 / D-20261104-0105-01): wiatr w ETA — mnożniki i postój (Z1).
 * Progi domyślne = Z1 pkt 5; produkcja czyta `ops_thresholds`.
 * Stara H10_ETA_PROPOSAL (0,70 od 15 m/s) — usunięta.
 */

export const E49_WIND_DEFAULTS = {
  WIND_SLOW_MS: 20,
  WIND_CROSS_PCT: 15,
  WIND_HEAD_PCT: 5,
  WIND_HOLD_MS: 25,
  WIND_RESUME_MS: 20,
  WIND_RESUME_MIN: 30,
  SLIP_RADIUS_KM: 25,
  SLIP_MULT: 1.15,
} as const;

export type WindBearing = 'cross' | 'head' | 'tail';

/** Kąt 0–180° między kierunkiem jazdy (deg) a skąd wieje wiatr (deg, meteorologiczny). */
export function windRelativeAngleDeg(travelDeg: number, windFromDeg: number): number {
  let d = Math.abs(((windFromDeg - travelDeg) % 360 + 360) % 360);
  if (d > 180) d = 360 - d;
  return d;
}

/** Z1 pkt 2: bok 45–135°, przód < 45°, tył ≥ 135° (kąt względny 0–180). */
export function windBearingOf(travelDeg: number, windFromDeg: number): WindBearing {
  const a = windRelativeAngleDeg(travelDeg, windFromDeg);
  if (a < 45) return 'head';
  if (a <= 135) return 'cross';
  return 'tail';
}

export type WindEtaEffect =
  | { kind: 'none' }
  | { kind: 'slow'; bearing: WindBearing; mult: number; gustMs: number }
  | { kind: 'hold'; gustMs: number; resumeBelowMs: number; resumeExtraMin: number };

export function windEtaEffect(args: {
  gustMs: number;
  travelDeg: number;
  windFromDeg: number;
  thr?: Partial<typeof E49_WIND_DEFAULTS>;
}): WindEtaEffect {
  const t = { ...E49_WIND_DEFAULTS, ...args.thr };
  const g = args.gustMs;
  if (!(Number.isFinite(g) && g >= t.WIND_SLOW_MS)) return { kind: 'none' };
  if (g >= t.WIND_HOLD_MS) {
    return {
      kind: 'hold',
      gustMs: g,
      resumeBelowMs: t.WIND_RESUME_MS,
      resumeExtraMin: t.WIND_RESUME_MIN,
    };
  }
  const bearing = windBearingOf(args.travelDeg, args.windFromDeg);
  const mult =
    bearing === 'cross' ? 1 + t.WIND_CROSS_PCT / 100
    : bearing === 'head' ? 1 + t.WIND_HEAD_PCT / 100
    : 1;
  if (mult === 1) return { kind: 'none' };
  return { kind: 'slow', bearing, mult, gustMs: g };
}

/** Z4: ×1,15 tylko gdy punkt śliskości w promieniu `radiusKm` od odcinka / auta. */
export function slipAppliesLocally(distKm: number | null | undefined, radiusKm = E49_WIND_DEFAULTS.SLIP_RADIUS_KM): boolean {
  return distKm != null && Number.isFinite(distKm) && distKm >= 0 && distKm <= radiusKm;
}

export function slipMultLocal(distKm: number | null | undefined, radiusKm = E49_WIND_DEFAULTS.SLIP_RADIUS_KM): number {
  return slipAppliesLocally(distKm, radiusKm) ? E49_WIND_DEFAULTS.SLIP_MULT : 1;
}
