/**
 * #588 / C11 — EUR przy pierwszym logowaniu (brak wiersza → odczyt EUR; F7 r3 bez zapisu).
 * Etap: Naprawy audytu / brama bezpieczeństwa; decyzja W1 + PLAN §4 C11.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('C11 — user_preferences EUR przy pierwszym logowaniu', () => {
  it('loadPreferences bez wiersza zwraca EUR bez savePreferences', () => {
    const src = readFileSync('src/data/supabaseProvider.ts', 'utf8');
    const prefs = src.slice(
      src.indexOf('async function loadPreferences'),
      src.indexOf('async function savePreferences'),
    );
    expect(prefs).not.toContain('savePreferences');
    expect(prefs).toContain("return { displayCurrency: 'EUR', theme: null }");
  });

  it('migracja 0323 zakłada wyzwalacz i uzupełnienie braków', () => {
    const sql = readFileSync('supabase/migrations/0323_588_c11_prefs_eur.sql', 'utf8');
    expect(sql).toContain('trg_app_user_prefs_eur');
    expect(sql).toContain("values (new.id, 'EUR')");
    expect(sql).toContain('AUDYT17_C11_PREFS');
  });
});
