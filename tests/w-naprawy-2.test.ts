/**
 * wyglad/W-naprawy-2 — wygląd pod naprawy A5/A6/A8/A9 i C11 (audyt 17.10, D-20261017-0730-01).
 */
import { describe, expect, it } from 'vitest';
import { PASSWORD_MIN, passwordOk } from '../src/auth/config';
import { tp } from '../src/i18n/messages';
import { p8ct } from '../src/i18n/p8c';
import { SOON } from '../src/lib/serverRules';
import { readyGapsText } from '../src/lib/p4c';
import { computeReadyGaps } from '../src/lib/readyGaps';
import { importSkipText, standardSkipMessage } from '../src/lib/standardSkipMessage';
import { demoFuelScreen } from '../src/lib/p5bDemo';
import { demoSources } from '../src/lib/sysDemo';
import type { Load } from '../src/types';

const NOW = '2026-09-23T10:00:00.000Z'; /* środa — w poniedziałek demo paliwa nie ma alarmu */

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
  it('przepięcie naczepy bez kierowcy SE → nie blokuje „Gotowy” (D-20261020-1525-01: termin 48 h przed dostawą)', () => {
    const l = load({ resources: { driverName: 'Jan Nowak', driverPhone: '+48 600 100 200', tractorPlate: 'PO 1AB', trailerPlate: 'PO 2CD', trailerSwap: true } });
    expect(computeReadyGaps(l, []).find((g) => g.kind === 'AWIZ')).toBeUndefined();
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

describe('A2 — Strefy: wyjazd z placu nie obiecuje automatu przed A2', () => {
  it('zdanie „wkrótce” dla placu i nowe zdanie wyjazdu ze Śremu po A2', () => {
    expect(p8ct('p8c_does_SITE_exit_soon', { soon: SOON })).toBe('Wyjazd: „Dostarczone” ustawia SCX albo administrator HHL; samo po co najmniej 10\u00a0min na placu — włączamy wkrótce.');
    expect(p8ct('p8c_does_LOADING_exit_a2')).toContain('postoju co najmniej 5\u00a0min: „Droga PL”');
  });
  it('ZonesView podmienia zdania według serverRuleOn(SITE_EXIT_DELIVERED)', async () => {
    const { readFileSync } = await import('node:fs');
    const v = readFileSync('src/views/ZonesView.tsx', 'utf8');
    expect(v).toMatch(/z\.type === 'SITE' && !serverRuleOn\('SITE_EXIT_DELIVERED'\)/);
    expect(v).toMatch(/z\.type === 'LOADING' && serverRuleOn\('SITE_EXIT_DELIVERED'\)/);
  });
});

describe('F7 runda 2 — czas polski po zmianie czasu (25.10) w danych demo', () => {
  it('rozkład: odejście 18:00 i przypłynięcie 12:00 czasu polskiego także po 25.10', async () => {
    const { buildSeedSailings } = await import('../src/lib/sailings');
    const hm = (iso: string) => new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
    const ss = buildSeedSailings().filter((s) => s.status === 'ZAPLANOWANY');
    expect(ss.length).toBe(60);
    for (const s of ss) {
      expect([s.id, hm(s.departureAt)]).toEqual([s.id, '18:00']);
      expect([s.id, hm(s.arrivalAt)]).toEqual([s.id, '12:00']);
    }
    expect(ss.find((s) => s.id === 'sail-2026-10-24-N' || s.id === 'sail-2026-10-24-W')).toBeTruthy();
  });
  it('Stan systemu: przed 07:15 następna próba 07:15, a „od” — od wczoraj', () => {
    const fuel = demoSources('2026-09-23T04:00:00.000Z').find((r) => r.id === 'fuel')!;
    const at = (iso: string) => new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
    expect(at(fuel.nextTryAt!)).toBe('23.09, 07:15');
    expect(at(fuel.since!)).toBe('22.09, 07:15');
    expect(Date.parse(fuel.since!)).toBeLessThan(Date.parse('2026-09-23T04:00:00.000Z'));
    // po 25.10 (czas zimowy) nadal 07:15 czasu polskiego
    expect(at(demoSources('2026-10-27T15:00:00.000Z').find((r) => r.id === 'fuel')!.nextTryAt!)).toBe('28.10, 07:15');
    /* F7 runda 3: w poniedziałek ekran paliwa nie ma alarmu — Stan systemu też „Działa” */
    const mon = demoSources('2026-10-26T15:00:00.000Z').find((r) => r.id === 'fuel')!;
    expect([mon.state, mon.nextTryAt ?? null]).toEqual(['ok', null]);
    expect(demoFuelScreen('2026-10-26', '16:00').alarm).toBeNull();
  });
});

describe('F7 runda 3 — promy w pasku i propozycja Steny w czasie polskim po 25.10', () => {
  it('demoFerryRows i demoStenaSailings: 18:00 / 20:00 czasu polskiego 26.10', async () => {
    const { demoFerryRows, demoStenaSailings } = await import('../src/lib/p6Demo');
    const hm = (iso: string) => new Intl.DateTimeFormat('pl-PL', { timeZone: 'Europe/Warsaw', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(iso));
    const rows = demoFerryRows('2026-10-26T15:00:00.000Z', 2);
    expect(rows.map((r) => hm(r.depIso))).toEqual(['18:00', '20:00']);
    expect(demoStenaSailings('2026-10-26T15:00:00.000Z').map((s) => hm(s.departureAt))).toEqual(['20:00', '09:00', '20:00']);
  });
  it('Automatyzacje: wyjazd ze Śremu — w demo (po A2) bez czekania na potwierdzenie, bez „załadowany”', async () => {
    const { wt } = await import('../src/i18n/p4cWf');
    expect(wt('pl', 'p4c_wf_zt_srem_out').replace(/\u00a0/g, ' ')).toBe('Droga PL — po postoju ≥ 5 min (próg strefy), bez czekania na potwierdzenie załadunku');
  });
});

describe('A8 — sprawa „Źródło niedostępne … od …” z detail.od_kiedy', () => {
  it('riskFromRow: rk_source_down + od_kiedy → rk_source_down_since z datą pierwszej awarii', async () => {
    const { riskFromRow } = await import('../src/data/mappers');
    const r = riskFromRow({
      id: 'r1', load_id: null, kind: 'JOB_FAILURE', severity: 'MEDIUM', title: 'x', title_key: 'rk_source_down',
      detail: { od_kiedy: '2026-10-07T22:00:03Z', params: { source: 'telematyka naczep (emtrack web)', source_key: 'rk_src_EMTRACK_WEB' } },
      detected_at: '2026-10-07T22:00:03Z', dedup_key: 'SOURCE_DOWN:EMTRACK_WEB',
    }, '2026-10-17T17:00:00Z');
    expect(r.titleKey).toBe('rk_source_down_since');
    expect(tp('pl', r.titleKey!, r.titleParams as Record<string, string>)).toMatch(/^Źródło niedostępne: .+ od 08\.10\.2026, 00:00 — HHL weryfikuje ręcznie$/);
  });
  it('bez od_kiedy — jak dotąd', async () => {
    const { riskFromRow } = await import('../src/data/mappers');
    const r = riskFromRow({ id: 'r2', load_id: null, kind: 'JOB_FAILURE', severity: 'MEDIUM', title: 'x', title_key: 'rk_source_down', detail: {}, detected_at: '2026-10-07T22:00:03Z' }, '2026-10-17T17:00:00Z');
    expect(r.titleKey).toBe('rk_source_down');
  });
});
