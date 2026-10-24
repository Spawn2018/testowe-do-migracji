// wyglad/C-reszta (D-20261015-0300-01 G): E41 nazwy w Kokpicie, Finansach, oknie „Dopłata”, na Mapie;
// E9/E12 „Dla mnie” zamiast „Ustawień” u KSH i SCX; E20 pkt 2 poniżej 1440 px; E6 pasek „Uzupełnij telefon”.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { needsPhone } from '../src/components/shell/PhoneMissingBar';
import { t } from '../src/i18n/messages';

const read = (p: string) => readFileSync(p, 'utf8');

describe('E6: pasek „Uzupełnij telefon”', () => {
  it('brak telefonu albo numer nie w formacie międzynarodowym → pasek', () => {
    expect(needsPhone({ phone: null, real_user_id: null })).toBe(true);
    expect(needsPhone({ phone: '000000001', real_user_id: null })).toBe(true);
    expect(needsPhone({ phone: '+48000000001', real_user_id: null })).toBe(false);
  });
  it('bez profilu (demo) i przy „Działaj jako” — bez paska', () => {
    expect(needsPhone(null)).toBe(false);
    expect(needsPhone({ phone: null, real_user_id: 'admin' })).toBe(false);
  });
  it('pasek pod paskiem górnym, „Uzupełnij” otwiera Moje konto', () => {
    expect(read('src/TowerShell.tsx')).toMatch(/<PhoneMissingBar \/>/);
    expect(read('src/components/shell/PhoneMissingBar.tsx')).toMatch(/openOptionsScreen\('my-account'\)/);
  });
});

describe('E41: nazwa transportu według firmy w miejscach z listy G', () => {
  it('Kokpit, okno „Dopłata”, Finanse, Mapa — przez transportLabel', () => {
    expect(read('src/lib/cockpitE9.ts')).toMatch(/ls\.map\(\(l\) => transportLabel\(l, role\)\)/);
    expect(read('src/lib/cockpitE9.ts')).not.toMatch(/code: last\.code/);
    expect(read('src/components/drawer/FeeModal.tsx')).not.toMatch(/\{load\.code\}/);
    expect(read('src/views/FinanceView.tsx')).toMatch(/nameOf\(b\.id, b\.code\)/);
    expect(read('src/components/map/CorridorMap.tsx')).toMatch(/code: transportLabel\(l, role\)/);
    expect(read('src/views/MapView.tsx')).not.toMatch(/g\.loads\.map\(\(l\) => l\.code\)/);
  });
});

describe('E9/E12: „Dla mnie” zamiast „Ustawień” (KSH, SCX)', () => {
  it('menu i nagłówek strony', () => {
    expect(t('pl', 'nav_settings')).toBe('Dla mnie');
    expect(t('pl', 'p3c_settings')).toBe('Dla mnie');
  });
});

describe('E20 pkt 2: poniżej 1440 px inicjały i rejs „statek · godzina · port wyjścia”', () => {
  it('reguła 1439 px w arkuszu i port docelowy w osobnym elemencie', () => {
    const css = read('src/index.css');
    expect(css).toMatch(/@media \(max-width:1439px\)\{\s*\.topbar \.acc-who,\.topbar \.acc-caret\{display:none\}/);
    expect(css).toMatch(/\.ops \.ops-to\{display:none\}/);
    expect(read('src/components/shell/Topbar.tsx')).toMatch(/className="ops-to"/);
  });
});
