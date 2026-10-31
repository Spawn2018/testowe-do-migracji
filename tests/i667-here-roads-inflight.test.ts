/**
 * #667 F7 r3–r6 — dwa równoległe loadRoadLines → jeden POST here-roads.
 * F7 r6 B6: `vi.mock('@supabase/supabase-js')` + okno sesji 0;
 * po `Promise.all` → 1× POST; usunięcie strażnika in-flight → „got 2 times”.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc, getSession, fetchMock, resolveFetch, resetFetchGate } = vi.hoisted(() => {
  let resolveFetchInner: (v: { ok: boolean }) => void = () => {};
  let fetchGate = new Promise<{ ok: boolean }>((r) => {
    resolveFetchInner = r;
  });
  return {
    rpc: vi.fn(),
    getSession: vi.fn(),
    fetchMock: vi.fn(() => fetchGate),
    resolveFetch: (v: { ok: boolean }) => resolveFetchInner(v),
    resetFetchGate: () => {
      fetchGate = new Promise<{ ok: boolean }>((r) => {
        resolveFetchInner = r;
      });
      fetchMock.mockImplementation(() => fetchGate);
    },
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    rpc,
    auth: { getSession },
  }),
}));
vi.mock('leaflet', () => ({ default: {} }));
vi.mock('../src/auth/config', () => ({
  SUPABASE_AUTH_ENABLED: true,
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-test',
}));

const {
  loadRoadLines,
  __resetRoadLinesCacheForTests,
  __setHereRoadsSessionMsForTests,
} = await import('../src/components/map/applyBasemap');

const roadRow = (leg: string, n = 3) => ({
  leg,
  points: Array.from({ length: n }, (_, i) => [56 + i * 0.01, 15 + i * 0.01]),
  summary: '',
});

async function waitUntil(pred: () => boolean, ms = 500): Promise<void> {
  const t0 = Date.now();
  while (!pred()) {
    if (Date.now() - t0 > ms) throw new Error('waitUntil timeout');
    await new Promise((r) => setTimeout(r, 0));
  }
}

describe('#667 F7 r6 B6 hereRoadsInFlight — mock supabase-js + sesja 0', () => {
  beforeEach(() => {
    __resetRoadLinesCacheForTests();
    __setHereRoadsSessionMsForTests(0);
    rpc.mockReset();
    getSession.mockReset();
    fetchMock.mockClear();
    resetFetchGate();
    vi.stubGlobal('fetch', fetchMock);
    let calls = 0;
    rpc.mockImplementation(async () => {
      calls += 1;
      const roads =
        calls === 1
          ? [roadRow('PL-GDN'), roadRow('SE-NYN')]
          : [
              roadRow('PL-GDN'),
              roadRow('SE-NYN'),
              roadRow('PL-GDY'),
              roadRow('SE-KAA'),
              roadRow('SE-KAA-INLAND'),
            ];
      return { data: { roads }, error: null };
    });
    getSession.mockResolvedValue({ data: { session: { access_token: 'tok' } } });
  });

  afterEach(() => {
    __setHereRoadsSessionMsForTests(5 * 60_000);
  });

  it('dwa równoległe loadRoadLines → 1× getSession + 1× POST (mutacja strażnika → 2)', async () => {
    const p1 = loadRoadLines();
    const p2 = loadRoadLines();
    await waitUntil(() => fetchMock.mock.calls.length >= 1);
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/here-roads/);
    resolveFetch({ ok: true });
    const [a, b] = await Promise.all([p1, p2]);
    // F7 r6: po Promise.all nadal 1 — bez `if (hereRoadsInFlight) return` byłoby 2.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a.length).toBeGreaterThanOrEqual(0);
    expect(b.length).toBe(a.length);
  });
});
