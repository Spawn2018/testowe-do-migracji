/** M6 — faktury v2: strony i widoczność, kontrole (lustro register_invoice), termin, płatność, akcje store. */
import { beforeEach, describe, expect, it } from 'vitest';
import {
  addDaysIso, billCandidates, billDueDate, billParties, billPaymentToday, billVisibleTo, canMarkPaid, canRegisterBill,
  canVerifyBill, checkBill, expectedNetFor, isoWeekMonday, verifyError, buildSeedBills, type BillDraft,
} from '../src/lib/invoices3';
import { buildDemoSnapshot, DEMO_TODAY_LOCAL } from '../src/data/demoProvider';
import { useTowerStore } from '../src/store/useTowerStore';
import { isoWeekKeyLocal } from '../src/lib/money/engine';
import { unloadedAtOf } from '../src/lib/money/loadMoney';
import type { Load } from '../src/types';

const snap = buildDemoSnapshot();
const delivered = snap.loads.filter((l) => unloadedAtOf(l));
const weekOf = (l: Load) => isoWeekKeyLocal(unloadedAtOf(l)!);
const freeWeek = (() => {
  const used = new Set(snap.bills.map((b) => b.weekKey));
  return delivered.map(weekOf).find((w) => !used.has(w))!;
})();

function draftFor(direction: 'KOSZT' | 'PRZYCHOD', currency: 'EUR' | 'PLN', p: Partial<BillDraft> = {}): BillDraft {
  const ls = billCandidates(snap.loads, snap.bills, direction, freeWeek);
  return {
    direction, number: 'FV/TEST/1', issueDate: DEMO_TODAY_LOCAL, weekKey: freeWeek, currency,
    net: 100, vat: 0, gross: 100, pdfName: 'f.pdf',
    lines: ls.map((l) => ({ loadId: l.id, invoicedNet: expectedNetFor(l, direction, currency, DEMO_TODAY_LOCAL) ?? 0 })),
    ...p,
  };
}

describe('M6 — strony i uprawnienia (W7, Q14)', () => {
  it('KOSZT = SCX → HHL, PRZYCHOD = HHL → KSH', () => {
    expect(billParties('KOSZT')).toEqual({ issuer: 'SCX', recipient: 'HHL' });
    expect(billParties('PRZYCHOD')).toEqual({ issuer: 'HHL', recipient: 'KSH' });
  });
  it('widoczność: KSH nigdy kosztowej, SCX nigdy przychodowej, HHL wszystkie', () => {
    const k = billParties('KOSZT'); const p = billParties('PRZYCHOD');
    expect(billVisibleTo('KSH', k)).toBe(false);
    expect(billVisibleTo('SCX', p)).toBe(false);
    expect(billVisibleTo('HHL', k) && billVisibleTo('HHL', p)).toBe(true);
    expect(billVisibleTo('SCX', k) && billVisibleTo('KSH', p)).toBe(true);
  });
  it('rejestruje wystawca, weryfikuje odbiorca, „Opłacona” wyłącznie HHL', () => {
    expect(canRegisterBill('SCX', 'KOSZT')).toBe(true);
    expect(canRegisterBill('HHL', 'KOSZT')).toBe(false);
    expect(canRegisterBill('HHL', 'PRZYCHOD')).toBe(true);
    expect(canRegisterBill('KSH', 'PRZYCHOD')).toBe(false);
    expect(canVerifyBill('HHL', { recipient: 'HHL', verification: 'DO_WERYFIKACJI' })).toBe(true);
    expect(canVerifyBill('SCX', { recipient: 'HHL', verification: 'DO_WERYFIKACJI' })).toBe(false);
    expect(canVerifyBill('KSH', { recipient: 'KSH', verification: 'DO_WERYFIKACJI' })).toBe(true);
    expect(canVerifyBill('HHL', { recipient: 'KSH', verification: 'DO_WERYFIKACJI' })).toBe(false);
    expect(canMarkPaid('HHL')).toBe(true);
    expect(canMarkPaid('SCX')).toBe(false);
    expect(canMarkPaid('KSH')).toBe(false);
  });
  it('SPORNA wymaga uzasadnienia (Q7)', () => {
    expect(verifyError('SPORNA', '  ')).not.toBeNull();
    expect(verifyError('SPORNA', 'zła stawka')).toBeNull();
    expect(verifyError('ZGODNA')).toBeNull();
  });
});

describe('M6 — termin i płatność (Q3/Q4)', () => {
  it('dokument > relacja: 30 dni KSH, 35 dni HHL wobec SCX', () => {
    expect(billDueDate('PRZYCHOD', '2026-09-01')).toBe('2026-10-01');
    expect(billDueDate('KOSZT', '2026-09-01')).toBe('2026-10-06');
    expect(billDueDate('KOSZT', '2026-09-01', '2026-09-20')).toBe('2026-09-20');
    expect(billDueDate('KOSZT', '2026-09-01', null, 14)).toBe('2026-09-15');
  });
  it('stan płatności liczony w obie strony', () => {
    expect(billPaymentToday({ dueDate: '2026-09-22', paidAt: null, payment: 'NIEOPLACONA' }, '2026-09-23')).toBe('PO_TERMINIE');
    expect(billPaymentToday({ dueDate: '2026-09-23', paidAt: null, payment: 'PO_TERMINIE' }, '2026-09-23')).toBe('NIEOPLACONA');
    expect(billPaymentToday({ dueDate: '2026-09-01', paidAt: '2026-09-10', payment: 'NIEOPLACONA' }, '2026-09-23')).toBe('OPLACONA');
  });
  it('tydzień ISO → poniedziałek; dodawanie dni', () => {
    expect(isoWeekMonday('2026-W39')).toBe('2026-09-21');
    expect(isoWeekMonday('2026-W01')).toBe('2025-12-29');
    expect(addDaysIso('2026-12-30', 3)).toBe('2027-01-02');
  });
});

describe('M6 — kontrole przy rejestracji (lustro register_invoice)', () => {
  it('faktura zgodna z wyliczeniem — bez uwag, bez błędów', () => {
    const c = checkBill(draftFor('KOSZT', 'EUR'), snap.loads, snap.bills, DEMO_TODAY_LOCAL);
    expect(c.errors).toEqual([]);
    expect(c.lines.length).toBeGreaterThan(0);
    expect(c.lines.every((l) => l.flags.length === 0)).toBe(true);
    expect(c.headerFlags).toEqual([]);
  });
  it('wymagane: numer, data, netto/VAT/brutto, PDF, pozycje', () => {
    const c = checkBill(draftFor('KOSZT', 'EUR', { number: ' ', net: null, pdfName: null, lines: [] }), snap.loads, snap.bills, DEMO_TODAY_LOCAL);
    expect(c.errors).toEqual(expect.arrayContaining(['NUMBER', 'AMOUNTS', 'PDF', 'NO_LINES']));
  });
  it('KWOTA poza tolerancją (> 1 i > 0,2 %), w tolerancji — bez flagi', () => {
    const d = draftFor('KOSZT', 'EUR');
    const bumped = { ...d, lines: d.lines.map((l, i) => (i === 0 ? { ...l, invoicedNet: l.invoicedNet + 50 } : l)) };
    expect(checkBill(bumped, snap.loads, snap.bills, DEMO_TODAY_LOCAL).lines[0].flags).toContain('KWOTA');
    const small = { ...d, lines: d.lines.map((l, i) => (i === 0 ? { ...l, invoicedNet: l.invoicedNet + 0.9 } : l)) };
    expect(checkBill(small, snap.loads, snap.bills, DEMO_TODAY_LOCAL).lines[0].flags).not.toContain('KWOTA');
  });
  it('zły tydzień, niezrealizowany, pominięty z tygodnia (BRAK_NA_FAKTURZE)', () => {
    const d = draftFor('PRZYCHOD', 'EUR');
    const planned = snap.loads.find((l) => !unloadedAtOf(l))!;
    const other = delivered.find((l) => weekOf(l) !== freeWeek)!;
    const c = checkBill({ ...d, lines: [...d.lines.slice(1), { loadId: planned.id, invoicedNet: 1 }, { loadId: other.id, invoicedNet: 1 }] }, snap.loads, snap.bills, DEMO_TODAY_LOCAL);
    expect(c.lines.find((l) => l.loadId === planned.id)!.flags).toContain('NIEZREALIZOWANY');
    const otherFlags = c.lines.find((l) => l.loadId === other.id)!.flags;
    if (!snap.bills.some((b) => b.direction === 'PRZYCHOD' && b.lines.some((x) => x.loadId === other.id))) expect(otherFlags).toContain('ZLY_TYDZIEN');
    expect(c.headerFlags).toEqual(['BRAK_NA_FAKTURZE']);
    expect(c.missingLoadIds).toEqual([d.lines[0].loadId]);
  });
  it('podwójne fakturowanie tego samego kierunku → błąd; drugi kierunek dozwolony', () => {
    const k = snap.bills.find((b) => b.direction === 'KOSZT')!;
    const d = { ...draftFor('KOSZT', 'EUR'), weekKey: k.weekKey, lines: [{ loadId: k.lines[0].loadId, invoicedNet: k.lines[0].invoicedNet }] };
    expect(checkBill(d, snap.loads, snap.bills, DEMO_TODAY_LOCAL).errors.some((e) => e.startsWith('DOUBLE:'))).toBe(true);
    const onlyCost = snap.bills.filter((b) => b.direction === 'KOSZT');
    expect(checkBill({ ...d, direction: 'PRZYCHOD' }, snap.loads, onlyCost, DEMO_TODAY_LOCAL).errors).toEqual([]);
  });
  it('faktura PLN: brak kursu pozycji → BRAK_KURSU; kurs inny niż reguła → TABELA/KURS/DATA', () => {
    const d = draftFor('KOSZT', 'PLN');
    const noFx = checkBill({ ...d, lines: d.lines.map((l) => ({ ...l, fx: null })) }, snap.loads, snap.bills, '2026-12-31');
    expect(noFx.lines[0].flags).toContain('BRAK_KURSU');
    const wrong = checkBill({ ...d, lines: d.lines.map((l) => ({ ...l, fx: { tableNo: '001/A/NBP/2026', mid: 4.1, effectiveDate: '2026-01-02' } })) }, snap.loads, snap.bills, '2026-12-31');
    expect(wrong.lines[0].flags).toEqual(expect.arrayContaining(['TABELA_NBP', 'KURS_NBP', 'DATA_KURSU']));
  });
});

describe('M6 — dane startowe i akcje store', () => {
  beforeEach(() => useTowerStore.setState({ ...buildDemoSnapshot(), role: 'HHL', notifications: [] }));
  it('po dwie faktury w każdym kierunku, deterministycznie; EUR i PLN; statusy różne', () => {
    const a = buildSeedBills(snap.loads, DEMO_TODAY_LOCAL);
    expect(a).toEqual(buildSeedBills(snap.loads, DEMO_TODAY_LOCAL));
    expect(a.filter((b) => b.direction === 'KOSZT')).toHaveLength(2);
    expect(a.filter((b) => b.direction === 'PRZYCHOD')).toHaveLength(2);
    expect(new Set(a.map((b) => b.currency))).toEqual(new Set(['EUR', 'PLN']));
    expect(a.some((b) => b.payment === 'OPLACONA')).toBe(true);
    expect(a.some((b) => b.payment === 'PO_TERMINIE')).toBe(true);
  });
  it('rejestracja: SCX kosztowa → powiadomienie HHL; HHL nie zarejestruje kosztowej', () => {
    useTowerStore.setState({ role: 'HHL' });
    expect(useTowerStore.getState().registerBill(draftFor('KOSZT', 'EUR'))).toEqual({ ok: false, errors: ['ROLE'] });
    useTowerStore.setState({ role: 'SCX' });
    const r = useTowerStore.getState().registerBill(draftFor('KOSZT', 'EUR'));
    expect(r.ok).toBe(true);
    const s = useTowerStore.getState();
    expect(s.bills[0].issuer).toBe('SCX');
    expect(s.bills[0].dueDate).toBe(addDaysIso(DEMO_TODAY_LOCAL, 35));
    expect(s.notifications[0].roleScope).toEqual(['HHL']);
    // druga rejestracja tych samych transportów — blokada
    const again = useTowerStore.getState().registerBill({ ...draftFor('KOSZT', 'EUR'), number: 'FV/TEST/2' });
    expect(again.ok).toBe(false);
  });
  it('weryfikacja: odbiorca; SPORNA bez uzasadnienia odrzucona; „Opłacona” tylko HHL, cofnięcie z powodem', () => {
    const p = useTowerStore.getState().bills.find((b) => b.direction === 'PRZYCHOD')!;
    expect(useTowerStore.getState().verifyBill(p.id, 'ZGODNA')).toBe(false); // HHL = wystawca
    useTowerStore.setState({ role: 'KSH' });
    expect(useTowerStore.getState().verifyBill(p.id, 'SPORNA', '')).toBe(false);
    expect(useTowerStore.getState().verifyBill(p.id, 'SPORNA', 'stawka niezgodna z cennikiem')).toBe(true);
    expect(useTowerStore.getState().bills.find((b) => b.id === p.id)!.disputeNote).toBe('stawka niezgodna z cennikiem');
    expect(useTowerStore.getState().markBillPaid(p.id, DEMO_TODAY_LOCAL)).toBe(false);
    useTowerStore.setState({ role: 'SCX' });
    expect(useTowerStore.getState().markBillPaid(p.id, DEMO_TODAY_LOCAL)).toBe(false);
    useTowerStore.setState({ role: 'HHL' });
    expect(useTowerStore.getState().markBillPaid(p.id, DEMO_TODAY_LOCAL)).toBe(true);
    expect(useTowerStore.getState().bills.find((b) => b.id === p.id)!.payment).toBe('OPLACONA');
    expect(useTowerStore.getState().unmarkBillPaid(p.id, ' ')).toBe(false);
    expect(useTowerStore.getState().unmarkBillPaid(p.id, 'błędna data')).toBe(true);
    expect(useTowerStore.getState().bills.find((b) => b.id === p.id)!.payment).not.toBe('OPLACONA');
  });
});
