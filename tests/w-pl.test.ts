/**
 * wyglad/W-pl — decyzja właściciela 17.10.2026, 07:20 (8A), Konstytucja X: interfejs tylko po polsku.
 * Słowniki EN i SV zostają wyłącznie dla aplikacji kierowcy (`src/i18n/driver.ts`).
 */
import { describe, expect, it } from 'vitest';
import { I18N_ALL, t, tp } from '../src/i18n/messages';
import { DRIVER_EN, DRIVER_SV } from '../src/i18n/driver';
import { useTowerStore } from '../src/store/useTowerStore';
import { bellAge } from '../src/lib/bellList';

const DRIVER_KEY = /^(drv_|a6_drv_|milestone_|i4_drv_|i4_sub_drv$|i4_h$|share_pos$|pr7_pdf_too_big$)/;

describe('8A — tylko PL poza aplikacją kierowcy', () => {
  it('EN i SV mają tylko klucze aplikacji kierowcy', () => {
    expect(Object.keys(I18N_ALL.en).filter((k) => !DRIVER_KEY.test(k))).toEqual([]);
    expect(Object.keys(I18N_ALL.sv).filter((k) => !DRIVER_KEY.test(k))).toEqual([]);
  });
  it('aplikacja kierowcy: komplet kluczy w EN i SV, bez polskich znaków', () => {
    const pl = Object.keys(I18N_ALL.pl).filter((k) => DRIVER_KEY.test(k)).sort();
    expect(Object.keys(DRIVER_EN).sort()).toEqual(pl);
    expect(Object.keys(DRIVER_SV).sort()).toEqual(pl);
    for (const v of Object.values(DRIVER_EN)) expect(/[ąćęłńóśźż]/i.test(v), v).toBe(false);
    expect(t('sv', 'milestone_loaded')).toBe('Lastad');
    expect(t('en', 'milestone_ferry')).toBe('On ferry');
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
