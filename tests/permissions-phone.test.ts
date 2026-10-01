import { describe, expect, it } from 'vitest';
import {
  canSeeDriverPhone,
  deliveryInstantMs,
  visibleDriverPhone,
} from '../src/lib/permissions';
import type { Load } from '../src/types';

function stubLoad(partial: Partial<Load> & Pick<Load, 'plannedDeliverDate'>): Load {
  return {
    id: 'load-test',
    code: 'SG-99',
    itemType: 'test',
    dims: { lengthM: 1, widthM: 1, heightM: 1, weightT: 1 },
    qty: 1,
    status: 'IN_TRANSIT_SE',
    stage: 'SE',
    progress: 0.5,
    plannedLoadDate: '2026-09-20',
    carrierId: 'org-scx',
    resources: {
      driverName: 'Marek Kowalski',
      driverPhone: '+48000000001',
      tractorPlate: 'PO 3K821',
      trailerPlate: 'PO 8T201',
      escort: false,
      escortPlate: null,
      setLengthM: null,
      setWidthM: null,
      setHeightM: null,
      setWeightT: null,
    },
    awizacja: {
      loadWindowStart: null,
      loadWindowEnd: null,
      unloadWindowStart: null,
      unloadWindowEnd: null,
      confirmed: true,
    },
    ferry: { vessel: null, departureAt: null, arrivalAt: null, bookingRef: null, status: 'NONE' },
    pricing: {
      costBase: 0,
      revBase: 0,
      costSefs: 0,
      revSefs: 0,
      costBaf: 0,
      revBaf: 0,
      costExtras: 0,
      revExtras: 0,
      ferryEco: 0,
      costTotal: 0,
      revTotal: 0,
      margin: 0,
      marginPct: 0,
      belowThreshold: false,
      currency: 'EUR',
      baf_multiplier: 1,
      baf_source_week: '2026-W39',
      price_sek: 0,
      price_pln: 0,
      mult_sek: 1,
      mult_pln: 1,
    },
    etaSegments: [],
    etaBoden: null,
    etaConfidence: 'MED',
    etaEarliestHours: 0,
    etaLatestHours: 0,
    etaReasons: [],
    etaMethod: '',
    etaUpdatedAt: '',
    lat: 0,
    lng: 0,
    heading: 0,
    silentMinutes: null,
    sequenceOrder: 1,
    sequenceRisk: false,
    delayed: false,
    docMissing: false,
    permitFits: true,
    ...partial,
    resources: {
      driverName: 'Marek Kowalski',
      driverPhone: '+48000000001',
      tractorPlate: 'PO 3K821',
      trailerPlate: 'PO 8T201',
      escort: false,
      escortPlate: null,
      setLengthM: null,
      setWidthM: null,
      setHeightM: null,
      setWeightT: null,
      ...(partial.resources ?? {}),
    },
    awizacja: {
      loadWindowStart: null,
      loadWindowEnd: null,
      unloadWindowStart: null,
      unloadWindowEnd: null,
      confirmed: true,
      ...(partial.awizacja ?? {}),
    },
  };
}

describe('D6 driver phone permissions', () => {
  const deliverIso = '2026-09-26T07:00:00+02:00';
  const deliverMs = Date.parse(deliverIso);
  const load = stubLoad({
    plannedDeliverDate: '2026-09-26',
    awizacja: {
      loadWindowStart: null,
      loadWindowEnd: null,
      unloadWindowStart: deliverIso,
      unloadWindowEnd: '2026-09-26T15:00:00+02:00',
      confirmed: true,
    },
  });

  it('deliveryInstantMs prefers unload window start', () => {
    expect(deliveryInstantMs(load)).toBe(deliverMs);
  });

  it('HHL and SCX always see phone when present', () => {
    const far = deliverMs + 10 * 24 * 60 * 60 * 1000;
    expect(canSeeDriverPhone('HHL', load, far)).toBe(true);
    expect(canSeeDriverPhone('SCX', load, far)).toBe(true);
    expect(visibleDriverPhone('HHL', load, far)).toBe('+48000000001');
  });

  it('KSH widzi telefon na stałe (I-7a), także poza ±24 h', () => {
    expect(canSeeDriverPhone('KSH', load, deliverMs)).toBe(true);
    expect(canSeeDriverPhone('KSH', load, deliverMs + 25 * 60 * 60 * 1000)).toBe(true);
    expect(canSeeDriverPhone('KSH', load, deliverMs - 25 * 60 * 60 * 1000)).toBe(true);
    expect(visibleDriverPhone('KSH', load, deliverMs + 25 * 60 * 60 * 1000)).toBe('+48000000001');
  });

  it('no phone stored → never visible', () => {
    const bare = stubLoad({
      plannedDeliverDate: '2026-09-26',
      resources: {
        driverName: null,
        driverPhone: null,
        tractorPlate: null,
        trailerPlate: null,
        escort: false,
        escortPlate: null,
        setLengthM: null,
        setWidthM: null,
        setHeightM: null,
        setWeightT: null,
      },
    });
    expect(canSeeDriverPhone('HHL', bare, deliverMs)).toBe(false);
    expect(canSeeDriverPhone('KSH', bare, deliverMs)).toBe(false);
  });

  it('table and drawer share the same visible string (HHL)', () => {
    const phone = visibleDriverPhone('HHL', load, deliverMs);
    expect(phone).toBe(load.resources.driverPhone);
  });
});
