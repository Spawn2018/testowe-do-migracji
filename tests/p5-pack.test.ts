/**
 * wyglad/P5 — E40 „Paczka tygodnia dla księgowości”: zawartość paczek KSH i HHL, blokady wysyłki (1A–5B),
 * etykieta tygodnia, nazwy plików. Numery, kody i adresy zmyślone (G-09).
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Bill, Document, Load } from '../src/types';
import { accountingPack, fileSafe, hasSignedCmr, packWeekLabel, packWeeks, type PackConfig } from '../src/lib/p5Pack';

const L = (id: string, code: string, at: string): Load => ({
  id, code, hhlOrderNo: `H-${code}`, carrierOrderNo: `S-${code}`,
  events: [{ type: 'UNLOADED', at }], unloadedAt: at, status: 'DELIVERED',
} as unknown as Load);
const LOADS = [L('a', 'TA-01', '2026-10-06T10:00:00Z'), L('b', 'TA-02', '2026-10-07T10:00:00Z')];
const bill = (p: Partial<Bill>): Bill => ({
  id: 'x', direction: 'PRZYCHOD', issuer: 'HHL', recipient: 'KSH', number: 'FV/41/2026', issueDate: '2026-10-12', weekKey: '2026-W41',
  currency: 'EUR', net: 100, vat: 23, gross: 123, dueDate: '2026-11-11', dueFromDocument: false, verification: 'DO_WERYFIKACJI',
  payment: 'NIEOPLACONA', pdfName: 'f.pdf', lines: [{ loadId: 'a', invoicedNet: 50 }, { loadId: 'b', invoicedNet: 50 }] as Bill['lines'],
  headerFlags: [], missingLoadIds: [], createdAt: '2026-10-12T08:00:00Z', ...p,
} as Bill);
const CMR = (loadId: string, status = 'UPLOADED') => ({ loadId, category: 'CMR', status } as Pick<Document, 'loadId' | 'category' | 'status'>);
const CFG: PackConfig = { addresses: { KSH: ['a@example.com'], HHL: ['b@example.com'] }, sent: {} };

describe('E40 — tydzień i pliki', () => {
  it('etykieta „t41 · 05.10.2026–11.10.2026”, tygodnie faktur od najnowszego', () => {
    expect(packWeekLabel('2026-W41')).toBe('t41 · 05.10.2026–11.10.2026');
    expect(packWeeks([{ weekKey: '2026-W40' }, { weekKey: '2026-W41' }, { weekKey: '2026-W40' }])).toEqual(['2026-W41', '2026-W40']);
  });
  it('nazwy plików: numer faktury bez ukośników, CMR po kodzie, zestawienie z tygodniem i paczką', () => {
    expect(fileSafe('FV/41/2026')).toBe('FV_41_2026');
    const p = accountingPack('KSH', '2026-W41', LOADS, [bill({})], [CMR('a'), CMR('b')], CFG);
    expect(p.files).toEqual(['FV_41_2026.pdf', 'TA-01_CMR.pdf', 'TA-02_CMR.pdf', 'Zestawienie_t41_KSH.pdf']);
    expect(p.total).toEqual({ net: 100, vat: 23, gross: 123, currency: 'EUR' });
    expect(p.blocks).toEqual([]);
  });
  it('CMR z podpisem = wgrany CMR transportu', () => {
    expect(hasSignedCmr('a', [CMR('a')])).toBe(true);
    expect(hasSignedCmr('a', [CMR('a', 'MISSING')])).toBe(false);
  });
});

describe('E40 — blokady wysyłki', () => {
  it('KSH: brak faktury HHL → KSH', () => {
    const p = accountingPack('KSH', '2026-W41', LOADS, [], [], CFG);
    expect(p.blocks.map((b) => b.kind)).toEqual(['NO_INVOICE']);
  });
  it('HHL (1A, 2A): tylko faktura SCX → HHL; przed akceptacją HHL wysyłka zablokowana, sporna — osobny powód', () => {
    const scx = bill({ id: 'k', direction: 'KOSZT', issuer: 'SCX', recipient: 'HHL', number: 'S/41/1' });
    const all = [bill({}), scx];
    const p = accountingPack('HHL', '2026-W41', LOADS, all, [CMR('a'), CMR('b')], CFG);
    expect(p.bills.map((b) => b.id)).toEqual(['k']);
    expect(p.blocks).toEqual([{ kind: 'NOT_ACCEPTED', number: 'S/41/1' }]);
    expect(accountingPack('HHL', '2026-W41', LOADS, [{ ...scx, verification: 'ZGODNA' }], [CMR('a'), CMR('b')], CFG).blocks[0].kind).toBe('NOT_ACCEPTED');
    expect(accountingPack('HHL', '2026-W41', LOADS, [{ ...scx, verification: 'SPORNA' }], [CMR('a'), CMR('b')], CFG).blocks[0].kind).toBe('DISPUTED');
    expect(accountingPack('HHL', '2026-W41', LOADS, [{ ...scx, verification: 'ZAAKCEPTOWANA' }], [CMR('a'), CMR('b')], CFG).blocks).toEqual([]);
  });
  it('3A: brak CMR przy którymkolwiek transporcie; brak PDF; brak adresu w Opcjach', () => {
    const p = accountingPack('KSH', '2026-W41', LOADS, [bill({ pdfName: null, pdfStoragePath: null })], [CMR('a')], null);
    expect(p.blocks).toEqual([{ kind: 'NO_PDF', number: 'FV/41/2026' }, { kind: 'NO_CMR', codes: ['TA-02'] }, { kind: 'NO_ADDRESS' }]);
    expect(p.loads.map((l) => [l.code, l.cmr])).toEqual([['TA-01', true], ['TA-02', false]]);
  });
  it('dziennik: wysłana paczka z kluczem tygodnia i paczki', () => {
    const sent = { at: '2026-10-12T07:14:00Z', to: 1, status: 'DORECZONO' as const, by: 'Konto pokazowe' };
    const p = accountingPack('KSH', '2026-W41', LOADS, [bill({})], [CMR('a'), CMR('b')], { ...CFG, sent: { '2026-W41:KSH': sent } });
    expect(p.sent).toEqual(sent);
  });
});

describe('E40 — tylko HHL i tylko po podłączeniu', () => {
  it('Finanse pokazują paczkę wyłącznie HHL; źródło zwraca dane tylko w demo (I-0)', () => {
    const view = readFileSync(new URL('../src/views/FinanceView.tsx', import.meta.url), 'utf8');
    expect(view).toMatch(/role === 'HHL' \? accountingPackConfigOf\(bills\) : null/);
    const src = readFileSync(new URL('../src/lib/p5Source.ts', import.meta.url), 'utf8');
    expect(src).toMatch(/VITE_AUTH_MODE !== 'supabase' \? demoAccountingPack\(bills\) : null/);
    expect(src).toMatch(/VITE_AUTH_MODE !== 'supabase' \? demoPackActions\(\) : null/);
  });
});
