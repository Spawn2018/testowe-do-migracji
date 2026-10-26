/* E11 (właściciel 21.10.2026 19:52): „Kto co dostaje” na produkcji w wyglądzie z audytu, dane z notification_matrix. */
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { matrixFromDb } from '../src/auth/LiveWhoGets';
import { NOTIFY_CATALOG } from '../src/lib/notifyCatalog';

const row = (event_key: string, role: string, in_app: boolean, email: boolean, push: boolean, fx: Partial<Record<'fixed_in_app' | 'fixed_email' | 'fixed_push', boolean>> = {}) =>
  ({ event_key, role, in_app, email, push, fixed_in_app: null, fixed_email: null, fixed_push: null, ...fx }) as never;

describe('Kto co dostaje — produkcja', () => {
  it('zaznaczenia z bazy, nie z katalogu; stałe kanały z fixed_*', () => {
    const g = matrixFromDb(NOTIFY_CATALOG, [row('dec_late', 'HHL_ADMIN', true, false, false), row('dates', 'HHL_OPS', true, false, false, { fixed_in_app: true })]);
    const r = g.flatMap((x) => x.rows);
    expect(r.find((x) => x.id === 'dec_late')!.cells.HHL_ADMIN).toEqual({ bell: true, push: false, mail: false });
    expect(r.find((x) => x.id === 'dates')!.cells.HHL_OPS).toEqual({ bell: true, push: false, mail: false, fixed: ['bell'] });
  });
  it('brak wiersza w bazie = wyłączone; „—” z katalogu zostaje; Sytuacja ogólna bez kanałów', () => {
    const r = matrixFromDb(NOTIFY_CATALOG, []).flatMap((x) => x.rows);
    expect(r.find((x) => x.id === 'status')!.cells.CARRIER_USER).toEqual({ bell: false, push: false, mail: false });
    expect(r.find((x) => x.id === 'cmr')!.cells.CLIENT_USER).toBeNull();
    expect(r.find((x) => x.id === 'risk_general')!.risksOnly).toBe(true);
  });
  it('Opcje ładują LiveWhoGets (ekran z audytu), nie starą tabelę', () => {
    const o = readFileSync(new URL('../src/views/OptionsView.tsx', import.meta.url), 'utf8');
    expect(o).toContain("import('../auth/LiveWhoGets')");
    expect(o).not.toContain("import('../auth/NotificationMatrixForm')");
    /* audyt 25.10 (U-14): stary formularz usunięty z kodu, nazwa zmiennej bez mylącego aliasu */
    expect(existsSync(new URL('../src/auth/NotificationMatrixForm.tsx', import.meta.url))).toBe(false);
    expect(o).not.toContain('NotificationMatrixForm');
  });
});

/* F7 #404: tylko odczyt dla Operacji / Podglądu, karty bez kanałów stałych, nieznane klucze z bazy, wybrany wiersz po zapisie */
import { channelOn, unknownKeys } from '../src/auth/LiveWhoGets';
describe('Kto co dostaje — F7 #404', () => {
  it('Operacje HHL i Podgląd — tylko odczyt', () => {
    const o = readFileSync(new URL('../src/views/OptionsView.tsx', import.meta.url), 'utf8');
    expect(o).toContain('block(<LiveWhoGetsForm readOnly={ro} />)');
    const l = readFileSync(new URL('../src/auth/LiveWhoGets.tsx', import.meta.url), 'utf8');
    expect(l).toContain('readOnly={readOnly} onToggle={onToggle} onCard={onCard}');
  });
  it('karta „włączone” bez kanałów stałych', () => {
    expect(channelOn([row('src_down', 'HHL_ADMIN', true, true, true, { fixed_email: true, fixed_push: true })], 'email')).toBe(false);
    expect(channelOn([row('dec_late', 'HHL_OPS', true, true, false)], 'email')).toBe(true);
  });
  it('klucz z bazy spoza katalogu jest zgłaszany', () => {
    expect(unknownKeys(NOTIFY_CATALOG, [row('nowe_zdarzenie', 'HHL_ADMIN', true, false, false), row('dec_new', 'HHL_ADMIN', true, false, false)])).toEqual(['nowe_zdarzenie']);
  });
  it('ekran bierze nowe dane bez ponownego montowania (wybrany wiersz zostaje)', () => {
    const w = readFileSync(new URL('../src/components/options/WhoGetsScreen.tsx', import.meta.url), 'utf8');
    expect(w).toContain('useEffect(() => { setGroups(initial); }, [initial]);');
    const l = readFileSync(new URL('../src/auth/LiveWhoGets.tsx', import.meta.url), 'utf8');
    expect(l).not.toContain('key={ver}');
  });
});
