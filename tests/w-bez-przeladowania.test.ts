/* Właściciel 21.10.2026 19:52: po powrocie na kartę aplikacja się nie przeładowuje; dane odświeżają się w tle; logo czytelne na tle.
   F7 #403: cicho tylko przy tym samym kluczu konta (logowanie + profil + widok); każde inne wczytanie — jak dotąd. */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const gate = readFileSync(new URL('../src/auth/AuthGate.tsx', import.meta.url), 'utf8');
const banner = readFileSync(new URL('../src/auth/ImpersonationBanner.tsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/auth/auth.css', import.meta.url), 'utf8');

describe('bez przeładowania po powrocie na kartę', () => {
  it('klucz obejmuje konto widoku, rolę, „Działaj jako”, imię, telefon i aktywność', () => {
    expect(gate).toMatch(/const key = \[session\.user\.id, p\.user_id, p\.role, p\.org_code, viewRole, p\.acting_as \? 'as' : '', p\.real_user_id \?\? '',\s*p\.full_name \?\? '', p\.phone \?\? '', p\.email \?\? '', p\.active \? '1' : '0'\]\.join\('\|'\);/);
  });
  it('każde wczytanie czyści klucz; wraca tylko po „ready”', () => {
    expect(gate).toContain('const prevKey = readyKeyRef.current;\n      readyKeyRef.current = null;');
    expect(gate).toContain('if (!first && alive) readyKeyRef.current = key;');
  });
  it('ten sam klucz — bez ekranu ładowania, dane w tle z zachowaniem otwartego transportu', () => {
    expect(gate).toContain("if (alive && !silent) setState({ kind: 'loading' });");
    expect(gate).toContain('if (silent) await bridge.refreshFromServer({ keepSelection: true });');
  });
  it('SIGNED_IN po powrocie na kartę przechodzi przez load (sprawdza profil), bez osobnego skrótu', () => {
    expect(gate).not.toContain('readyUserRef');
    expect(gate).not.toContain("document.addEventListener('visibilitychange'");
  });
  it('błąd sieci przy cichym wczytaniu — ekran zostaje, tylko komunikat', () => {
    expect(gate).toContain("if (error && prevKey) { readyKeyRef.current = prevKey;");
    expect(gate).toContain("if (silent) { readyKeyRef.current = key;");
  });
  it('pasek „Działasz jako” zwalnia przycisk po zakończeniu', () => {
    expect(banner).toMatch(/setBusy\(false\);\s*requestAuthReload\(\);/);
  });
  it('logo wybierane po data-theme dokumentu, nie po motywie w store', () => {
    expect(gate).not.toMatch(/theme === 'light' \? '\/brand\/watchtower-logo-full/);
    expect(css).toContain(':root[data-theme="light"] .wt-logo-dark{display:none}');
    expect(css).toContain(':root:not([data-theme="light"]) .wt-logo-light{display:none}');
  });
});
