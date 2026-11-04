/**
 * E49-a cz.3 (DP-205): budowa `eta_basis.causes.weather` z prognozy punktów korytarza (Z1)
 * oraz spraw Z2 („Silny wiatr” / „Postój przez wiatr”).
 */
import { gustMeetsThresholdInWindow } from './corridorWindJob.ts';
import {
  E49_WIND_DEFAULTS,
  windBearingOf,
  windEtaEffect,
  type E49Thr,
  type WindBearing,
} from './windEta.ts';
import { nearestWindSample, type WindHourSample } from './windForecast.ts';

export type EtaWxCause = {
  kind: 'WIND' | 'WIND_HOLD' | 'SLIPPERY';
  addMin: number;
  where: string;
  gustMs?: number | null;
  side?: 'CROSS' | 'HEAD' | null;
  atIso?: string | null;
  fromIso?: string | null;
  untilIso?: string | null;
  source: 'SMHI' | 'FMI' | 'TRAFIKVERKET' | 'DIGITRAFFIC' | string;
};

export type CorridorWindRow = {
  corridor: string;
  km: number;
  lon: number;
  lat: number;
  bearingDeg: number;
  source: 'SMHI' | 'FMI';
  samples: WindHourSample[];
};

const TRUCK_KMH = 70;

function sideOf(b: WindBearing): 'CROSS' | 'HEAD' | null {
  if (b === 'cross') return 'CROSS';
  if (b === 'head') return 'HEAD';
  return null;
}

function whereLabel(corridor: string, km: number): string {
  const nice = corridor.replace(/_/g, ' ');
  return `${nice} · km ${Math.round(km)}`;
}

/**
 * Z1: dla punktów przed autem (km ≥ fromKm) w horyzoncie driveH —
 * poryw w godzinie przejazdu → WIND / WIND_HOLD.
 */
export function weatherFromCorridorWind(args: {
  rows: readonly CorridorWindRow[];
  fromKm: number;
  startAt: Date;
  driveH: number;
  thr?: Partial<E49Thr>;
  horizonH?: number;
}): { weather: EtaWxCause[]; addMin: number; holdMin: number } {
  const thr = { ...E49_WIND_DEFAULTS, ...args.thr };
  const horizonH = args.horizonH ?? 24;
  const weather: EtaWxCause[] = [];
  let addMin = 0;
  let holdMin = 0;
  const endMs = args.startAt.getTime() + Math.min(args.driveH, horizonH) * 3600_000;
  const sorted = [...args.rows]
    .filter((r) => Number.isFinite(r.km) && r.km >= args.fromKm - 0.01)
    .sort((a, b) => a.km - b.km);

  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i]!;
    const nextKm = sorted[i + 1]?.km ?? row.km + 25;
    const segKm = Math.max(0, nextKm - row.km);
    const distFromStart = Math.max(0, row.km - args.fromKm);
    const at = new Date(args.startAt.getTime() + (distFromStart / TRUCK_KMH) * 3600_000);
    if (at.getTime() > endMs) break;
    const sample = nearestWindSample(row.samples ?? [], at.toISOString());
    if (sample?.gustMs == null) continue;
    const gust = sample.gustMs;
    /* brak kierunku: bok (nie zgadujemy przodu/tyłu — F7 #785 r1) */
    const windFrom = sample.windFromDeg ?? (row.bearingDeg + 90) % 360;
    const effect = windEtaEffect({
      gustMs: gust,
      travelDeg: row.bearingDeg,
      windFromDeg: windFrom,
      thr,
    });
    if (effect.kind === 'none') continue;
    if (effect.kind === 'slow') {
      const baseMin = (segKm / TRUCK_KMH) * 60;
      const extra = Math.round(baseMin * (effect.mult - 1));
      if (extra <= 0) continue;
      addMin += extra;
      weather.push({
        kind: 'WIND',
        addMin: extra,
        where: whereLabel(row.corridor, row.km),
        gustMs: gust,
        side: sideOf(effect.bearing),
        atIso: at.toISOString(),
        source: row.source,
      });
    } else if (effect.kind === 'hold') {
      /* Postój: szukaj pierwszej godziny < resume na tym punkcie + WIND_RESUME_MIN. */
      let until = at;
      const samples = [...(row.samples ?? [])].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
      for (const s of samples) {
        const t = Date.parse(s.at);
        if (t < at.getTime()) continue;
        if (s.gustMs != null && s.gustMs < effect.resumeBelowMs) {
          until = new Date(t + effect.resumeExtraMin * 60_000);
          break;
        }
      }
      if (until.getTime() <= at.getTime()) {
        until = new Date(at.getTime() + 6 * 3600_000 + effect.resumeExtraMin * 60_000);
      }
      const mins = Math.max(0, Math.round((until.getTime() - at.getTime()) / 60_000));
      holdMin += mins;
      addMin += mins;
      weather.push({
        kind: 'WIND_HOLD',
        addMin: mins,
        where: whereLabel(row.corridor, row.km),
        gustMs: gust,
        fromIso: at.toISOString(),
        untilIso: until.toISOString(),
        source: row.source,
      });
      break; /* postój blokuje dalszy przejazd tego korytarza */
    }
  }

  weather.sort((a, b) => b.addMin - a.addMin);
  return { weather, addMin, holdMin };
}

/** Z2: klucz deduplikacji — JEDNA otwarta sprawa na transport i korytarz (nie na punkt km, nie osobno postój). */
export function windCaseDedup(loadId: string, corridor: string): string {
  return `E49_WIND:${loadId}:${corridor}`;
}

/** Z2: histereza zamknięcia — sprawa zamyka się dopiero gdy poryw spadnie poniżej progu − tyle m/s. */
export const E49_WIND_CLOSE_HYST_MS = 2;

export type WindThresholds = E49Thr;

/** Progi z `ops_thresholds` (WIND_*, SLIP_*) na wartości domyślne E49 (Z1 pkt 5). */
export function windThresholdsFromOps(
  rows: ReadonlyArray<{ key: string; value_num: number | string | null }>,
): WindThresholds {
  const thr: WindThresholds = { ...E49_WIND_DEFAULTS };
  for (const row of rows) {
    const v = Number(row.value_num);
    if (!Number.isFinite(v)) continue;
    switch (row.key) {
      case 'WIND_SLOW_MS': thr.WIND_SLOW_MS = v; break;
      case 'WIND_CROSS_PCT': thr.WIND_CROSS_PCT = v; break;
      case 'WIND_HEAD_PCT': thr.WIND_HEAD_PCT = v; break;
      case 'WIND_HOLD_MS': thr.WIND_HOLD_MS = v; break;
      case 'WIND_RESUME_MS': thr.WIND_RESUME_MS = v; break;
      case 'WIND_RESUME_MIN': thr.WIND_RESUME_MIN = v; break;
      case 'SLIP_RADIUS_KM': thr.SLIP_RADIUS_KM = v; break;
      case 'SLIP_PCT': thr.SLIP_MULT = 1 + v / 100; break;
      default: break;
    }
  }
  return thr;
}

/** Z2: sprawa „Silny wiatr” / „Postój przez wiatr” — jedna na transport+korytarz; odbiorcy HHL + SCX (bez KSH). */
export function windCaseRisk(args: {
  loadId: string;
  corridor: string;
  km: number;
  gustMs: number;
  hold: boolean;
  atIso: string;
  side?: 'CROSS' | 'HEAD' | null;
  untilIso?: string | null;
}): {
  kind: 'WEATHER';
  severity: 'MEDIUM' | 'HIGH';
  title: string;
  titleKey: string;
  params: Record<string, string>;
  detail: Record<string, unknown>;
  dedup: string;
  loadId: string;
  sourceUrl: null;
  validUntil: string | null;
} {
  const where = whereLabel(args.corridor, args.km);
  const sidePl = args.side === 'CROSS' ? 'z boku' : args.side === 'HEAD' ? 'z przodu' : '';
  const base = {
    zrodlo: 'E49-a SMHI/FMI',
    /* Z2: odbiorcy HHL + SCX — risk_audience_for (0398) czyta detail.audience, nie WSZYSCY (KSH). */
    audience: 'HHL_PRZEWOZNIK',
    gustMs: args.gustMs,
    corridor: args.corridor,
    km: args.km,
    loadId: args.loadId,
  };
  if (args.hold) {
    return {
      kind: 'WEATHER',
      severity: 'HIGH',
      title: `Postój przez wiatr · ${where} · porywy ${Math.round(args.gustMs)} m/s`,
      titleKey: 'rk_wind_hold',
      params: { where, gust: String(Math.round(args.gustMs)) },
      detail: {
        ...base,
        hold: true,
        fromIso: args.atIso,
        untilIso: args.untilIso ?? null,
      },
      dedup: windCaseDedup(args.loadId, args.corridor),
      loadId: args.loadId,
      sourceUrl: null,
      validUntil: null, /* waga i tytuł aktualizowane w miejscu; sprawa nie wygasa sama */
    };
  }
  return {
    kind: 'WEATHER',
    severity: 'MEDIUM',
    title: `Silny wiatr na trasie · ${where} · ${Math.round(args.gustMs)} m/s${sidePl ? ` ${sidePl}` : ''}`,
    titleKey: 'rk_wind_strong',
    params: { where, gust: String(Math.round(args.gustMs)) },
    detail: {
      ...base,
      hold: false,
      atIso: args.atIso,
      side: args.side ?? null,
    },
    dedup: windCaseDedup(args.loadId, args.corridor),
    loadId: args.loadId,
    sourceUrl: null,
    validUntil: null,
  };
}

export type WindPeak = {
  gustMs: number;
  corridor: string;
  km: number;
  atIso: string;
  side: 'CROSS' | 'HEAD' | null;
};

/** Z2: najsilniejszy poryw w 24 h na punktach korytarza PRZED autem (km ≥ fromKm), bez względu na kierunek. */
export function windCasePeak(args: {
  rows: readonly CorridorWindRow[];
  fromKm: number;
  now: Date;
  windowH?: number;
}): WindPeak | null {
  const nowIso = args.now.toISOString();
  let best: WindPeak | null = null;
  for (const row of args.rows) {
    if (!Number.isFinite(row.km) || row.km < args.fromKm - 0.01) continue;
    const s = gustMeetsThresholdInWindow(row.samples ?? [], nowIso, 0, args.windowH ?? 24);
    const g = s?.gustMs ?? s?.windMs ?? null;
    if (s == null || g == null) continue;
    if (best == null || g > best.gustMs) {
      best = {
        gustMs: g,
        corridor: row.corridor,
        km: row.km,
        atIso: s.at,
        side: s.windFromDeg == null ? 'CROSS' : sideOf(windBearingOf(row.bearingDeg, s.windFromDeg)),
      };
    }
  }
  return best;
}

export type WindCasePlan =
  | { action: 'raise'; risk: ReturnType<typeof windCaseRisk> }
  | { action: 'keep'; dedup: string }
  | { action: 'close'; dedup: string };

/**
 * Z2 + F7 #785 r1 pkt 5: decyzja dla jednego transportu i jednego korytarza.
 * - poryw w 24 h ≥ WIND_SLOW_MS → raise (otwarcie albo aktualizacja tej samej sprawy; ≥ WIND_HOLD_MS = wyższa waga na TYM SAMYM kluczu);
 * - między (WIND_SLOW_MS − histereza) a WIND_SLOW_MS i sprawa otwarta → keep (bez zmian, bez nowego powiadomienia);
 * - niżej → close (brak w liście „keep” → resolveStaleRisks).
 */
export function planWindCase(args: {
  loadId: string;
  corridor: string;
  rows: readonly CorridorWindRow[];
  fromKm: number;
  now: Date;
  thr: Pick<WindThresholds, 'WIND_SLOW_MS' | 'WIND_HOLD_MS' | 'WIND_RESUME_MIN'>;
  isOpen: boolean;
}): WindCasePlan {
  const dedup = windCaseDedup(args.loadId, args.corridor);
  const peak = windCasePeak({ rows: args.rows, fromKm: args.fromKm, now: args.now });
  if (peak == null) return { action: 'close', dedup };
  if (peak.gustMs >= args.thr.WIND_SLOW_MS) {
    const hold = peak.gustMs >= args.thr.WIND_HOLD_MS;
    return {
      action: 'raise',
      risk: windCaseRisk({
        loadId: args.loadId,
        corridor: args.corridor,
        km: peak.km,
        gustMs: peak.gustMs,
        hold,
        atIso: peak.atIso,
        side: peak.side,
        untilIso: hold
          ? new Date(Date.parse(peak.atIso) + args.thr.WIND_RESUME_MIN * 60_000).toISOString()
          : null,
      }),
    };
  }
  const closeBelow = Math.max(0, args.thr.WIND_SLOW_MS - E49_WIND_CLOSE_HYST_MS);
  if (args.isOpen && peak.gustMs >= closeBelow) return { action: 'keep', dedup };
  return { action: 'close', dedup };
}

/** Z4: ×1,15 tylko gdy punkt śliskości w promieniu radiusKm od odcinka. */
export function slipperyCause(args: {
  where: string;
  addMin: number;
  atIso?: string | null;
  source?: 'TRAFIKVERKET' | 'SMHI' | 'FMI';
}): EtaWxCause {
  return {
    kind: 'SLIPPERY',
    addMin: Math.max(0, Math.round(args.addMin)),
    where: args.where,
    atIso: args.atIso ?? null,
    source: args.source ?? 'TRAFIKVERKET',
  };
}
