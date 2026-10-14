import { describe, expect, it } from 'vitest';
import { etaConfidenceFromMinutes, trackingLinkFromRow, type LoadRow } from '../src/data/mappers';
import { etaDetailFromBasis } from '../src/lib/etaDetail';
import { computeReadyGaps } from '../src/lib/readyGaps';
import { redactTrackingRef, trackingRefHasSecret } from '../src/lib/trackingRefSafe';
import type { Load } from '../src/types';

describe('P4 H3.2 — progi pewności ETA (E15-3)', () => {
  it('30 → HIGH, 31–120 → MED, powyżej → LOW', () => {
    expect(etaConfidenceFromMinutes(30)).toBe('HIGH');
    expect(etaConfidenceFromMinutes(31)).toBe('MED');
    expect(etaConfidenceFromMinutes(120)).toBe('MED');
    expect(etaConfidenceFromMinutes(121)).toBe('LOW');
  });
});

describe('P4 H3.1 — etaDetail z eta_basis.causes', () => {
  it('mapuje km, jazdę i odpoczynek', () => {
    const d = etaDetailFromBasis(
      { segment: 'SE_ROAD', causes: { remaining_km: 196.4, drive_h: 3.8, rest_h: 0 } },
      'IN_TRANSIT_SE',
    );
    expect(d?.phase).toBe('DRIVE');
    expect(d?.distanceKm).toBe(196);
    expect(d?.driveMin).toBe(228);
    expect(d?.restNeeded).toBe(false);
  });
});

describe('P4 K2.1 — secret RIO poza zdarzeniami', () => {
  const url = 'https://public.position-sharing.rio.cloud/share/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee?secret=TOPSECRET';
  it('wykrywa secret i zamienia na rio:<uuid>', () => {
    expect(trackingRefHasSecret(url)).toBe(true);
    expect(redactTrackingRef(url)).toBe('rio:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
  });
  it('rio:uuid zostaje', () => {
    expect(redactTrackingRef('rio:AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE')).toBe(
      'rio:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    );
  });
});

describe('P4 K2.1 — trackingLinkFromRow bez secret', () => {
  it('rio: + kolumny serwera → TrackingLinkInfo', () => {
    const row = {
      telematics_vehicle_id: 'rio:aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      rio_tracking_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      rio_asset_name: 'GD 4417K',
      rio_tracker_on: 'NACZEPA',
      rio_check_state: 'ok',
    } as LoadRow;
    const info = trackingLinkFromRow(row);
    expect(info?.provider).toBe('RIO');
    expect(info?.asset).toBe('GD 4417K');
    expect(info?.trackerOn).toBe('NACZEPA');
    expect(info?.check?.state).toBe('ok');
    expect(JSON.stringify(info)).not.toMatch(/secret|TOPSECRET/i);
  });
});

describe('P4 K2.2 — readyGaps (E32 pkt 6)', () => {
  it('braki awizacji i zleceń', () => {
    const load = {
      id: '1',
      status: 'RESOURCES_PENDING',
      resources: { driverName: null, driverPhone: null, tractorPlate: null, trailerPlate: null, trailerSwap: false },
      carrierOrderNo: null,
      hhlOrderNo: null,
      docMissing: false,
    } as unknown as Load;
    const gaps = computeReadyGaps(load, []);
    expect(gaps.some((g) => g.kind === 'AWIZ')).toBe(true);
    expect(gaps.some((g) => g.kind === 'ORDER_SCX')).toBe(true);
    expect(gaps.some((g) => g.kind === 'ORDER_HHL')).toBe(true);
  });
});
