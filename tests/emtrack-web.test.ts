import { describe, expect, it } from 'vitest';
import {
  isMoving, normalizePlate, parseCurrentSnapshot, pollIntervalSec,
} from '../supabase/functions/_shared/telematics/emtrackWeb';
import { matchFixToLoad } from '../supabase/functions/_shared/telematics/matchTrailer';
import { runEmtrackWeb } from '../supabase/functions/_shared/integrations/jobs';

describe('TELM-EMTRACK-WEB parsers', () => {
  it('normalizePlate usuwa spacje i myślniki', () => {
    expect(normalizePlate('GD 035-YX')).toBe('GD035YX');
  });

  it('parseCurrentSnapshot czyta d.C.v / d.S.v', () => {
    const fix = parseCurrentSnapshot({
      trackingObjectId: 11008,
      name: 'GD035YX - SEXPG12',
      textId: 'GD035YX',
      type: 'TRAILER',
      producer: 'MAX TRAILER',
      currentSnapshot: {
        ts: Date.parse('2026-10-05T10:48:37Z'),
        d: {
          C: { ts: 1, v: { lat: 62.31, lng: 17.34 } },
          S: { ts: 1, v: 76 },
          AZ: { ts: 1, v: 338 },
          I: { ts: 1, v: true },
        },
      },
    });
    expect(fix).toMatchObject({
      textId: 'GD035YX', type: 'TRAILER', lat: 62.31, lon: 17.34, speedKmh: 76, ignition: true,
    });
    expect(fix.observedAt).toBe('2026-10-05T10:48:37.000Z');
    expect(isMoving(fix)).toBe(true);
    expect(pollIntervalSec(fix, 120, 900)).toBe(120);
    expect(pollIntervalSec({ ...fix, speedKmh: 0, ignition: false }, 120, 900)).toBe(900);
  });

  it('matchFixToLoad: telematics_vehicle_id albo trailer_plate', () => {
    const fix = parseCurrentSnapshot({
      trackingObjectId: 11008, name: 'x', textId: 'GD035YX', type: 'TRAILER',
      currentSnapshot: { ts: Date.now(), d: { C: { v: { lat: 1, lng: 2 } } } },
    });
    const loads = [
      { id: 'a', trailer_plate: 'OTHER', telematics_vehicle_id: null, status: 'IN_TRANSIT' },
      { id: 'b', trailer_plate: 'GD 035 YX', telematics_vehicle_id: null, status: 'IN_TRANSIT' },
    ];
    expect(matchFixToLoad(fix, loads)?.id).toBe('b');
    expect(matchFixToLoad(fix, [
      { id: 'c', trailer_plate: null, telematics_vehicle_id: 'GD035YX', status: 'IN_TRANSIT' },
    ])?.id).toBe('c');
    expect(matchFixToLoad(fix, [
      { id: 'd', trailer_plate: 'GD035YX', telematics_vehicle_id: null, status: 'DONE' },
    ])).toBeNull();
  });
});

describe('runEmtrackWeb', () => {
  it('bez sekretów: DEMO', async () => {
    const r = await runEmtrackWeb({
      store: {
        async projectId() { return 'p'; },
        async vessels() { return []; },
        async sailingsSince() { return []; },
        async insertSailings() {},
        async updateSailing() { return false; },
        async raiseRisk() { return false; },
        async latestPositions() { return []; },
        async lastRun() { return null; },
        async resolveRisks() { return 0; },
        async recordRun() {},
        async saveVesselPosition() {},
      },
      fetch: globalThis.fetch,
      env: {},
      now: () => new Date('2026-10-05T12:00:00+02:00'),
    });
    expect(r).toMatchObject({ job: 'emtrack-web', mode: 'DEMO', ok: true });
  });

  it('flaga wyłączona: LIVE bez zapisu', async () => {
    const r = await runEmtrackWeb({
      store: {
        async projectId() { return 'p'; },
        async vessels() { return []; },
        async sailingsSince() { return []; },
        async insertSailings() {},
        async updateSailing() { return false; },
        async raiseRisk() { return false; },
        async latestPositions() { return []; },
        async lastRun() { return null; },
        async resolveRisks() { return 0; },
        async recordRun() {},
        async saveVesselPosition() {},
        async telmEmtrackWebEnabled() { return false; },
      },
      fetch: globalThis.fetch,
      env: { EMTRACK_LOGIN: 'u', EMTRACK_PASSWORD: 'p' },
      now: () => new Date('2026-10-05T12:00:00+02:00'),
    });
    expect(r).toMatchObject({ mode: 'LIVE', ok: true });
    expect(String(r.reason)).toMatch(/TELM_EMTRACK_WEB/);
  });
});
