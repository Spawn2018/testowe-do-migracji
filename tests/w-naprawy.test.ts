/**
 * wyglad/W-naprawy — wygląd i obliczenia widoku pod naprawy audytu 17.10 (D-20261017-0730-01), zanim wykonawca zrobi bazę.
 * A4: kreator faktury — na fakturę tylko transporty z CMR, reszta tygodnia szara z „czeka na CMR”.
 * B5: Historia — wpis zrobiony w Podglądzie: „Administrator // H&H Logistics jako osoba // KSH”.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Document, Load, LoadEvent } from '../src/types';
import { billReady, billSumOk, parseAmount } from '../src/lib/invoices3';
import { pendingWeekLoads } from '../src/lib/p5Invoices';
import { invoiceTodoCount } from '../src/lib/cockpitE9';
import { buildDemoSnapshot } from '../src/data/demoProvider';
import { histRow } from '../src/lib/p6History';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const load = (id: string, status: string, unloadedAt = '2026-09-23T10:00:00Z') => ({ id, code: id, status, unloadedAt } as unknown as Load);
const cmr = (loadId: string, status: Document['status'], uploadedAt = '2026-09-23T14:00:00+02:00', superseded = false) =>
  ({ id: `d-${loadId}-${uploadedAt}`, loadId, category: 'CMR', status, uploadedAt, superseded } as unknown as Document);

describe('A4 · faktura tylko z CMR (kreator)', () => {
  it('„Gotowe do fakturowania” i „Zafakturowano” — na fakturę; „Dostarczone” tylko z wgranym CMR', () => {
    expect(billReady(load('SG-01', 'READY_TO_INVOICE'))).toBe(true);
    expect(billReady(load('SG-02', 'INVOICED'))).toBe(true);
    expect(billReady(load('SG-03', 'DELIVERED'))).toBe(false);
    expect(billReady(load('SG-03', 'DELIVERED'), [cmr('SG-03', 'MISSING')])).toBe(false);
    expect(billReady(load('SG-03', 'DELIVERED'), [cmr('SG-03', 'UPLOADED')])).toBe(true);
    expect(billReady(load('SG-04', 'DELIVERED'), [cmr('SG-03', 'UPLOADED')])).toBe(false);
  });
  it('lustro automatu C17 (F7 P1): CMR wgrany przed rozładunkiem, zastąpiony, z błędem albo przeterminowany — nie wystarcza', () => {
    expect(billReady(load('SG-03', 'DELIVERED'), [cmr('SG-03', 'UPLOADED', '2026-09-22T08:00:00+02:00')])).toBe(false);
    expect(billReady(load('SG-03', 'DELIVERED'), [cmr('SG-03', 'UPLOADED', '2026-09-23T14:00:00+02:00', true)])).toBe(false);
    expect(billReady(load('SG-03', 'DELIVERED'), [cmr('SG-03', 'MISMATCH')])).toBe(false);
    expect(billReady(load('SG-03', 'DELIVERED'), [cmr('SG-03', 'EXPIRED' as Document['status'])])).toBe(false);
    /* nowsza wersja po rozładunku — wystarcza, choć starsza była przed */
    expect(billReady(load('SG-03', 'DELIVERED'), [cmr('SG-03', 'UPLOADED', '2026-09-22T08:00:00+02:00', true), cmr('SG-03', 'UPLOADED', '2026-09-23T15:00:00+02:00')])).toBe(true);
  });
  it('„zgodna” (F7 B2): dwie różnice ±0,01 się nie znoszą; faktura bez pozycji nie jest zgodna', () => {
    const line = (flags: string[]) => ({ loadId: 'x', invoicedNet: 1, invoicedFuel: null, fx: null, expectedNet: 1, flags }) as never;
    expect(billSumOk({ lines: [line([]), line([])], invoicedTotal: 2, expectedTotal: 2 })).toBe(true);
    expect(billSumOk({ lines: [line(['KWOTA']), line(['KWOTA'])], invoicedTotal: 2, expectedTotal: 2 })).toBe(false);
    expect(billSumOk({ lines: [], invoicedTotal: 0, expectedTotal: 0 })).toBe(false);
    expect(billSumOk({ lines: [line([])], invoicedTotal: 1.01, expectedTotal: 1 })).toBe(false);
  });
  it('kwota wpisana z odstępem tysięcy (F7 P2)', () => {
    expect(parseAmount('6 271,90')).toBe(6271.9);
    expect(parseAmount('6\u00a0271,90')).toBe(6271.9);
    expect(parseAmount('6271.9')).toBe(6271.9);
    expect(parseAmount('  ')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
  });
  it('„Do wystawienia”, liczba przy „Faktury” i Kokpit liczą tylko transporty z CMR (F7 B1)', () => {
    const snap = buildDemoSnapshot();
    const today = '2026-09-28';
    const all = pendingWeekLoads(snap.loads, snap.bills, 'PRZYCHOD', today, snap.documents).flatMap((w) => w.loads);
    expect(all.every((l) => billReady(l, snap.documents))).toBe(true);
    const withoutCmr = pendingWeekLoads(snap.loads, snap.bills, 'PRZYCHOD', today).flatMap((w) => w.loads);
    expect(withoutCmr.length).toBeLessThanOrEqual(all.length);
    const n = invoiceTodoCount('HHL', { loads: snap.loads, documents: snap.documents, bills: snap.bills, today });
    const waitingBills = snap.bills.filter((b) => (b.recipient === 'HHL' && b.verification === 'DO_WERYFIKACJI') || (b.issuer === 'HHL' && b.verification === 'SPORNA')).length;
    expect(n).toBe(waitingBills + all.length);
    expect(read('src/components/shell/Nav.tsx')).toContain('invoiceTodoCount(role, { loads, documents, bills, today: localDateOf(getNowIso()) })');
    expect(read('src/lib/cockpitE9.ts')).toContain('const doneNoCmr = done.filter((l) => !billReady(l, documents));');
  });
  it('kreator: pozycje faktury tylko z gotowych; szare wiersze bez pola kwoty, nie do zaznaczenia, z „czeka na CMR”', () => {
    const s = read('src/views/BillsPanel.tsx');
    expect(s).toMatch(/const ready = weekLoads\.filter\(\(l\) => billReady\(l, documents\)\)/);
    expect(s).toMatch(/const waiting = useMemo\(\(\) => weekLoads\.filter\(\(l\) => !billReady\(l, documents\)\)/);
    expect(s).toMatch(/\.\.\.candidates\.filter\(\(l\) => lineOf\(l\.id\)\.on\)/);
    expect(s).toMatch(/<tr key=\{l\.id\} className="inv-wait" data-w-wait=\{l\.code\}>/);
    expect(s).toMatch(/checked=\{false\} disabled/);
    expect(read('src/i18n/p5.ts')).toContain("p5_inv_wait_cmr: 'czeka na CMR',");
    expect(read('src/components/finance/finance.css')).toContain('.fin-table tr.inv-wait td{color:var(--ink-3);background:var(--surface-2)}');
  });
  it('„pominięty z tygodnia” tylko wśród transportów z CMR; kwota co do grosza — na produkcji razem z A4 w bazie (INVOICE_A4)', () => {
    const s = read('src/lib/invoices3.ts');
    expect(s).toMatch(/\.filter\(\(l\) => !onBill\.has\(l\.id\) && \(!invoiceA4On\(\) \|\| billReady\(l, documents\)\)\)/);
    expect(s).toContain('export const BILL_TOLERANCE_A4 = 0.01;');
    expect(s).toContain('export const BILL_TOLERANCE = { abs: 1, pct: 0.002 };');
    expect(read('src/lib/serverRules.ts')).toContain('INVOICE_A4: true /* A4 register_invoice */,');
    expect(read('src/views/BillsPanel.tsx')).toContain('checkBill(draft, loads, bills, today, documents)');
    expect(read('src/store/useTowerStore.ts')).toContain('checkBill(draft, s.loads, s.bills, today, s.documents)');
  });
});

describe('B5 · Podgląd w Historii', () => {
  const ev = (payload: Record<string, unknown>): LoadEvent => ({
    id: 'e1', loadId: 'SG-03', type: 'NOTE_ADDED', at: '2026-09-23T12:00:00Z', actor: 'Anna Wiśniewska // HHL', payload,
  });
  it('payload.preview_as → „… // H&H Logistics jako Piotr Zając // KSH”; bez Podglądu — jak dotąd', () => {
    expect(histRow(ev({ preview_as: 'Piotr Zając // KSH' }), 'pl').who).toBe('Anna Wiśniewska // H&H Logistics jako Piotr Zając // KSH');
    expect(histRow(ev({}), 'pl').who).toBe('Anna Wiśniewska // H&H Logistics');
  });
});

describe('nazwy nowych spraw z napraw A2, A3, A6 (kody z dopisku 1450 §2 pkt 3)', () => {
  it('„Do zrobienia” ma polskie nazwy dla KSH_DATES_CHECK, DELIVERED_CHECK, CMR_UPLOAD i ich opcji', () => {
    const p6 = read('src/i18n/p6.ts');
    for (const k of ['p6_dec_short_KSH_DATES_CHECK', 'p6_dec_short_DELIVERED_CHECK', 'p6_dec_short_CMR_UPLOAD']) expect(p6, k).toContain(`${k}:`);
    const d = read('src/i18n/decisions.ts');
    for (const k of ['dec_type_KSH_DATES_CHECK', 'dec_type_DELIVERED_CHECK', 'dec_type_CMR_UPLOAD', 'dec_opt_DATES_OK', 'dec_opt_DELIVERED_YES', 'dec_opt_DELIVERED_NO', 'dec_opt_UPLOAD_CMR']) expect(d, k).toContain(`${k}:`);
  });
});

describe('B5 · oś Status jak Historia (F7 runda 2)', () => {
  it('autor „jako” na osi Status przez whoOf — „… // H&H Logistics jako … // KSH”', () => {
    const s = read('src/components/drawer/StatusAxisTab.tsx');
    expect(s).toContain("`${whoOf(h.actor, locale)} ${ht(locale, 'p6b_as')} ${whoOf(h.previewAs, locale)}`");
    expect(read('src/lib/statusAxis.ts')).toContain("previewAs: str('preview_as'),");
  });
});
