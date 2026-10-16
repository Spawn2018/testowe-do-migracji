/**
 * wyglad/P10b-b — Pomoc „Jak pracuję” (E37 pkt 3, D-20261009-0015-01 „Test odbioru” pkt 1, 3, 4).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { HELP_PHONE_STEPS, HELP_VERSIONS, helpVersion, targetView } from '../src/lib/helpContent';
import { navForRole } from '../src/lib/permissions';
import type { AccountKind } from '../src/lib/cockpitE9';

const ORG: Record<AccountKind, 'HHL' | 'KSH' | 'SCX'> = {
  HHL_ADMIN: 'HHL', HHL_OPS: 'HHL', CLIENT_USER: 'KSH', CARRIER_DISPATCH: 'SCX', CARRIER_USER: 'SCX',
};
const all = (k: AccountKind) => {
  const v = helpVersion(k);
  return [v.intro, ...v.steps.flatMap((s) => [s.place, s.text])].join(' ');
};

describe('Pomoc — 5 wersji (D-20261009-0015-01)', () => {
  it('liczba kroków: 17, 13, 10, 11, 11; na telefonie +2 (KSH: 10 → 12)', () => {
    expect((Object.keys(HELP_VERSIONS) as AccountKind[]).map((k) => helpVersion(k).steps.length)).toEqual([17, 13, 10, 11, 11]);
    expect(HELP_PHONE_STEPS).toHaveLength(2);
  });

  it('każda pozycja menu bocznego roli ma krok z tym celem; menu konta ma krok „konto”', () => {
    const want: Record<AccountKind, string[]> = {
      HHL_ADMIN: ['dash', 'map', 'sched', 'risk', 'docs', 'fin', 'inv', 'wf', 'geo', 'options'],
      HHL_OPS: ['dash', 'map', 'sched', 'risk', 'docs', 'fin', 'inv', 'wf', 'geo', 'options'],
      CLIENT_USER: ['dash', 'map', 'sched', 'risk', 'docs', 'fin', 'inv'],
      CARRIER_DISPATCH: ['dash', 'map', 'sched', 'risk', 'docs', 'fin', 'inv'],
      CARRIER_USER: ['dash', 'map', 'sched', 'risk', 'docs', 'fin', 'inv'],
    };
    for (const k of Object.keys(want) as AccountKind[]) {
      const v = helpVersion(k);
      const views = new Set(v.steps.map((s) => (s.target ? targetView(s.target) : null)).filter(Boolean));
      for (const w of want[k]) expect(views.has(w as never), `${k}: ${w}`).toBe(true);
      /* menu boczne (bez Ustawień — tam prowadzi menu konta) */
      for (const n of navForRole(ORG[k], false).filter((x) => x !== 'settings')) expect(views.has(n), `${k}: menu ${n}`).toBe(true);
      expect(v.steps.some((s) => s.target === 'konto'), `${k}: konto`).toBe(true);
    }
  });

  it('KSH bez „marża”, „numer zlecenia HHL”, „Twoja stawka”; SCX bez „marża”, „Twoja cena”', () => {
    const ksh = all('CLIENT_USER').toLowerCase();
    for (const w of ['marża', 'numer zlecenia hhl', 'twoja stawka']) expect(ksh).not.toContain(w);
    for (const k of ['CARRIER_DISPATCH', 'CARRIER_USER'] as AccountKind[]) {
      const scx = all(k).toLowerCase();
      for (const w of ['marża', 'twoja cena']) expect(scx).not.toContain(w);
    }
  });

  it('G-09: bez kodów transportów, numerów telefonów, kwot i dat z danych przykładowych', () => {
    for (const k of Object.keys(HELP_VERSIONS) as AccountKind[]) {
      const x = all(k);
      expect(x).not.toMatch(/\b[A-Z]{1,2}-\d{1,3}\b/);
      expect(x).not.toMatch(/\+48|\d{3} \d{3} \d{3}/);
      expect(x).not.toMatch(/\d+[,.]?\d* ?(EUR|PLN|zł)/);
      expect(x).not.toMatch(/\b\d{2}\.\d{2}\b/);
    }
  });

  it('SCX Użytkownik — kroki dosłownie jak SCX Dyspozytor', () => {
    expect(helpVersion('CARRIER_USER').steps).toEqual(helpVersion('CARRIER_DISPATCH').steps);
  });

  it('„Instrukcja” znika z Opcji i Ustawień; „?” otwiera Pomoc (E37 pkt 3)', () => {
    for (const f of ['src/views/OptionsView.tsx', 'src/views/SettingsView.tsx']) expect(readFileSync(f, 'utf8')).not.toMatch(/components\/guide\/Guide/);
    const top = readFileSync('src/components/shell/Topbar.tsx', 'utf8');
    expect(top).toContain("import('./HelpPanel')");
    expect(top).not.toContain('KeyboardHelp');
  });
});
