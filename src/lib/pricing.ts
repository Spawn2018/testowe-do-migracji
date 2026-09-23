import type { Dimensions, RateRule } from '../types';
import { applySefsToRoadRate, sefsForLoadDate, type SefsWeekSnapshot } from './sefs';

export function matchRate(dims: Dimensions, rules: RateRule[]) {
  const hits = rules.filter(
    (r) =>
      dims.lengthM >= r.lengthFrom &&
      dims.lengthM <= r.lengthTo &&
      dims.widthM >= r.widthFrom &&
      dims.widthM <= r.widthTo &&
      dims.heightM >= r.heightFrom &&
      dims.heightM <= r.heightTo &&
      dims.weightT >= r.weightFrom &&
      dims.weightT <= r.weightTo,
  );
  if (hits.length === 0) return { matched: false as const, reason: 'NO_BRACKET' as const };
  if (hits.length > 1) return { matched: false as const, reason: 'AMBIGUOUS' as const, candidates: hits };
  return { matched: true as const, rule: hits[0], baseRate: hits[0].baseRate };
}

export interface RoadPricingBreakdown {
  costRoadBase: number;
  revRoadBase: number;
  sefs: SefsWeekSnapshot;
  costRoadWithSefs: number;
  revRoadWithSefs: number;
  /** Ferry eco / other — NOT part of SEFS */
  ferryEco: number;
  extras: number;
  costTotal: number;
  revTotal: number;
  margin: number;
  marginPct: number;
  belowThreshold: boolean;
}

/**
 * SEFS applies only to road freight rate.
 * ferryEco and extras are outside SEFS (do not mix).
 */
export function buildPricing(
  dims: Dimensions,
  costRules: RateRule[],
  revRules: RateRule[],
  loadDate: string,
  opts?: { ferryEco?: number; extras?: number },
): RoadPricingBreakdown {
  const costHit = matchRate(dims, costRules.filter((r) => r.side === 'COST'));
  const revHit = matchRate(dims, revRules.filter((r) => r.side === 'REVENUE'));
  const sefs = sefsForLoadDate(loadDate);
  const costRoadBase = costHit.matched ? costHit.baseRate : 0;
  const revRoadBase = revHit.matched ? revHit.baseRate : 0;
  const costRoadWithSefs = applySefsToRoadRate(costRoadBase, sefs.appliedMult);
  const revRoadWithSefs = applySefsToRoadRate(revRoadBase, sefs.appliedMult);
  const ferryEco = opts?.ferryEco ?? 0;
  const extras = opts?.extras ?? 800;
  const costTotal = costRoadWithSefs + ferryEco + extras;
  const revTotal = revRoadWithSefs + Math.round(ferryEco * 1.05) + Math.round(extras * 0.75);
  const margin = revTotal - costTotal;
  const marginPct = revTotal > 0 ? margin / revTotal : 0;
  return {
    costRoadBase,
    revRoadBase,
    sefs,
    costRoadWithSefs,
    revRoadWithSefs,
    ferryEco,
    extras,
    costTotal,
    revTotal,
    margin,
    marginPct,
    belowThreshold: marginPct < 0.12,
  };
}

export function matchInvoice(expected: number, billed: number, threshold = 50) {
  const diff = billed - expected;
  if (Math.abs(diff) <= threshold) return { status: 'MATCHED' as const, diff };
  return { status: 'DISPUTED' as const, diff };
}
