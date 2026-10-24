/**
 * #412 E40 — Opcje › Pieniądze › Terminy płatności i adresy na produkcji (baza 0285): mapowanie odpowiedzi RPC
 * bez zmyślonych wartości i podłączenie ekranu (zapis tylko Administrator HHL, próbny e-mail ukryty).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { addressesFromDb, termsFromDb } from '../src/auth/LiveTerms';

describe('LiveTerms — mapowanie', () => {
  it('terminy i ostatnia zmiana z bazy', () => {
    expect(termsFromDb({ kshDays: 30, scxDays: 35, changed: { at: '2026-10-24T05:00:00Z', by: 'Anna' } }))
      .toEqual({ kshDays: 30, scxDays: 35, changed: { at: '2026-10-24T05:00:00Z', by: 'Anna' } });
    expect(termsFromDb({ kshDays: 30, scxDays: 35, changed: null })).toEqual({ kshDays: 30, scxDays: 35, changed: null });
  });
  it('zły kształt → null (bez zmyślonych dni)', () => {
    for (const raw of [null, 'x', {}, { kshDays: 0, scxDays: 35 }, { kshDays: 30, scxDays: '35' }]) {
      expect(termsFromDb(raw)).toBeNull();
    }
  });
  it('adresy KSH i HHL; puste wpisy odrzucone; zły kształt → null', () => {
    expect(addressesFromDb({ KSH: ['a@x.pl'], HHL: [] })).toEqual({ KSH: ['a@x.pl'], HHL: [] });
    expect(addressesFromDb({ KSH: ['a@x.pl', ' ', 3], HHL: ['b@y.pl'] })).toEqual({ KSH: ['a@x.pl'], HHL: ['b@y.pl'] });
    expect(addressesFromDb({ KSH: ['a@x.pl'] })).toBeNull();
    expect(addressesFromDb(null)).toBeNull();
  });
});

describe('LiveTerms — podłączenie', () => {
  const live = readFileSync('src/auth/LiveTerms.tsx', 'utf8');
  const ov = readFileSync('src/views/OptionsView.tsx', 'utf8');
  it('RPC z 0285 i nazwy parametrów', () => {
    expect(live).toContain("sb.rpc('payment_terms_options')");
    expect(live).toContain("sb.rpc('accounting_addresses_get')");
    expect(live).toContain("sb.rpc('payment_terms_options_set', { p_side: side, p_days: days })");
    expect(live).toContain("sb.rpc('accounting_addresses_set', { p_pack: key, p_emails: list })");
  });
  it('zapis tylko bez readOnly (Administrator HHL); próbny e-mail ukryty', () => {
    expect(live).toContain('onTermsSave={readOnly ? null : saveTerms}');
    expect(live).toContain('onAddrSave={readOnly ? null : saveAddresses}');
    expect(live).toContain('onTest={null}');
  });
  it('Opcje: produkcja pokazuje LiveTerms, demo — dotychczasowy ekran', () => {
    expect(ov).toMatch(/const LiveTerms = import\.meta\.env\.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED \? lazy\(lazyRetry\(\(\) => import\('\.\.\/auth\/LiveTerms'\)\)\) : null;/);
    expect(ov).toContain("money.push(scr('terms', block(<LiveTerms readOnly={ro} />), { right: change }));");
  });
});
