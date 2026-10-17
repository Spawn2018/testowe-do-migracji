/**
 * wyglad/W-pl — decyzja właściciela 17.10.2026, 07:20 (8A), Konstytucja X: interfejs tylko po polsku.
 * Słowniki EN i SV zostają wyłącznie dla aplikacji kierowcy (`src/i18n/driver.ts`).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { I18N_ALL, t, tp } from '../src/i18n/messages';
import { DRIVER_EN, DRIVER_SV } from '../src/i18n/driver';
import { useTowerStore } from '../src/store/useTowerStore';
import { bellAge } from '../src/lib/bellList';

const DRIVER_KEY = /^(drv_|a6_drv_|milestone_|i4_drv_|i4_sub_drv$|i4_h$|share_pos$|pr7_pdf_too_big$)/;
/** Pliki, które rysuje aplikacja kierowcy (DriverPwa, dokumenty transportu, instrukcja). */
const DRIVER_FILES = ['src/views/DriverPwa.tsx', 'src/components/ui/DocFileRow.tsx', 'src/components/ui/DocPreview.tsx'];

describe('8A — tylko PL poza aplikacją kierowcy', () => {
  it('EN i SV: te same klucze, każdy jest też w PL', () => {
    expect(Object.keys(DRIVER_SV).sort()).toEqual(Object.keys(DRIVER_EN).sort());
    expect(Object.keys(DRIVER_EN).filter((k) => !(k in I18N_ALL.pl))).toEqual([]);
    expect(I18N_ALL.en).toBe(DRIVER_EN);
    expect(I18N_ALL.sv).toBe(DRIVER_SV);
  });
  it('aplikacja kierowcy: komplet kluczy w EN i SV (także dokumenty transportu, F7), bez polskich znaków', () => {
    const plDriver = Object.keys(I18N_ALL.pl).filter((k) => DRIVER_KEY.test(k));
    expect(plDriver.filter((k) => !(k in DRIVER_EN))).toEqual([]);
    const used = new Set<string>();
    for (const f of DRIVER_FILES) {
      for (const m of readFileSync(f, 'utf8').matchAll(/\btp?\(locale, '([a-z0-9_]+)'/g)) used.add(m[1]);
    }
    for (const c of ['CMR', 'INSURANCE', 'INVOICE', 'PERMIT_PL', 'PERMIT_SE', 'POD', 'OTHER']) used.add(`a6_doccat_${c}`);
    expect([...used].filter((k) => !(k in DRIVER_EN))).toEqual([]);
    for (const v of Object.values(DRIVER_EN)) expect(/[ąćęłńóśźż]/i.test(v), v).toBe(false);
    expect(t('sv', 'milestone_loaded')).toBe('Lastad');
    expect(t('en', 'milestone_ferry')).toBe('On ferry');
    expect(t('sv', 'a6_doccat_PERMIT_SE')).toBe('Tillstånd SE');
    /* bez tekstów wpisanych na sztywno po polsku w aplikacji kierowcy */
    expect(readFileSync('src/views/DriverPwa.tsx', 'utf8')).not.toMatch(/Link jest nieaktywny|Nieznany token|'Tryb demo/);
  });
  it('reszta aplikacji przy EN/SV dostaje tekst polski (także liczby i odmiana)', () => {
    expect(t('en', 'nav_dash')).toBe(t('pl', 'nav_dash'));
    expect(t('sv', 'p4b_eta_why')).toBe(t('pl', 'p4b_eta_why'));
    expect(tp('sv', 'a6_sch_export_ok', { rows: 5, bytes: 10 })).toBe(tp('pl', 'a6_sch_export_ok', { rows: 5, bytes: 10 }));
  });
  it('panel zostaje po polsku: zapisany język z konta i wybór „en”/„sv” nie przełączają panelu', () => {
    useTowerStore.getState().applyUserPrefs({ locale: 'en' });
    expect(useTowerStore.getState().locale).toBe('pl');
    useTowerStore.getState().setLocale('sv');
    expect(useTowerStore.getState().locale).toBe('pl');
  });
  it('dzwonek bez EN/SV (audyt N20)', () => {
    const now = Date.parse('2026-10-06T12:00:00Z');
    expect(bellAge('2026-10-06T09:00:00Z', now, 'en')).toBe('3 godz. temu');
    expect(bellAge('2026-10-04T12:00:00Z', now, 'sv')).toBe('2 dni temu');
  });
});
