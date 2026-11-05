/**
 * wyglad/P10a-a (E22): teksty paska nowej wersji, „na żywo”, komunikatu zamiast pustej strony — bez „sms:”,
 * „mailto:”, „supabase” (I-2); produkcja przed podłączeniem: bez paska i bez znacznika.
 */
import { describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { A10_PL, a10 } from '../src/i18n/p10a';

describe('E22 — teksty', () => {
  it('pasek, znacznik, komunikat', () => {
    expect(a10('a10_live', { t: '02:45' })).toBe('na żywo · 02:45');
    expect(a10('a10_off', { t: '02:41' })).toBe('brak połączenia od 02:41');
    expect(A10_PL.a10_new_btn).toBe('Odśwież teraz');
    const all = Object.values(A10_PL).join('\n').toLowerCase();
    for (const bad of ['sms:', 'mailto:', 'supabase']) expect(all).not.toContain(bad);
  });
  it('produkcja: bez sygnału — bez paska; „na żywo” nadal null do podłączenia Realtime', async () => {
    /* DP-224 C / #817 B2 / E22: pasek w PROD po sygnale lazyRetry; bez sygnału jak dotąd false. */
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    try {
      vi.resetModules();
      const src = await import('../src/lib/p10aSource');
      const probe = () => {
        const on = src.useNewVersion();
        const live = src.useLive();
        return createElement('i', null, `${on}|${live === null}`);
      };
      expect(renderToString(createElement(probe))).toContain('false|true');
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it('produkcja: sygnał chunk → pasek nowej wersji', async () => {
    vi.stubEnv('VITE_AUTH_MODE', 'supabase');
    try {
      vi.resetModules();
      const sig = await import('../src/lib/newVersionSignal');
      sig.signalNewVersion('chunk');
      const src = await import('../src/lib/p10aSource');
      const probe = () => createElement('i', null, String(src.useNewVersion()));
      expect(renderToString(createElement(probe))).toContain('true');
      sig.clearNewVersionSignal();
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});

