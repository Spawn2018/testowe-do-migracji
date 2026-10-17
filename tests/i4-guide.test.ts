/** I-4 — instrukcja w PWA kierowcy: komplet kroków w 3 językach, osadzenie tylko w buildzie produkcyjnym.
 *  C13 (D-20261015-0300-01): stare instrukcje HHL, KSH i SCX usunięte — zastępuje je Pomoc („Jak pracuję”). */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { guideSteps, type GuideRole } from '../src/components/guide/Guide';
import { I18N_ALL } from '../src/i18n/messages';

const ROLES: GuideRole[] = ['drv'];
const EXPECT: Record<GuideRole, number> = { drv: 8 };

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
  it('kierowca: zgoda, etapy, PROBLEM, CMR z podpisem odbiorcy, odpoczynek na promie (D-9)', () => {
    const pl = guideSteps('pl', 'drv').join(' ');
    for (const w of ['Zgadzam się', 'ZAŁADOWANY', 'NA PROMIE', 'ROZŁADOWANY', 'PROBLEM', 'CMR z podpisem odbiorcy', 'Aparat / plik → CMR', 'odpoczynkiem dobowym']) expect(pl).toContain(w);
  });
  /* C13 (D-20261015-0300-01; E31, decyzja 08.10 12:14): bez POD i bez CMR z załadunku; bez starych instrukcji HHL, KSH i SCX */
  it('C13: kierowca bez POD i bez „po załadunku”; brak kluczy i4_hhl / i4_ksh / i4_scx w PL, EN i SV', () => {
    for (const l of ['pl', 'en', 'sv'] as const) {
      expect(guideSteps(l, 'drv').join(' ')).not.toMatch(/\bPOD\b/);
      expect(Object.keys(I18N_ALL[l]).filter((k) => /^i4_(?:sub_)?(?:hhl|ksh|scx)/.test(k))).toEqual([]);
    }
    expect(guideSteps('pl', 'drv').join(' ')).not.toContain('Po załadunku');
  });
});

describe('I-4 osadzenie', () => {
  const lazyRe = /const Guide = import\.meta\.env\.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED \? lazy\(lazyRetry\(\(\) => import\('\.\.\/components\/guide\/Guide'\)\)\) : null;/;
  /* wyglad/P10b-b (E37 pkt 3, P10b „Testy do przepisania: i4-guide”): Instrukcja tylko w PWA kierowcy;
     w Opcjach i Ustawieniach zastępuje ją Pomoc („Jak pracuję” w 5 wersjach) — tests/help-content.test.ts */
  it('PWA kierowcy — leniwie, tylko build produkcyjny; Opcje i Ustawienia bez Instrukcji', () => {
    expect(readFileSync('src/views/DriverPwa.tsx', 'utf8')).toMatch(lazyRe);
    expect(readFileSync('src/views/DriverPwa.tsx', 'utf8')).toMatch(/role="drv"/);
    for (const f of ['src/views/OptionsView.tsx', 'src/views/SettingsView.tsx']) expect(readFileSync(f, 'utf8')).not.toMatch(lazyRe);
  });
});
