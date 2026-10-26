/**
 * wyglad/P5-c — Kokpit „Marża” z liczbą transportów z ceną i bez (E16), opłata paliwowa przy pozycji faktury (E39),
 * karta opłaty paliwowej w panelu „Ceny” z liczbą publikacji i „ostateczna od …” (E39), odrzucenie dopłaty z powodem
 * (E33), stawka dobowa postoju od 10 h (W41, decyzja właściciela 15.10.2026, 18:32). Dane zmyślone (G-09).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildCockpit, type CockpitInput } from '../src/lib/cockpitE9';
import { billLineFuel } from '../src/lib/p5cFuel';
import { DECIDED_RULES, dwellFee, reasonReaderOf, rejecterOf, rejectNeedsReason, rejectionVisibleTo } from '../src/lib/p5Fees';
import { fc, fcp } from '../src/i18n/p5c';
import { t } from '../src/i18n/messages';
import type { Load } from '../src/types';

const src = (f: string) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
const T = '2026-10-14';

const priced = (p: Partial<Load['pricing']> & { refCost?: string; refRev?: string; status?: 'PROGNOZA' | 'OSTATECZNY' }): Load => ({
  id: 'x', code: 'TST-01',
  pricing: {
    costSefs: 897, revSefs: 941.85, currency: 'EUR',
    money: {
      v: 2, tier: 'REALIZACJA',
      cost: { tier: 'REALIZACJA', computedEur: 7797, invoicedEur: null, fuel: { refDate: p.refCost ?? '2026-10-07', multSek: 1.13, multPln: 1.15, applied: 1.13, status: 'status' in p ? p.status : 'OSTATECZNY' }, fx: { tableNo: '', mid: 0, date: '', provisional: false } },
      rev: { tier: 'REALIZACJA', computedEur: 8186.85, invoicedEur: null, fuel: { refDate: p.refRev ?? '2026-10-07', multSek: 1.13, multPln: 1.15, applied: 1.13, status: 'status' in p ? p.status : 'OSTATECZNY' }, fx: { tableNo: '', mid: 0, date: '', provisional: false } },
    },
    ...p,
  },
} as unknown as Load);

describe('E39 — opłata paliwowa przy pozycji faktury', () => {
  it('faktura SCX → HHL: strona kosztu, tydzień załadunku i mnożnik, kwota w EUR', () => {
    expect(billLineFuel(priced({}), 'KOSZT', 'EUR', null, T)).toEqual({ week: 41, mult: 1.13, amount: 897, currency: 'EUR', forecast: false });
    expect(fcp('pl', 'p5c_bd_fuel', { week: 41, mult: '1,13' })).toBe('Opłata paliwowa t41 · ×1,13');
  });
  it('faktura HHL → KSH: strona przychodu; faktura w PLN — kwota po kursie pozycji, bez kursu — bez kwoty', () => {
    expect(billLineFuel(priced({}), 'PRZYCHOD', 'EUR', null, T)?.amount).toBe(941.85);
    const fx = { tableNo: '195/A/NBP/2026', mid: 4.3797, effectiveDate: '2026-10-07' } as never;
    expect(billLineFuel(priced({}), 'PRZYCHOD', 'PLN', fx, T)?.amount).toBe(4125.02);
    expect(billLineFuel(priced({}), 'PRZYCHOD', 'PLN', null, T)).toMatchObject({ amount: null, currency: 'PLN' });
  });
  it('prognoza oznaczona; bez daty załadunku albo ceny — bez linii', () => {
    expect(billLineFuel(priced({ status: 'PROGNOZA' }), 'KOSZT', 'EUR', null, T)?.forecast).toBe(true);
    expect(billLineFuel(priced({ status: 'WSTEPNY' as never }), 'KOSZT', 'EUR', null, T)?.forecast).toBe(true);
    /* bez statusu: prognoza, dopóki tydzień wskaźników (przed tygodniem załadunku) trwa — jak w Finansach */
    expect(billLineFuel(priced({ status: undefined as never, refCost: '2026-10-21' }), 'KOSZT', 'EUR', null, T)?.forecast).toBe(true);
    expect(billLineFuel(priced({ status: 'BRAK' as never }), 'KOSZT', 'EUR', null, T)).toBeNull();
    expect(billLineFuel(priced({ refCost: '' }), 'KOSZT', 'EUR', null, T)).toBeNull();
    expect(billLineFuel(undefined, 'KOSZT', 'EUR', null, T)).toBeNull();
  });
  it('tabela pozycji: kolumna „Transport”, „Kurs NBP” z przecinkiem, „Sporna” wielką literą, powód sporu po polsku', () => {
    const v = src('views/BillsPanel.tsx');
    expect(v).toContain("billLineFuel(l, bill.direction, bill.currency, ln.fx, localDateOf(getNowIso()))");
    expect(v).toContain('data-bill-fuel={fuel.week}');
    expect(v).toContain('formatPlNumber(ln.fx.mid, 4)');
    expect(v).not.toContain('ln.fx.mid.toFixed(4)');
    expect(fc('pl', 'p5c_bd_load')).toBe('Transport');
    expect(t('pl', 'bill_dispute_ph')).toBe('Powód sporu — wymagany przy „Sporna”');
    expect(t('pl', 'bill_dispute_ph')).not.toMatch(/SPORNA/);
  });
});

describe('E16 — Kokpit „Marża”: liczba transportów z ceną i bez ceny', () => {
  const base: CockpitInput = {
    role: 'HHL', locale: 'pl', nowIso: '2026-10-14T10:00:00Z', loads: [], documents: [], bills: [],
    todo: { total: 0, loads: 0, other: 0 }, ferry: null,
    margin: { pct: 0.0477, moneyText: '32 891,26 EUR', tierText: 'prognoza' },
  };
  const tile = (m: CockpitInput['margin']) => buildCockpit({ ...base, margin: m }).find((x) => x.id === 'margin');
  it('86 z ceną, 8 bez ceny (jak w nagłówku Finansów)', () => {
    expect(tile({ ...base.margin, priced: 86, unpriced: 8 })?.desc).toBe('32 891,26 EUR · ważona przychodem · 86 z ceną · 8 bez ceny');
    expect(tile({ ...base.margin, priced: 72, unpriced: 0 })?.desc).toBe('32 891,26 EUR · ważona przychodem · 72 z ceną');
    expect(tile({ ...base.margin, priced: 0, unpriced: 0 })?.desc).toBe('32 891,26 EUR · ważona przychodem');
  });
  it('bez liczb (inna firma) — dotychczasowy opis', () => {
    expect(tile(base.margin)?.desc).toBe('32 891,26 EUR · ważona przychodem');
  });
  it('Kokpit liczy marżę i liczby z tego samego źródła co Finanse (`financeOf`, suma marż ÷ suma przychodów)', () => {
    const d = src('views/DashboardView.tsx');
    /* financeSummary = to, co zwraca financeOf w Finansach (p5Source) — bez wczytywania przykładów demo w Kokpicie */
    expect(d).toMatch(/financeSummary\(loads, 'both', nbpLive \?\? latestNbp\(loads\)\)/);
    expect(src('lib/p5Source.ts')).toMatch(/return financeSummary\(loads, side, live \?\? latestNbp\(loads\)\);/);
    expect(fcp('pl', 'p5c_priced_line', { priced: 1, unpriced: 2 })).toBe('1 z ceną · 2 bez ceny');
    expect(d).toContain('pct: r > 0 ? (r - c) / r : null');
  });
});

describe('E39 — karta opłaty paliwowej w panelu „Ceny”', () => {
  const v = src('components/drawer/PanelPrices.tsx');
  it('liczba publikacji przy średniej, prognoza „ostateczna od …”, tydzień wskaźników jeszcze trwa', () => {
    expect(fcp('pl', 'p5c_fuel_n', { n: 4 })).toBe('(4 publ.)');
    expect(fcp('pl', 'p5c_fuel_final_from', { date: '19.10' })).toBe('ostateczna od 19.10');
    expect(fcp('pl', 'p5c_fuel_running', { x: '×1,13', last: 't40' })).toBe('jeszcze nie zamknięte, do tego czasu ostatnia ostateczna ×1,13 (wskaźniki t40)');
    expect(v).toContain("fcp(locale, 'p5c_fuel_n', { n: fuelRow.okq8.n })");
    expect(v).toContain('data-pp-final={fuelRow.finalFrom');
    /* wiersz kwoty jak na obrazie E39: „t43 · ×1,13 prognoza” */
    expect(v).toContain("fuelRow?.state === 'PROGNOZA' ? ` ${fc(locale, 'p5c_bd_fuel_fc')}` : ''");
  });
});

describe('E33 — odrzucenie dopłaty z powodem', () => {
  const v = src('components/drawer/PanelPrices.tsx');
  it('zasady: dopłatę HHL odrzuca KSH (powód nieobowiązkowy, czyta HHL), dopłatę SCX — HHL (powód obowiązkowy, czyta SCX)', () => {
    expect([rejecterOf('hhl'), rejectNeedsReason('hhl'), reasonReaderOf('hhl')]).toEqual(['KSH', false, 'HHL']);
    expect([rejecterOf('scx'), rejectNeedsReason('scx'), reasonReaderOf('scx')]).toEqual(['HHL', true, 'SCX']);
  });
  it('„Odrzucona przez …” widzi strona dopłaty, odrzucający i HHL; KSH nie widzi dopłat SCX', () => {
    const who = (side: 'hhl' | 'scx') => (['HHL', 'KSH', 'SCX'] as const).filter((r) => rejectionVisibleTo(r, side));
    expect(who('hhl')).toEqual(['HHL', 'KSH']);
    expect(who('scx')).toEqual(['HHL', 'SCX']);
    expect(fcp('pl', 'p5c_rej_by', { who: 'HHL', reason: 'spóźnienie na załadunek' })).toBe('Odrzucona przez HHL: spóźnienie na załadunek');
  });
  it('panel: formularz z pola powodu (Enter zatwierdza, Escape zamyka), tylko dla firmy odrzucającej, bez powodu — przycisk nieaktywny', () => {
    expect(v).toMatch(/data-fee-reject onClick=\{\(\) => setRejecting\(/);
    expect(v).toContain('rejecterOf(rejecting.side) === role');
    expect(v).toContain('disabled={rejNeed && !rej.draft.trim()}');
    expect(v).toMatch(/<form[\s\S]*?data-fee-reject-form/);
    expect(v).toContain("if (e.key === 'Escape')");
    expect(fcp('pl', 'p5c_rej_need', { who: 'SCX' })).toBe('Wpisz powód — zobaczy go SCX.');
  });
});

describe('W41 — stawka dobowa postoju od 10 h (15.10.2026, 18:32)', () => {
  it('zasady i przykład: 12 h na załadunku → 1 doba × 750 EUR; panel „Powyżej 10 h”', () => {
    expect(DECIDED_RULES.dayAfterH).toBe(10);
    expect(dwellFee(12 * 60, 'LOAD')).toMatchObject({ days: 1, eur: 750 });
    expect(src('components/drawer/PanelPrices.tsx')).toContain("ftp(locale, 'p5_pr_rule_day', { h: rules.dayAfterH })");
  });
});
