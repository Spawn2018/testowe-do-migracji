/**
 * #412 E40 — Finanse › Paczka tygodnia na produkcji (baza 0286): mapowanie `accounting_pack_config()` bez zmyślonych
 * adresów, stan „Zlecono” (e-mail jeszcze nie wychodzi), ZIP z prawdziwych PDF i podłączenie widoku.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { packConfigFromDb, packZipDocs } from '../src/auth/LivePack';
import type { Bill, Document } from '../src/types';

describe('LivePack — mapowanie', () => {
  it('adresy i dziennik z bazy (klucz tydzień:paczka, stan ZLECONO)', () => {
    const cfg = packConfigFromDb({
      addresses: { KSH: ['a@x.pl'], HHL: [] },
      sent: { '2026-W43:KSH': { at: '2026-10-24T08:00:00Z', to: 1, status: 'ZLECONO', by: 'Anna' } },
    });
    expect(cfg).toEqual({
      addresses: { KSH: ['a@x.pl'], HHL: [] },
      sent: { '2026-W43:KSH': { at: '2026-10-24T08:00:00Z', to: 1, status: 'ZLECONO', by: 'Anna' } },
    });
  });
  it('pusty dziennik z bazy', () => {
    expect(packConfigFromDb({ addresses: { KSH: [], HHL: [] }, sent: {} })).toEqual({ addresses: { KSH: [], HHL: [] }, sent: {} });
  });
  it('zły kształt → null; złe wpisy dziennika pominięte', () => {
    for (const raw of [null, 'x', {}, { addresses: { KSH: [] } }, { addresses: 'a' }]) expect(packConfigFromDb(raw)).toBeNull();
    const cfg = packConfigFromDb({
      addresses: { KSH: [], HHL: [] },
      sent: { 'W43:KSH': { at: 'x', status: 'ZLECONO' }, '2026-W43:SCX': { at: 'x', status: 'ZLECONO' }, '2026-W43:HHL': { at: 'x', status: 'NIEZNANY' } },
    });
    expect(cfg?.sent).toEqual({});
  });
});

describe('LivePack — ZIP', () => {
  it('PDF faktur z pliku faktury (dokumentów faktur nie ma w liście) + CMR', () => {
    const bills = [
      { id: 'b1', number: 'FV/1', pdfDocId: 'd1', pdfStoragePath: 'docs/fv1.pdf', pdfName: 'FV_1.pdf', lines: [{ loadId: 'l1' }], createdAt: '2026-10-20', issuer: 'SCX', recipient: 'HHL' },
      { id: 'b2', number: 'FV/2', pdfDocId: 'd2', pdfStoragePath: 'docs/fv2.pdf', lines: [], createdAt: '2026-10-20', issuer: 'SCX', recipient: 'HHL' },
      { id: 'b3', number: 'FV/3', pdfDocId: null, pdfStoragePath: null, lines: [], createdAt: '2026-10-20', issuer: 'SCX', recipient: 'HHL' },
    ] as unknown as Bill[];
    const cmr = [{ id: 'c1', status: 'UPLOADED' }] as unknown as Document[];
    const docs = packZipDocs(['b1', 'b3'], bills, cmr);
    expect(docs.map((d) => d.id)).toEqual(['d1', 'c1']);
    expect(docs[0]).toMatchObject({ category: 'INVOICE', storagePath: 'docs/fv1.pdf', name: 'FV_1.pdf', status: 'UPLOADED' });
  });
});

describe('LivePack — podłączenie', () => {
  const live = readFileSync('src/auth/LivePack.tsx', 'utf8');
  const fin = readFileSync('src/views/FinanceView.tsx', 'utf8');
  it('RPC z 0286 i nazwy parametrów', () => {
    expect(live).toContain("sb.rpc('accounting_pack_config')");
    expect(live).toContain("sb.rpc('accounting_pack_send', { p_pack: key, p_week: weekKey, p_files: [], p_resend: resend })");
  });
  it('ponowienie: po własnym zleceniu i po błędzie odświeżenie dziennika (F7 #518)', () => {
    expect(live).toContain('const resend = !!cfg.sent[k] || ordered.current.has(k);');
    expect(live).toContain('if (r.error) { setNotice(r.error.message); await refresh(true); return null; }');
  });
  it('produkcja bez obietnicy zestawienia', () => {
    const ap = readFileSync('src/components/finance/AccountingPack.tsx', 'utf8');
    expect(ap).toContain('(orderOnly ? p.files.slice(0, -1) : p.files)');
  });
  it('widok „tylko zlecenie” z komunikatem bazy', () => {
    expect(live).toContain('orderOnly');
    expect(live).toContain('notice={notice}');
  });
  it('Finanse: produkcja HHL → LivePack, demo bez zmian', () => {
    expect(fin).toMatch(/const LivePack = import\.meta\.env\.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED \? lazy\(lazyRetry\(\(\) => import\('\.\.\/auth\/LivePack'\)\)\) : null;/);
    expect(fin).toContain("role === 'HHL' && LivePack ?");
    expect(fin).toContain('accountingPackConfigOf(bills)');
  });
});
