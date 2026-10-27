import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { changesLoads, confirmKeyOf, dbErrorKey, decisionRpc, hasOwnSnooze, isForbidden, optionVisible, takesNote } from '../src/lib/carrierDecision';
import { DEC_I18N, decText } from '../src/i18n/decisions';

/**
 * Polecenie właściciela 27.10, 12:47 (#590/#592): decyzja „zmiana przewoźnika w pliku” — Anuluj / Usuń z harmonogramu /
 * Odłóż 2 h — „wszystkie 3 opcje mają działać i nieść odpowiedni skutek w transporcie”. Skutek daje tylko
 * `decision_resolve_carrier_change`; ogólne `decision_resolve` zamknęłoby decyzję bez zmiany transportu.
 */
const CARRIER = { id: 'd1', typeCode: 'KSH_CARRIER_CHANGED', loadId: 'l1' };
const BACK = { id: 'd2', typeCode: 'KSH_REMOVED_BACK', loadId: 'l2' };

/* opcje jak w katalogu `decision_types` na produkcji (27.10) */
const OPTIONS = [
  'dec_opt_CARRIER_CANCEL', 'dec_opt_CARRIER_REMOVE', 'dec_opt_CARRIER_SNOOZE',
  'dec_opt_REMOVED_KEEP', 'dec_opt_REMOVED_RESTORE',
  'dec_type_KSH_CARRIER_CHANGED', 'dec_type_KSH_REMOVED_BACK',
  'dec_confirm_CARRIER_CANCEL', 'dec_confirm_CARRIER_REMOVE', 'dec_confirm_REMOVED_RESTORE',
  'dec_confirm_yes', 'dec_confirm_back',
  'dec_err_unknown_option', 'dec_err_no_load', 'dec_err_restore_admin', 'dec_err_stale', 'dec_err_forbidden',
];

describe('W-590 decyzja „zmiana przewoźnika” — właściwa funkcja bazy', () => {
  it('wszystkie trzy opcje idą do decision_resolve_carrier_change z kodem opcji', () => {
    for (const opt of ['CANCEL', 'REMOVE', 'SNOOZE_2H']) {
      expect(decisionRpc(CARRIER, opt, 'uwaga', null)).toEqual({
        fn: 'decision_resolve_carrier_change', args: { p_decision: 'd1', p_action: opt },
      });
    }
  });

  it('nieznana opcja tej decyzji nie spada do ogólnego rozstrzygnięcia', () => {
    expect(decisionRpc(CARRIER, 'ACCEPT', null)).toEqual({ error: 'unknown_option' });
  });

  it('„Przywróć” woła load_restore_removed z transportem; „Zostaw usunięty” — zwykłe rozstrzygnięcie', () => {
    expect(decisionRpc(BACK, 'WILL_RESTORE', null)).toEqual({ fn: 'load_restore_removed', args: { p_load: 'l2' } });
    expect(decisionRpc({ ...BACK, loadId: null }, 'WILL_RESTORE', null)).toEqual({ error: 'no_load' });
    expect(decisionRpc(BACK, 'KEEP_REMOVED', null)).toEqual({
      fn: 'decision_resolve', args: { p_decision: 'd2', p_option: 'KEEP_REMOVED', p_note: null },
    });
  });

  it('inne decyzje bez zmian — decision_resolve, z p_payload tylko gdy podany', () => {
    const d = { id: 'd3', typeCode: 'NO_AWIZACJA', loadId: null };
    expect(decisionRpc(d, 'ACK', 'x')).toEqual({ fn: 'decision_resolve', args: { p_decision: 'd3', p_option: 'ACK', p_note: 'x' } });
    expect(decisionRpc(d, 'PROPOSE', null, { a: 1 })).toEqual({
      fn: 'decision_resolve', args: { p_decision: 'd3', p_option: 'PROPOSE', p_note: null, p_payload: { a: 1 } },
    });
  });

  it('Anuluj, Usuń i Przywróć wymagają potwierdzenia; Odłóż i Zostaw — nie', () => {
    expect(confirmKeyOf('KSH_CARRIER_CHANGED', 'CANCEL')).toBe('dec_confirm_CARRIER_CANCEL');
    expect(confirmKeyOf('KSH_CARRIER_CHANGED', 'REMOVE')).toBe('dec_confirm_CARRIER_REMOVE');
    expect(confirmKeyOf('KSH_REMOVED_BACK', 'WILL_RESTORE')).toBe('dec_confirm_REMOVED_RESTORE');
    expect(confirmKeyOf('KSH_CARRIER_CHANGED', 'SNOOZE_2H')).toBeNull();
    expect(confirmKeyOf('KSH_REMOVED_BACK', 'KEEP_REMOVED')).toBeNull();
    expect(confirmKeyOf('NO_AWIZACJA', 'CANCEL')).toBeNull();
  });

  it('decyzja z własnym „Odłóż 2 h” nie dostaje drugiego przycisku odkładania', () => {
    expect(hasOwnSnooze('KSH_CARRIER_CHANGED')).toBe(true);
    expect(hasOwnSnooze('KSH_REMOVED_BACK')).toBe(false);
  });

  it('odmowa uprawnień rozpoznana po kodzie albo słowie', () => {
    expect(isForbidden({ code: '42501', message: 'x' })).toBe(true);
    expect(isForbidden({ message: 'forbidden' })).toBe(true);
    expect(isForbidden({ code: '22023', message: 'Usunięcie z harmonogramu tylko przed załadunkiem' })).toBe(false);
    expect(isForbidden(null)).toBe(false);
  });
});

describe('W-590 F7 r1 — uprawnienia, komunikaty bazy, odświeżenie harmonogramu', () => {
  it('„Przywróć” widzi tylko administrator HHL; reszta opcji dla wszystkich', () => {
    expect(optionVisible('KSH_REMOVED_BACK', 'WILL_RESTORE', 'HHL_ADMIN')).toBe(true);
    expect(optionVisible('KSH_REMOVED_BACK', 'WILL_RESTORE', 'HHL_OPS')).toBe(false);
    expect(optionVisible('KSH_REMOVED_BACK', 'WILL_RESTORE', null)).toBe(false);
    expect(optionVisible('KSH_REMOVED_BACK', 'KEEP_REMOVED', 'HHL_OPS')).toBe(true);
    expect(optionVisible('KSH_CARRIER_CHANGED', 'REMOVE', 'HHL_OPS')).toBe(true);
  });

  it('pole komentarza ukryte tam, gdzie baza go nie zapisuje', () => {
    expect(takesNote('KSH_CARRIER_CHANGED')).toBe(false);
    expect(takesNote('KSH_REMOVED_BACK')).toBe(true);
    expect(takesNote('NO_AWIZACJA')).toBe(true);
  });

  it('angielskie odmowy bazy dostają polski komunikat; polski 22023 zostaje bez zmian', () => {
    expect(dbErrorKey({ code: '42501', message: 'forbidden' })).toBe('dec_err_forbidden');
    expect(dbErrorKey({ code: 'P0002', message: 'not found' })).toBe('dec_err_stale');
    expect(dbErrorKey({ code: '22023', message: 'wrong type' })).toBe('dec_err_stale');
    expect(dbErrorKey({ code: '22023', message: 'Usunięcie z harmonogramu tylko przed załadunkiem (status IN_TRANSIT)' })).toBeNull();
  });

  it('po anulowaniu / usunięciu / przywróceniu odświeżany jest harmonogram', () => {
    expect(changesLoads({ fn: 'decision_resolve_carrier_change', args: { p_decision: 'd', p_action: 'REMOVE' } })).toBe(true);
    expect(changesLoads({ fn: 'load_restore_removed', args: { p_load: 'l' } })).toBe(true);
    expect(changesLoads({ fn: 'decision_resolve', args: {} })).toBe(false);
  });
});

describe('W-590 etykiety i ostrzeżenia po polsku', () => {
  it('każda opcja i nazwa decyzji ma polską etykietę (nie surowy kod)', () => {
    for (const k of OPTIONS) {
      expect(DEC_I18N.pl[k], k).toBeTruthy();
      expect(decText('pl', k)).not.toBe(k);
    }
  });

  it('ostrzeżenie przy „Usuń” mówi o wszystkich firmach i o przywróceniu tylko przez administratora', () => {
    const w = decText('pl', 'dec_confirm_CARRIER_REMOVE');
    expect(w).toMatch(/wszystkich firm/);
    expect(w).toMatch(/administrator HHL/);
  });
});

describe('W-590 ekran nie woła ogólnego rozstrzygnięcia z pominięciem trasy', () => {
  const hook = readFileSync('src/components/risks/useDecisions.ts', 'utf8');
  const card = readFileSync('src/components/risks/TodoCard.tsx', 'utf8');

  it('hook wybiera funkcję przez decisionRpc i bez wiersza decyzji odmawia (nie zgaduje ogólnego rozstrzygnięcia)', () => {
    expect(hook).toMatch(/decisionRpc\(/);
    expect(hook).not.toMatch(/rpc\(\s*['"`]decision_resolve['"`]/);
    expect(hook).toMatch(/sb\.rpc\(call\.fn, call\.args\)/);
    expect(hook).toMatch(/if \(!row\) return \{ hint: null, error: decText\('pl', 'dec_err_stale'\) \}/);
    expect(hook).toMatch(/changesLoads\(call\)[\s\S]*refreshFromServer/);
  });

  it('karta pokazuje potwierdzenie na stronie i ukrywa podwójne „Odłóż”', () => {
    expect(card).toMatch(/data-rk-dec-confirm/);
    expect(card).toMatch(/hasOwnSnooze\(d\.typeCode\)/);
    expect(card).not.toMatch(/window\.confirm|\bconfirm\(/);
    expect(card).toMatch(/optionVisible\(d\.typeCode, o\.code, ctx\.me\?\.role\)/);
    expect(card).toMatch(/data-rk-dec-yes=\{o\.code\} autoFocus/);
    /* komentarz wymagany sprawdzany PRZED otwarciem potwierdzenia */
    expect(card).toMatch(/confirmKeyOf\(d\.typeCode, code\)\) \{\s*if \(needsNote/);
  });
});
