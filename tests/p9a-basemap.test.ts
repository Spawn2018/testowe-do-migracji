/**
 * wyglad/P9-a (E24-1) — komunikat zamiast szarej mapy: liczenie prób podkładu, teksty z makiety `raport/img/e24-after`,
 * zgłoszenie dla HHL tylko gdy zapisane, plik aplikacji z podkładem (E22) z 3 próbami.
 */
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TILE_RETRY_MS, TILE_TRIES, tileVia, watchTiles, type TileHealth } from '../src/components/map/tileHealth';
import { p9, p9p } from '../src/i18n/p9a';

type Handler = (...args: unknown[]) => void;
function fakeLayer() {
  const handlers = new Map<string, Set<Handler>>();
  let redraws = 0;
  return {
    on(type: string, fn: Handler) { if (!handlers.has(type)) handlers.set(type, new Set()); handlers.get(type)!.add(fn); },
    off(type: string, fn: Handler) { handlers.get(type)?.delete(fn); },
    redraw() { redraws += 1; },
    fire(type: string) { for (const fn of handlers.get(type) ?? []) fn(); },
    get redraws() { return redraws; },
    count(type: string) { return handlers.get(type)?.size ?? 0; },
  };
}
/** Jeden przebieg kafelków: `ok` z obrazem, `err` z błędem. */
function pass(l: ReturnType<typeof fakeLayer>, ok: number, err: number) {
  l.fire('loading');
  for (let i = 0; i < ok; i++) l.fire('tileload');
  for (let i = 0; i < err; i++) l.fire('tileerror');
  l.fire('load');
}
function timers() {
  const queue: Array<{ fn: () => void; ms: number }> = [];
  return {
    setTimer: (fn: () => void, ms: number) => { queue.push({ fn, ms }); return queue.length; },
    clearTimer: () => {},
    run() { const q = queue.splice(0); for (const t of q) t.fn(); return q.map((t) => t.ms); },
  };
}

describe('P9-a · próby podkładu (tileHealth)', () => {
  it('3 przebiegi bez kafelka = „failed”; ponowienia po 1 s i 2 s', () => {
    const l = fakeLayer();
    const tm = timers();
    const seen: TileHealth[] = [];
    watchTiles(l, (h) => seen.push(h), tm);
    pass(l, 0, 6);
    expect(seen.at(-1)).toEqual({ state: 'loading', tries: 1 });
    expect(tm.run()).toEqual([TILE_RETRY_MS(1)]);
    expect(l.redraws).toBe(1);
    pass(l, 0, 6);
    expect(seen.at(-1)).toEqual({ state: 'loading', tries: 2 });
    expect(tm.run()).toEqual([2000]);
    expect(l.redraws).toBe(2);
    pass(l, 0, 6);
    expect(seen.at(-1)).toEqual({ state: 'failed', tries: TILE_TRIES });
    expect(tm.run()).toEqual([]);
    expect(l.redraws).toBe(2);
  });

  it('pierwszy kafelek z obrazem = „ok” (komunikat znika), także po „failed” (przesunięcie mapy)', () => {
    const l = fakeLayer();
    const tm = timers();
    const seen: TileHealth[] = [];
    watchTiles(l, (h) => seen.push(h), tm);
    pass(l, 0, 4); tm.run(); pass(l, 0, 4); tm.run(); pass(l, 0, 4);
    expect(seen.at(-1)?.state).toBe('failed');
    pass(l, 1, 3);
    expect(seen.at(-1)).toEqual({ state: 'ok', tries: 0 });
  });

  it('przebieg z częścią kafelków = podkład jest; przebieg bez błędów i bez kafelków nie liczy się jako próba', () => {
    const l = fakeLayer();
    const tm = timers();
    const seen: TileHealth[] = [];
    watchTiles(l, (h) => seen.push(h), tm);
    pass(l, 0, 0);
    expect(seen).toEqual([]);
    pass(l, 2, 5);
    expect(seen).toEqual([{ state: 'ok', tries: 0 }]);
    expect(l.redraws).toBe(0);
  });

  it('po „ok” utrata sieci liczy próby od nowa', () => {
    const l = fakeLayer();
    const tm = timers();
    const seen: TileHealth[] = [];
    watchTiles(l, (h) => seen.push(h), tm);
    pass(l, 3, 0);
    pass(l, 0, 3);
    expect(seen.at(-1)).toEqual({ state: 'loading', tries: 1 });
  });

  it('zatrzymanie zdejmuje słuchaczy i nie rysuje warstwy po zamknięciu', () => {
    const l = fakeLayer();
    const tm = timers();
    const stop = watchTiles(l, () => {}, tm);
    pass(l, 0, 2);
    stop();
    tm.run();
    expect(l.redraws).toBe(0);
    for (const ev of ['loading', 'tileload', 'tileerror', 'load']) expect(l.count(ev)).toBe(0);
  });

  it('droga prób z `data-tile-path` mapy', () => {
    expect(tileVia('here-direct')).toBe('here-both');
    expect(tileVia('proxy')).toBe('here-proxy');
    expect(tileVia('fallback')).toBe('fallback');
    expect(tileVia(undefined)).toBe('fallback');
  });
});

describe('P9-a · teksty z makiety E24 (raport/img/e24-after)', () => {
  it('komputer: tytuł, zdanie, dwa przyciski, przypis', () => {
    expect(p9('pl', 'p9a_title')).toBe('Nie udało się wczytać podkładu mapy');
    expect(p9('pl', 'p9a_body')).toBe('Pozycje i trasa są aktualne. Brakuje tylko tła z ulicami.');
    expect(p9('pl', 'p9a_retry')).toBe('Spróbuj ponownie');
    expect(p9('pl', 'p9a_reload')).toBe('Odśwież stronę');
    expect(p9p('pl', 'p9a_tried', { n: 3, via: p9('pl', 'p9a_via_here_both') }))
      .toBe('Próbowano 3 razy: HERE wprost i przez serwer aplikacji.');
    expect(p9('pl', 'p9a_reported')).toBe('Zgłoszenie zapisane dla HHL.');
  });
  it('telefon: krótko', () => {
    expect(p9('pl', 'p9a_title_short')).toBe('Nie udało się wczytać podkładu');
    expect(p9('pl', 'p9a_body_short')).toBe('Pozycje i trasa są aktualne.');
  });
  it('bez kodów transportów i bez nazw z danych przykładowych (I-0)', () => {
    const src = readFileSync('src/i18n/p9a.ts', 'utf8');
    expect(src).not.toMatch(/SG-\d|WGM|GD0/);
  });
});

describe('P9-a · zgłoszenie dla HHL (p9aSource)', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
  it('demo: zapisane (przykład z makiety)', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'demo');
    const { reportBasemapFailure } = await import('../src/lib/p9aSource');
    await expect(reportBasemapFailure({ via: 'fallback', tries: 3, slot: 'map', cause: 'tiles' })).resolves.toBe(true);
  });
  it('produkcja: nie zapisane, dopóki Cursor nie podepnie zapisu — zdanie ukryte', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    const { reportBasemapFailure } = await import('../src/lib/p9aSource');
    await expect(reportBasemapFailure({ via: 'here-both', tries: 3, slot: 'map', cause: 'tiles' })).resolves.toBe(false);
  });
});

describe('P9-a · podpięcie w mapie (źródło)', () => {
  const pool = readFileSync('src/components/map/mapPool.ts', 'utf8');
  const comp = readFileSync('src/components/map/CorridorMap.tsx', 'utf8');
  const card = readFileSync('src/components/map/BasemapFailCard.tsx', 'utf8');
  it('każda nowa warstwa podkładu jest obserwowana; plik z podkładem (E22): 3 próby, potem komunikat', () => {
    expect(pool).toMatch(/e\.unwatch = watchTiles\(layer/);
    expect(pool).toMatch(/\}, onChunkFail\);\n  \}\n  return import\('\.\/applyBasemap'\)/);
    expect(pool).toMatch(/if \(e\.chunkFails >= TILE_TRIES\)/);
    expect(pool).toMatch(/e\.tilesTheme = null;\n    e\.chunkFails \+= 1;/);
  });
  it('jedno zgłoszenie na epizod awarii; „Spróbuj ponownie” zakłada podkład od nowa', () => {
    expect(pool).toMatch(/if \(next\.state === 'failed' && prev\.state !== 'failed'\)/);
    expect(pool).toMatch(/export function retryBasemap\(e: PoolEntry\): void \{\n  e\.tilesTheme = null;/);
  });
  it('karta tylko przy „failed” (albo w trakcie ręcznej próby); „Odśwież stronę” przeładowuje', () => {
    expect(comp).toMatch(/health\.state === 'failed' \|\| \(retrying && health\.state === 'loading'\)/);
    expect(comp).toMatch(/onReload=\{\(\) => window\.location\.reload\(\)\}/);
    expect(card).toMatch(/health\.reported \?/);
  });
});
