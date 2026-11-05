/**
 * @vitest-environment jsdom
 * DP-224 B F7 #821: TTL + pokrycie legów `spec`; mock `applyBasemap` (nie same regexy źródła).
 * Etap C2 / mapa — po cz. A (0414).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const loadRoadLines = vi.fn(async () => [] as unknown[]);
const loadRoadLegs = vi.fn(async () => ({
  legs: [
    { leg: 'PL-GDN', line: [[52.0, 17.0], [53.0, 18.0]] },
    { leg: 'SE-NYN', line: [[58.9, 17.9], [59.0, 18.0]] },
    { leg: 'PL-GDY', line: [[52.1, 17.1], [53.1, 18.1]] },
    { leg: 'SE-KAA', line: [[56.16, 15.63], [56.2, 15.7]] },
    { leg: 'SE-KAA-INLAND', line: [[56.2, 15.7], [56.3, 15.8]] },
    { leg: 'PL-TLL', line: [[52.0, 17.0], [59.4, 24.7]] },
    { leg: 'FI-HEL', line: [[60.15, 24.9], [65.8, 21.7]] },
  ],
  routeLegs: [
    { route: 'GDN-NYN', pre: 'PL-GDN', post: 'SE-NYN' },
    { route: 'GDY-KAA', pre: 'PL-GDY', post: 'SE-KAA' },
    { route: 'TLL-HEL', pre: 'PL-TLL', post: 'FI-HEL' },
    { route: 'MUU-VUO', pre: 'PL-MUU', post: 'FI-VUO' },
    { route: 'TLL-STO', pre: 'PL-TLL', post: 'SE-STO' },
    { route: 'PLD-KPS', pre: 'PL-PLD', post: 'SE-KPS' },
  ],
  roadLegCodes: [
    'PL-GDN', 'SE-NYN', 'PL-GDY', 'SE-KAA', 'SE-KAA-INLAND',
    'PL-TLL', 'FI-HEL', 'PL-MUU', 'FI-VUO', 'PL-PLD', 'SE-STO', 'SE-KPS',
  ],
}));
const loadFerryLines = vi.fn(async () => ({ lines: [] as { leg: string; line: number[][] }[], summary: null }));

vi.mock('../src/components/map/applyBasemap', () => ({
  loadRoadLines,
  loadRoadLegs,
  loadFerryLines,
  applyBasemap: vi.fn(async (_map: unknown, tiles: unknown) => tiles),
}));
vi.mock('../src/auth/config', () => ({
  SUPABASE_AUTH_ENABLED: true,
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-test',
}));

beforeAll(() => {
  const proto = (globalThis as unknown as { SVGSVGElement?: { prototype: { createSVGRect?: () => DOMRect } } })
    .SVGSVGElement?.prototype;
  if (proto && typeof proto.createSVGRect !== 'function') {
    proto.createSVGRect = () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, right: 0, bottom: 0, left: 0, toJSON() { return {}; } }) as DOMRect;
  }
  (globalThis as unknown as { CSS?: { escape?: (s: string) => string } }).CSS ??= { escape: (s: string) => s };
  Element.prototype.scrollIntoView ??= function scrollIntoView() { /* jsdom */ };
});

const { useTowerStore } = await import('../src/store/useTowerStore');
const {
  __resetMapPool, acquireMap, drawCorridorLines, LINES_CACHE_TTL_MS, NETWORK_LINES, poolStats, releaseMap,
} = await import('../src/components/map/mapPool');

let host: HTMLDivElement | null = null;

afterEach(() => {
  host?.remove();
  host = null;
  document.querySelectorAll('.leaflet-container').forEach((n) => n.remove());
  __resetMapPool();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  loadRoadLines.mockClear();
  loadRoadLegs.mockClear();
  loadFerryLines.mockClear();
});

function prodHost(): void {
  vi.stubEnv('VITE_AUTH_MODE', 'supabase');
  useTowerStore.setState({ theme: 'light' });
  host = document.createElement('div');
  host.style.cssText = 'width:900px;height:600px;position:relative';
  document.body.appendChild(host);
}

describe('DP-224 B mapPool — TTL i pokrycie legów (mock applyBasemap)', () => {
  it('dwa drawCorridorLines(load=true) → roadsLoads === 1; po TTL → 2; leg spoza puli → +1', async () => {
    prodHost();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-05T12:00:00Z'));
    const e = acquireMap(host!, 'map');
    /* build() odpala BASELINE w tle — zerujemy stan puli przed asercjami F7 */
    await drawCorridorLines(e, NETWORK_LINES, true);
    e.lines.legs = null;
    e.lines.loadedAt = null;
    e.lines.serverLegCodes = new Set();
    poolStats.roadsLoads = 0;
    loadRoadLines.mockClear();
    loadRoadLegs.mockClear();

    await drawCorridorLines(e, NETWORK_LINES, true);
    await drawCorridorLines(e, NETWORK_LINES, true);
    expect(poolStats.roadsLoads).toBe(1);
    expect(loadRoadLegs).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date(Date.now() + LINES_CACHE_TTL_MS + 1));
    await drawCorridorLines(e, NETWORK_LINES, true);
    expect(poolStats.roadsLoads).toBe(2);

    /* świeża pula bez PL-TLL / FI-HEL — karta TLL-HEL musi dociągnąć */
    e.lines.legs = (e.lines.legs ?? []).filter((l) => l.leg !== 'PL-TLL' && l.leg !== 'FI-HEL');
    e.lines.serverLegCodes = new Set([...e.lines.serverLegCodes].filter((c) => c !== 'PL-TLL' && c !== 'FI-HEL'));
    e.lines.loadedAt = Date.now();
    await drawCorridorLines(e, { routes: ['TLL-HEL'], baseline: false }, true);
    expect(poolStats.roadsLoads).toBe(3);

    releaseMap(e, 'map');
  });

  it('CorridorMap nadal bierze mapę z puli (AUD-01e)', async () => {
    const { readFileSync } = await import('node:fs');
    const comp = readFileSync('src/components/map/CorridorMap.tsx', 'utf8');
    expect(comp).toMatch(/acquireMap\(containerRef\.current, slot, linesSpecRef\.current\)/);
    expect(comp).toMatch(/releaseMap\(pooled, slot\)/);
    expect(comp).not.toMatch(/L\.map\(/);
  });
});
