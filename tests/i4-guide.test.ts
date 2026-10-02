/** I-4 — instrukcje w aplikacji: komplet kroków dla 4 odbiorców × 3 języki, osadzenie w widokach tylko w buildzie produkcyjnym. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { guideSteps, type GuideRole } from '../src/components/guide/Guide';
import { I18N_ALL } from '../src/i18n/messages';

const ROLES: GuideRole[] = ['drv', 'hhl', 'ksh', 'scx'];
// DOC-ROLE (02.10): HHL +Decyzje (i4_hhl_8), KSH/SCX +panel Instrukcja (i4_*_7).
const EXPECT: Record<GuideRole, number> = { drv: 8, hhl: 8, ksh: 7, scx: 7 };

describe('I-4 treść', () => {
  for (const r of ROLES) {
    it(`${r}: ${EXPECT[r]} kroków w PL, EN i SV, bez pustych`, () => {
      for (const l of ['pl', 'en', 'sv'] as const) {
        const s = guideSteps(l, r);
        expect(s.length).toBe(EXPECT[r]);
        expect(s.every((x) => x.length > 20)).toBe(true);
        expect(I18N_ALL[l][`i4_sub_${r}`]).toBeTruthy();
      }
    });
  }
  it('EN i SV bez polskich znaków', () => {
    for (const l of ['en', 'sv'] as const) for (const r of ROLES) for (const s of guideSteps(l, r)) expect(s).not.toMatch(/[ąćęłńśźżĄĆĘŁŃŚŹŻ]/);
  });
  it('kierowca: zgoda, etapy, PROBLEM, CMR/POD, odpoczynek na promie (D-9)', () => {
    const pl = guideSteps('pl', 'drv').join(' ');
    for (const w of ['Zgadzam się', 'ZAŁADOWANY', 'NA PROMIE', 'ROZŁADOWANY', 'PROBLEM', 'CMR', 'odpoczynkiem dobowym']) expect(pl).toContain(w);
  });
});

describe('I-4 osadzenie', () => {
  const lazyRe = /const Guide = import\.meta\.env\.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED \? lazy\(\(\) => import\('\.\.\/components\/guide\/Guide'\)\) : null;/;
  it('PWA kierowcy, Opcje (HHL), Ustawienia (KSH/SCX) — leniwie, tylko build produkcyjny', () => {
    for (const f of ['src/views/DriverPwa.tsx', 'src/views/OptionsView.tsx', 'src/views/SettingsView.tsx']) expect(readFileSync(f, 'utf8')).toMatch(lazyRe);
    expect(readFileSync('src/views/DriverPwa.tsx', 'utf8')).toMatch(/role="drv"/);
    expect(readFileSync('src/views/OptionsView.tsx', 'utf8')).toMatch(/role="hhl"/);
    expect(readFileSync('src/views/SettingsView.tsx', 'utf8')).toMatch(/role === 'KSH' \? 'ksh' : role === 'SCX' \? 'scx'/);
  });
});
