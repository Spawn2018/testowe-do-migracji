import { describe, expect, it } from 'vitest';
import {
  inferPhaseFromLatLon,
  orphanProducesAlarm,
  pollIntervalSec,
  resolveActiveLoadAt,
  shouldTrackViaAis,
  simulateJourney,
  type JourneyLoad,
} from '../supabase/functions/_shared/telematics/telm2Sim';

const PLATE = 'GD035YX';

describe('TELM-2 inferPhaseFromLatLon (jak 0176)', () => {
  it('Śrem PL — brak fazy SE/prom', () => {
    expect(inferPhaseFromLatLon(52.089, 17.015)).toBeNull();
  });
  it('korytarz promowy Bałtyk → FERRY', () => {
    expect(inferPhaseFromLatLon(54.5, 18.5)).toBe('FERRY');
  });
  it('Szwecja / Boden → IN_TRANSIT_SE', () => {
    expect(inferPhaseFromLatLon(65.825, 21.716)).toBe('IN_TRANSIT_SE');
    expect(inferPhaseFromLatLon(58.9, 17.9)).toBe('IN_TRANSIT_SE');
  });
});

describe('TELM-2 AIS na promie', () => {
  it('FERRY → AIS; SE → naczepa', () => {
    expect(shouldTrackViaAis('FERRY')).toBe(true);
    expect(shouldTrackViaAis('IN_TRANSIT_SE')).toBe(false);
    expect(shouldTrackViaAis(null)).toBe(false);
  });
});

describe('TELM-2 poll PR5', () => {
  it('2 min jadąca / 15 min postój', () => {
    expect(pollIntervalSec(70, true)).toBe(120);
    expect(pollIntervalSec(0, false)).toBe(900);
  });
});

describe('TELM-2 orphan bez alarmu', () => {
  it('orphan → alarm false', () => {
    expect(orphanProducesAlarm(null)).toBe(false);
  });
});

describe('TELM-2 kolejne transporty tej samej naczepy', () => {
  const loads: JourneyLoad[] = [
    {
      id: 'L1', trailer_plate: PLATE, status: 'IN_TRANSIT_PL',
      activeFrom: '2026-10-01T06:00:00+02:00', activeTo: '2026-10-03T12:00:00+02:00',
    },
    {
      id: 'L2', trailer_plate: PLATE, status: 'IN_TRANSIT_PL',
      activeFrom: '2026-10-03T12:00:00+02:00', activeTo: null,
    },
  ];
  it('przed handoff → L1; po → L2; bez mieszania', () => {
    expect(resolveActiveLoadAt(PLATE, loads, '2026-10-02T10:00:00+02:00')?.id).toBe('L1');
    expect(resolveActiveLoadAt(PLATE, loads, '2026-10-04T10:00:00+02:00')?.id).toBe('L2');
  });
});

describe('TELM-2 simulateJourney Śrem→prom→SE', () => {
  const loads: JourneyLoad[] = [
    { id: 'SG-03', trailer_plate: 'GD 035 YX', status: 'IN_TRANSIT_PL', activeFrom: '2026-10-05T06:00:00+02:00' },
  ];
  it('przebieg: match, ferry=AIS, SE, orphan bez alarmu', () => {
    const r = simulateJourney(
      [
        { at: '2026-10-05T08:00:00+02:00', lat: 52.09, lon: 17.02, speedKmh: 60, ignition: true, plate: PLATE },
        { at: '2026-10-05T18:00:00+02:00', lat: 54.55, lon: 18.7, speedKmh: 0, ignition: false, plate: PLATE },
        { at: '2026-10-06T06:00:00+02:00', lat: 58.9, lon: 17.9, speedKmh: 75, ignition: true, plate: PLATE },
        { at: '2026-10-06T12:00:00+02:00', lat: 60.0, lon: 18.0, speedKmh: 50, ignition: true, plate: 'OTHER1' },
      ],
      loads,
    );
    expect(r[0]).toMatchObject({ loadId: 'SG-03', phase: null, useAis: false, orphan: false, alarm: false, pollSec: 120 });
    expect(r[1]).toMatchObject({ loadId: 'SG-03', phase: 'FERRY', useAis: true, pollSec: 900 });
    expect(r[2]).toMatchObject({ loadId: 'SG-03', phase: 'IN_TRANSIT_SE', useAis: false });
    expect(r[3]).toMatchObject({ loadId: null, orphan: true, alarm: false });
  });
});
