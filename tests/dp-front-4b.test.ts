/**
 * B1 (F7 r1, PR #676): produkcyjna gałąź `src/lib/vesselsLoad.ts` — test zachowania zamiast regexu źródła.
 * Build supabase (VITE_AUTH_MODE=supabase i SUPABASE_AUTH_ENABLED) → loader czyta `vessels` przez dynamiczny import
 * `../data/vesselsServer`; bez SUPABASE_AUTH_ENABLED → brak loadera (paczka demo bez klienta Supabase).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const loadVesselGroups = vi.fn(async () => [{ op: 'STENA', names: ['X'] }]);

const loadModule = async (authEnabled: boolean) => {
  vi.resetModules();
  vi.stubEnv('VITE_AUTH_MODE', 'supabase');
  vi.doMock('../src/auth/config', () => ({ SUPABASE_AUTH_ENABLED: authEnabled }));
  vi.doMock('../src/data/vesselsServer', () => ({ loadVesselGroups }));
  return import('../src/lib/vesselsLoad');
};

afterEach(() => {
  vi.doUnmock('../src/auth/config');
  vi.doUnmock('../src/data/vesselsServer');
  vi.unstubAllEnvs();
  vi.resetModules();
  loadVesselGroups.mockClear();
});

describe('DP-8 · vesselsLoad: gałąź produkcyjna (supabase)', () => {
  it('VITE_AUTH_MODE=supabase i SUPABASE_AUTH_ENABLED → loader istnieje, load() woła vesselsServer.loadVesselGroups raz', async () => {
    const { vesselsLoader } = await loadModule(true);
    expect(vesselsLoader).not.toBeNull();
    expect(loadVesselGroups).not.toHaveBeenCalled();
    await vesselsLoader!.load();
    expect(loadVesselGroups).toHaveBeenCalledTimes(1);
    vesselsLoader!.reset();
  });
  it('VITE_AUTH_MODE=supabase bez SUPABASE_AUTH_ENABLED → brak loadera, vesselsServer nie jest wołany', async () => {
    const { vesselsLoader } = await loadModule(false);
    expect(vesselsLoader).toBeNull();
    expect(loadVesselGroups).not.toHaveBeenCalled();
  });
});
