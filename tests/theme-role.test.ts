import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultThemeForRole } from '../src/lib/permissions';
import { applyThemeToDom, systemTheme } from '../src/lib/theme';
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

function mockPrefersLight(light: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: light && query.includes('prefers-color-scheme: light'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

describe('Q-9 B theme: system + manual override', () => {
  beforeEach(() => {
    themeDom().reset();
    mockPrefersLight(false); // system dark by default in tests
    useTowerStore.setState({
      role: 'HHL',
      theme: 'dark',
      themeManual: false,
    });
  });

  it('defaultThemeForRole remains documented (legacy helper)', () => {
    expect(defaultThemeForRole('KSH')).toBe('light');
    expect(defaultThemeForRole('HHL')).toBe('dark');
    expect(defaultThemeForRole('SCX')).toBe('dark');
  });

  it('systemTheme follows prefers-color-scheme', () => {
    mockPrefersLight(true);
    expect(systemTheme()).toBe('light');
    mockPrefersLight(false);
    expect(systemTheme()).toBe('dark');
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

  it('setRole without themeManual applies system theme (not role)', () => {
    mockPrefersLight(true);
    useTowerStore.getState().setRole('HHL');
    expect(useTowerStore.getState().theme).toBe('light');
    expect(themeDom().getDataTheme()).toBe('light');

    mockPrefersLight(false);
    useTowerStore.getState().setRole('KSH');
    expect(useTowerStore.getState().theme).toBe('dark');
    expect(themeDom().getDataTheme()).toBe('dark');
  });

  it('themeManual sticks across setRole', () => {
    useTowerStore.getState().setTheme('dark'); // manual
    expect(useTowerStore.getState().themeManual).toBe(true);
    mockPrefersLight(true);
    useTowerStore.getState().setRole('KSH');
    expect(useTowerStore.getState().theme).toBe('dark');
    expect(themeDom().getDataTheme()).toBe('dark');
  });

  it('initTheme uses system when !themeManual', () => {
    mockPrefersLight(true);
    useTowerStore.setState({ role: 'HHL', theme: 'dark', themeManual: false });
    useTowerStore.getState().initTheme();
    expect(useTowerStore.getState().theme).toBe('light');
    expect(themeDom().getDataTheme()).toBe('light');
    expect(themeDom().hasDarkClass()).toBe(false);
  });

  it('setThemePreference(system) clears manual', () => {
    mockPrefersLight(true);
    useTowerStore.getState().setTheme('dark');
    expect(useTowerStore.getState().themeManual).toBe(true);
    useTowerStore.getState().setThemePreference('system');
    expect(useTowerStore.getState().themeManual).toBe(false);
    expect(useTowerStore.getState().theme).toBe('light');
  });
});
