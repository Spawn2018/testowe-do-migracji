/**
 * E49-a cz.3 (DP-205): budowa `eta_basis.causes.weather` z prognozy punktów korytarza (Z1)
 * oraz spraw Z2 („Silny wiatr” / „Postój przez wiatr”).
 */
import {
  E49_WIND_DEFAULTS,
  windEtaEffect,
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
  source: 'SMHI' | 'FMI' | 'TRAFIKVERKET';
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
  thr?: Partial<typeof E49_WIND_DEFAULTS>;
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
    const windFrom = sample.windFromDeg ?? 0;
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

/** Z2: jedna sprawa na transport+odcinek (dedup). */
export function windCaseRisk(args: {
  loadId: string;
  corridor: string;
  km: number;
  gustMs: number;
  addMin: number;
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
  if (args.hold) {
    return {
      kind: 'WEATHER',
      severity: 'HIGH',
      title: `Postój przez wiatr · ${where} · porywy ${Math.round(args.gustMs)} m/s`,
      titleKey: 'rk_wind_hold',
      params: { where, gust: String(Math.round(args.gustMs)) },
      detail: {
        zrodlo: 'E49-a SMHI/FMI',
        gustMs: args.gustMs,
        corridor: args.corridor,
        km: args.km,
        fromIso: args.atIso,
        untilIso: args.untilIso ?? null,
        addMin: args.addMin,
        loadId: args.loadId,
      },
      dedup: `E49_WIND_HOLD:${args.loadId}:${args.corridor}:${Math.round(args.km)}`,
      loadId: args.loadId,
      sourceUrl: null,
      validUntil: args.untilIso ?? null,
    };
  }
  return {
    kind: 'WEATHER',
    severity: 'MEDIUM',
    title: `Silny wiatr na trasie · ${where} · ${Math.round(args.gustMs)} m/s${sidePl ? ` ${sidePl}` : ''} · +${args.addMin} min`,
    titleKey: 'rk_wind_strong',
    params: { where, gust: String(Math.round(args.gustMs)), min: String(args.addMin) },
    detail: {
      zrodlo: 'E49-a SMHI/FMI',
      gustMs: args.gustMs,
      corridor: args.corridor,
      km: args.km,
      atIso: args.atIso,
      side: args.side ?? null,
      addMin: args.addMin,
      loadId: args.loadId,
    },
    dedup: `E49_WIND:${args.loadId}:${args.corridor}:${Math.round(args.km)}`,
    loadId: args.loadId,
    sourceUrl: null,
    validUntil: null,
  };
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
