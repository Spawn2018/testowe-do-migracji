/**
 * wyglad/W-naprawy — wygląd i obliczenia widoku pod naprawy audytu 17.10 (D-20261017-0730-01), zanim wykonawca zrobi bazę.
 * A4: kreator faktury — na fakturę tylko transporty z CMR, reszta tygodnia szara z „czeka na CMR”.
 * B5: Historia — wpis zrobiony w Podglądzie: „Administrator // H&H Logistics jako osoba // KSH”.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Document, Load, LoadEvent } from '../src/types';
import { billReady } from '../src/lib/invoices3';
import { histRow } from '../src/lib/p6History';

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const load = (id: string, status: string) => ({ id, code: id, status } as unknown as Load);
const cmr = (loadId: string, status: Document['status']) => ({ id: `d-${loadId}`, loadId, category: 'CMR', status } as unknown as Document);

describe('A4 · faktura tylko z CMR (kreator)', () => {
  it('„Gotowe do fakturowania” i „Zafakturowano” — na fakturę; „Dostarczone” tylko z wgranym CMR', () => {
    expect(billReady(load('SG-01', 'READY_TO_INVOICE'))).toBe(true);
    expect(billReady(load('SG-02', 'INVOICED'))).toBe(true);
    expect(billReady(load('SG-03', 'DELIVERED'))).toBe(false);
    expect(billReady(load('SG-03', 'DELIVERED'), [cmr('SG-03', 'MISSING')])).toBe(false);
    expect(billReady(load('SG-03', 'DELIVERED'), [cmr('SG-03', 'UPLOADED')])).toBe(true);
    expect(billReady(load('SG-04', 'DELIVERED'), [cmr('SG-03', 'UPLOADED')])).toBe(false);
  });
  it('kreator: pozycje faktury tylko z gotowych; szare wiersze bez pola kwoty, nie do zaznaczenia, z „czeka na CMR”', () => {
    const s = read('src/views/BillsPanel.tsx');
    expect(s).toMatch(/const candidates = useMemo\(\(\) => weekLoads\.filter\(\(l\) => billReady\(l, documents\)\)/);
    expect(s).toMatch(/const waiting = useMemo\(\(\) => weekLoads\.filter\(\(l\) => !billReady\(l, documents\)\)/);
    expect(s).toMatch(/lines: candidates\.filter\(\(l\) => lineOf\(l\.id\)\.on\)/);
    expect(s).toMatch(/<tr key=\{l\.id\} className="inv-wait" data-w-wait=\{l\.code\}>/);
    expect(s).toMatch(/checked=\{false\} disabled/);
    expect(read('src/i18n/p5.ts')).toContain("p5_inv_wait_cmr: 'czeka na CMR',");
    expect(read('src/components/finance/finance.css')).toContain('.fin-table tr.inv-wait td{color:var(--ink-3);background:var(--surface-2)}');
  });
  it('„pominięty z tygodnia” tylko wśród transportów z CMR; kwota co do grosza (BILL_TOLERANCE 0,01)', () => {
    const s = read('src/lib/invoices3.ts');
    expect(s).toMatch(/\.filter\(\(l\) => !onBill\.has\(l\.id\) && billReady\(l, documents\)\)/);
    expect(s).toContain('export const BILL_TOLERANCE = { abs: 0.01, pct: 0 };');
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
