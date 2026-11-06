import { describe, expect, it, vi } from 'vitest';
import {
  looksLikeBrokenMonitorujPojazd, monitorujpojazdDataUrl, monitorujpojazdMarker,
  monitorujpojazdTokenFromLink, monitorujpojazdUrlSafe, parseMonitorujPojazdPayload,
  parseMonitorujPojazdTimestamp, scrubMonitorujPojazdToken,
} from '../supabase/functions/_shared/telematics/monitorujpojazdShareLink';
import {
  runMonitorujPojazdPoll, type MonitorujPojazdLoadRow, type SyncStore,
} from '../supabase/functions/_shared/integrations/jobs';

/** Zmyślony UUID (nie z TS-08). */
const FAKE_TOKEN = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee1234';
const FAKE_MARKER = 'mp:ee1234';

function baseLoad(over: Partial<MonitorujPojazdLoadRow> = {}): MonitorujPojazdLoadRow {
  return {
    id: 'load-mp-1',
    monitorujpojazd_token: FAKE_TOKEN,
    monitorujpojazd_check_state: 'pending',
    monitorujpojazd_check_at: null,
    monitorujpojazd_last_fix_at: null,
    monitorujpojazd_error_streak: 0,
    telematics_vehicle_id: FAKE_MARKER,
    status: 'IN_TRANSIT_PL',
    plannedLoadDate: '2026-11-05',
    trackingOpenedAt: '2026-11-05T06:00:00Z',
    ...over,
  };
}

describe('#837 monitorujpojazd parser / URL', () => {
  it('token z http i https; marker bez UUID', () => {
    const https = `https://sledz.monitorujpojazd.pl/share/${FAKE_TOKEN}/`;
    const http = `http://sledz.monitorujpojazd.pl/share/${FAKE_TOKEN}/`;
    expect(monitorujpojazdTokenFromLink(https)).toBe(FAKE_TOKEN);
    expect(monitorujpojazdTokenFromLink(http)).toBe(FAKE_TOKEN);
    expect(monitorujpojazdMarker(FAKE_TOKEN)).toBe(FAKE_MARKER);
    expect(looksLikeBrokenMonitorujPojazd('https://sledz.monitorujpojazd.pl/other')).toBe(true);
    expect(looksLikeBrokenMonitorujPojazd('https://evil.example/share/x')).toBe(false);
  });

  it('data URL tylko https + host sledz; scrub maskuje UUID', () => {
    const u = monitorujpojazdDataUrl(FAKE_TOKEN);
    expect(u.startsWith('https://sledz.monitorujpojazd.pl/')).toBe(true);
    expect(u).toContain(FAKE_TOKEN);
    expect(monitorujpojazdUrlSafe(FAKE_TOKEN)).toContain('…ee1234');
    expect(monitorujpojazdUrlSafe(FAKE_TOKEN)).not.toContain(FAKE_TOKEN);
    const raw = `fetch failed ${u}`;
    expect(scrubMonitorujPojazdToken(raw)).not.toContain(FAKE_TOKEN);
  });

  it('EXPIRED → invalid; NOT_STARTED → pending; OK z ts Europe/Warsaw', () => {
    expect(parseMonitorujPojazdPayload({
      state: 'EXPIRED', guid: FAKE_TOKEN, reason: 2,
    }, Date.parse('2026-11-06T12:00:00Z'))).toMatchObject({ ok: false, kind: 'invalid' });

    expect(parseMonitorujPojazdPayload({
      state: 'NOT_STARTED', guid: FAKE_TOKEN, reason: 1,
    }, Date.parse('2026-11-06T12:00:00Z'))).toMatchObject({ ok: false, kind: 'pending' });

    /* Zima CET (UTC+1): „11:50” Warsaw → 10:50Z — F7 #839. */
    const ok = parseMonitorujPojazdPayload({
      state: 'OK',
      ts: '2026-11-06 11:50:00',
      data: [{
        id: 1, name: 'TEST-PLATE', lat: 54.35, lon: 18.65,
        speed: 62, speed_unit: 'km/h', ignition: true, ts: '2026-11-06 11:50:00',
      }],
    }, Date.parse('2026-11-06T12:00:00Z'));
    expect(ok).toMatchObject({
      ok: true, lat: 54.35, lon: 18.65, speedKmh: 62, ignition: true, vehicleName: 'TEST-PLATE',
    });
    if (ok.ok) expect(ok.observedAt).toBe('2026-11-06T10:50:00.000Z');
  });

  it('parse ts: ISO z offsetem; lokalny Warsaw zima/lato; odrzut przyszłości', () => {
    expect(parseMonitorujPojazdTimestamp('2026-11-06T10:00:00Z', Date.parse('2026-11-06T12:00:00Z')))
      .toBe('2026-11-06T10:00:00.000Z');
    expect(parseMonitorujPojazdTimestamp('2026-11-06T10:00:00+01:00', Date.parse('2026-11-06T12:00:00Z')))
      .toBe('2026-11-06T09:00:00.000Z');
    /* Zima CET UTC+1 */
    expect(parseMonitorujPojazdTimestamp('2026-11-06 11:50:00', Date.parse('2026-11-06T12:00:00Z')))
      .toBe('2026-11-06T10:50:00.000Z');
    /* Lato CEST UTC+2 */
    expect(parseMonitorujPojazdTimestamp('2026-07-15 14:00:00', Date.parse('2026-07-15T13:00:00Z')))
      .toBe('2026-07-15T12:00:00.000Z');
    /* Lokalny Warsaw w przyszłości względem now → null (filtr +5 min) */
    expect(parseMonitorujPojazdTimestamp('2026-11-06 14:00:00', Date.parse('2026-11-06T12:00:00Z')))
      .toBeNull();
    expect(parseMonitorujPojazdTimestamp('2026-11-06T13:00:00Z', Date.parse('2026-11-06T12:00:00Z')))
      .toBeNull();
  });
});

describe('#837 monitorujpojazd-poll job', () => {
  it('zapisuje MONITORUJPOJAZD, dedup po ts, ryzyko po 3 błędach, maskuje token', async () => {
    const positions: unknown[] = [];
    const risks: { dedup?: string; title?: string }[] = [];
    let streak = 0;
    const load = baseLoad();
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      state: 'EXPIRED', guid: FAKE_TOKEN, reason: 2, exception: 'No row',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    const store: Partial<SyncStore> = {
      telmMonitorujPojazdPollEnabled: async () => true,
      listMonitorujPojazdLoadsForPoll: async () => [load],
      updateMonitorujPojazdLoadState: async (_id, patch) => {
        if (patch.monitorujpojazd_error_streak != null) {
          streak = patch.monitorujpojazd_error_streak;
          load.monitorujpojazd_error_streak = streak;
        }
        if (patch.monitorujpojazd_check_state) {
          load.monitorujpojazd_check_state = patch.monitorujpojazd_check_state;
        }
      },
      processPosition: async (row) => { positions.push(row); },
      lastPositionFix: async () => null,
      raiseRisk: async (r) => { risks.push(r); return true; },
      resolveRisks: async () => 0,
      inferPhaseFromPosition: async () => null,
    };

    for (let i = 0; i < 3; i++) {
      const r = await runMonitorujPojazdPoll({
        store: store as SyncStore,
        fetch: fetchImpl as unknown as typeof fetch,
        env: {},
        now: () => new Date('2026-11-06T12:00:00Z'),
      });
      expect(r.ok).toBe(false);
    }
    expect(streak).toBe(3);
    expect(load.monitorujpojazd_check_state).toBe('invalid');
    expect(positions).toHaveLength(0);
    expect(risks.some((x) => x.dedup === 'MONITORUJPOJAZD_DEAD:load-mp-1')).toBe(true);
    expect(JSON.stringify(risks)).not.toContain(FAKE_TOKEN);

    fetchImpl.mockImplementation(async () => new Response(JSON.stringify({
      state: 'OK',
      data: [{
        id: 1, name: 'T', lat: 54.4, lon: 18.7, speed: 40, speed_unit: 'km/h',
        /* Warsaw 12:58 CET → 11:58Z */
        ignition: false, ts: '2026-11-06 12:58:00',
      }],
    }), { status: 200 }));
    load.monitorujpojazd_error_streak = 3;
    load.monitorujpojazd_check_state = 'invalid';
    const okRun = await runMonitorujPojazdPoll({
      store: store as SyncStore,
      fetch: fetchImpl as unknown as typeof fetch,
      env: {},
      now: () => new Date('2026-11-06T12:00:00Z'),
    });
    expect(okRun.ok).toBe(true);
    expect(positions).toHaveLength(1);
    expect(positions[0]).toMatchObject({
      source: 'MONITORUJPOJAZD', loadId: 'load-mp-1', lat: 54.4, lon: 18.7,
      ts: '2026-11-06T11:58:00.000Z',
    });
    expect(JSON.stringify(positions[0])).not.toContain(FAKE_TOKEN);
  });

  it('NOT_STARTED → pending bez streak i bez sprawy', async () => {
    const risks: unknown[] = [];
    const load = baseLoad({ monitorujpojazd_error_streak: 2, monitorujpojazd_check_state: 'ok' });
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      state: 'NOT_STARTED', guid: FAKE_TOKEN, reason: 1,
    }), { status: 200 }));
    const store: Partial<SyncStore> = {
      telmMonitorujPojazdPollEnabled: async () => true,
      listMonitorujPojazdLoadsForPoll: async () => [load],
      updateMonitorujPojazdLoadState: async (_id, patch) => { Object.assign(load, patch); },
      raiseRisk: async (r) => { risks.push(r); return true; },
    };
    const r = await runMonitorujPojazdPoll({
      store: store as SyncStore,
      fetch: fetchImpl as unknown as typeof fetch,
      env: {},
      now: () => new Date('2026-11-06T12:00:00Z'),
    });
    expect(r.ok).toBe(true);
    expect(load.monitorujpojazd_check_state).toBe('pending');
    expect(load.monitorujpojazd_error_streak).toBe(2);
    expect(risks).toHaveLength(0);
  });

  it('pomija poza oknem śledzenia', async () => {
    const load = baseLoad({
      status: 'READY',
      plannedLoadDate: '2099-01-01',
      trackingOpenedAt: null,
    });
    const store: Partial<SyncStore> = {
      telmMonitorujPojazdPollEnabled: async () => true,
      listMonitorujPojazdLoadsForPoll: async () => [load],
    };
    const r = await runMonitorujPojazdPoll({
      store: store as SyncStore,
      fetch: vi.fn() as unknown as typeof fetch,
      env: {},
      now: () => new Date('2026-11-06T12:00:00Z'),
    });
    expect(r.observations?.skipped_window).toBe('1');
    expect(r.observations?.queried).toBe('0');
  });
});
