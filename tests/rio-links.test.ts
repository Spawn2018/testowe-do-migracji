import { describe, expect, it, vi } from 'vitest';
import {
  fetchRioPosition, inferRioTrackerOn, parseRioPositionPayload, rioLinkValidNow,
  rioPositionUrlSafe, speedKmhFromPrev,
} from '../supabase/functions/_shared/telematics/rioPositionSharing';
import { runRioLinks, type RioLoadRow, type SyncStore } from '../supabase/functions/_shared/integrations/jobs';
import { sourceDownRisk } from '../supabase/functions/_shared/integrations/sync';

const SAMPLE = {
  id: '0c8f36c7-3f69-498c-bb34-3d713de26d06',
  name: 'WPR8220T  srem boden ',
  start: '2026-10-06T15:36:00Z',
  end: '2026-10-09T04:00:00Z',
  position: {
    timestamp: '2026-10-09T03:21:05Z',
    latitude: 65.82174682617188,
    longitude: 21.788219451904297,
  },
  asset_name: 'WPR 8220T',
};

describe('E44 RIO adapter', () => {
  it('URL bezpieczny bez secret', () => {
    const u = rioPositionUrlSafe('abc-123');
    expect(u).toBe('https://api.position-sharing.rio.cloud/trackings/abc-123/position');
    expect(u).not.toMatch(/secret/i);
  });

  it('parseRioPositionPayload czyta lat/lon/asset/start-end', () => {
    const r = parseRioPositionPayload(SAMPLE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lat).toBeCloseTo(65.8217, 3);
    expect(r.lon).toBeCloseTo(21.7882, 3);
    expect(r.assetName).toBe('WPR 8220T');
    expect(r.validFrom).toBe('2026-10-06T15:36:00.000Z');
    expect(r.validTo).toBe('2026-10-09T04:00:00.000Z');
  });

  it('brak position.latitude → down (zmieniony format)', () => {
    const r = parseRioPositionPayload({ id: 'x', position: { timestamp: '2026-10-09T03:21:05Z' } });
    expect(r).toMatchObject({ ok: false, kind: 'down' });
  });

  it('inferRioTrackerOn: naczepa / ciągnik / nieznany', () => {
    expect(inferRioTrackerOn('WPR 8220T', { trailer: 'WPR8220T' })).toBe('NACZEPA');
    expect(inferRioTrackerOn('WPR8220T', { tractorPl: 'WPR 8220T' })).toBe('CIAGNIK_PL');
    expect(inferRioTrackerOn('WPR8220T', { tractorSe: 'WPR-8220-T' })).toBe('CIAGNIK_SE');
    expect(inferRioTrackerOn('INNY', { trailer: 'WPR8220T' })).toBe('NIEZNANY');
  });

  it('rioLinkValidNow respektuje start–end', () => {
    expect(rioLinkValidNow('2026-10-07T12:00:00Z', SAMPLE.start, SAMPLE.end)).toBe(true);
    expect(rioLinkValidNow('2026-10-06T10:00:00Z', SAMPLE.start, SAMPLE.end)).toBe(false);
    expect(rioLinkValidNow('2026-10-10T00:00:00Z', SAMPLE.start, SAMPLE.end)).toBe(false);
    expect(rioLinkValidNow('2026-10-07T12:00:00Z', null, null)).toBe(true);
  });

  it('speedKmhFromPrev > 5 przy ruchu', () => {
    const prev = { lat: 52.0, lon: 17.0, ts: '2026-10-09T03:00:00Z' };
    const curr = { lat: 52.1, lon: 17.0, ts: '2026-10-09T03:30:00Z' };
    const sp = speedKmhFromPrev(prev, curr);
    expect(sp).not.toBeNull();
    expect(sp!).toBeGreaterThan(5);
  });

  it('fetchRioPosition: 404 → invalid; 500 → down', async () => {
    const bad = await fetchRioPosition({
      trackingId: 'x', secret: 's',
      fetchImpl: async () => new Response('no', { status: 404 }),
    });
    expect(bad).toMatchObject({ ok: false, kind: 'invalid', status: 404 });
    const down = await fetchRioPosition({
      trackingId: 'x', secret: 's',
      fetchImpl: async () => new Response('err', { status: 503 }),
    });
    expect(down).toMatchObject({ ok: false, kind: 'down', status: 503 });
  });

  it('fetchRioPosition: 200 + JSON → ok; secret nie w wyniku', async () => {
    const r = await fetchRioPosition({
      trackingId: SAMPLE.id, secret: 'SEKRET-TEST',
      fetchImpl: async (url) => {
        expect(String(url)).toContain('secret=');
        return new Response(JSON.stringify(SAMPLE), { status: 200 });
      },
    });
    expect(r.ok).toBe(true);
    expect(JSON.stringify(r)).not.toMatch(/SEKRET/);
  });
});

describe('E44 runRioLinks', () => {
  function baseLoad(over: Partial<RioLoadRow> = {}): RioLoadRow {
    return {
      id: 'load-1',
      code: 'SG-19',
      rio_tracking_id: SAMPLE.id,
      rio_secret: 'SEKRET-TEST',
      rio_check_state: 'pending',
      rio_valid_from: null,
      rio_valid_to: null,
      rio_error_streak: 0,
      trailer_plate: 'WPR8220T',
      tractor_plate: null,
      tractor_delivery_plate: null,
      status: 'READY',
      plannedLoadDate: '2026-10-09',
      trackingOpenedAt: null,
      telematics_vehicle_id: `rio:${SAMPLE.id}`,
      ...over,
    };
  }

  function store(loads: RioLoadRow[], hooks: {
    processPosition?: SyncStore['processPosition'];
    raiseRisk?: SyncStore['raiseRisk'];
    update?: SyncStore['updateRioLoadState'];
  } = {}): SyncStore {
    return {
      projectId: async () => 'p',
      vessels: async () => [],
      sailingsSince: async () => [],
      insertSailings: async () => {},
      updateSailing: async () => true,
      raiseRisk: hooks.raiseRisk ?? (async () => true),
      latestPositions: async () => [],
      lastRun: async () => null,
      resolveRisks: async () => 0,
      recordRun: async () => {},
      saveVesselPosition: async () => {},
      listRioLoadsForPoll: async () => loads,
      updateRioLoadState: hooks.update ?? (async () => {}),
      processPosition: hooks.processPosition,
      lastPositionAt: async () => null,
      lastPositionFix: async () => null,
    };
  }

  it('pending → check ok + zapis pozycji w oknie; secret nie w observations', async () => {
    const patches: unknown[] = [];
    const positions: unknown[] = [];
    const res = await runRioLinks({
      store: store([baseLoad()], {
        update: async (_id, p) => { patches.push(p); },
        processPosition: async (row) => { positions.push(row); },
      }),
      fetch: async () => new Response(JSON.stringify(SAMPLE), { status: 200 }),
      env: {},
      now: () => new Date('2026-10-09T03:30:00Z'),
    });
    expect(res.job).toBe('rio-links');
    expect(res.ok).toBe(true);
    expect(res.observations?.written).toBe('1');
    expect(res.observations?.pending_ok).toBe('1');
    expect(JSON.stringify(res)).not.toMatch(/SEKRET/);
    expect(JSON.stringify(patches)).not.toMatch(/SEKRET/);
    expect(positions[0]).toMatchObject({ source: 'SUBCONTRACTOR_LINK', loadId: 'load-1' });
    expect(patches[0]).toMatchObject({ rio_check_state: 'ok', rio_tracker_on: 'NACZEPA' });
  });

  it('poza oknem E27: pending robi check, bez zapisu pozycji', async () => {
    const positions: unknown[] = [];
    const res = await runRioLinks({
      store: store([baseLoad({ plannedLoadDate: '2026-10-20' })], {
        processPosition: async (row) => { positions.push(row); },
      }),
      fetch: async () => new Response(JSON.stringify(SAMPLE), { status: 200 }),
      env: {},
      now: () => new Date('2026-10-09T03:30:00Z'),
    });
    expect(res.observations?.pending_ok).toBe('1');
    expect(res.observations?.written).toBe('0');
    expect(positions).toHaveLength(0);
  });

  it('404 → sprawa Link RIO nieprawidłowy', async () => {
    const risks: string[] = [];
    await runRioLinks({
      store: store([baseLoad({ rio_check_state: 'ok', rio_valid_from: SAMPLE.start, rio_valid_to: SAMPLE.end })], {
        raiseRisk: async (r) => { risks.push(r.dedup); return true; },
      }),
      fetch: async () => new Response('no', { status: 404 }),
      env: {},
      now: () => new Date('2026-10-09T03:30:00Z'),
    });
    expect(risks).toContain('RIO_INVALID:load-1');
  });

  it('3× down → SOURCE_DOWN:RIO; dedup bez daty', async () => {
    const risk = sourceDownRisk('RIO', ['timeout'], '2026-10-22T07:00:00Z');
    expect(risk.dedup).toBe('SOURCE_DOWN:RIO');
    const risks: string[] = [];
    await runRioLinks({
      store: store([baseLoad({
        rio_check_state: 'ok',
        rio_error_streak: 2,
        rio_valid_from: SAMPLE.start,
        rio_valid_to: SAMPLE.end,
      })], {
        raiseRisk: async (r) => { risks.push(r.dedup); return true; },
      }),
      fetch: async () => new Response('err', { status: 503 }),
      env: {},
      now: () => new Date('2026-10-09T03:30:00Z'),
    });
    expect(risks).toContain('SOURCE_DOWN:RIO');
  });

  it('ten sam timestamp 2× → 1 pozycja', async () => {
    let n = 0;
    const storeOnce = store([baseLoad({
      rio_check_state: 'ok',
      rio_valid_from: SAMPLE.start,
      rio_valid_to: SAMPLE.end,
    })], {
      processPosition: async () => { n++; },
    });
    storeOnce.lastPositionAt = async () => SAMPLE.position.timestamp;
    const res = await runRioLinks({
      store: storeOnce,
      fetch: async () => new Response(JSON.stringify(SAMPLE), { status: 200 }),
      env: {},
      now: () => new Date('2026-10-09T03:30:00Z'),
    });
    expect(res.observations?.skipped_dup).toBe('1');
    expect(n).toBe(0);
  });
});

// wycisz unused vi przy braku mocków sieciowych w części testów
void vi;
