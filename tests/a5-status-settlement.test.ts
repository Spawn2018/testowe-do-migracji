// wyglad/A5 (E25 „Rozliczenie”, decyzje 07.10 17:46; D-20261015-0300-01 A5): okno „Zmień status” prosi o CMR
// przy „Gotowe do fakturowania” i pokazuje faktury SCX → HHL i HHL → KSH przy „Zafakturowano”.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { billVisible, currentCmr, settlementGate } from '../src/lib/statusSettlement';
import type { Bill, Document } from '../src/types';

const L = 'load-1';
const doc = (over: Partial<Document>): Document => ({
  id: 'd1', loadId: L, category: 'CMR', name: 'SG-03_CMR.pdf', uploadedAt: '2026-10-07T11:00:00Z', deadline: null,
  status: 'UPLOADED', permitFits: null, visibleTo: ['HHL', 'SCX', 'KSH'], ...over,
});
const bill = (id: string, direction: Bill['direction'], loadIds: string[]): Bill => ({
  id, direction, issuer: direction === 'KOSZT' ? 'SCX' : 'HHL', recipient: direction === 'KOSZT' ? 'HHL' : 'KSH',
  number: `FV ${id}`, issueDate: '2026-10-12', weekKey: '2026-W41', currency: 'EUR', net: 1, vat: 0, gross: 1,
  dueDate: '2026-11-11', dueFromDocument: false, verification: 'DO_WERYFIKACJI', payment: 'NIEOPLACONA',
  lines: loadIds.map((loadId) => ({ loadId, invoicedNet: 1, flags: [] })), headerFlags: [], missingLoadIds: [], createdAt: '2026-10-12T10:00:00Z',
});

describe('A5: „Gotowe do fakturowania” wymaga CMR', () => {
  it('bez CMR — zablokowane; zastąpiony plik i puste wymaganie się nie liczą', () => {
    expect(settlementGate('READY_TO_INVOICE', L, 'SCX', [], [])).toEqual({ kind: 'cmr', cmr: null, blocked: true });
    const docs = [doc({ superseded: true }), doc({ id: 'd2', status: 'MISSING', uploadedAt: null }), doc({ id: 'd3', category: 'PERMIT_PL' })];
    expect(settlementGate('READY_TO_INVOICE', L, 'HHL', docs, [])?.blocked).toBe(true);
  });
  it('z CMR — odblokowane, pokazuje najnowszy plik', () => {
    const docs = [doc({ id: 'old', uploadedAt: '2026-10-07T10:00:00Z' }), doc({ id: 'new', uploadedAt: '2026-10-07T12:00:00Z' })];
    expect(currentCmr(L, docs)?.id).toBe('new');
    expect(settlementGate('READY_TO_INVOICE', L, 'SCX', docs, [])?.blocked).toBe(false);
  });
  it('inne statusy bez warunku', () => {
    expect(settlementGate('DELIVERED', L, 'HHL', [], [])).toBeNull();
  });
});

describe('A5: „Zafakturowano” — obie faktury, widać której brakuje', () => {
  it('HHL widzi obie strony; brak faktury HHL → KSH blokuje', () => {
    const g = settlementGate('INVOICED', L, 'HHL', [], [bill('k1', 'KOSZT', [L])]);
    expect(g?.kind).toBe('inv');
    if (g?.kind !== 'inv') return;
    expect(g.missing).toEqual(['PRZYCHOD']);
    expect(g.blocked).toBe(true);
    expect(g.rows.map((r) => [r.dir, r.bill?.id ?? null, r.hidden])).toEqual([['KOSZT', 'k1', false], ['PRZYCHOD', null, false]]);
  });
  it('obie faktury z tym transportem — odblokowane; faktura z innym transportem się nie liczy', () => {
    const g = settlementGate('INVOICED', L, 'HHL', [], [bill('k1', 'KOSZT', [L]), bill('p0', 'PRZYCHOD', ['inny']), bill('p1', 'PRZYCHOD', ['inny', L])]);
    expect(g?.blocked).toBe(false);
    if (g?.kind === 'inv') expect(g.rows[1]!.bill?.id).toBe('p1');
  });
  it('SCX nie widzi faktury HHL → KSH — „sprawdzi baza”, blokuje tylko brak własnej', () => {
    expect(billVisible('PRZYCHOD', 'SCX')).toBe(false);
    expect(billVisible('KOSZT', 'KSH')).toBe(false);
    const own = settlementGate('INVOICED', L, 'SCX', [], [bill('k1', 'KOSZT', [L])]);
    expect(own?.blocked).toBe(false);
    if (own?.kind === 'inv') expect(own.rows[1]!.hidden).toBe(true);
    expect(settlementGate('INVOICED', L, 'SCX', [], [])?.blocked).toBe(true);
  });
});

describe('A5: okno', () => {
  it('„Wgraj CMR” otwiera dzisiejsze okno „Wgraj dokument” tylko z CMR; „Zapisz” blokuje brak', () => {
    const src = readFileSync('src/components/drawer/StatusChangeModal.tsx', 'utf8');
    expect(src).toMatch(/settlementGate\(status, loadId, role, documents, bills\)/);
    expect(src).toMatch(/allowed=\{\['CMR'\]\}/);
    expect(src).toMatch(/disabled=\{busy \|\| blocked\}/);
    expect(src).toMatch(/data-status-invoices/);
  });
});
