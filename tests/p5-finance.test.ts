/**
 * wyglad/P5 — Finanse (E16) i opłata paliwowa według tygodnia (E39): liczenie widoku z cen transportów (EUR),
 * strony kwoty według firmy, PLN kursem transportu albo bieżącym, flaga marży z progiem, tygodnie ISO, prognoza.
 * Kody i kwoty zmyślone (G-09). Przykłady demo nie trafiają do produkcji (strażnik I-0).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Load } from '../src/types';
import type { MoneySideV2 } from '../src/lib/money/loadMoney';
import {
  belowThreshold, codeRange, financeSummary, fuelWeeks, isoWeek, marginPct, mondayOf, transportsText, weekLabel, weekOf,
} from '../src/lib/p5Finance';

type Tier = 'PROGNOZA' | 'REALIZACJA' | 'FAKTURA';
function side(eur: number, tier: Tier, fuelDate: string, opts: Partial<MoneySideV2> = {}, status?: 'OSTATECZNY' | 'PROGNOZA'): MoneySideV2 {
  return {
    tier, computedEur: eur, invoicedEur: null,
    fuel: { refDate: fuelDate, multSek: 1.13, multPln: 1.15, applied: 1.13, ...(status ? { status } : {}) },
    fx: { tableNo: '', mid: 0, date: '', provisional: true },
    ...opts,
  };
}
function load(code: string, type: string, rev: MoneySideV2 | null, cost: MoneySideV2 | null, planned: string | null = '2026-10-06'): Load {
  const money = rev && cost ? { v: 2 as const, tier: (['PROGNOZA', 'REALIZACJA', 'FAKTURA'] as Tier[])[Math.min(['PROGNOZA', 'REALIZACJA', 'FAKTURA'].indexOf(rev.tier), ['PROGNOZA', 'REALIZACJA', 'FAKTURA'].indexOf(cost.tier))], rev, cost } : undefined;
  return { id: `id-${code}`, code, itemType: type, plannedLoadDate: planned, pricing: { money } } as unknown as Load;
}

const fxDone = { fx: { tableNo: '901/A/NBP/2026', mid: 4.3855, date: '2026-10-05', provisional: false } };
const LOADS: Load[] = [
  load('TA-01', 'Słupy', side(8259.3, 'REALIZACJA', '2026-10-01', fxDone), side(7866, 'REALIZACJA', '2026-10-01', fxDone)),
  load('TA-02', 'Słupy', side(8000, 'PROGNOZA', '2026-10-13'), side(7600, 'PROGNOZA', '2026-10-13')),
  load('TB-01', 'Belki', side(1000, 'FAKTURA', '2026-09-24', fxDone), side(990, 'FAKTURA', '2026-09-24', fxDone)),
  load('KZ-08', 'Kratownice', null, null, null),
  load('KZ-09', 'Kratownice', null, null, null),
];

describe('E16 — etapy rozliczenia i strony kwoty', () => {
  it('HHL: obie strony, etap = mniej pewna strona, bez ceny osobno (z kodami i „brak daty”)', () => {
    const f = financeSummary(LOADS, 'both');
    expect(f.all).toBe(5);
    expect(f.priced).toBe(3);
    expect(f.unpricedCodes).toEqual(['KZ-08', 'KZ-09']);
    expect(f.unpricedNoDate).toBe(true);
    const by = Object.fromEntries(f.stages.map((s) => [s.stage, s]));
    expect(by.REALIZACJA.count).toBe(1);
    expect(by.REALIZACJA.rev.eur).toBe(8259.3);
    expect(by.REALIZACJA.cost.eur).toBe(7866);
    expect(by.FAKTURA.count).toBe(1);
    expect(by.PROGNOZA.count).toBe(1);
    expect(f.total.rev.eur).toBe(17259.3);
    expect(f.total.cost.eur).toBe(16456);
    expect(marginPct(f.total.rev.eur, f.total.cost.eur)?.toFixed(2)).toBe('4.65');
    expect(f.types.find((t) => t.type === 'Kratownice')).toMatchObject({ priced: 0, all: 2 });
  });
  it('KSH widzi przychód, SCX koszt — druga strona zawsze 0', () => {
    const k = financeSummary(LOADS, 'rev');
    expect(k.total.rev.eur).toBe(17259.3);
    expect(k.total.cost.eur).toBe(0);
    const s = financeSummary(LOADS, 'cost');
    expect(s.total.cost.eur).toBe(16456);
    expect(s.total.rev.eur).toBe(0);
  });
  it('PLN: dostarczony swoim kursem NBP, prognoza kursem bieżącym (ostatnia tabela w danych)', () => {
    const f = financeSummary(LOADS, 'both');
    expect(f.nbpLatest).toEqual({ tableNo: '901/A/NBP/2026', date: '2026-10-05', mid: 4.3855 });
    expect(f.plnComplete).toBe(true);
    expect(f.stages.find((s) => s.stage === 'REALIZACJA')!.rev.pln).toBe(Math.round(8259.3 * 4.3855 * 100) / 100);
    const none = financeSummary([LOADS[1]], 'both');
    expect(none.plnComplete).toBe(false);
  });
  it('flaga marży: bez progu wyłączona; z progiem — lista od najniższej', () => {
    expect(belowThreshold(LOADS, null)).toEqual([]);
    const b = belowThreshold(LOADS, 5);
    expect(b.map((x) => x.code)).toEqual(['TB-01', 'TA-01']); /* TA-02 ma równo 5 % — nie poniżej progu */
    expect(belowThreshold(LOADS, 1)).toEqual([]);
  });
  it('liczebniki i zakres kodów', () => {
    expect([1, 2, 5, 12, 22, 94, 86].map(transportsText)).toEqual([
      '1 transport', '2 transporty', '5 transportów', '12 transportów', '22 transporty', '94 transporty', '86 transportów',
    ]);
    expect(codeRange(['KZ-08', 'KZ-09', 'KZ-10', 'KZ-15'])).toBe('KZ-08 – KZ-15');
    expect(codeRange(['KZ-08', 'KZ-09'])).toBe('KZ-08, KZ-09');
  });
});

describe('E39 — opłata paliwowa według tygodnia załadunku', () => {
  it('tydzień ISO poniedziałek–niedziela', () => {
    expect(isoWeek('2026-10-05')).toBe(41);
    expect(isoWeek('2026-10-11')).toBe(41);
    expect(isoWeek('2026-12-31')).toBe(53);
    expect(mondayOf('2026-10-11')).toBe('2026-10-05');
    expect(weekLabel(weekOf('2026-10-05'))).toBe('t41 · 05.10–11.10');
    expect(weekLabel(weekOf('2026-10-19'), weekOf('2026-12-14'))).toBe('t43–t51 · 19.10–20.12');
  });
  it('wiersze: wskaźniki z tygodnia poprzedniego, ostateczna / prognoza z datą, bez ceny na końcu', () => {
    const rows = fuelWeeks(LOADS, 'cost', '2026-10-14');
    expect(rows.map((r) => r.key)).toEqual(['2026-09-21', '2026-09-28', '2026-10-12', 'none']);
    const t40 = rows[1];
    expect(t40.week?.no).toBe(40);
    expect(t40.idx?.no).toBe(39);
    expect(t40.state).toBe('OSTATECZNA');
    expect(t40.okq8?.mult).toBe(1.13);
    const t42 = rows[2];
    expect(t42.state).toBe('OSTATECZNA');
    const prog = fuelWeeks([load('TA-03', 'Słupy', side(1, 'PROGNOZA', '2026-10-20'), side(1, 'PROGNOZA', '2026-10-20'))], 'cost', '2026-10-14');
    expect(prog[0]).toMatchObject({ state: 'PROGNOZA', finalFrom: '2026-10-19', running: true, okq8: null });
    expect(rows[3]).toMatchObject({ state: 'BRAK', loads: [{ id: 'id-KZ-08', code: 'KZ-08' }, { id: 'id-KZ-09', code: 'KZ-09' }] });
  });
  it('status z bazy ma pierwszeństwo; dalsze tygodnie prognozy z tym samym mnożnikiem — jeden wiersz', () => {
    const mk = (code: string, d: string) => load(code, 'Słupy', side(1, 'PROGNOZA', d, {}, 'PROGNOZA'), side(1, 'PROGNOZA', d, {}, 'PROGNOZA'));
    const rows = fuelWeeks([mk('TA-04', '2026-10-27'), mk('TA-05', '2026-11-03'), mk('TA-06', '2026-11-10')], 'cost', '2026-10-14');
    expect(rows).toHaveLength(1);
    expect(weekLabel(rows[0].week!, rows[0].weekLast)).toBe('t44–t46 · 26.10–15.11');
    expect(rows[0].finalFrom).toBeNull();
    expect(rows[0].loads).toHaveLength(3);
  });
});

describe('I-0 — przykłady P5 tylko w demo', () => {
  it('p5Source woła przykłady wyłącznie za warunkiem trybu demo wpisanym wprost', () => {
    const src = readFileSync(new URL('../src/lib/p5Source.ts', import.meta.url), 'utf8');
    const calls = src.match(/demo[A-Z]\w+\(/g) ?? [];
    const guarded = src.match(/import\.meta\.env\.VITE_AUTH_MODE !== 'supabase' \? demo[A-Z]\w+\(/g) ?? [];
    expect(calls.length).toBeGreaterThan(0);
    expect(guarded.length).toBe(calls.length);
  });
  it('Finanse bez stałego kursu demo i bez progów 12 % / 18 % (E16)', () => {
    const view = readFileSync(new URL('../src/views/FinanceView.tsx', import.meta.url), 'utf8');
    expect(view).not.toMatch(/demoFx|formatAppMoney|DEMO_FX/);
    expect(view).not.toMatch(/0\.18|0\.12|belowThreshold\b(?!\()/);
    expect(view).not.toMatch(/SEFS|BAF|dodatek paliwowy/i);
  });
});
