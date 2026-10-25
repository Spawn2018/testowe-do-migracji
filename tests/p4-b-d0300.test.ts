/**
 * D-20261015-0300-01 §B — progi ETA, readyGaps, faza prom, stan śledzenia PDF.
 */
import { describe, expect, it } from 'vitest';
import { etaConfidenceFromMinutes } from '../src/data/mappers';
import { OPS_THRESHOLD_DEFAULTS, opsThreshold, setOpsThresholdCache } from '../src/lib/opsThresholdDefaults';
import { etaDetailFromBasis } from '../src/lib/etaDetail';
import { computeReadyGaps } from '../src/lib/readyGaps';
import { trackingStateLines } from '../src/lib/trackingStateText';
import type { Document, Load, LoadEvent } from '../src/types';

function baseLoad(over: Partial<Load> = {}): Load {
  return {
    id: 'l1',
    code: 'SG-99',
    itemType: 'SG',
    dims: { L: 1, W: 1, H: 1, weight: 1 },
    qty: 1,
    status: 'RESOURCES_PENDING',
    stage: 'PLAN',
    progress: 0,
    plannedLoadDate: '2026-10-20',
    plannedDeliverDate: '2026-10-22',
    carrierId: 'scx',
    resources: {
      driverName: 'A',
      driverPhone: '+48111',
      tractorPlate: 'WW 1',
      trailerPlate: 'WW 2',
      escort: false,
      escortPlate: null,
      trackingRef: null,
      trailerSwap: false,
      tractorDeliveryPlate: null,
    },
    awizacja: {} as Load['awizacja'],
    ferry: { vessel: null, departureAt: null, arrivalAt: null, bookingRef: null, status: 'NONE' },
    pricing: {} as Load['pricing'],
    etaSegments: [],
    etaBoden: null,
    etaConfidence: 'LOW',
    etaEarliestHours: 0,
    etaLatestHours: 0,
    etaReasons: [],
    etaMethod: 'test',
    etaUpdatedAt: '2026-10-15T10:00:00Z',
    lat: 0,
    lng: 0,
    heading: 0,
    silentMinutes: null,
    sequenceOrder: 1,
    sequenceRisk: false,
    delayed: false,
    docMissing: false,
    permitFits: null,
    hhlOrderNo: 'H1',
    carrierOrderNo: 'C1',
    ...over,
  } as Load;
}

describe('B7 ops thresholds ETA', () => {
  it('domyślnie 30 / 120 (E15)', () => {
    setOpsThresholdCache([]);
    expect(opsThreshold('ETA_CONF_HIGH_MIN')).toBe(30);
    expect(opsThreshold('ETA_CONF_MED_MIN')).toBe(120);
    expect(etaConfidenceFromMinutes(30)).toBe('HIGH');
    expect(etaConfidenceFromMinutes(31)).toBe('MED');
    expect(etaConfidenceFromMinutes(121)).toBe('LOW');
  });

  it('cache z bazy nadpisuje progi', () => {
    setOpsThresholdCache([
      { key: 'ETA_CONF_HIGH_MIN', value_num: 20 },
      { key: 'ETA_CONF_MED_MIN', value_num: 90 },
    ]);
    expect(etaConfidenceFromMinutes(20)).toBe('HIGH');
    expect(etaConfidenceFromMinutes(21)).toBe('MED');
    expect(etaConfidenceFromMinutes(91)).toBe('LOW');
    setOpsThresholdCache([]);
    expect(OPS_THRESHOLD_DEFAULTS.SILENT_MIN).toBe(30);
  });

  it('faza FERRY — czeka na AIS albo ETA', () => {
    const wait = etaDetailFromBasis({ segment: 'FERRY', wait_ais: true } as never, 'ON_FERRY');
    expect(wait?.phase).toBe('FERRY');
    expect(wait?.waitAis).toBe(true);
    const ais = etaDetailFromBasis(
      { segment: 'FERRY', ferry_eta_at: '2026-10-16T08:00:00Z' } as never,
      'ON_FERRY',
    );
    expect(ais?.ferryEtaAt).toBe('2026-10-16T08:00:00Z');
  });
});

describe('B5 readyGaps piloci z symbolu', () => {
  /* D-20261020-1118-01: pilot tylko przy symbolu z wymogiem (KR, PL-B) — przykład na KR; SG bez pilota mimo wpisu w zezwoleniu */
  it('plPilotsRequired > 0 bez tablicy → PILOTS', () => {
    const docs: Document[] = [{
      id: 'd1', loadId: 'l1', category: 'INSURANCE', fileName: 'p.pdf',
      mimeType: 'application/pdf', sizeBytes: 1, uploadedAt: '2026-10-01', status: 'UPLOADED',
    } as Document];
    const gaps = computeReadyGaps(baseLoad({
      permit: {
        pozycja: 'x', lp: 1, zestaw: { L: 20, W: 3, H: 3, masa_max_t: 40 },
        plStatus: 'OK', plCategory: 'NORMATIVE', plCategoryLabel: 'normatywne',
        plPilotsRequired: 1, plOver: [], sePath: 'NONE', seNotes: [],
      },
      permitFits: true,
      code: 'KR-01',
      resources: { ...baseLoad().resources, escort: false, escortPlate: null },
    }), docs);
    expect(gaps.some((g) => g.kind === 'PILOTS')).toBe(true);
    const sg = computeReadyGaps(baseLoad({ code: 'SG-01', resources: { ...baseLoad().resources, escort: true, escortPlate: null } }), docs);
    expect(sg.some((g) => g.kind === 'PILOTS')).toBe(false);
  });
});

describe('B9 tracking state (panel; eksport PDF jednego transportu usunięty)', () => {
  it('anulowany — nagłówek stanu', () => {
    const load = baseLoad({ status: 'CANCELLED' });
    const events: LoadEvent[] = [];
    const { head } = trackingStateLines(load, events, 'pl', '2026-10-15T12:00:00Z');
    expect(head).toMatch(/Anulowany/);
  });
});
