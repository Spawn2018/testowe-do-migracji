import { beforeEach, describe, expect, it } from 'vitest';
import { defaultThemeForRole } from '../src/lib/permissions';
import { applyThemeToDom } from '../src/lib/theme';
import { useTowerStore } from '../src/store/useTowerStore';

type ThemeDom = {
  getDataTheme: () => string | null;
  hasDarkClass: () => boolean;
  reset: () => void;
  seedDarkClass: () => void;
};

function themeDom(): ThemeDom {
  return (globalThis as unknown as { __wtThemeDom: ThemeDom }).__wtThemeDom;
}

describe('Fala-1-D16 theme per role + data-theme only', () => {
  beforeEach(() => {
    themeDom().reset();
    useTowerStore.setState({
      role: 'HHL',
      theme: 'dark',
      themeManual: false,
    });
  });

  it('defaultThemeForRole: KSH light, HHL/SCX dark', () => {
    expect(defaultThemeForRole('KSH')).toBe('light');
    expect(defaultThemeForRole('HHL')).toBe('dark');
    expect(defaultThemeForRole('SCX')).toBe('dark');
  });

  it('applyThemeToDom sets data-theme and strips Tailwind dark class', () => {
    themeDom().seedDarkClass();
    applyThemeToDom('light');
    expect(themeDom().getDataTheme()).toBe('light');
    expect(themeDom().hasDarkClass()).toBe(false);
    applyThemeToDom('dark');
    expect(themeDom().getDataTheme()).toBe('dark');
    expect(themeDom().hasDarkClass()).toBe(false);
  });

  it('setRole without themeManual applies role default theme', () => {
    useTowerStore.getState().setRole('KSH');
    expect(useTowerStore.getState().theme).toBe('light');
    expect(themeDom().getDataTheme()).toBe('light');
    expect(themeDom().hasDarkClass()).toBe(false);

    useTowerStore.getState().setRole('HHL');
    expect(useTowerStore.getState().theme).toBe('dark');
    expect(themeDom().getDataTheme()).toBe('dark');

    useTowerStore.getState().setRole('SCX');
    expect(useTowerStore.getState().theme).toBe('dark');
    expect(themeDom().getDataTheme()).toBe('dark');
  });

  it('themeManual sticks across setRole', () => {
    useTowerStore.getState().setTheme('dark'); // manual
    expect(useTowerStore.getState().themeManual).toBe(true);
    useTowerStore.getState().setRole('KSH');
    expect(useTowerStore.getState().theme).toBe('dark');
    expect(themeDom().getDataTheme()).toBe('dark');
  });

  it('initTheme forces role default when !themeManual (stale persist paint)', () => {
    useTowerStore.setState({ role: 'KSH', theme: 'dark', themeManual: false });
    useTowerStore.getState().initTheme();
    expect(useTowerStore.getState().theme).toBe('light');
    expect(themeDom().getDataTheme()).toBe('light');
    expect(themeDom().hasDarkClass()).toBe(false);
  });
});
