import { describe, expect, it } from 'vitest';
import {
  isMoving, normalizePlate, parseCurrentSnapshot, pollIntervalSec,
} from '../supabase/functions/_shared/telematics/emtrackWeb';
import { matchFixToLoad } from '../supabase/functions/_shared/telematics/matchTrailer';
import { runEmtrackWeb } from '../supabase/functions/_shared/integrations/jobs';
import { sourceDownRisk } from '../supabase/functions/_shared/integrations/sync';
import {
  emtrackLoginFail, emtrackLoginFresh, emtrackLoginOk, emtrackLoginSkipped, emtrackNextTryAt, emtrackSecretFp,
} from '../supabase/functions/_shared/integrations/emtrackLogin';

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

  it('A8: w pauzie nie woła logowania; nextTryAt = skipped_until', async () => {
    const fp = emtrackSecretFp('u', 'p');
    const until = '2026-10-05T16:00:00.000Z';
    let fetched = 0;
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
        async telmEmtrackWebEnabled() { return true; },
        async emtrackLoginState() {
          return { failStreak: 3, skippedUntil: until, secretFp: fp };
        },
      },
      fetch: async () => { fetched += 1; return new Response('ok'); },
      env: { EMTRACK_LOGIN: 'u', EMTRACK_PASSWORD: 'p' },
      now: () => new Date('2026-10-05T12:00:00Z'),
    });
    expect(fetched).toBe(0);
    expect(r.ok).toBe(false);
    expect(r.observations?.skipped).toBe('true');
    expect(r.observations?.next_try_at).toBe(until);
    expect(String(r.reason)).toMatch(/wstrzymane do/);
    expect(emtrackNextTryAt({ failStreak: 3, skippedUntil: until, secretFp: fp })).toBe(until);
  });
});

describe('A8 pauza logowania', () => {
  const now = new Date('2026-10-05T12:00:00Z');
  const fp = emtrackSecretFp('login', 'haslo');

  it('3 porażki ustawiają pauzę 6 h; 4. wywołanie w oknie jest pominięte', () => {
    let s = emtrackLoginFresh(null, fp);
    s = emtrackLoginFail(s, now);
    s = emtrackLoginFail(s, now);
    expect(emtrackLoginSkipped(s, now)).toBe(false);
    s = emtrackLoginFail(s, now);
    expect(s.failStreak).toBe(3);
    expect(s.skippedUntil).toBe('2026-10-05T18:00:00.000Z');
    expect(emtrackLoginSkipped(s, new Date('2026-10-05T17:59:00Z'))).toBe(true);
    expect(emtrackNextTryAt(s)).toBe(s.skippedUntil);
  });

  it('po 6 h pauza mija — jedna kolejna próba; kolejna odmowa znowu na 6 h', () => {
    const s = emtrackLoginFail(
      emtrackLoginFail(emtrackLoginFail(emtrackLoginFresh(null, fp), now), now),
      now,
    );
    const after = new Date('2026-10-05T18:00:00.000Z');
    expect(emtrackLoginSkipped(s, after)).toBe(false);
    const again = emtrackLoginFail(s, after);
    expect(again.skippedUntil).toBe('2026-10-06T00:00:00.000Z');
    expect(emtrackLoginSkipped(again, new Date('2026-10-05T18:01:00.000Z'))).toBe(true);
  });

  it('A8: 3× wyjątek sieci nie stawia pauzy 6 h; 3× login_failed stawia', async () => {
    let state: { failStreak: number; skippedUntil: string | null; secretFp: string | null } | null = null;
    let raised = 0;
    const base = {
      async projectId() { return 'p'; },
      async vessels() { return []; },
      async sailingsSince() { return []; },
      async insertSailings() {},
      async updateSailing() { return false; },
      async latestPositions() { return []; },
      async lastRun() { return null; },
      async resolveRisks() { return 0; },
      async recordRun() {},
      async saveVesselPosition() {},
      async telmEmtrackWebEnabled() { return true; },
      async emtrackLoginState() { return state; },
      async saveEmtrackLoginState(s: { failStreak: number; skippedUntil: string | null; secretFp: string | null }) { state = s; },
      async raiseRisk() { raised += 1; return true; },
    };
    const fetch = async () => new Response('<html></html>');
    const t0 = new Date('2026-10-05T12:00:00Z');
    class NetDown {
      constructor() { throw new Error('ws error'); }
    }
    for (let i = 0; i < 3; i++) {
      const r = await runEmtrackWeb({
        store: base,
        fetch,
        env: { EMTRACK_LOGIN: 'u', EMTRACK_PASSWORD: 'p' },
        now: () => new Date(t0.getTime() + i * 120_000),
        WebSocketImpl: NetDown as unknown as typeof WebSocket,
      });
      expect(r.ok).toBe(false);
      expect(r.observations?.skipped).toBeUndefined();
    }
    expect(state?.failStreak ?? 0).toBe(0);
    expect(state?.skippedUntil ?? null).toBeNull();
    expect(raised).toBe(3);

    let sockets = 0;
    class Denied {
      onopen: (() => void) | null = null;
      onmessage: ((ev: MessageEvent) => void) | null = null;
      constructor(_url: string) {
        sockets += 1;
        queueMicrotask(() => this.onopen?.());
      }
      send(raw: string) {
        const msg = JSON.parse(raw) as { id: number; type: string };
        queueMicrotask(() => {
          const frame = (body: unknown) => new MessageEvent('message', { data: JSON.stringify(body) });
          if (msg.type === 'SELECT_PROTOCOL') {
            this.onmessage?.(frame({ id: msg.id, type: 'PROTOCOL', data: { protocol: 'accepted' } }));
          } else if (msg.type === 'LOGIN') {
            this.onmessage?.(frame({ id: msg.id, type: 'LOGIN_RESPONSE', data: {} }));
          }
        });
      }
      close() {}
    }
    for (let i = 0; i < 3; i++) {
      const r = await runEmtrackWeb({
        store: base,
        fetch,
        env: { EMTRACK_LOGIN: 'u', EMTRACK_PASSWORD: 'p' },
        now: () => new Date(t0.getTime() + i * 120_000),
        WebSocketImpl: Denied as unknown as typeof WebSocket,
      });
      expect(r.ok).toBe(false);
      expect(r.warnings).toContain('login_failed');
    }
    expect(sockets).toBe(3);
    expect(state?.failStreak).toBe(3);
    expect(state?.skippedUntil).toBe('2026-10-05T18:04:00.000Z');

    const held = await runEmtrackWeb({
      store: base,
      fetch,
      env: { EMTRACK_LOGIN: 'u', EMTRACK_PASSWORD: 'p' },
      now: () => new Date('2026-10-05T18:03:00.000Z'),
      WebSocketImpl: Denied as unknown as typeof WebSocket,
    });
    expect(sockets).toBe(3);
    expect(held.ok).toBe(false);
    expect(held.observations?.skipped).toBe('true');
    expect(held.observations?.next_try_at).toBe('2026-10-05T18:04:00.000Z');

    const retry = await runEmtrackWeb({
      store: base,
      fetch,
      env: { EMTRACK_LOGIN: 'u', EMTRACK_PASSWORD: 'p' },
      now: () => new Date('2026-10-05T18:04:00.000Z'),
      WebSocketImpl: Denied as unknown as typeof WebSocket,
    });
    expect(sockets).toBe(4);
    expect(retry.warnings).toContain('login_failed');
    expect(state?.skippedUntil).toBe('2026-10-06T00:04:00.000Z');
  });

  it('udane logowanie zeruje serię', () => {
    const paused = emtrackLoginFail(
      emtrackLoginFail(emtrackLoginFail(emtrackLoginFresh(null, fp), now), now),
      now,
    );
    const ok = emtrackLoginOk(paused);
    expect(ok.failStreak).toBe(0);
    expect(ok.skippedUntil).toBeNull();
    expect(emtrackLoginSkipped(ok, now)).toBe(false);
  });

  it('inny sekret zeruje pauzę przed próbą', () => {
    const paused = emtrackLoginFail(
      emtrackLoginFail(emtrackLoginFail(emtrackLoginFresh(null, fp), now), now),
      now,
    );
    const fresh = emtrackLoginFresh(paused, emtrackSecretFp('login', 'nowe'));
    expect(fresh.failStreak).toBe(0);
    expect(fresh.skippedUntil).toBeNull();
    expect(emtrackLoginSkipped(fresh, now)).toBe(false);
  });

  it('sprawa EMTRACK_WEB ma klucz bez daty', () => {
    const risk = sourceDownRisk('EMTRACK_WEB', ['login_failed'], '2026-10-05T12:00:00.000Z');
    expect(risk.dedup).toBe('SOURCE_DOWN:EMTRACK_WEB');
    expect(risk.detail).toMatchObject({ od_kiedy: '2026-10-05T12:00:00.000Z' });
    expect(String(risk.title)).toMatch(/od /);
  });
});
