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
  it('tylko wgrane PDF faktur z paczki + CMR', () => {
    const bills = [{ id: 'b1', pdfDocId: 'd1' }, { id: 'b2', pdfDocId: 'd2' }] as unknown as Bill[];
    const docs = [{ id: 'd1', status: 'UPLOADED' }, { id: 'd2', status: 'UPLOADED' }, { id: 'd3', status: 'MISSING' }] as unknown as Document[];
    const cmr = [{ id: 'c1', status: 'UPLOADED' }] as unknown as Document[];
    expect(packZipDocs(['b1'], bills, cmr, docs).map((d) => d.id)).toEqual(['d1', 'c1']);
  });
});

describe('LivePack — podłączenie', () => {
  const live = readFileSync('src/auth/LivePack.tsx', 'utf8');
  const fin = readFileSync('src/views/FinanceView.tsx', 'utf8');
  it('RPC z 0286 i nazwy parametrów', () => {
    expect(live).toContain("sb.rpc('accounting_pack_config')");
    expect(live).toContain("sb.rpc('accounting_pack_send', { p_pack: key, p_week: weekKey, p_files: [], p_resend: resend })");
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
