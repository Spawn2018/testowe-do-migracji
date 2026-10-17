/**
 * wyglad/W-naprawy-2 — wygląd pod naprawy A5/A6/A8/A9 i C11 (audyt 17.10, D-20261017-0730-01).
 */
import { describe, expect, it } from 'vitest';
import { PASSWORD_MIN, passwordOk } from '../src/auth/config';
import { tp } from '../src/i18n/messages';
import { readyGapsText } from '../src/lib/p4c';
import { computeReadyGaps } from '../src/lib/readyGaps';
import { importSkipText, standardSkipMessage } from '../src/lib/standardSkipMessage';
import { demoFuelScreen } from '../src/lib/p5bDemo';
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
    expect(tp('pl', 'auth_pw_rule', { n: PASSWORD_MIN })).toMatch(/co najmniej \d+ znak(ów|i)?, w tym litery \(a–z\) i cyfry\.$/);
    expect(passwordOk('ąęśćżźółńĄĘ1')).toBe(false);
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
    /* F7: na ekranie słowa z okna Awizacja */
    expect(readyGapsText(computeReadyGaps(l, []), 'pl').list).toContain('awizacja (kierowca odcinka SE, telefon odcinka SE, ciągnik odcinka SE)');
    expect(tp('pl', 'p4c_ready_ok')).toContain('rejs');
  });
});

describe('A6 — podsumowanie importu słowami', () => {
  it('nagłówek z odmianą', () => {
    expect(tp('pl', 'p7_imp_head', { ok: 1, total: 1 })).toBe('wczytano 1 z 1 wiersza');
    expect(tp('pl', 'p7_imp_head', { ok: 95, total: 153 })).toBe('wczytano 95 z 153 wierszy');
  });
  it('pominięte w jednym zdaniu', () => {
    expect(importSkipText({ carrier: 43, empty: 15, standard: 0 })).toBe('Pominięte: inny przewoźnik — 43 · puste wiersze — 15.');
    /* F7: zera i brak pól — bez zdania; po imporcie to samo zdanie */
    expect(importSkipText({ carrier: 0, empty: 0, standard: 0 })).toBeNull();
    expect(importSkipText({})).toBeNull();
    expect(standardSkipMessage(2, 1)).toBe('Zaimportowano 2 transporty. Pominięte: rozmiar „Standard” (ładunki innej firmy) — 1.');
    expect(standardSkipMessage(1, 0, { carrier: 0, empty: 0 })).toBe('Zaimportowano 1 transport.');
  });
  it('daty KSH do sprawdzenia', () => {
    expect(tp('pl', 'p7_imp_dates_check', { n: 1 })).toMatch(/^1 wiersz wchodzi do harmonogramu z datami KSH do sprawdzenia/);
    expect(tp('pl', 'p7_imp_dates_check', { n: 3 })).toMatch(/^3 wiersze wchodzą/);
    expect(tp('pl', 'p7_imp_dates_check', { n: 7 })).toMatch(/^7 wierszy wchodzi/);
  });
});

describe('A8 — Stan systemu: „następna próba o …”', () => {
  it('demo: źródło „Nie działa” ma czas następnej próby w przyszłości', () => {
    const fuel = demoSources(NOW).find((r) => r.id === 'fuel');
    expect(fuel?.state).toBe('down');
    expect(Date.parse(fuel?.nextTryAt ?? '')).toBeGreaterThan(Date.parse(NOW));
  });
  it('demo: ta sama następna próba w Stanie systemu i na ekranie Opłata paliwowa', () => {
    const at = (iso: string) => new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
    // 12:00 czasu polskiego → dziś 13:15
    expect(at(demoSources('2026-09-23T10:00:00.000Z').find((r) => r.id === 'fuel')!.nextTryAt!)).toBe('23.09, 13:15');
    expect(demoFuelScreen('2026-09-23', '12:00').alarm?.nextTry).toBe('13:15');
    // 16:32 → dziś już nie ma prób; Stan systemu: jutro 07:15
    expect(at(demoSources('2026-09-23T14:32:00.000Z').find((r) => r.id === 'fuel')!.nextTryAt!)).toBe('24.09, 07:15');
    expect(demoFuelScreen('2026-09-23', '16:32').alarm?.nextTry).toBeNull();
  });
  it('źródła bez uwagi nie mają czasu próby', () => {
    expect(demoSources(NOW).filter((r) => r.state === 'ok').every((r) => !r.nextTryAt)).toBe(true);
  });
});
