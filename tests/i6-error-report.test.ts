/** I-6 — zgłaszanie błędów przeglądarki: limity klienta, ścieżka bez tokenów, identyfikator buildu, tylko build produkcyjny. */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { makeGate, safePath, buildId, MAX_PER_TAB } from '../src/lib/errorReport';

describe('I-6 klient', () => {
  it('ten sam komunikat raz na 60 s, maks. 10 na kartę', () => {
    let now = 0; const g = makeGate(() => now);
    expect(g('a')).toBe(true); expect(g('a')).toBe(false);
    now = 61_000; expect(g('a')).toBe(true);
    let n = 2; for (let i = 0; i < 20; i++) if (g('m' + i)) n++;
    expect(n).toBe(MAX_PER_TAB);
  });
  it('ścieżka: bez zapytania, token kierowcy i token logowania wycięte', () => {
    expect(safePath('https://tower.log-mar.pl/?x=1#/driver/wt_' + 'a'.repeat(64))).toBe('/#/driver/wt_…');
    expect(safePath('https://tower.log-mar.pl/#access_token=eyJabc&type=magiclink')).toBe('/#…');
    expect(safePath('nie-url')).toBe('');
  });
  it('identyfikator buildu z nazwy paczki index-*.js', () => {
    const doc = { querySelector: () => ({ src: 'https://x/assets/index-B7kQ_x9a.js' }) } as unknown as Document;
    expect(buildId(doc)).toBe('B7kQ_x9a');
    expect(buildId({ querySelector: () => null } as unknown as Document)).toBe('dev');
  });
  it('main.tsx: instalacja tylko w buildzie produkcyjnym (leniwy import)', () => {
    const m = readFileSync('src/main.tsx', 'utf8');
    expect(m).toMatch(/if \(import\.meta\.env\.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED\) \{\s*void Promise\.all\(\[import\('\.\/lib\/errorReport'\)/);
    expect(m).not.toMatch(/^import .*errorReport/m);
  });
});
