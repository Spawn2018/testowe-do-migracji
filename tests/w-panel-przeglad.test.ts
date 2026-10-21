/**
 * Właściciel 21.10.2026, 16:27: panel transportu domyślnie na „Przegląd”, a nie na ostatnio otwartej zakładce.
 * Przyczyny: szuflada stale zamontowana (zakładka przechodziła na kolejny transport) i „?zakladka=status” z dzwonka
 * zostający w adresie przy przejściu do innego transportu.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { carrySearch } from '../src/hooks/useRouteSync';

describe('panel transportu — domyślnie Przegląd', () => {
  it('parametry jednorazowe linku nie przechodzą na kolejny transport; ?now= i reszta zostają', () => {
    expect(carrySearch('?zakladka=status')).toBe('');
    expect(carrySearch('?now=2026-10-21T10:00&zakladka=czat&odpowiedz=1&tekst=ok')).toBe('?now=2026-10-21T10%3A00');
    expect(carrySearch('?now=x')).toBe('?now=x');
    expect(carrySearch('')).toBe('');
  });
  it('szuflada wraca do „Przeglądu” przy innym transporcie, chyba że link wskazał zakładkę', () => {
    const src = readFileSync('src/components/drawer/LoadDrawer.tsx', 'utf8');
    expect(src).toContain("if (id && id !== lastId.current && !useTowerStore.getState().drawerTab) setTab('overview');");
    expect(readFileSync('src/hooks/useRouteSync.ts', 'utf8')).toContain('search: carrySearch(cur.search)');
  });
});
