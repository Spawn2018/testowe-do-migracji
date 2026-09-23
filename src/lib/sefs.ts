/**
 * SEFS — Scandinavian Express Fuel Surcharge (contractual annex).
 * Hybrid weekly model: applied = min(mult_sek, mult_pln).
 * Applies ONLY to road freight rate — never cancellation / demurrage / ferry eco.
 */
import tables from '../data/sefs-tables.json';

export interface SefsTier {
  lte: number;
  mult: number;
}

export interface SefsWeekSnapshot {
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  priceSek: number;
  pricePln: number;
  multSek: number;
  multPln: number;
  appliedMult: number;
  sourceNote: string;
}

export const SEFS_SOURCES = {
  orlen: tables.sources.urls.orlen as string,
  okq8: tables.sources.urls.okq8 as string,
  baseSek: tables.base.sek as number,
  basePln: tables.base.pln as number,
  labelSek: tables.sources.sek as string,
  labelPln: tables.sources.pln as string,
};

export const SEFS_SEK: SefsTier[] = tables.sek as SefsTier[];
export const SEFS_PLN: SefsTier[] = tables.pln as SefsTier[];

export function lookupMult(price: number, tiers: SefsTier[]): number {
  if (tiers.length === 0) return 1;
  if (price <= tiers[0].lte) return tiers[0].mult;
  for (const t of tiers) {
    if (price <= t.lte) return t.mult;
  }
  return tiers[tiers.length - 1].mult;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeSefs(priceSek: number, pricePln: number): {
  multSek: number;
  multPln: number;
  appliedMult: number;
} {
  const sek = round2(priceSek);
  const pln = round2(pricePln);
  const multSek = lookupMult(sek, SEFS_SEK);
  const multPln = lookupMult(pln, SEFS_PLN);
  return { multSek, multPln, appliedMult: Math.min(multSek, multPln) };
}

export function applySefsToRoadRate(roadBaseRate: number, appliedMult: number): number {
  return Math.round(roadBaseRate * appliedMult * 100) / 100;
}

function week(label: string, start: string, end: string, priceSek: number, pricePln: number, note: string): SefsWeekSnapshot {
  const c = computeSefs(priceSek, pricePln);
  return {
    weekLabel: label,
    weekStart: start,
    weekEnd: end,
    priceSek,
    pricePln,
    multSek: c.multSek,
    multPln: c.multPln,
    appliedMult: c.appliedMult,
    sourceNote: note,
  };
}

export const SEFS_WEEKLY: SefsWeekSnapshot[] = [
  week('2026-W36', '2026-08-31', '2026-09-06', 19.12, 5.62, 'Mean Mon–Sun OKQ8 + ORLEN'),
  week('2026-W37', '2026-09-07', '2026-09-13', 19.55, 5.71, 'Mean Mon–Sun OKQ8 + ORLEN'),
  week('2026-W38', '2026-09-14', '2026-09-20', 19.68, 5.74, 'Mean Mon–Sun OKQ8 + ORLEN · current'),
];

export function sefsForLoadDate(loadDate: string): SefsWeekSnapshot {
  const d = loadDate.slice(0, 10);
  const hit = SEFS_WEEKLY.find((w) => d >= w.weekStart && d <= w.weekEnd);
  return hit ?? SEFS_WEEKLY[SEFS_WEEKLY.length - 1];
}
