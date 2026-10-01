import { describe, expect, it } from 'vitest';
import {
  earliestFerryDepartureMs,
  hasAwizacja,
  PORT_CLEARANCE_H,
  reachableSailings,
} from '../src/lib/awizacjaState';
import type { Load, Sailing } from '../src/types';

const emptyRes = {
  driverName: null, driverPhone: null, tractorPlate: null, trailerPlate: null,
  escort: false, escortPlate: null, setLengthM: null, setWidthM: null, setHeightM: null, setWeightT: null,
};

function load(partial: Partial<Load> & { id: string }): Load {
  return {
    code: partial.id,
    itemType: 'X',
    dims: { lengthM: 1, widthM: 1, heightM: 1, weightT: 1 },
    qty: 1,
    status: 'PLANNED',
    stage: 'PLAN',
    progress: 0,
    plannedLoadDate: '2026-10-02',
    plannedDeliverDate: '2026-10-05',
    carrierId: 'c',
    resources: { ...emptyRes },
    awizacja: { loadWindowStart: null, loadWindowEnd: null, unloadWindowStart: null, unloadWindowEnd: null, confirmed: false },
    ferry: { vessel: null, departureAt: null, arrivalAt: null, bookingRef: null, status: 'NONE' },
    pricing: {} as Load['pricing'],
    etaSegments: [],
    etaBoden: null,
    etaConfidence: 'MED',
    etaEarliestHours: 0,
    etaLatestHours: 0,
    etaReasons: [],
    etaMethod: 'x',
    etaUpdatedAt: '',
    lat: 0, lng: 0, heading: 0, silentMinutes: null,
    sequenceOrder: 1, sequenceRisk: false, delayed: false, docMissing: false, permitFits: null,
    ...partial,
  };
}

describe('hasAwizacja', () => {
  it('false when empty', () => {
    expect(hasAwizacja(load({ id: 'a' }))).toBe(false);
  });
  it('true when driver + tractor', () => {
    expect(hasAwizacja(load({
      id: 'a',
      resources: { ...emptyRes, driverName: 'Jan', tractorPlate: 'ABC123' },
    }))).toBe(true);
  });
  it('true when sailing assigned', () => {
    expect(hasAwizacja(load({ id: 'a', sailingId: 's1' }))).toBe(true);
  });
});

describe('reachableSailings', () => {
  const now = '2026-10-01T10:00:00.000Z';
  const sail = (id: string, dep: string): Sailing => ({
    id, vessel: 'Wawel', route: 'GDN-NYN',
    departureAt: dep, arrivalAt: '2026-10-04T12:00:00.000Z',
    delayedDepartureAt: null, delayedArrivalAt: null,
    status: 'ZAPLANOWANY', source: 'DANE_STARTOWE',
  });

  it('filters sailings before port clearance', () => {
    const l = load({
      id: 'a',
      plannedLoadDate: '2026-10-02',
      awizacja: {
        loadWindowStart: '2026-10-02T06:00:00+02:00',
        loadWindowEnd: '2026-10-02T14:00:00+02:00',
        unloadWindowStart: null, unloadWindowEnd: null, confirmed: false,
      },
    });
    const min = earliestFerryDepartureMs(l);
    expect(min).toBe(Date.parse('2026-10-02T14:00:00+02:00') + PORT_CLEARANCE_H * 36e5);

    const early = sail('early', new Date(min - 36e5).toISOString());
    const ok = sail('ok', new Date(min + 36e5).toISOString());
    const ids = reachableSailings([early, ok], l, now).map((s) => s.id);
    expect(ids).toEqual(['ok']);
  });

  it('keeps current sailing even if early', () => {
    const l = load({ id: 'a', sailingId: 'early', plannedLoadDate: '2026-10-02' });
    const early = sail('early', '2026-10-02T12:00:00.000Z');
    expect(reachableSailings([early], l, now).map((s) => s.id)).toEqual(['early']);
  });
});
