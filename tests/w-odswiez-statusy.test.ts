/**
 * Właściciel 23.10.2026 13:43: „kierowca nie przełącza się automatycznie” (SG-17, SG-23) — statusy z automatu
 * zmieniały się na serwerze, a ekran pokazywał stary stan do przeładowania. Teraz: lekkie zapytanie o wersję
 * transportów (co 2 min i po powrocie do aplikacji), pełny zrzut tylko gdy się zmieniła i nie trwa własny zapis.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

let version = '2026-10-23T10:31:51Z';
const snapshots = vi.fn();
let applyImpl: () => Promise<unknown> = async () => ({});
vi.mock('../src/data/supabaseProvider', () => ({
  createSupabaseProvider: () => ({
    kind: 'supabase',
    loadSnapshot: async () => { snapshots(); const { emptySnapshot } = await import('../src/data/provider'); return emptySnapshot(); },
    loadNotifications: async () => [],
    loadsVersion: async () => version,
    loadPreferences: async () => null,
    apply: () => applyImpl(),
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

  it('zmiana statusu tuż po zalogowaniu — pierwsze sprawdzenie od razu pobiera zrzut (F7: wersja nie zerowana po starcie)', async () => {
    const noop = () => undefined;
    vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: noop, removeEventListener: noop });
    vi.stubGlobal('window', { addEventListener: noop, removeEventListener: noop });
    const b = await import('../src/data/supabaseBridge');
    version = 'v-login';
    await b.connectSupabaseData({} as never);
    snapshots.mockClear();
    version = 'v-auto';
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
    expect(br).toContain('WRITE_STUCK_MS');
  });

  it('zapis w toku wstrzymuje odświeżanie w tle; zawieszony > 2 min — już nie blokuje', async () => {
    const noop = () => undefined;
    vi.stubGlobal('document', { visibilityState: 'visible', addEventListener: noop, removeEventListener: noop });
    vi.stubGlobal('window', { addEventListener: noop, removeEventListener: noop });
    const b = await import('../src/data/supabaseBridge');
    const { writeThrough } = await import('../src/data/registry');
    version = 'w-0';
    await b.connectSupabaseData({} as never);
    snapshots.mockClear();
    applyImpl = () => new Promise(() => undefined); /* zapis, który nie wraca (sieć) */
    const t0 = Date.now();
    const now = vi.spyOn(Date, 'now').mockReturnValue(t0);
    writeThrough({ type: 'message.send', loadId: '95ab7218-69cc-490d-8b68-b379c3ed9aae' } as never);
    await new Promise((r) => setTimeout(r, 0));
    version = 'w-1';
    await b.refreshIfLoadsChanged();
    expect(snapshots).not.toHaveBeenCalled();
    now.mockReturnValue(t0 + 3 * 60_000);
    await b.refreshIfLoadsChanged();
    expect(snapshots).toHaveBeenCalledTimes(1);
    now.mockRestore();
    applyImpl = async () => ({});
    b.disconnectSupabaseData();
    vi.unstubAllGlobals();
  });
});
