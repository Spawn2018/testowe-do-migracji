/**
 * wyglad/P5 — Faktury (E4, img/e4-faktury-desk / -phone) i faktoring (E4b): jeden status, tygodnie „Do wystawienia”,
 * kafelki, wypłata faktoringu, etykieta tygodnia, terminy 35 / 30 dni (03_REJESTR „Faktury”).
 * Numery i kwoty zmyślone (G-09).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Bill } from '../src/types';
import {
  billDiff, billStatus, factoringPayout, invoiceKpis, ISSUER, pendingWeeks, RECIPIENT, weekKeyLabel,
} from '../src/lib/p5Invoices';
import { BILL_TERM_DAYS, invoicedLoadIds, isoWeekMonday } from '../src/lib/invoices3';
import { buildDemoSnapshot, DEMO_TODAY_LOCAL } from '../src/data/demoProvider';
import { isoWeekKeyLocal } from '../src/lib/money/engine';
import { unloadedAtOf } from '../src/lib/money/loadMoney';

function bill(p: Partial<Bill>): Bill {
  return {
    id: 'b-1', direction: 'KOSZT', issuer: 'SCX', recipient: 'HHL', number: 'TEST/1', issueDate: '2026-10-05',
    weekKey: '2026-W40', currency: 'EUR', net: 100, vat: 23, gross: 123, dueDate: '2026-11-09', dueFromDocument: false,
    verification: 'DO_WERYFIKACJI', payment: 'NIEOPLACONA', lines: [], headerFlags: [], missingLoadIds: [], createdAt: '2026-10-05T08:00:00Z',
    ...p,
  } as Bill;
}

describe('E4 — jeden status faktury', () => {
  it('Opłacona > Sporna > Po terminie > weryfikacja', () => {
    expect(billStatus({ payment: 'OPLACONA', verification: 'SPORNA' })).toBe('OPLACONA');
    expect(billStatus({ payment: 'PO_TERMINIE', verification: 'SPORNA' })).toBe('SPORNA');
    expect(billStatus({ payment: 'PO_TERMINIE', verification: 'ZAAKCEPTOWANA' })).toBe('PO_TERMINIE');
    expect(billStatus({ payment: 'NIEOPLACONA', verification: 'DO_WERYFIKACJI' })).toBe('DO_WERYFIKACJI');
    expect(billStatus({ payment: 'NIEOPLACONA', verification: 'ZAAKCEPTOWANA' })).toBe('ZAAKCEPTOWANA');
  });
  it('strony: wystawca i weryfikujący według kierunku', () => {
    expect([ISSUER.KOSZT, RECIPIENT.KOSZT]).toEqual(['SCX', 'HHL']);
    expect([ISSUER.PRZYCHOD, RECIPIENT.PRZYCHOD]).toEqual(['HHL', 'KSH']);
  });
  it('różnica faktura − wyliczenie z pozycji', () => {
    const b = bill({ lines: [
      { loadId: 'a', invoicedNet: 7797, expectedNet: 7797 },
      { loadId: 'b', invoicedNet: 6406.3, expectedNet: 6226.3 },
    ] as Bill['lines'] });
    expect(billDiff(b)).toBe(180);
  });
  it('etykieta tygodnia „41 · 05.10.2026–11.10.2026” (rok zawsze — właściciel 16.10.2026)', () => {
    expect(weekKeyLabel('2026-W41')).toBe('41 · 05.10.2026–11.10.2026');
    expect(weekKeyLabel('2026-W01')).toBe('1 · 29.12.2025–04.01.2026');
  });
  it('terminy: przewoźnik → HHL 35 dni, HHL → KSH 30 dni', () => {
    expect(BILL_TERM_DAYS).toEqual({ KOSZT: 35, PRZYCHOD: 30 });
  });
});

describe('E4 — tygodnie „Do wystawienia”', () => {
  const snap = buildDemoSnapshot();
  for (const dir of ['KOSZT', 'PRZYCHOD'] as const) {
    it(`${dir}: tylko tygodnie zamknięte, transporty dostarczone w tym tygodniu i jeszcze bez faktury`, () => {
      const rows = pendingWeeks(snap.loads, snap.bills, dir, DEMO_TODAY_LOCAL);
      const done = invoicedLoadIds(snap.bills, dir);
      for (const w of rows) {
        expect(w.from).toBe(isoWeekMonday(w.weekKey));
        expect(w.to < DEMO_TODAY_LOCAL).toBe(true);
        expect(w.no).toBe(Number(w.weekKey.slice(-2)));
        expect(w.loads.length).toBeGreaterThan(0);
        for (const l of w.loads) {
          expect(isoWeekKeyLocal(unloadedAtOf(l)!)).toBe(w.weekKey);
          expect(done.has(l.id)).toBe(false);
        }
        expect(w.netEur).toBeGreaterThanOrEqual(0);
      }
      expect([...rows].map((r) => r.weekKey)).toEqual([...rows].map((r) => r.weekKey).sort());
    });
  }
});

describe('E4 — kafelki', () => {
  const today = '2026-10-14';
  const bills = [
    bill({ id: 'v', verification: 'DO_WERYFIKACJI', dueDate: '2026-10-20' }),
    bill({ id: 'a', verification: 'ZAAKCEPTOWANA', dueDate: '2026-10-30' }),
    bill({ id: 'o', verification: 'ZAAKCEPTOWANA', payment: 'PO_TERMINIE', dueDate: '2026-10-01' }),
    bill({ id: 's', verification: 'SPORNA', payment: 'PO_TERMINIE', dueDate: '2026-10-02' }),
    bill({ id: 'p', verification: 'ZAAKCEPTOWANA', payment: 'OPLACONA', dueDate: '2026-10-15' }),
    bill({ id: 'r', direction: 'PRZYCHOD', issuer: 'HHL', recipient: 'KSH', dueDate: '2026-10-16' }),
  ];
  it('HHL na koszcie: weryfikuje sam; do zapłaty w 7 dni bez opłaconych i spornych; po terminie bez spornych', () => {
    const k = invoiceKpis('HHL', bills, [], 'KOSZT', today);
    expect(k.verifyMine).toBe(true);
    expect(k.toVerify.map((b) => b.id)).toEqual(['v']);
    expect(k.dueSoon.map((b) => b.id)).toEqual(['v']);
    expect(k.nextDue).toBe('2026-10-20');
    expect(k.overdue.map((b) => b.id)).toEqual(['o']);
  });
  it('SCX na koszcie: czeka na weryfikację HHL; KSH na przychodzie weryfikuje sam', () => {
    expect(invoiceKpis('SCX', bills, [], 'KOSZT', today).verifyMine).toBe(false);
    const k = invoiceKpis('KSH', bills, [], 'PRZYCHOD', today);
    expect(k.verifyMine).toBe(true);
    expect(k.toVerify.map((b) => b.id)).toEqual(['r']);
  });
});

describe('E4b — faktoring HHL', () => {
  it('prowizja % od netto, wypłata = brutto − prowizja', () => {
    expect(factoringPayout(21820.3, 26838.97, 1)).toEqual({ fee: 218.2, payout: 26620.77 });
    expect(factoringPayout(1000, 1230, 0)).toEqual({ fee: 0, payout: 1230 });
  });
});

describe('E4 „Jedna strona” — bez makiety i bez osobnego „Zgodna”', () => {
  const view = readFileSync(new URL('../src/views/InvoicesView.tsx', import.meta.url), 'utf8');
  const panel = readFileSync(new URL('../src/views/BillsPanel.tsx', import.meta.url), 'utf8');
  it('widok nie ma porównania trójstronnego ani formularza oferty faktoringu z makiety', () => {
    expect(view).not.toMatch(/threeWay|ThreeWay|factoringForm|FactoringOfferForm|data-three/);
  });
  it('szczegóły faktury: przyciski „Sporna” i „Akceptuj”, bez „Zgodna”', () => {
    expect(panel).toMatch(/data-verify="SPORNA"/);
    expect(panel).toMatch(/data-verify="ZAAKCEPTOWANA"/);
    expect(panel).not.toMatch(/data-verify="ZGODNA"|verify\('ZGODNA'\)/);
  });
});
