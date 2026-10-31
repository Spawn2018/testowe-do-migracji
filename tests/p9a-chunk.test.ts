/**
 * wyglad/P9-a (E22 w E24-1) — plik aplikacji z podkładem się nie pobrał (karta sprzed wdrożenia): 3 próby po 1 s i 2 s,
 * potem komunikat z przyczyną „chunk”; wcześniej mapa zostawała szara do odświeżenia (`tilesTheme` ustawiony przed
 * importem). Leaflet i plik podkładu podmienione — w demo plik jest w kawałku mapy, więc e2e tego nie wywoła.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('leaflet', () => ({ default: {} }));
vi.mock('../src/components/map/fallbackTiles', () => {
  throw new Error('Failed to fetch dynamically imported module: /assets/fallbackTiles-old.js');
});

describe('P9-a · plik z podkładem (E22)', () => {
  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });
  it('3 nieudane pobrania = „failed” z przyczyną „chunk”, zgłoszenie (demo) zapisane', async () => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_AUTH_MODE', 'demo');
    const { ensureBasemap, subscribeBasemapHealth } = await import('../src/components/map/mapPool') as unknown as {
      ensureBasemap: (e: unknown, theme: string) => Promise<unknown>;
      subscribeBasemapHealth: (e: unknown, fn: (h: { state: string; tries: number; cause: string; reported: boolean }) => void) => () => void;
    };
    const tiles = {};
    const e = {
      map: { getContainer: () => ({ dataset: {} }) },
      el: {}, pooled: true, tilesTheme: null, lanesTheme: 'light', tilesLoaded: false, basemapSeq: 0, views: new Map(),
      layers: { tiles, ferryLeg: { eachLayer() { /* DP-76: pusta warstwa promu */ } } },
      health: { state: 'loading', tries: 0, via: 'fallback', reported: false, cause: 'tiles' },
      healthSubs: new Set(), unwatch: null, chunkFails: 0, slot: 'map',
    };
    const seen: Array<{ state: string; tries: number; cause: string; reported: boolean }> = [];
    subscribeBasemapHealth(e, (h) => seen.push({ ...h }));
    await expect(ensureBasemap(e, 'light')).resolves.toBe(tiles);
    expect(e.tilesTheme).toBeNull();
    expect(seen.at(-1)).toMatchObject({ state: 'loading', tries: 1, cause: 'chunk' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(seen.at(-1)).toMatchObject({ state: 'loading', tries: 2, cause: 'chunk' });
    await vi.advanceTimersByTimeAsync(2000);
    expect(seen.at(-1)).toMatchObject({ state: 'failed', tries: 3, cause: 'chunk' });
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.at(-1)).toMatchObject({ state: 'failed', reported: true });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(seen.filter((h) => h.state === 'failed' && !h.reported)).toHaveLength(1);
    expect(e.tilesTheme).toBeNull();
  });
});
