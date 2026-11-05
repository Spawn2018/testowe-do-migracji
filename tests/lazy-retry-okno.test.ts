/**
 * #274 / F7 #511 — okno po odświeżeniu; DP-224 C / #817 B2 — na ekranie aplikacji pasek zamiast cichego reload.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { lazyRetry } from '../src/lib/lazyRetry';
import { clearNewVersionSignal, isNewVersionSignaled } from '../src/lib/newVersionSignal';

const FAIL = () => Promise.reject(new Error('Failed to fetch dynamically imported module: /assets/RisksView-x.js'));
const OK = () => Promise.resolve({ default: 'ok' });

describe('lazyRetry — okno po odświeżeniu', () => {
  let store: Map<string, string>;
  let reloads: number;
  beforeEach(() => {
    store = new Map();
    reloads = 0;
    clearNewVersionSignal();
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
    });
    vi.stubGlobal('window', {
      location: { reload: () => { reloads += 1; } },
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => true,
    });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); clearNewVersionSignal(); });

  it('DP-224 C: pierwszy błąd na ekranie → pasek (bez reload), znacznik z czasem', async () => {
    void lazyRetry(FAIL)();
    await Promise.resolve(); await Promise.resolve();
    expect(reloads).toBe(0);
    expect(isNewVersionSignaled()).toBe(true);
    expect(Number(store.get('wt_chunk_reload'))).toBeGreaterThan(1e12);
  });

  it('start/logowanie (stale=reload): pierwszy błąd → jedno odświeżenie', async () => {
    void lazyRetry(FAIL, { stale: 'reload' })();
    await Promise.resolve(); await Promise.resolve();
    expect(reloads).toBe(1);
    expect(Number(store.get('wt_chunk_reload'))).toBeGreaterThan(1e12);
  });

  it('po odświeżeniu: udane wczytanie powłoki nie zdejmuje świeżego znacznika, brakująca część → błąd (komunikat), bez drugiego odświeżenia', async () => {
    store.set('wt_chunk_reload', String(Date.now()));
    await lazyRetry(OK)();
    expect(store.has('wt_chunk_reload')).toBe(true);
    await expect(lazyRetry(FAIL)()).rejects.toThrow(/Failed to fetch/);
    expect(reloads).toBe(0);
  });

  it('po oknie 15 s udane wczytanie zdejmuje znacznik (następne wdrożenie znów z jednym sygnałem)', async () => {
    store.set('wt_chunk_reload', String(Date.now() - 16_000));
    await lazyRetry(OK)();
    expect(store.has('wt_chunk_reload')).toBe(false);
  });

  it('stara wartość „1” bez czasu nie blokuje zdjęcia znacznika', async () => {
    store.set('wt_chunk_reload', '1');
    await lazyRetry(OK)();
    expect(store.has('wt_chunk_reload')).toBe(false);
  });
});
