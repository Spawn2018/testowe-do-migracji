/**
 * B5 (0249, D-20261019-1525-01) — Podgląd KSH / SCX zapisany w bazie.
 * Przełącznik w produkcji woła admin_preview_start / admin_preview_stop; w Podglądzie widok jest tylko do odczytu,
 * a prawo przełączania ma prawdziwy administrator (real_role). „Działaj jako” (zapis) nie daje przełącznika.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { setAuthProfile, type AuthProfile } from '../src/auth/profile';
import { canSwitchView, dbPreviewOn, isPreviewReadOnly, switchRoleOf } from '../src/lib/prodFacade';
import { previewErrorPl, readPreviewRo, switchViewRole } from '../src/auth/previewSwitch';
import { useTowerStore } from '../src/store/useTowerStore';

const base: AuthProfile = {
  user_id: 'u1', email: 'a@x', full_name: 'Anna Nowak', role: 'CLIENT_USER', org_code: 'KSH', org_name: 'KSH',
  locale: 'pl', active: true,
};
const preview: AuthProfile = { ...base, acting_as: true, preview_ro: true, real_role: 'HHL_ADMIN' };
const actAs: AuthProfile = { ...base, acting_as: true, preview_ro: false, real_role: 'HHL_ADMIN' };

afterEach(() => setAuthProfile(null));

describe('B5 — stan Podglądu z bazy', () => {
  it('Podgląd = acting_as i read_only; „Działaj jako” to nie Podgląd', () => {
    expect(dbPreviewOn(preview)).toBe(true);
    expect(dbPreviewOn(actAs)).toBe(false);
    expect(dbPreviewOn(base)).toBe(false);
    expect(dbPreviewOn(null)).toBe(false);
  });

  it('przełącznik w Podglądzie widzi tylko Administrator HHL (real_role), nie konto oglądane', () => {
    expect(switchRoleOf(preview)).toBe('HHL_ADMIN');
    setAuthProfile(preview);
    expect(canSwitchView(true)).toBe(true);
    setAuthProfile({ ...preview, real_role: 'HHL_OPS' });
    expect(canSwitchView(true)).toBe(false);
    setAuthProfile(actAs);
    expect(canSwitchView(true)).toBe(false);
    setAuthProfile(base);
    expect(canSwitchView(true)).toBe(false);
    setAuthProfile({ ...base, role: 'HHL_ADMIN', org_code: 'HHL' });
    expect(canSwitchView(true)).toBe(true);
  });

  it('Podgląd w bazie jest tylko do odczytu także gdy widok = firma oglądanego konta', () => {
    expect(isPreviewReadOnly({ prod: true, viewRole: 'KSH', orgCode: 'KSH', dbPreview: true })).toBe(true);
    expect(isPreviewReadOnly({ prod: true, viewRole: 'KSH', orgCode: 'KSH', dbPreview: false })).toBe(false);
    expect(isPreviewReadOnly({ prod: false, viewRole: 'KSH', orgCode: 'HHL', dbPreview: true })).toBe(false);
    setAuthProfile(preview);
    expect(isPreviewReadOnly({ prod: true, viewRole: 'KSH', orgCode: 'KSH' })).toBe(true);
  });
});

describe('B5 — przełączanie funkcjami bazy', () => {
  const mk = (error: { message: string } | null = null) => vi.fn(async () => ({ data: null, error }));

  it('KSH / SCX → admin_preview_start z p_side, potem przeładowanie profilu i danych', async () => {
    const call = mk(); const reload = vi.fn();
    expect(await switchViewRole('KSH', { prod: true, call, reload, dbPreview: false })).toBeNull();
    expect(call).toHaveBeenCalledWith('admin_preview_start', { p_side: 'KSH' });
    expect(reload).toHaveBeenCalledTimes(1);
    await switchViewRole('SCX', { prod: true, call, reload, dbPreview: true });
    expect(call).toHaveBeenLastCalledWith('admin_preview_start', { p_side: 'SCX' });
  });

  it('HHL w Podglądzie → admin_preview_stop; HHL bez Podglądu → tylko widok, bez bazy', async () => {
    const call = mk(); const reload = vi.fn();
    await switchViewRole('HHL', { prod: true, call, reload, dbPreview: true });
    expect(call).toHaveBeenCalledWith('admin_preview_stop');
    expect(reload).toHaveBeenCalledTimes(1);
    const call2 = mk(); const reload2 = vi.fn();
    await switchViewRole('HHL', { prod: true, call: call2, reload: reload2, dbPreview: false });
    expect(call2).not.toHaveBeenCalled();
    expect(reload2).not.toHaveBeenCalled();
    expect(useTowerStore.getState().role).toBe('HHL');
  });

  it('odmowa bazy → komunikat zdaniem, widok bez zmian, bez przeładowania', async () => {
    useTowerStore.getState().setRole('HHL');
    const call = mk({ message: 'Tylko administrator HHL (z 2FA gdy wymagane)' }); const reload = vi.fn();
    const msg = await switchViewRole('KSH', { prod: true, call, reload, dbPreview: false });
    expect(msg).toBe('Podgląd może włączyć tylko Administrator HHL z weryfikacją dwuetapową.');
    expect(reload).not.toHaveBeenCalled();
    expect(useTowerStore.getState().role).toBe('HHL');
    expect(useTowerStore.getState().toasts.some((t) => t.message === msg)).toBe(true);
  });

  it('demo bez logowania: przełącznik zmienia tylko widok', async () => {
    const call = mk(); const reload = vi.fn();
    await switchViewRole('SCX', { prod: false, call, reload });
    expect(call).not.toHaveBeenCalled();
    expect(useTowerStore.getState().role).toBe('SCX');
    useTowerStore.getState().setRole('HHL');
  });

  it('komunikaty bazy po polsku', () => {
    expect(previewErrorPl('Brak aktywnego konta SCX do Podglądu')).toBe('Podgląd SCX niedostępny — brak aktywnego konta SCX.');
    expect(previewErrorPl('Could not find the function public.admin_preview_start')).toBe('Podgląd będzie dostępny po aktualizacji bazy.');
  });

  it('read_only czyta is_preview_read_only; błąd = brak Podglądu', async () => {
    expect(await readPreviewRo(vi.fn(async () => ({ data: true, error: null })))).toBe(true);
    expect(await readPreviewRo(vi.fn(async () => ({ data: null, error: { message: 'x' } })))).toBe(false);
  });

  it('ekrany przełączają przez switchViewRole; pasek „Działasz jako” nie dubluje paska Podglądu', () => {
    for (const f of ['src/components/shell/Topbar.tsx', 'src/components/shell/AccountMenu.tsx', 'src/App.tsx', 'src/auth/PreviewBanner.tsx']) {
      expect(readFileSync(f, 'utf8')).toContain('switchViewRole(');
    }
    expect(readFileSync('src/auth/ImpersonationBanner.tsx', 'utf8')).toContain('me.preview_ro');
    expect(readFileSync('src/auth/AuthGate.tsx', 'utf8').match(/readPreviewRo\(\)/g)?.length).toBe(2);
  });
});
