/* Właściciel 21.10.2026 19:52: po powrocie na kartę aplikacja się nie przeładowuje; dane odświeżają się w tle; logo czytelne na tle. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const gate = readFileSync(new URL('../src/auth/AuthGate.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/auth/auth.css', import.meta.url), 'utf8');

describe('bez przeładowania po powrocie na kartę', () => {
  it('SIGNED_IN tego samego konta — tylko ciche odświeżenie danych', () => {
    expect(gate).toContain("if (event === 'SIGNED_IN' && session && readyUserRef.current === session.user.id) {");
    expect(gate).toContain("b.refreshFromServer({ keepSelection: true })");
  });
  it('ponowne wczytanie tego samego konta bez ekranu „Ładowanie danych…”', () => {
    expect(gate).toContain('const silent = readyUserRef.current === session.user.id;');
    expect(gate).toContain("if (alive && !silent) setState({ kind: 'loading' });");
  });
  it('powrót na kartę po ≥ 30 s odświeża dane w tle', () => {
    expect(gate).toContain("document.addEventListener('visibilitychange', onVis);");
    expect(gate).toContain('Date.now() - hiddenAt >= 30_000');
  });
  it('logo wybierane po data-theme dokumentu, nie po motywie w store', () => {
    expect(gate).not.toMatch(/theme === 'light' \? '\/brand\/watchtower-logo-full/);
    expect(css).toContain(':root[data-theme="light"] .wt-logo-dark{display:none}');
    expect(css).toContain(':root:not([data-theme="light"]) .wt-logo-light{display:none}');
  });
});
