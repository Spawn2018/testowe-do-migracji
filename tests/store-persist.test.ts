import { beforeEach, describe, expect, it } from 'vitest';
import {
  STORE_PERSIST_KEY,
  STORE_SCHEMA_VERSION,
  STORE_WIPE_FLAG_KEY,
  STORE_WIPE_MESSAGE_PL,
  consumePersistWipeNotice,
  isCorruptPersistSlice,
  migrateTowerPersist,
  pickPersistSlice,
} from '../src/lib/storePersist';
import { useTowerStore } from '../src/store/useTowerStore';

function clearDomStorage() {
  localStorage.clear();
  sessionStorage.clear();
}

describe('D22 storePersist pure migrator', () => {
  beforeEach(() => {
    clearDomStorage();
  });

  it('old v0 → v1 migrates useful fields (no wipe)', () => {
    const legacy = {
      role: 'KSH',
      locale: 'en',
      theme: 'light',
      themeManual: true,
      loads: [{ id: 'L1', code: 'X' }],
      junkIgnored: true,
    };
    const r = migrateTowerPersist(legacy, 0);
    expect(r.wiped).toBe(false);
    expect(r.state.role).toBe('KSH');
    expect(r.state.locale).toBe('en');
    expect(r.state.themeManual).toBe(true);
    /* v4 (W-demo, audyt 17.10 N6): stare dane startowe demo odrzucone — wracają dane z dniem demo 23.09 */
    expect(r.state).not.toHaveProperty('loads');
    expect(r.state).not.toHaveProperty('junkIgnored');
    expect(sessionStorage.getItem(STORE_WIPE_FLAG_KEY)).toBeNull();
  });

  it('already at current schema version keeps fields (no wipe)', () => {
    const cur = { role: 'SCX', theme: 'dark', themeManual: false, loads: [] };
    const r = migrateTowerPersist(cur, STORE_SCHEMA_VERSION);
    expect(r.wiped).toBe(false);
    expect(r.state.role).toBe('SCX');
    expect(r.state.loads).toEqual([]);
  });

  it('corrupt / missing root → wipe flag + empty slice', () => {
    for (const bad of [null, undefined, 'x', 1, [], { loads: 'nope' }, { role: 'ADMIN' }]) {
      clearDomStorage();
      const r = migrateTowerPersist(bad, 0);
      expect(r.wiped).toBe(true);
      expect(r.reason).toBe('corrupt');
      expect(r.state).toEqual({});
      expect(sessionStorage.getItem(STORE_WIPE_FLAG_KEY)).toBe('1');
    }
  });

  it('unsupported future version → wipe', () => {
    const r = migrateTowerPersist({ role: 'HHL' }, STORE_SCHEMA_VERSION + 9);
    expect(r.wiped).toBe(true);
    expect(r.reason).toBe('unsupported-future');
    expect(r.state).toEqual({});
  });

  it('consumePersistWipeNotice is one-shot', () => {
    sessionStorage.setItem(STORE_WIPE_FLAG_KEY, '1');
    expect(consumePersistWipeNotice()).toBe(true);
    expect(consumePersistWipeNotice()).toBe(false);
    expect(STORE_WIPE_MESSAGE_PL).toMatch(/Przywrócono dane startowe/);
  });

  it('pickPersistSlice / isCorruptPersistSlice helpers', () => {
    expect(isCorruptPersistSlice({ loads: [] })).toBe(false);
    expect(isCorruptPersistSlice({ loads: {} })).toBe(true);
    expect(pickPersistSlice({ role: 'HHL', extra: 1 })).toEqual({ role: 'HHL' });
  });
});

describe('D22 zustand rehydrate paths', () => {
  beforeEach(async () => {
    clearDomStorage();
    useTowerStore.persist.clearStorage();
    // reset mutable UI bits; keep seed loads from initial state after rehydrate
    useTowerStore.setState({
      role: 'HHL',
      locale: 'pl',
      theme: 'dark',
      themeManual: false,
      toasts: [],
    });
    await useTowerStore.persist.rehydrate();
  });

  it('rehydrate v0 legacy storage migrates and bumps version to schema', async () => {
    const seedLoadsLen = useTowerStore.getState().loads.length;
    localStorage.setItem(
      STORE_PERSIST_KEY,
      JSON.stringify({
        state: {
          role: 'KSH',
          locale: 'sv',
          theme: 'light',
          themeManual: true,
          loads: [{ id: 'kept-load', code: 'KEEP' }],
        },
        version: 0,
      }),
    );
    await useTowerStore.persist.rehydrate();
    const s = useTowerStore.getState();
    expect(s.role).toBe('KSH');
    expect(s.locale).toBe('sv');
    expect(s.themeManual).toBe(true);
    /* v4 (W-demo, audyt 17.10 N6): zapisane stare transporty demo nie przykrywają danych startowych */
    expect(s.loads.some((l) => l.id === 'kept-load')).toBe(false);
    expect(s.loads.length).toBe(seedLoadsLen);
    expect(seedLoadsLen).toBeGreaterThan(0);

    const raw = JSON.parse(localStorage.getItem(STORE_PERSIST_KEY)!);
    expect(raw.version).toBe(STORE_SCHEMA_VERSION);
    expect(raw.state.role).toBe('KSH');
  });

  it('rehydrate already-new version leaves state and does not wipe', async () => {
    localStorage.setItem(
      STORE_PERSIST_KEY,
      JSON.stringify({
        state: { role: 'SCX', locale: 'en', themeManual: true, theme: 'dark' },
        version: STORE_SCHEMA_VERSION,
      }),
    );
    await useTowerStore.persist.rehydrate();
    expect(useTowerStore.getState().role).toBe('SCX');
    expect(useTowerStore.getState().locale).toBe('en');
    expect(sessionStorage.getItem(STORE_WIPE_FLAG_KEY)).toBeNull();
  });

  it('rehydrate corrupt storage wipes to seed defaults and flags notice', async () => {
    const seedRole = 'HHL';
    useTowerStore.setState({ role: seedRole, toasts: [] });
    localStorage.setItem(
      STORE_PERSIST_KEY,
      JSON.stringify({ state: { loads: 'broken', role: 'HHL' }, version: 0 }),
    );
    await useTowerStore.persist.rehydrate();
    // migrate returns {} → shallow merge keeps in-memory seed (role HHL from before merge… actually merge uses get() at hydrate time)
    expect(Array.isArray(useTowerStore.getState().loads)).toBe(true);
    expect(useTowerStore.getState().loads.length).toBeGreaterThan(0);
    // wipe flag consumed in onRehydrate → toast queued
    await new Promise((r) => setTimeout(r, 0));
    const toasts = useTowerStore.getState().toasts;
    expect(toasts.some((t) => t.message === STORE_WIPE_MESSAGE_PL)).toBe(true);
  });

  it('rehydrate missing storage (null) keeps seed — no wipe toast', async () => {
    localStorage.removeItem(STORE_PERSIST_KEY);
    useTowerStore.setState({ toasts: [] });
    await useTowerStore.persist.rehydrate();
    await new Promise((r) => setTimeout(r, 0));
    expect(useTowerStore.getState().toasts.some((t) => t.message === STORE_WIPE_MESSAGE_PL)).toBe(
      false,
    );
    expect(useTowerStore.getState().loads.length).toBeGreaterThan(0);
  });
});
