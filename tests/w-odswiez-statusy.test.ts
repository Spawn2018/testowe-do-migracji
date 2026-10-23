/**
 * Właściciel 23.10.2026 13:43: „kierowca nie przełącza się automatycznie” (SG-17, SG-23) — statusy z automatu
 * zmieniały się na serwerze, a ekran pokazywał stary stan do przeładowania. Teraz: lekkie zapytanie o wersję
 * transportów (co 2 min i po powrocie do aplikacji), pełny zrzut tylko gdy się zmieniła i nie trwa własny zapis.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

let version = '2026-10-23T10:31:51Z';
const snapshots = vi.fn();
vi.mock('../src/data/supabaseProvider', () => ({
  createSupabaseProvider: () => ({
    kind: 'supabase',
    loadSnapshot: async () => { snapshots(); const { emptySnapshot } = await import('../src/data/provider'); return emptySnapshot(); },
    loadNotifications: async () => [],
    loadsVersion: async () => version,
    loadPreferences: async () => null,
    apply: async () => ({}),
    context: () => ({ orgs: [], projectId: null }),
  }),
}));
vi.mock('../src/data/storageFiles', () => ({ createStorageSink: () => ({}) }));

describe('W-odswiez-statusy — statusy z automatu bez przeładowania', () => {
  beforeEach(() => { snapshots.mockClear(); });

  it('bez zmiany wersji — bez zrzutu; po zmianie (automat zmienił status) — jeden zrzut', async () => {
    const noop = () => undefined;
    vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: noop, removeEventListener: noop });
    vi.stubGlobal('window', { addEventListener: noop, removeEventListener: noop });
    const b = await import('../src/data/supabaseBridge');
    await b.connectSupabaseData({} as never);
    expect(snapshots).toHaveBeenCalledTimes(1);
    snapshots.mockClear();
    await b.refreshIfLoadsChanged();
    expect(snapshots).not.toHaveBeenCalled();
    version = '2026-10-23T10:36:54Z';
    await b.refreshIfLoadsChanged();
    expect(snapshots).toHaveBeenCalledTimes(1);
    await b.refreshIfLoadsChanged();
    expect(snapshots).toHaveBeenCalledTimes(1);
    b.disconnectSupabaseData();
    vi.unstubAllGlobals();
  });

  it('w kodzie: co 2 min przy widocznej karcie i przy powrocie do aplikacji; nie w trakcie własnego zapisu', async () => {
    const { readFileSync } = await import('node:fs');
    const br = readFileSync(new URL('../src/data/supabaseBridge.ts', import.meta.url), 'utf8');
    expect(br).toContain('const LIVE_EVERY_MS = 2 * 60_000;');
    expect(br).toContain('void refreshIfLoadsChanged().catch(() => undefined);');
    expect(br).toContain('if (writesPending > 0) return;');
  });
});
