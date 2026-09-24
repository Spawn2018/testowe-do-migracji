import { describe, expect, it } from 'vitest';
import {
  CORRIDOR_IN_TRANSIT_STAGES,
  computeCorridorKpis,
  countLoadsByStage,
  sumStages,
} from '../src/lib/corridorKpis';
import { STAGE_ORDER } from '../src/lib/status';
import type { Load, Risk } from '../src/types';

function load(partial: Partial<Load> & Pick<Load, 'id' | 'stage' | 'status'>): Load {
  return {
    code: partial.code ?? partial.id,
    delayed: false,
    docMissing: false,
    dims: { lengthM: 1, widthM: 1, heightM: 1, weightT: 10 },
    pricing: {
      costTotal: 1000,
      revTotal: 1200,
      margin: 200,
      marginPct: 0.16,
      costRoadBase: 1000,
      revRoadBase: 1200,
      costRoadWithSefs: 1000,
      revRoadWithSefs: 1200,
      ferryEco: 0,
      extras: 0,
      belowThreshold: false,
      sefs: {
        weekLabel: 'x',
        weekStart: '',
        weekEnd: '',
        priceSek: 0,
        pricePln: 0,
        multSek: 1,
        multPln: 1,
        appliedMult: 1,
        sourceNote: '',
      },
    },
    progress: 0,
    resources: {},
    ...partial,
  } as Load;
}

describe('D5 corridor KPIs ↔ spine', () => {
  it('countLoadsByStage matches STAGE_ORDER spine buckets', () => {
    const loads = [
      load({ id: 'a', stage: 'PLAN', status: 'PLANNED' }),
      load({ id: 'b', stage: 'PLAN', status: 'READY' }),
      load({ id: 'c', stage: 'FERRY', status: 'ON_FERRY' }),
      load({ id: 'd', stage: 'SE_ROAD', status: 'DELAYED', delayed: true }),
      load({ id: 'e', stage: 'DELIVERED', status: 'DELIVERED' }),
    ];
    const counts = countLoadsByStage(loads);
    expect(STAGE_ORDER.every((st) => typeof counts[st] === 'number')).toBe(true);
    expect(counts.PLAN).toBe(2);
    expect(counts.FERRY).toBe(1);
    expect(counts.SE_ROAD).toBe(1);
    expect(counts.DELIVERED).toBe(1);
    expect(sumStages(counts, CORRIDOR_IN_TRANSIT_STAGES)).toBe(2);
  });

  it('inTransit uses stages (includes DELAYED/SILENT on SE_ROAD), not status whitelist', () => {
    const loads = [
      load({ id: '1', stage: 'TO_PORT', status: 'IN_TRANSIT_PL' }),
      load({ id: '2', stage: 'SE_ROAD', status: 'DELAYED', delayed: true }),
      load({ id: '3', stage: 'SE_ROAD', status: 'SILENT' }),
      load({ id: '4', stage: 'APPROACH', status: 'APPROACHING_SITE' }),
      load({ id: '5', stage: 'PLAN', status: 'PLANNED' }),
      load({ id: '6', stage: 'DELIVERED', status: 'DELIVERED' }),
      load({ id: '7', stage: 'SITE', status: 'UNLOADING' }),
    ];
    const k = computeCorridorKpis(loads);
    // old Dashboard whitelist would count only 1+1=2 (skip DELAYED/SILENT)
    expect(k.inTransit).toBe(4);
    expect(k.delivered).toBe(1);
    expect(k.notInTransit).toBe(2); // PLAN + SITE
    expect(k.total).toBe(7);
    expect(k.inTransit + k.delivered + k.notInTransit).toBe(k.total);
    expect(k.delayedN).toBe(1);
  });

  it('ferryHot from risks; arrivals sorted by etaBoden among arrival stages', () => {
    const loads = [
      load({
        id: 'late',
        stage: 'SE_ROAD',
        status: 'IN_TRANSIT_SE',
        etaBoden: '2026-09-26T18:00:00+02:00',
        code: 'L',
      }),
      load({
        id: 'soon',
        stage: 'APPROACH',
        status: 'APPROACHING_SITE',
        etaBoden: '2026-09-25T10:00:00+02:00',
        code: 'S',
      }),
      load({ id: 'plan', stage: 'PLAN', status: 'PLANNED', etaBoden: '2026-09-24T08:00:00+02:00' }),
    ];
    const risks: Risk[] = [
      {
        id: 'r1',
        type: 'FERRY',
        severity: 'HIGH',
        title: 'fala',
        detail: '',
        owner: 'HHL',
        meta: '',
        nextAction: '',
        ageHours: 1,
      },
      {
        id: 'r2',
        type: 'FERRY',
        severity: 'LOW',
        title: 'ok',
        detail: '',
        owner: 'HHL',
        meta: '',
        nextAction: '',
        ageHours: 1,
      },
    ];
    const k = computeCorridorKpis(loads, risks);
    expect(k.ferryHot).toBe(1);
    expect(k.arrivals.map((l) => l.id)).toEqual(['soon', 'late']);
  });
});
