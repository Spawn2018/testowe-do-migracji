/**
 * #412 E43 na produkcji (baza 0289): „Treści wiadomości” — odczyt, zapis i przywrócenie z bazy, komunikat bazy przy
 * odmowie, bez próbnej wysyłki, uczciwa informacja, że wysyłka czyta jeszcze treści domyślne (P8).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { savedFromDb } from '../src/lib/p8tProd';

describe('treści z bazy — mapowanie', () => {
  it('wiersz z bazy', () => {
    expect(savedFromDb({ id: 'SMS_A', subject: null, body: 'Dzien dobry {{plate}}', at: '2026-10-24T08:00:00Z', who: 'Anna' }))
      .toEqual({ id: 'SMS_A', subject: null, body: 'Dzien dobry {{plate}}', at: '2026-10-24T08:00:00Z', who: 'Anna' });
    expect(savedFromDb({ id: 'EM_X', subject: 'Temat', body: 'b', at: null, who: '' })).toEqual({ id: 'EM_X', subject: 'Temat', body: 'b', at: '', who: '—' });
  });
  it('zły kształt → null', () => {
    for (const raw of [null, 'x', {}, { id: '', body: 'b' }, { id: 'A', body: 3 }]) expect(savedFromDb(raw)).toBeNull();
  });
});

describe('podłączenie', () => {
  const prod = readFileSync('src/lib/p8tProd.ts', 'utf8');
  const src = readFileSync('src/lib/p8Source.ts', 'utf8');
  const ui = readFileSync('src/components/options/MessageTexts.tsx', 'utf8');
  it('RPC z 0289 i nazwy parametrów', () => {
    expect(prod).toContain("sb.rpc('message_texts_list')");
    expect(prod).toContain("sb.rpc('message_texts_set', { p_kind: id, p_subject: subject, p_body: body })");
    expect(prod).toContain("sb.rpc('message_texts_reset', { p_kind: id })");
    expect(prod).toContain('sendTest: null,');
  });
  it('produkcja → baza; demo bez zmian (warunek wpisany wprost)', () => {
    expect(src).toContain("return import.meta.env.VITE_AUTH_MODE !== 'supabase'");
    expect(src).toContain(': messageTextsProd();');
  });
  it('komunikat bazy przy odmowie; informacja o wysyłce (P8)', () => {
    expect(ui).toContain("text: r.error ?? p8t('p8_fail')");
    expect(ui).toContain("p8t(item.channel === 'LOGIN' ? 'p8_prod_login' : 'p8_prod_store')");
  });
});
