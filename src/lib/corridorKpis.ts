/**
 * D5 — cockpit KPI counts must match the corridor spine.
 * Single source of truth: aggregate by `load.stage` (CorridorStage), never a
 * parallel status whitelist that drifts from STATUS_TO_STAGE.
 */
import type { CorridorStage, Load, Risk } from '../types';
import { STAGE_ORDER } from './status';

/** Stages that mean „w drodze” on the spine (between loading and site unload). */
export const CORRIDOR_IN_TRANSIT_STAGES: readonly CorridorStage[] = [
  'TO_PORT',
  'GDANSK',
  'FERRY',
  'SE_ROAD',
  'APPROACH',
] as const;

/** Near-arrival window used by KSH „Najbliższa dostawa”. */
export const CORRIDOR_ARRIVAL_STAGES: readonly CorridorStage[] = [
  'SE_ROAD',
  'APPROACH',
  'SITE',
] as const;

export type CorridorStageCounts = Record<CorridorStage, number>;

export function countLoadsByStage(loads: readonly Load[]): CorridorStageCounts {
  const counts = Object.fromEntries(STAGE_ORDER.map((st) => [st, 0])) as CorridorStageCounts;
  for (const l of loads) {
    if (l.stage in counts) counts[l.stage] += 1;
  }
  return counts;
}

export function sumStages(
  counts: CorridorStageCounts,
  stages: readonly CorridorStage[],
): number {
  let n = 0;
  for (const st of stages) n += counts[st] ?? 0;
  return n;
}

export interface CorridorKpis {
  total: number;
  byStage: CorridorStageCounts;
  /** Spine-aligned „Transporty w drodze”. */
  inTransit: number;
  delivered: number;
  /** PLAN + LOADING + SITE (everything that is not delivered and not inTransit). */
  notInTransit: number;
  arrivals: Load[];
  delayedN: number;
  docsOk: number;
  docsMissing: number;
  /** delivered / (delivered + delayed) style OTIF used on kokpit. */
  otifPct: number;
  marginAvg: number;
  ferryHot: number;
}

/**
 * One function for cockpit KPI numbers that must stay coherent with the corridor.
 */
export function computeCorridorKpis(
  loads: readonly Load[],
  risks: readonly Risk[] = [],
): CorridorKpis {
  const byStage = countLoadsByStage(loads);
  const inTransit = sumStages(byStage, CORRIDOR_IN_TRANSIT_STAGES);
  const delivered = byStage.DELIVERED;
  const delayedN = loads.filter((l) => l.delayed).length;
  const docsMissing = loads.filter((l) => l.docMissing).length;
  const docsOk = loads.length - docsMissing;
  const arrivals = loads
    .filter((l) => (CORRIDOR_ARRIVAL_STAGES as readonly string[]).includes(l.stage))
    .slice()
    .sort((a, b) => (a.etaBoden ?? '').localeCompare(b.etaBoden ?? ''));
  const marginAvg =
    loads.reduce((a, l) => a + (l.pricing?.marginPct ?? 0), 0) / Math.max(1, loads.length);
  const ferryHot = risks.filter(
    (r) => r.type === 'FERRY' && (r.severity === 'CRITICAL' || r.severity === 'HIGH'),
  ).length;

  return {
    total: loads.length,
    byStage,
    inTransit,
    delivered,
    notInTransit: loads.length - delivered - inTransit,
    arrivals,
    delayedN,
    docsOk,
    docsMissing,
    otifPct: Math.round((delivered / Math.max(1, delivered + delayedN)) * 100),
    marginAvg,
    ferryHot,
  };
}
