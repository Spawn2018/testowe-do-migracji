/**
 * W-opcje-live-2 — ekrany Opcji na produkcji w wyglądzie z audytu, dane z bazy przez istniejące RPC i tabele:
 * Opłata paliwowa (E3, 5B), Cennik (E33/E-06), Dopłaty (E33), SMS przy miejscach (E42), Stan systemu (E23);
 * Finanse — tabele bez przewijania w bok przy 1280–1366 px, „Nowa faktura” jako osobny panel (E4).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { dwellFromDb, dwellPatchToDb } from '../src/auth/LiveDwell';
import { rateViewFromDb, rulesWithPrices, ruleKey, type DbCard } from '../src/auth/LiveRateCard';
import { liveOtherJobs, liveSourceRows, limitText } from '../src/auth/LiveStatus';
import { placesFromDb } from '../src/auth/LiveSmsPlaces';
import { tierOf } from '../src/lib/p5bFuel';
import { fetchDay, hhlFuelView, mondayOf, partyFuelView, tiersFromDb, type FuelRun, type WeekCalc } from '../src/auth/liveFuel';
import { hasKey } from '../src/i18n/messages';
import type { Load } from '../src/types';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const NOW = '2026-10-21T10:00:00Z';

describe('Dopłaty — ops_thresholds ↔ ekran', () => {
  const rows = [
    ['DWELL_FREE_LOAD_H', 6], ['DWELL_FREE_UNLOAD_H', 4], ['DWELL_HOURLY_EUR', 75], ['DWELL_DAILY_EUR', 750],
    ['DWELL_DAY_AFTER_H', 10], ['DWELL_START_LATER', 2], ['DWELL_FULL_HOUR', 1],
  ].map(([key, v]) => ({ key: String(key), value_num: String(v), updated_at: null }));
  it('wartości i wybory 1 / 2 z bazy', () => {
    expect(dwellFromDb(rows)).toEqual({ freeLoadH: 6, freeUnloadH: 4, hourEur: 75, dayEur: 750, dayAfterH: 10, startFrom: 'ENTRY', hourMode: 'FULL', changed: null });
    expect(dwellFromDb(rows.slice(1))).toBeNull();
  });
  it('zapis tymi samymi kluczami co DwellOptionsForm (admin_ops_threshold_set)', () => {
    expect(dwellPatchToDb({ startFrom: 'LATER', hourMode: 'FRACTION', freeLoadH: 5 })).toEqual([
      { key: 'DWELL_START_LATER', value: 1 }, { key: 'DWELL_FULL_HOUR', value: 2 }, { key: 'DWELL_FREE_LOAD_H', value: 5 },
    ]);
    expect(read('src/auth/LiveDwell.tsx')).toContain("sb.rpc('admin_ops_threshold_set'");
  });
});

describe('Cennik — rate_cards ↔ tabela symboli', () => {
  const rule = (symbol: string, base: number, convoy: number | null = null) => ({
    cargo_class: 'SYMBOL' as const, symbol, family: symbol.split('-')[0], convoy_cars: convoy,
    length_to: 18.21, width_to: 2.45, height_to: 2.45, weight_to: 30, base_rate: base, note: null,
  });
  const scx: DbCard = { id: 'c', version: 1, valid_from: '2026-09-28', note: null, created_at: '2026-09-30T20:57:00Z', rate_rules: [rule('SG', 6900), rule('KR', 12745, 1)] };
  const ksh: DbCard = { id: 'r', version: 2, valid_from: '2026-09-28', note: 'Poprawa', created_at: '2026-10-06T14:02:00Z', rate_rules: [rule('SG', 7245), rule('KR', 13382, 1)] };
  it('koszt SCX i przychód KSH w jednym wierszu pozycji; wersje z bazy', () => {
    const v = rateViewFromDb(ksh, scx, { ksh: 'Anna', scx: 'Jan' })!;
    expect(v.rows.map((r) => [r.id, r.kind, r.costEur, r.revEur])).toEqual([['KR-1', 'Kratownice', 12745, 13382], ['SG', 'Słupy główne', 6900, 7245]]);
    expect(v.ksh).toMatchObject({ v: 2, from: '2026-09-28', by: 'Anna' });
    expect(rateViewFromDb(null, null, { ksh: '', scx: '' })).toBeNull();
  });
  it('nowa wersja: wymiary bez zmian, zmienia się tylko cena (rate_card_save)', () => {
    const rules = rulesWithPrices(scx, { SG: 7000, [ruleKey({ symbol: 'KR', convoy_cars: 1 })]: 12800 })!;
    expect(rules.map((r) => [r.symbol, r.base_rate, r.length_to, r.convoy_cars])).toEqual([['SG', 7000, 18.21, undefined], ['KR', 12800, 18.21, 1]]);
    expect(read('src/auth/LiveRateCard.tsx')).toContain("sb.rpc('rate_card_save'");
  });
});

describe('Stan systemu — „Źródła danych” z integration_runs', () => {
  const run = (job: string, minAgo: number, ok = true) => ({ job, ok, ran_at: new Date(Date.parse(NOW) - minAgo * 60_000).toISOString() });
  it('działa, nie działa (seria błędów od…), dane za stare, bez źródła', () => {
    const rows = liveSourceRows('pl', [run('emtrack-web', 2), run('ferry-status', 5, false), run('ferry-status', 15, false), run('ferry-status', 25), run('road-se', 120)], [], [], NOW);
    const by = (id: string) => rows.find((r) => r.id === id)!;
    expect(by('telematics').state).toBe('ok');
    expect(by('ferry-status')).toMatchObject({ state: 'down', since: run('ferry-status', 15).ran_at, lastAt: run('ferry-status', 25).ran_at });
    expect(by('road-se').state).toBe('down');
    expect(by('road-se').why).toBe('Brak nowych danych dłużej niż 45 min.');
    expect(by('road-pl').state).toBe('nosource');
    expect(by('sms').state).toBe('nosource');
    expect(rows.every((r) => !/[a-z]+_[a-z_]+/.test(r.name))).toBe(true);
  });
  it('pozostałe zadania po polsku; progi bez kodów', () => {
    expect(liveOtherJobs('pl', [run('web-push-send', 1), run('rodo', 60, false)]).map((j) => [j.name, j.state])).toEqual([['Powiadomienia na telefon', 'ok'], ['Porządki RODO', 'down']]);
    expect([limitText(15), limitText(180), limitText(8 * 24 * 60)]).toEqual(['15 min', '3 h', '8 dni']);
  });
  it('Opcje ładują LiveStatus; dzisiejszy panel (kopie, limity, „Odśwież”) zostaje pod listą', () => {
    expect(read('src/views/OptionsView.tsx')).toContain("import('../auth/LiveStatus')");
    expect(read('src/auth/LiveStatus.tsx')).toContain('<SystemStatusPanel />');
  });
});

describe('SMS przy miejscach — sms_zone_recipients', () => {
  it('aktywne osoby w miejscach, rodzaje A–D miejsca, tryb testowy, bramka', () => {
    const s = placesFromDb(
      [
        { list_key: 'LOAD_SREM', slot: 1, display_name: 'Anna', phone_national: '600000010', country: 'PL', active: true },
        { list_key: 'UNLOAD_BODEN', slot: 2, display_name: 'Ola', phone_national: '0700000000', country: 'SE', active: false },
      ],
      false, '+48000000010',
      [{ label: 'Telefon', last_seen_at: '2026-10-21T09:55:00Z', revoked_at: null, paused: false, day_sent: 3, day_limit: 150 }],
      NOW,
    );
    expect(s.places[0].people[0]).toEqual({ userId: null, name: 'Anna', country: 'PL', phone: '600000010', kinds: ['A', 'C', 'D'] });
    expect(s.places[1].people).toEqual([null, null]);
    expect(s.sending).toBe(false);
    expect(s.gateway).toEqual({ active: true, lastSignal: '2026-10-21T09:55:00Z', today: 3, limit: 150 });
  });
  it('zapis tym samym RPC; usunięcie = nieaktywna; wyzwalacze i SMS testowe zostają', () => {
    const l = read('src/auth/LiveSmsPlaces.tsx');
    for (const rpc of ['admin_sms_zone_recipient_set', 'admin_sms_zone_trigger_set', 'admin_sms_zone_test']) expect(l).toContain(`'${rpc}'`);
    expect(l).toContain('p_active: false');
    expect(l).toContain('kindsFixed: true');
    expect(read('src/components/options/SmsPlaces.tsx')).toContain('disabled={readOnly || busy || na || kindsFixed ||');
  });
  it('1366 px: osoba, numer i A/B/C/D w jednym wierszu', () => {
    expect(read('src/components/options/smsPlaces.css')).toMatch(/@media \(min-width: 1281px\) and \(max-width: 1599px\)\{\s*\.sp-row\{grid-template-columns:minmax\(120px,150px\) 76px minmax\(112px,132px\) max-content auto/);
  });
});

describe('Opłata paliwowa — sefs_week_for_load, sefs_parameters, fuel-prices', () => {
  const cur: WeekCalc = {
    ok: true, status: 'OSTATECZNY', final: true, avg_sek: 23.04, avg_pln: 7.41, n_sek: 4, n_pln: 5, mult_sek: 1.14, mult_pln: 1.17, applied_mult: 1.14,
    load_week_start: '2026-10-19', load_week_end: '2026-10-25', prev_week_start: '2026-10-12', prev_week_end: '2026-10-18',
    days_sek: [{ day: '2026-10-12', value: 23.14, published_on: '2026-10-12' }, { day: '2026-10-13', value: 23.14, published_on: '2026-10-12' }],
    pubs_pln: [{ value: 7.089, published_on: '2026-10-13' }],
  };
  const runs: FuelRun[] = [
    { ran_at: '2026-10-21T05:15:00Z', ok: true, result: { sources: { okq8: { ok: true }, orlen: { ok: true } } } },
    { ran_at: '2026-10-20T05:15:00Z', ok: true, result: { okq8: 22.69, orlen: 7092 } },
    { ran_at: '2026-10-18T05:15:00Z', ok: false, result: { error: 'x' } },
  ];
  it('tabela załącznika „do X” → przedziały od–do', () => {
    expect(tiersFromDb([{ lte: 22.5, mult: 1.12 }, { lte: 22.2, mult: 1.11 }])).toEqual([{ from: 22.2, to: 22.49, mult: 1.11 }, { from: 22.5, to: 22.79, mult: 1.12 }]);
  });
  it('HHL: tydzień, średnie i mnożniki z bazy; dni z publikacji; pobieranie z fuel-prices', () => {
    const v = hhlFuelView({ today: '2026-10-21', params: { version: 3, valid_from: '2026-09-28', agreed_with_carrier: true, tiers_sek: [], tiers_pln: [] }, cur, next: null, curDays: null, runs, exampleBaseEur: 6900, missWhy: 'brak publikacji' });
    expect(v.current).toMatchObject({ from: '2026-10-19', idxFrom: '2026-10-12', applied: 1.14, final: true, okq8: { avg: 23.04, n: 4, mult: 1.14 } });
    expect(v.fetch.at).toBe('07:15');
    expect(v.fetch.today).toEqual({ date: '2026-10-21', okq8: true, orlen: true });
    expect(v.alarm).toBeNull();
    const prev = v.days[1];
    expect(prev.closed).toEqual({ okq8: 23.04, orlen: 7.41, mult: 1.14 });
    const d13 = prev.rows.find((r) => r.date === '2026-10-13')!;
    expect(d13).toMatchObject({ okq8: 23.14, okq8Pub: '2026-10-12', orlen: 7.089, orlenPub: null });
    expect(prev.rows.find((r) => r.date === '2026-10-12')!).toMatchObject({ how: 'MISSING', missing: { source: 'ORLEN', why: 'brak publikacji' } });
    expect(fetchDay(runs, '2026-10-18')).toEqual({ date: '2026-10-18', okq8: false, orlen: false });
    expect(mondayOf('2026-10-25')).toBe('2026-10-19');
  });
  it('KSH / SCX (5B): mnożnik z migawek własnych transportów, bez publikacji, alarmu i pobierania', () => {
    const load = (code: string, refDate: string, applied: number, eur: number) => ({
      code, pricing: { money: { v: 2, tier: 'PROGNOZA', rev: { computedEur: eur, invoicedEur: null, fuel: { refDate, multSek: applied, multPln: applied + 0.02, applied, status: 'OSTATECZNY' } }, cost: { computedEur: 0, invoicedEur: null, fuel: { refDate: '', multSek: 1, multPln: 1, applied: 1 } } } },
    }) as unknown as Load;
    const v = partyFuelView({ today: '2026-10-21', side: 'rev', loads: [load('SG-01', '2026-10-20', 1.13, 8186.85)], params: null });
    expect(v.current).toMatchObject({ applied: 1.13, final: true, okq8: { avg: null, mult: 1.13 }, orlen: { mult: 1.15 } });
    expect(v.days).toEqual([]);
    expect(v.alarm).toBeNull();
    expect(v.exampleBaseEur).toBe(7245);
  });
  it('Opcje (HHL) i Dla mnie (KSH, SCX) ładują LiveFuel; BafForm i SefsReadOnly rozwijane pod ekranem', () => {
    expect(read('src/views/OptionsView.tsx')).toContain('block(<LiveFuel readOnly={ro} />)');
    expect(read('src/views/SettingsView.tsx')).toContain('block(<LiveFuel readOnly party={role} />)');
    const f = read('src/auth/LiveFuel.tsx');
    expect(f).toContain("sb.rpc('sefs_week_for_load'");
    expect(f).toContain('<SefsReadOnly />');
    expect(read('src/components/options/MoneyScreens.tsx')).toContain('data-pm-days-none');
  });
  it('komputer: ceny i tabela mnożników obok siebie, gdy panel ma miejsce (img/e3-opcje-desk)', () => {
    const c = read('src/components/options/money.css');
    expect(c).toContain('.pm-fuel{container-type:inline-size}');
    expect(c).toMatch(/@container \(max-width:799px\)\{\s*\.pm-two\{grid-template-columns:minmax\(0,1fr\)\}/);
    expect(c).not.toMatch(/@media \(max-width:1680px\)\{\s*\.pm-two/);
  });
});

describe('Finanse — wygląd (E4, E39, E44)', () => {
  it('tabela tygodni opłaty paliwowej łamie komórki zamiast poszerzać tabelę', () => {
    const c = read('src/components/finance/finance.css');
    expect(c).toContain('.fin-table[data-fuel-table] td,.fin-table[data-fuel-table] td.num{white-space:normal}');
    expect(c).toContain('.fin-nw{white-space:nowrap}');
    const f = read('src/components/finance/FuelWeekTable.tsx');
    expect(f).toContain('<span className="fin-nw">{full.slice(0, at)}</span> <span className="fin-nw">{full.slice(at + 1)}</span>');
    expect(f).toContain("const publ = s.n != null ? ` ${ftp(locale, 'p5_fuel_publ', { n: s.n }).trim()}` : '';");
  });
  it('„Nowa faktura” w osobnym panelu pod listą; pozycje na całą szerokość przy węższym panelu', () => {
    const b = read('src/views/BillsPanel.tsx');
    expect(b).toContain('<section className="panel fin-panel inv-new-panel" ref={wizardRef} data-bill-new-panel={direction}>');
    expect(b.indexOf('data-bill-new-panel')).toBeGreaterThan(b.indexOf('</table>'));
    expect(read('src/components/invoices/invoices.css')).toMatch(/@container \(max-width:1199px\)\{\s*\.inv-form-grid\{grid-template-columns:minmax\(0,1fr\)\}/);
  });
});

describe('teksty w słowniku', () => {
  it('klucze nowych ekranów są w słowniku PL', () => {
    for (const k of ['ol2_status_more', 'ol2_src_why_stale', 'ol2_src_smsgw', 'ol2_rate_more', 'ol2_fuel_more', 'ol2_fuel_more_party', 'ol2_sms_more', 'ol2_sms_triggers_h']) {
      expect(hasKey('pl', k), k).toBe(true);
    }
  });
});

describe('F7 #415 — opłata paliwowa, prawdziwy kształt odpowiedzi sefs_week_calc (produkcja 21.10.2026)', () => {
  /* odpowiedzi z bazy (skrócone do pól ekranu): tydzień bieżący (OSTATECZNY), przyszły (PROGNOZA z kotwicą 12.10)
     i „na poniedziałek 26.10” — jedyne źródło dni tygodnia 19–25.10 */
  const cur: WeekCalc = {
    ok: true, final: true, status: 'OSTATECZNY', n_pln: 5, n_sek: 7, avg_pln: 7.11, avg_sek: 23.1, mult_pln: 1.13, mult_sek: 1.14, applied_mult: 1.13,
    load_week_start: '2026-10-19', load_week_end: '2026-10-25', prev_week_start: '2026-10-12', prev_week_end: '2026-10-18',
    days_sek: [
      { day: '2026-10-12', value: 23.14, published_on: '2026-10-12' }, { day: '2026-10-13', value: 22.94, published_on: '2026-10-13' },
      { day: '2026-10-17', value: 23.04, published_on: '2026-10-16' }, { day: '2026-10-18', value: 23.04, published_on: '2026-10-16' },
    ],
    pubs_pln: [{ value: 7.089, published_on: '2026-10-13' }, { value: 7.081, published_on: '2026-10-17' }],
  };
  const next: WeekCalc = {
    ok: true, final: false, status: 'PROGNOZA', n_pln: 5, n_sek: 7, avg_pln: 7.11, avg_sek: 23.1, mult_pln: 1.13, mult_sek: 1.14, applied_mult: 1.13,
    load_week_start: '2026-10-26', load_week_end: '2026-11-01', prev_week_start: '2026-10-12', prev_week_end: '2026-10-18',
    load_prev_week_start: '2026-10-19', load_prev_week_end: '2026-10-25',
    days_sek: cur.days_sek, pubs_pln: cur.pubs_pln,
  };
  const curDays: WeekCalc = {
    ok: true, final: true, status: 'OSTATECZNY', load_week_start: '2026-10-26', prev_week_start: '2026-10-19', prev_week_end: '2026-10-25',
    days_sek: [
      { day: '2026-10-19', value: 22.69, published_on: '2026-10-19' }, { day: '2026-10-20', value: 23.09, published_on: '2026-10-20' },
      { day: '2026-10-21', value: 23.09, published_on: '2026-10-20' }, { day: '2026-10-22', value: 23.09, published_on: '2026-10-20' },
    ],
    pubs_pln: [{ value: 7.092, published_on: '2026-10-20' }, { value: 7.127, published_on: '2026-10-21' }],
  };
  const v = hhlFuelView({
    today: '2026-10-21', params: null, cur, next, curDays,
    plnPubs: [{ value: 7.124, published_on: '2026-10-10' }, { value: 7.081, published_on: '2026-10-17' }],
    runs: [], exampleBaseEur: 6900, missWhy: 'brak publikacji',
  });
  it('bieżący tydzień: OKQ8 23,10 (n=7, ×1,14), Orlen 7,11 (n=5, ×1,13), stosowany ×1,13 ostateczny', () => {
    expect(v.current).toMatchObject({ from: '2026-10-19', idxFrom: '2026-10-12', idxTo: '2026-10-18', applied: 1.13, final: true,
      okq8: { avg: 23.1, n: 7, mult: 1.14 }, orlen: { avg: 7.11, n: 5, mult: 1.13 } });
  });
  it('przyszły tydzień: wskaźniki z load_prev_week_* (19–25.10), nie z kotwicy (12.10)', () => {
    expect(v.next).toMatchObject({ from: '2026-10-26', idxFrom: '2026-10-19', idxTo: '2026-10-25', forecast: 1.13, finalOn: '2026-10-26' });
  });
  it('dwie listy cen: 19–25.10 (do dziś) z wywołania „na poniedziałek”, 12–18.10 z tygodnia bieżącego', () => {
    expect(v.days.map((g) => [g.from, g.to, g.rows.map((r) => r.date)])).toEqual([
      ['2026-10-19', '2026-10-25', ['2026-10-21', '2026-10-20', '2026-10-19']],
      ['2026-10-12', '2026-10-18', ['2026-10-18', '2026-10-17', '2026-10-16', '2026-10-15', '2026-10-14', '2026-10-13', '2026-10-12']],
    ]);
    const d19 = v.days[0].rows.find((r) => r.date === '2026-10-19')!;
    /* poniedziałek bez publikacji Orlen — cena z soboty 17.10 */
    expect(d19).toMatchObject({ okq8: 22.69, orlen: 7.081, orlenPub: '2026-10-17' });
    expect(v.days[0].rows.find((r) => r.date === '2026-10-21')!).toMatchObject({ okq8: 23.09, okq8Pub: '2026-10-20', orlen: 7.127, orlenPub: null });
    expect(v.days[1].rows.find((r) => r.date === '2026-10-12')!).toMatchObject({ orlen: 7.124, orlenPub: '2026-10-10' });
    expect(v.days[1].closed).toEqual({ okq8: 23.1, orlen: 7.11, mult: 1.13 });
  });
  it('LiveFuel pyta o ceny tygodnia bieżącego osobnym wywołaniem (dziś = poniedziałek przyszłego tygodnia)', () => {
    expect(read('src/auth/LiveFuel.tsx')).toContain("sb.rpc('sefs_week_for_load', { p_project: pid, p_load_date: nextMon, p_today: nextMon })");
  });
});

describe('F7 #415 — odczyt i zapis', () => {
  it('SMS: błąd odczytu — komunikat i zapis wstrzymany', () => {
    const l = read('src/auth/LiveSmsPlaces.tsx');
    expect(l).toContain('const err = r.error ?? f.error ?? n.error ?? d.error;');
    expect(l).toContain("if (blockedRef.current) return { ok: false, error: t(locale, 'ol2_sms_blocked') };");
    expect(l).toContain('readOnly={readOnly || !!readErr}');
  });
  it('wyjątek przy odświeżaniu — komunikat (Cennik, Paliwo, Dopłaty, Stan systemu)', () => {
    for (const f of ['LiveRateCard', 'LiveFuel', 'LiveDwell', 'LiveStatus']) expect(read(`src/auth/${f}.tsx`), f).toMatch(/\} catch \(e\) \{\s*\/\* F7 #415/);
  });
  it('Cennik: zapis w tabeli odświeża formularz i odwrotnie', () => {
    expect(read('src/auth/LiveRateCard.tsx')).toContain('<RateCardForm readOnly={readOnly} reload={formReload} onSaved={() => void refresh()} />');
    const f = read('src/auth/RateCardForm.tsx');
    expect(f).toContain('useEffect(() => { void refresh(); }, [refresh, reload]);');
    expect(f).toContain('if (!error) { await refresh(); onSaved?.(); }');
  });
  it('strefy pod SMS — Operacje HHL tylko podgląd', () => {
    expect(read('src/views/OptionsView.tsx')).toContain("disabled={ro} onClick={() => { if (ro) return; saveGeofence(");
  });
});

/* D-20261020-1322-01: próg „od” — wiersz podświetlony tak, jak liczy baza (sefs_week_calc 19.10.2026: SEK 23,10 → ×1,14, PLN 7,11 → ×1,13) */
describe('W-paliwo-progi: tabela mnożników czytana „od progu”', () => {
  const pln = tiersFromDb([{ lte: 7.0, mult: 1.12 }, { lte: 7.1, mult: 1.13 }, { lte: 7.2, mult: 1.14 }, { lte: 7.3, mult: 1.15 }]);
  const sek = tiersFromDb([{ lte: 22.8, mult: 1.13 }, { lte: 23.1, mult: 1.14 }, { lte: 23.4, mult: 1.15 }]);
  const at = (tiers: ReturnType<typeof tiersFromDb>, v: number) => tiers[tierOf(tiers, v)].mult;
  it('PLN jak w dopisku', () => {
    expect([7.0, 7.1, 7.11, 7.19, 7.2].map((v) => at(pln, v))).toEqual([1.12, 1.13, 1.13, 1.13, 1.14]);
    expect(at(pln, 6.5)).toBe(1.12);
    expect(at(pln, 9.9)).toBe(1.15);
  });
  it('SEK jak w dopisku', () => {
    expect([22.8, 22.85, 23.09, 23.1, 23.12].map((v) => at(sek, v))).toEqual([1.13, 1.13, 1.13, 1.14, 1.14]);
  });
  it('przedziały na ekranie: od progu do następnego minus 0,01', () => {
    expect(pln.map((r) => [r.from, r.to])).toEqual([[7, 7.09], [7.1, 7.19], [7.2, 7.29], [7.3, 7.39]]);
  });
});

