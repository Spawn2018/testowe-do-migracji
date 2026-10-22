import { describe, expect, it, vi } from 'vitest';
import {
  fetchRioPosition, inferRioTrackerOn, parseRioPositionPayload, rioLinkValidNow,
  rioPositionUrlSafe, scrubRioSecret, speedKmhFromPrev,
} from '../supabase/functions/_shared/telematics/rioPositionSharing';
import { runRioLinks, type RioLoadRow, type SyncStore } from '../supabase/functions/_shared/integrations/jobs';
import { sourceDownRisk } from '../supabase/functions/_shared/integrations/sync';

/** Zmyślone dane — nie z prawdziwej odpowiedzi RIO (F7 #438). */
const SAMPLE = {
  id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
  name: 'TEST-NACZEPA kurs testowy',
  start: '2026-10-08T15:00:00Z',
  end: '2026-10-12T04:00:00Z',
  position: {
    timestamp: '2026-10-09T03:21:05Z',
    latitude: 52.081,
    longitude: 17.012,
  },
  asset_name: 'TEST 1111A',
};

describe('E44 RIO adapter', () => {
  it('URL bezpieczny bez secret', () => {
    const u = rioPositionUrlSafe('abc-123');
    expect(u).toBe('https://api.position-sharing.rio.cloud/trackings/abc-123/position');
    expect(u).not.toMatch(/secret/i);
  });

  it('scrubRioSecret wycina secret z komunikatu', () => {
    const raw = 'TypeError: fetch failed https://api.position-sharing.rio.cloud/trackings/x/position?secret=TAJNE123&x=1';
    const scrubbed = scrubRioSecret(raw);
    expect(scrubbed).not.toMatch(/TAJNE/);
    expect(scrubbed).toMatch(/secret=\*\*\*/);
  });

  it('parseRioPositionPayload czyta lat/lon/asset/start-end', () => {
    const r = parseRioPositionPayload(SAMPLE);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lat).toBeCloseTo(52.081, 3);
    expect(r.lon).toBeCloseTo(17.012, 3);
    expect(r.assetName).toBe('TEST 1111A');
    expect(r.validFrom).toBe('2026-10-08T15:00:00.000Z');
    expect(r.validTo).toBe('2026-10-12T04:00:00.000Z');
  });

  it('latitude: null → down', () => {
    const r = parseRioPositionPayload({
      id: 'x',
      position: { timestamp: '2026-10-09T03:21:05Z', latitude: null, longitude: 17 },
    });
    expect(r).toMatchObject({ ok: false, kind: 'down' });
  });

  it('latitude: "" → down', () => {
    const r = parseRioPositionPayload({
      id: 'x',
      position: { timestamp: '2026-10-09T03:21:05Z', latitude: '', longitude: 17 },
    });
    expect(r).toMatchObject({ ok: false, kind: 'down' });
  });

  it('lat poza zakresem → down', () => {
    const r = parseRioPositionPayload({
      id: 'x',
      position: { timestamp: '2026-10-09T03:21:05Z', latitude: 95, longitude: 17 },
    });
    expect(r).toMatchObject({ ok: false, kind: 'down' });
  });

  it('timestamp z przyszłości (> +5 min) → down', () => {
    const future = new Date(Date.now() + 10 * 60_000).toISOString();
    const r = parseRioPositionPayload({
      id: 'x',
      position: { timestamp: future, latitude: 52, longitude: 17 },
    }, Date.now());
    expect(r).toMatchObject({ ok: false, kind: 'down' });
  });

  it('brak position.latitude → down (zmieniony format)', () => {
    const r = parseRioPositionPayload({ id: 'x', position: { timestamp: '2026-10-09T03:21:05Z' } });
    expect(r).toMatchObject({ ok: false, kind: 'down' });
  });

  it('inferRioTrackerOn: naczepa / ciągnik / nieznany', () => {
    expect(inferRioTrackerOn('TEST 1111A', { trailer: 'TEST1111A' })).toBe('NACZEPA');
    expect(inferRioTrackerOn('TEST1111A', { tractorPl: 'TEST 1111A' })).toBe('CIAGNIK_PL');
    expect(inferRioTrackerOn('TEST1111A', { tractorSe: 'TEST-1111-A' })).toBe('CIAGNIK_SE');
    expect(inferRioTrackerOn('INNY', { trailer: 'TEST1111A' })).toBe('NIEZNANY');
  });

  it('rioLinkValidNow respektuje start–end', () => {
    expect(rioLinkValidNow('2026-10-09T12:00:00Z', SAMPLE.start, SAMPLE.end)).toBe(true);
    expect(rioLinkValidNow('2026-10-08T10:00:00Z', SAMPLE.start, SAMPLE.end)).toBe(false);
    expect(rioLinkValidNow('2026-10-13T00:00:00Z', SAMPLE.start, SAMPLE.end)).toBe(false);
    expect(rioLinkValidNow('2026-10-09T12:00:00Z', null, null)).toBe(true);
  });

  it('speedKmhFromPrev > 5 przy ruchu; skok > 130 → null', () => {
    const prev = { lat: 52.0, lon: 17.0, ts: '2026-10-09T03:00:00Z' };
    const curr = { lat: 52.1, lon: 17.0, ts: '2026-10-09T03:30:00Z' };
    const sp = speedKmhFromPrev(prev, curr);
    expect(sp).not.toBeNull();
    expect(sp!).toBeGreaterThan(5);
    const jump = speedKmhFromPrev(
      { lat: 52, lon: 17, ts: '2026-10-09T03:00:00Z' },
      { lat: 60, lon: 17, ts: '2026-10-09T03:01:00Z' },
    );
    expect(jump).toBeNull();
  });

  it('fetchRioPosition: 404/400/410 → invalid; 500 → down', async () => {
    for (const status of [404, 400, 410]) {
      const bad = await fetchRioPosition({
        trackingId: 'x', secret: 's',
        fetchImpl: async () => new Response('no', { status }),
      });
      expect(bad).toMatchObject({ ok: false, kind: 'invalid', status });
    }
    const down = await fetchRioPosition({
      trackingId: 'x', secret: 's',
      fetchImpl: async () => new Response('err', { status: 503 }),
    });
    expect(down).toMatchObject({ ok: false, kind: 'down', status: 503 });
  });

  it('fetchRioPosition: błąd sieci bez secret w warning', async () => {
    const r = await fetchRioPosition({
      trackingId: 'x', secret: 'SEKRET-W-URL',
      fetchImpl: async () => {
        throw new TypeError(
          'fetch failed: https://api.position-sharing.rio.cloud/trackings/x/position?secret=SEKRET-W-URL',
        );
      },
    });
    expect(r).toMatchObject({ ok: false, kind: 'down' });
    if (r.ok) return;
    expect(r.warning).not.toMatch(/SEKRET/);
    expect(r.warning).toMatch(/^RIO: sieć/);
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
      code: 'SG-99',
      rio_tracking_id: SAMPLE.id,
      rio_secret: 'SEKRET-TEST',
      rio_check_state: 'pending',
      rio_check_at: null,
      rio_valid_from: null,
      rio_valid_to: null,
      rio_asset_name: null,
      rio_tracker_on: null,
      rio_last_fix_at: null,
      rio_error_streak: 0,
      trailer_plate: 'TEST1111A',
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
    resolveRisks?: SyncStore['resolveRisks'];
    lastPositionFix?: SyncStore['lastPositionFix'];
    telmRioLinksEnabled?: SyncStore['telmRioLinksEnabled'];
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
      resolveRisks: hooks.resolveRisks ?? (async () => 0),
      recordRun: async () => {},
      saveVesselPosition: async () => {},
      listRioLoadsForPoll: async () => loads,
      updateRioLoadState: hooks.update ?? (async () => {}),
      processPosition: hooks.processPosition,
      lastPositionFix: hooks.lastPositionFix ?? (async () => null),
      telmRioLinksEnabled: hooks.telmRioLinksEnabled ?? (async () => true),
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
    expect(patches[0]).toMatchObject({
      rio_check_state: 'ok',
      rio_tracker_on: 'NACZEPA',
      rio_last_fix_at: SAMPLE.position.timestamp.replace(/Z$/, '.000Z').replace('.000.000Z', '.000Z'),
    });
    // observedAt z ISO parse — porównaj bez narzutu
    expect((patches[0] as { rio_last_fix_at: string }).rio_last_fix_at)
      .toBe(new Date(SAMPLE.position.timestamp).toISOString());
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

  it('0 zapytań poza oknem i po end (ok, nie pending)', async () => {
    let fetches = 0;
    const res = await runRioLinks({
      store: store([baseLoad({
        rio_check_state: 'ok',
        rio_valid_from: SAMPLE.start,
        rio_valid_to: SAMPLE.end,
        plannedLoadDate: '2026-10-20',
      })]),
      fetch: async () => {
        fetches++;
        return new Response(JSON.stringify(SAMPLE), { status: 200 });
      },
      env: {},
      now: () => new Date('2026-10-09T03:30:00Z'),
    });
    expect(fetches).toBe(0);
    expect(res.observations?.queried).toBe('0');
    expect(res.observations?.skipped_window).toBe('1');
  });

  it('granica okna: 02:59 nie / 03:00 tak (load_date = dziś)', async () => {
    // loadInTrackingWindow: start = plan_load 03:00 Europe/Warsaw dnia załadunku
    const load = baseLoad({
      rio_check_state: 'ok',
      rio_valid_from: '2026-10-08T00:00:00Z',
      rio_valid_to: '2026-10-12T00:00:00Z',
      plannedLoadDate: '2026-10-09',
    });
    let fetchesEarly = 0;
    await runRioLinks({
      store: store([load]),
      fetch: async () => {
        fetchesEarly++;
        return new Response(JSON.stringify(SAMPLE), { status: 200 });
      },
      env: {},
      // 02:59 Warsaw = 00:59 UTC (CEST = UTC+2 w październiku)
      now: () => new Date('2026-10-09T00:59:00Z'),
    });
    expect(fetchesEarly).toBe(0);

    let fetchesOk = 0;
    await runRioLinks({
      store: store([load]),
      fetch: async () => {
        fetchesOk++;
        return new Response(JSON.stringify(SAMPLE), { status: 200 });
      },
      env: {},
      // 03:00 Warsaw = 01:00 UTC
      now: () => new Date('2026-10-09T01:00:00Z'),
    });
    expect(fetchesOk).toBe(1);
  });

  it('404 → sprawa Link RIO nieprawidłowy (RESOURCE_MISSING); secret nie w raiseRisk', async () => {
    const risks: { dedup: string; kind: string; detail: unknown }[] = [];
    await runRioLinks({
      store: store([baseLoad({
        rio_check_state: 'ok',
        rio_valid_from: SAMPLE.start,
        rio_valid_to: SAMPLE.end,
      })], {
        raiseRisk: async (r) => {
          risks.push({ dedup: r.dedup, kind: r.kind, detail: r.detail });
          return true;
        },
      }),
      fetch: async () => new Response('no', { status: 404 }),
      env: {},
      now: () => new Date('2026-10-09T03:30:00Z'),
    });
    expect(risks.some((r) => r.dedup === 'RIO_INVALID:load-1')).toBe(true);
    expect(risks.find((r) => r.dedup === 'RIO_INVALID:load-1')?.kind).toBe('RESOURCE_MISSING');
    expect(JSON.stringify(risks)).not.toMatch(/SEKRET/);
  });

  it('seria 2 bez SOURCE_DOWN; seria 3 → SOURCE_DOWN; zerowanie po ok', async () => {
    const risk = sourceDownRisk('RIO', ['timeout'], '2026-10-22T07:00:00Z');
    expect(risk.dedup).toBe('SOURCE_DOWN:RIO');

    const risks2: string[] = [];
    await runRioLinks({
      store: store([baseLoad({
        rio_check_state: 'ok',
        rio_error_streak: 1,
        rio_valid_from: SAMPLE.start,
        rio_valid_to: SAMPLE.end,
      })], {
        raiseRisk: async (r) => { risks2.push(r.dedup); return true; },
      }),
      fetch: async () => new Response('err', { status: 503 }),
      env: {},
      now: () => new Date('2026-10-09T03:30:00Z'),
    });
    expect(risks2).not.toContain('SOURCE_DOWN:RIO');

    const risks3: string[] = [];
    const patches: unknown[] = [];
    await runRioLinks({
      store: store([baseLoad({
        rio_check_state: 'ok',
        rio_error_streak: 2,
        rio_valid_from: SAMPLE.start,
        rio_valid_to: SAMPLE.end,
      })], {
        raiseRisk: async (r) => { risks3.push(r.dedup); return true; },
        update: async (_id, p) => { patches.push(p); },
      }),
      fetch: async () => new Response('err', { status: 503 }),
      env: {},
      now: () => new Date('2026-10-09T03:30:00Z'),
    });
    expect(risks3).toContain('SOURCE_DOWN:RIO');

    const okPatches: unknown[] = [];
    await runRioLinks({
      store: store([baseLoad({
        rio_check_state: 'ok',
        rio_error_streak: 2,
        rio_valid_from: SAMPLE.start,
        rio_valid_to: SAMPLE.end,
      })], {
        update: async (_id, p) => { okPatches.push(p); },
      }),
      fetch: async () => new Response(JSON.stringify(SAMPLE), { status: 200 }),
      env: {},
      now: () => new Date('2026-10-09T03:30:00Z'),
    });
    expect(okPatches[0]).toMatchObject({ rio_error_streak: 0 });
  });

  it('rio_last_fix_at tylko przy ok (nie przy błędzie)', async () => {
    const patches: Record<string, unknown>[] = [];
    await runRioLinks({
      store: store([baseLoad({
        rio_check_state: 'ok',
        rio_valid_from: SAMPLE.start,
        rio_valid_to: SAMPLE.end,
      })], {
        update: async (_id, p) => { patches.push(p as Record<string, unknown>); },
      }),
      fetch: async () => new Response('err', { status: 503 }),
      env: {},
      now: () => new Date('2026-10-09T03:30:00Z'),
    });
    expect(patches[0]).not.toHaveProperty('rio_last_fix_at');
  });

  it('ten sam timestamp 2× → 1 pozycja', async () => {
    let n = 0;
    const storeOnce = store([baseLoad({
      rio_check_state: 'ok',
      rio_valid_from: SAMPLE.start,
      rio_valid_to: SAMPLE.end,
    })], {
      processPosition: async () => { n++; },
      lastPositionFix: async () => ({
        lat: SAMPLE.position.latitude,
        lon: SAMPLE.position.longitude,
        ts: SAMPLE.position.timestamp,
      }),
    });
    const res = await runRioLinks({
      store: storeOnce,
      fetch: async () => new Response(JSON.stringify(SAMPLE), { status: 200 }),
      env: {},
      now: () => new Date('2026-10-09T03:30:00Z'),
    });
    expect(res.observations?.skipped_dup).toBe('1');
    expect(n).toBe(0);
  });

  it('flaga TELM_RIO_LINKS wyłączona → bez zapytań', async () => {
    let fetches = 0;
    const res = await runRioLinks({
      store: store([baseLoad()], {
        telmRioLinksEnabled: async () => false,
      }),
      fetch: async () => {
        fetches++;
        return new Response(JSON.stringify(SAMPLE), { status: 200 });
      },
      env: {},
      now: () => new Date('2026-10-09T03:30:00Z'),
    });
    expect(fetches).toBe(0);
    expect(res.observations?.flag).toBe('false');
    expect(res.disabled).toBe(true); // #446: Stan systemu nie pokazuje „działa”
    expect(res.observations?.disabled).toBe('true');
  });

  it('#446: resolveRisks RIO_UNKNOWN_ASSET tylko NIEZNANY → znany', async () => {
    const resolved: string[] = [];
    // Już znany — bez resolve przy każdym przebiegu.
    await runRioLinks({
      store: store([baseLoad({
        rio_tracker_on: 'NACZEPA',
        rio_check_state: 'ok',
        rio_valid_from: SAMPLE.start,
        rio_valid_to: SAMPLE.end,
      })], {
        resolveRisks: async (prefix) => { resolved.push(prefix); return 0; },
      }),
      fetch: async () => new Response(JSON.stringify(SAMPLE), { status: 200 }),
      env: {},
      now: () => new Date('2026-10-09T03:30:00Z'),
    });
    expect(resolved.filter((p) => p.startsWith('RIO_UNKNOWN_ASSET:'))).toHaveLength(0);

    const resolved2: string[] = [];
    await runRioLinks({
      store: store([baseLoad({
        rio_tracker_on: 'NIEZNANY',
        rio_check_state: 'ok',
        rio_valid_from: SAMPLE.start,
        rio_valid_to: SAMPLE.end,
        trailer_plate: SAMPLE.asset_name,
      })], {
        resolveRisks: async (prefix) => { resolved2.push(prefix); return 0; },
      }),
      fetch: async () => new Response(JSON.stringify(SAMPLE), { status: 200 }),
      env: {},
      now: () => new Date('2026-10-09T03:30:00Z'),
    });
    expect(resolved2).toContain('RIO_UNKNOWN_ASSET:load-1');
  });

  it('F7 r3: bez UPDATE gdy tylko rio_check_at (+00 vs Z) i stan bez zmian', async () => {
    const updates: unknown[] = [];
    const load = baseLoad({
      rio_check_state: 'ok',
      rio_check_at: '2026-10-09T03:20:00+00',
      rio_asset_name: SAMPLE.asset_name,
      rio_tracker_on: 'NACZEPA',
      rio_valid_from: SAMPLE.start,
      rio_valid_to: SAMPLE.end,
      rio_last_fix_at: SAMPLE.position.timestamp,
      rio_error_streak: 0,
    });
    await runRioLinks({
      store: store([load], {
        update: async (_id, p) => { updates.push(p); },
        lastPositionFix: async () => ({
          lat: SAMPLE.position.latitude,
          lon: SAMPLE.position.longitude,
          ts: SAMPLE.position.timestamp,
        }),
      }),
      fetch: async () => new Response(JSON.stringify(SAMPLE), { status: 200 }),
      env: {},
      // 10 min po ostatnim check — poniżej 30 min → bez odświeżenia samego check_at
      now: () => new Date('2026-10-09T03:30:00Z'),
    });
    expect(updates).toHaveLength(0);
  });

  it('F7 r3: ok → down ustawia rio_check_state=down', async () => {
    const patches: Record<string, unknown>[] = [];
    await runRioLinks({
      store: store([baseLoad({
        rio_check_state: 'ok',
        rio_valid_from: SAMPLE.start,
        rio_valid_to: SAMPLE.end,
      })], {
        update: async (_id, p) => { patches.push(p as Record<string, unknown>); },
      }),
      fetch: async () => new Response('err', { status: 503 }),
      env: {},
      now: () => new Date('2026-10-09T03:30:00Z'),
    });
    expect(patches[0]?.rio_check_state).toBe('down');
  });

  it('F7 r3: resolveRisks RIO_INVALID tylko przy przejściu z invalid', async () => {
    const resolved: string[] = [];
    await runRioLinks({
      store: store([baseLoad({
        rio_check_state: 'ok',
        rio_valid_from: SAMPLE.start,
        rio_valid_to: SAMPLE.end,
      })], {
        resolveRisks: async (prefix) => { resolved.push(prefix); return 0; },
      }),
      fetch: async () => new Response(JSON.stringify(SAMPLE), { status: 200 }),
      env: {},
      now: () => new Date('2026-10-09T03:30:00Z'),
    });
    expect(resolved.filter((p) => p.startsWith('RIO_INVALID:'))).toHaveLength(0);

    const resolved2: string[] = [];
    await runRioLinks({
      store: store([baseLoad({
        rio_check_state: 'invalid',
        rio_check_at: '2026-10-09T02:00:00Z',
        rio_valid_from: SAMPLE.start,
        rio_valid_to: SAMPLE.end,
      })], {
        resolveRisks: async (prefix) => { resolved2.push(prefix); return 0; },
      }),
      fetch: async () => new Response(JSON.stringify(SAMPLE), { status: 200 }),
      env: {},
      now: () => new Date('2026-10-09T03:30:00Z'),
    });
    expect(resolved2).toContain('RIO_INVALID:load-1');
  });
});

void vi;
