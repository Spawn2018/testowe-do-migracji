/**
 * @vitest-environment jsdom
 * DP-224 B (#817): po wczytaniu legów kolejne drawCorridorLines(load=true) nie woła applyBasemap.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const loadRoadLines = vi.fn(async () => [[ [54, 18], [55, 19] ] as [number, number][]]);
const loadRoadLegs = vi.fn(async () => ({
  legs: [{ leg: 'PL-GDN', line: [[54, 18], [55, 19]] as [number, number][] }],
  routeLegs: [] as { route: string; pre: string | null; post: string | null }[],
}));
const loadFerryLines = vi.fn(async () => ({ lines: [] as { leg: string; line: [number, number][] }[], summary: '' }));

vi.mock('../src/components/map/applyBasemap', async () => {
  const actual = await vi.importActual<typeof import('../src/components/map/applyBasemap')>('../src/components/map/applyBasemap');
  return { ...actual, loadRoadLines, loadRoadLegs, loadFerryLines };
});

vi.stubEnv('VITE_AUTH_MODE', 'supabase');

const spies: { mockRestore: () => void }[] = [];
const {
  __resetMapPool, acquireMap, drawCorridorLines, NETWORK_LINES, poolStats, releaseMap,
} = await import('../src/components/map/mapPool');

beforeEach(() => {
  spies.push(vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800));
  spies.push(vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600));
});

afterEach(() => {
  for (const s of spies.splice(0)) s.mockRestore();
  document.querySelectorAll('.leaflet-container, [data-map-pool]').forEach((n) => n.remove());
  __resetMapPool();
  loadRoadLines.mockClear();
  loadRoadLegs.mockClear();
  loadFerryLines.mockClear();
});

describe('DP-224 B jsdom — reuse puli bez drugiego roadsLoads', () => {
  it('po wczytaniu legów: drugie load=true bez sieci; release+acquire reuse mapy', async () => {
    const a = document.createElement('div');
    document.body.appendChild(a);
    const e1 = acquireMap(a, 'kokpit', NETWORK_LINES);
    e1.map.setView([58.5, 18.5], 4.2, { animate: false });
    e1.map.invalidateSize({ animate: false });
    await vi.waitFor(() => {
      expect(e1.lines.legs).not.toBeNull();
    });
    expect(poolStats.created).toBe(1);
    expect(poolStats.roadsLoads).toBe(1);
    expect(loadRoadLines).toHaveBeenCalledTimes(1);

    await drawCorridorLines(e1, NETWORK_LINES, true);
    expect(poolStats.roadsLoads).toBe(1);
    expect(loadRoadLines).toHaveBeenCalledTimes(1);

    releaseMap(e1, 'kokpit');
    const b = document.createElement('div');
    document.body.appendChild(b);
    const e2 = acquireMap(b, 'map', NETWORK_LINES);
    expect(poolStats.created).toBe(1);
    expect(poolStats.reused).toBeGreaterThanOrEqual(1);
    expect(e2.map).toBe(e1.map);

    await drawCorridorLines(e2, NETWORK_LINES, true);
    expect(poolStats.roadsLoads).toBe(1);
    expect(loadRoadLines).toHaveBeenCalledTimes(1);
  });
});
