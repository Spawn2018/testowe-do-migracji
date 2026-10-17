/**
 * wyglad/W-naprawy-2 — wygląd pod naprawy A5/A6/A8/A9 i C11 (audyt 17.10, D-20261017-0730-01).
 */
import { describe, expect, it } from 'vitest';
import { PASSWORD_MIN, passwordOk } from '../src/auth/config';
import { tp } from '../src/i18n/messages';
import { computeReadyGaps } from '../src/lib/readyGaps';
import { demoSources } from '../src/lib/sysDemo';
import type { Load } from '../src/types';

const NOW = '2026-09-28T10:00:00.000Z';

describe('C11 — hasło: co najmniej PASSWORD_MIN znaków, litery i cyfry', () => {
  const pad = (s: string) => s.padEnd(PASSWORD_MIN, s.slice(-1));
  it('litery + cyfry → dobre', () => {
    expect(passwordOk(pad('Haslo1'))).toBe(true);
    expect(passwordOk(pad('źdźbło7'))).toBe(true);
  });
  it('same cyfry, same litery albo za krótkie → złe', () => {
    expect(passwordOk('1'.repeat(PASSWORD_MIN + 2))).toBe(false);
    expect(passwordOk('a'.repeat(PASSWORD_MIN + 2))).toBe(false);
    expect(passwordOk('a1'.repeat(Math.floor((PASSWORD_MIN - 1) / 2)).slice(0, PASSWORD_MIN - 1))).toBe(false);
  });
  it('komunikat mówi to samo co reguła', () => {
    expect(tp('pl', 'auth_pw_rule', { n: PASSWORD_MIN })).toMatch(/co najmniej \d+ znak(ów|i)?, w tym litery i cyfry\.$/);
  });
});

describe('A9 — braki do „Gotowy”: rejs i kierowca SE przy przepięciu', () => {
  const load = (over: Partial<Record<string, unknown>> = {}) => ({
    id: '1',
    status: 'RESOURCES_PENDING',
    resources: {
      driverName: 'Jan Nowak', driverPhone: '+48 600 100 200', tractorPlate: 'PO 1AB', trailerPlate: 'PO 2CD', trailerSwap: false,
    },
    carrierOrderNo: 'SCX/1', hhlOrderNo: 'HHL/1', docMissing: false, sailingId: null,
    ...over,
  }) as unknown as Load;

  it('bez rejsu → brak „rejs” po stronie SCX', () => {
    const gaps = computeReadyGaps(load(), []);
    expect(gaps.find((g) => g.kind === 'SAILING')).toMatchObject({ who: 'SCX' });
    expect(tp('pl', 'p4c_gap_SAILING')).toBe('rejs');
  });
  it('z rejsem → bez braku rejsu', () => {
    expect(computeReadyGaps(load({ sailingId: 's1' }), []).some((g) => g.kind === 'SAILING')).toBe(false);
  });
  it('przepięcie naczepy bez kierowcy SE → „kierowca SE”, „telefon SE”, „ciągnik SE” w awizacji', () => {
    const l = load({ resources: { driverName: 'Jan Nowak', driverPhone: '+48 600 100 200', tractorPlate: 'PO 1AB', trailerPlate: 'PO 2CD', trailerSwap: true } });
    const awiz = computeReadyGaps(l, []).find((g) => g.kind === 'AWIZ');
    expect(awiz?.items).toEqual(['kierowca SE', 'telefon SE', 'ciągnik SE']);
  });
});

describe('A6 — podsumowanie importu słowami', () => {
  it('nagłówek z odmianą', () => {
    expect(tp('pl', 'p7_imp_head', { ok: 1, total: 1 })).toBe('wczytano 1 z 1 wiersza');
    expect(tp('pl', 'p7_imp_head', { ok: 95, total: 153 })).toBe('wczytano 95 z 153 wierszy');
  });
  it('pominięte w jednym zdaniu', () => {
    const list = [tp('pl', 'p7_imp_skip_carrier', { n: 43 }), tp('pl', 'p7_imp_skip_empty', { n: 15 })].join(' · ');
    expect(tp('pl', 'p7_imp_skip', { list })).toBe('Pominięte: inny przewoźnik (NTG) — 43 · puste wiersze — 15.');
  });
  it('daty KSH do sprawdzenia', () => {
    expect(tp('pl', 'p7_imp_dates_check', { n: 7 })).toMatch(/^Daty KSH do sprawdzenia: 7 — wiersze wchodzą/);
  });
});

describe('A8 — Stan systemu: „następna próba o …”', () => {
  it('demo: źródło „Nie działa” ma czas następnej próby w przyszłości', () => {
    const fuel = demoSources(NOW).find((r) => r.id === 'fuel');
    expect(fuel?.state).toBe('down');
    expect(Date.parse(fuel?.nextTryAt ?? '')).toBeGreaterThan(Date.parse(NOW));
  });
  it('źródła bez uwagi nie mają czasu próby', () => {
    expect(demoSources(NOW).filter((r) => r.state === 'ok').every((r) => !r.nextTryAt)).toBe(true);
  });
});
