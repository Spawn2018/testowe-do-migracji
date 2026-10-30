import { describe, expect, it, vi } from 'vitest';
import {
  fetchSafefleetPosition, isSafefleetLink, looksLikeBrokenSafefleet,
  parseSafefleetRefreshPayload, parseSafefleetTimestamp, parseSafefleetTrajectoryPayload,
  safefleetMarker, safefleetTokenFromLink, safefleetUrlSafe, scrubSafefleetToken,
} from '../supabase/functions/_shared/telematics/safefleetTemporaryLink';
import {
  runSafefleetPoll, type SafefleetLoadRow, type SyncStore,
} from '../supabase/functions/_shared/integrations/jobs';

/** Zmyślone dane — nie z prawdziwego SG-27 (#662). */
const FAKE_TOKEN = 'a'.repeat(26) + 'b1c2d3';
const SAMPLE = [{
  id: 99,
  lat: 52.081,
  lng: 17.012,
  timestamp: '30 October 2026, 10:51 (UTC)',
  status: 1,
  speed: 42,
  azimuth: 180,
  licensePlate: 'TEST 9999Z',
  name: 'TEST-POJAZD',
}];

function baseLoad(over: Partial<SafefleetLoadRow> = {}): SafefleetLoadRow {
  return {
    id: 'load-sf-1',
    safefleet_token: FAKE_TOKEN,
    safefleet_check_state: 'pending',
    safefleet_check_at: null,
    safefleet_last_fix_at: null,
    safefleet_error_streak: 0,
    safefleet_trajectory_done: true,
    telematics_vehicle_id: safefleetMarker(FAKE_TOKEN),
    status: 'IN_TRANSIT',
    plannedLoadDate: '2026-10-28',
    trackingOpenedAt: '2026-10-28T01:00:00Z',
    ...over,
  };
}

describe('#662 SafeFleet adapter', () => {
  it('rozpoznaje wzór URL i znacznik', () => {
    const url = `https://portal.safefleet.pl/safefleet/temporary_link/view/${FAKE_TOKEN}/`;
    expect(isSafefleetLink(url)).toBe(true);
    expect(safefleetTokenFromLink(url)).toBe(FAKE_TOKEN);
    expect(safefleetMarker(FAKE_TOKEN)).toBe('safefleet:b1c2d3');
    expect(looksLikeBrokenSafefleet('https://portal.safefleet.pl/other')).toBe(true);
    expect(looksLikeBrokenSafefleet(url)).toBe(false);
  });

  it('URL bezpieczny tylko z 6 ostatnimi znakami tokenu', () => {
    const u = safefleetUrlSafe(FAKE_TOKEN);
    expect(u).toContain('…b1c2d3');
    expect(u).not.toContain(FAKE_TOKEN);
    expect(u).not.toMatch(/[0-9a-f]{32}/i);
  });

  it('scrubSafefleetToken wycina 32 hex z komunikatu', () => {
    const raw = `fetch failed https://portal.safefleet.pl/safefleet/temporary_link/view/${FAKE_TOKEN}/?refresh=true`;
    const scrubbed = scrubSafefleetToken(raw);
    expect(scrubbed).not.toContain(FAKE_TOKEN);
    expect(scrubbed).toMatch(/temporary_link\/view\/…/);
  });

  it('parseSafefleetTimestamp czyta format angielski UTC', () => {
    const now = Date.parse('2026-10-30T12:00:00Z');
    expect(parseSafefleetTimestamp('30 October 2026, 10:51 (UTC)', now))
      .toBe('2026-10-30T10:51:00.000Z');
  });

  it('parseSafefleetRefreshPayload: lat/lng/speed/ignition', () => {
    const r = parseSafefleetRefreshPayload(SAMPLE, Date.parse('2026-10-30T12:00:00Z'));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lat).toBeCloseTo(52.081, 3);
    expect(r.lon).toBeCloseTo(17.012, 3);
    expect(r.speedKmh).toBe(42);
    expect(r.ignition).toBe(true);
    expect(r.licensePlate).toBe('TEST 9999Z');
  });

  it('error / pusta tablica → invalid lub no_position', () => {
    expect(parseSafefleetRefreshPayload('error')).toMatchObject({ ok: false, kind: 'invalid' });
    expect(parseSafefleetRefreshPayload([])).toMatchObject({ ok: false, kind: 'no_position' });
  });

  it('trajectory: timestampAgo → ts wstecz', () => {
    const now = Date.parse('2026-10-30T12:00:00Z');
    const pts = parseSafefleetTrajectoryPayload({
      journey: null,
      presences: [{ lat: 52.1, lng: 17.1, timestampAgo: 120 }],
    }, now);
    expect(pts).toHaveLength(1);
    expect(pts[0].ts).toBe('2026-10-30T11:58:00.000Z');
  });

  it('fetchSafefleetPosition: 404 → invalid; 500 → down', async () => {
    const bad = await fetchSafefleetPosition({
      token: FAKE_TOKEN,
      fetchImpl: async () => new Response('error', { status: 404 }),
    });
    expect(bad).toMatchObject({ ok: false, kind: 'invalid', status: 404 });
    const down = await fetchSafefleetPosition({
      token: FAKE_TOKEN,
      fetchImpl: async () => new Response('x', { status: 502 }),
    });
    expect(down).toMatchObject({ ok: false, kind: 'down', status: 502 });
  });
});

describe('#662 runSafefleetPoll', () => {
  it('zapisuje SAFEFLEET, dedup po ts, ryzyko po 3 błędach, maskuje token w raw', async () => {
    const positions: unknown[] = [];
    const risks: { dedup?: string; title?: string }[] = [];
    const patches: unknown[] = [];
    let streak = 0;
    const load = baseLoad({ safefleet_trajectory_done: true });

    const store: Partial<SyncStore> = {
      telmSafefleetPollEnabled: async () => true,
      listSafefleetLoadsForPoll: async () => [load],
      updateSafefleetLoadState: async (_id, patch) => {
        patches.push(patch);
        if (patch.safefleet_error_streak != null) {
          streak = patch.safefleet_error_streak;
          load.safefleet_error_streak = streak;
        }
        if (patch.safefleet_check_state) load.safefleet_check_state = patch.safefleet_check_state;
      },
      processPosition: async (row) => { positions.push(row); },
      lastPositionFix: async () => null,
      raiseRisk: async (r) => { risks.push(r); return true; },
      resolveRisks: async () => 0,
      inferPhaseFromPosition: async () => null,
    };

    const okFetch: typeof fetch = async () =>
      new Response(JSON.stringify(SAMPLE), { status: 200, headers: { 'Content-Type': 'application/json' } });

    const r1 = await runSafefleetPoll({
      store: store as SyncStore,
      fetch: okFetch,
      env: {},
      now: () => new Date('2026-10-30T12:00:00Z'),
    });
    expect(r1.ok).toBe(true);
    expect(positions).toHaveLength(1);
    expect(positions[0]).toMatchObject({ source: 'SAFEFLEET', loadId: 'load-sf-1' });
    const raw = (positions[0] as { raw: { url: string } }).raw;
    expect(raw.url).not.toContain(FAKE_TOKEN);
    expect(raw.url).toContain('b1c2d3');

    // dedup: ta sama ts
    store.lastPositionFix = async () => ({
      lat: 52.081, lon: 17.012, ts: '2026-10-30T10:51:00.000Z',
    });
    const rDup = await runSafefleetPoll({
      store: store as SyncStore,
      fetch: okFetch,
      env: {},
      now: () => new Date('2026-10-30T12:02:00Z'),
    });
    expect(rDup.observations?.skipped_dup).toBe('1');
    expect(positions).toHaveLength(1);

    // 3× 404 → ryzyko
    store.lastPositionFix = async () => null;
    const badFetch: typeof fetch = async () => new Response('error', { status: 404 });
    for (let i = 0; i < 3; i++) {
      await runSafefleetPoll({
        store: store as SyncStore,
        fetch: badFetch,
        env: {},
        now: () => new Date(`2026-10-30T12:0${4 + i}:00Z`),
      });
    }
    expect(risks.some((x) => x.dedup === 'SAFEFLEET_DEAD:load-sf-1')).toBe(true);
    expect(risks.find((x) => x.dedup === 'SAFEFLEET_DEAD:load-sf-1')?.title)
      .toMatch(/SafeFleet nie działa/);
  });

  it('flaga wyłączona → disabled, bez zapisu', async () => {
    const r = await runSafefleetPoll({
      store: {
        telmSafefleetPollEnabled: async () => false,
        listSafefleetLoadsForPoll: async () => [baseLoad()],
        raiseRisk: async () => false,
        resolveRisks: async () => 0,
      } as SyncStore,
      fetch: vi.fn(),
      env: {},
      now: () => new Date('2026-10-30T12:00:00Z'),
    });
    expect(r).toMatchObject({ ok: true, disabled: true });
  });
});
