/**
 * #667 F7 r3/r4 — dwa równoległe loadRoadLines → jeden POST here-roads.
 * F7 r4 uwaga 1: prawdziwe `loadRoadLines` z atrapą fetch/Supabase (nie kopia wzorca).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.fn();
const getSession = vi.fn();
const fetchMock = vi.fn();

vi.mock('../src/auth/client', () => ({
  getSupabase: async () => ({
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

const { loadRoadLines, __resetRoadLinesCacheForTests } = await import('../src/components/map/applyBasemap');

const roadRow = (leg: string, n = 3) => ({
  leg,
  points: Array.from({ length: n }, (_, i) => [56 + i * 0.01, 15 + i * 0.01]),
  summary: '',
});

describe('#667 F7 r4 hereRoadsInFlight — prawdziwe loadRoadLines', () => {
  beforeEach(() => {
    __resetRoadLinesCacheForTests();
    rpc.mockReset();
    getSession.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    // Za mało legów → POST here-roads; po POSCie pełne 5.
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
    fetchMock.mockResolvedValue({ ok: true });
  });

  it('dwa równoległe loadRoadLines → jeden POST here-roads', async () => {
    const [a, b] = await Promise.all([loadRoadLines(), loadRoadLines()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toMatch(/here-roads/);
    expect(a.length).toBeGreaterThanOrEqual(0);
    expect(b.length).toBe(a.length);
  });

  it('kolejne wołanie w oknie sesji 5 min nie powtarza POST', async () => {
    await loadRoadLines();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockClear();
    // hereRoadsSessionAt ustawione po 1. POST — drugi call wraca bez sieci.
    await loadRoadLines();
    expect(fetchMock).toHaveBeenCalledTimes(0);
  });
});
