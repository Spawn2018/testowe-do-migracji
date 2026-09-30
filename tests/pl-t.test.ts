/**
 * PL-T (ANEKS 3 §3) — pisownia słownika PL: hunspell `pl_PL` na wszystkich wartościach
 * słownika polskiego (messages + d19Extra + etap4). D19-T łapie polskie znaki w EN/SV —
 * ten test łapie ich BRAK w PL („Marza”, „Zalaczniki”).
 * Wyjątki (kody, skróty, nazwy własne, terminy branżowe): tests/fixtures/pl-t-exceptions.txt.
 * Wymaga: `hunspell` + słownik `pl_PL` (Debian: apt-get install hunspell hunspell-pl).
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { I18N_ALL } from '../src/i18n/messages';

const EXC = new Set(
  readFileSync(new URL('./fixtures/pl-t-exceptions.txt', import.meta.url), 'utf8')
    .split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean),
);

/** hunspell + pl_PL — na Windows zwykle brak (Debian: apt install hunspell hunspell-pl). */
function hunspellAvailable(): boolean {
  try {
    execFileSync('hunspell', ['-d', 'pl_PL', '-l'], { input: 'test\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}
const HUNSPELL_OK = hunspellAvailable();
const skipHunspell = !HUNSPELL_OK
  ? process.platform === 'win32'
    ? 'pominięte na Windows — brak hunspell/pl_PL (wymaga Linux CI lub apt install hunspell hunspell-pl)'
    : 'pominięte — brak hunspell z słownikiem pl_PL'
  : false;

/** Słowa do sprawdzenia: bez znaczników {n}, kodów (cyfry, WERSALIKI ≥ 2), adresów i identyfikatorów. */
export function plWords(text: string): string[] {
  const clean = text
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/https?:\/\/\S+|#\/\S+|\S+@\S+/g, ' ')
    .replace(/\b[\w.-]+\.(xlsx|csv|pdf|json|md|zip)\b/gi, ' ');
  return (clean.match(/[A-Za-zÀ-ÿĄąĆćĘęŁłŃńÓóŚśŹźŻżÄäÖöÅå]+(?:-[A-Za-zÀ-ÿĄąĆćĘęŁłŃńÓóŚśŹźŻż]+)*/g) ?? [])
    .flatMap((w) => w.split('-'))
    .filter((w) => w.length > 1 && !/^[A-ZĄĆĘŁŃÓŚŹŻ0-9]{2,}$/.test(w) && !/[0-9_]/.test(w));
}

function hunspellMisses(words: string[]): string[] {
  const out = execFileSync('hunspell', ['-d', 'pl_PL', '-l'], { input: words.join('\n'), encoding: 'utf8' });
  return [...new Set(out.split('\n').map((l) => l.trim()).filter(Boolean))];
}

describe('PL-T — słownik PL bez błędów pisowni (hunspell pl_PL + wyjątki)', () => {
  // Jawny powód w nazwie (Windows nie ma hunspell/pl_PL — Linux CI nadal egzekwuje).
  const hunspellIt = HUNSPELL_OK ? it : it.skip;

  hunspellIt(
    HUNSPELL_OK
      ? 'hunspell z pl_PL jest zainstalowany'
      : `hunspell z pl_PL jest zainstalowany — SKIP: ${skipHunspell}`,
    () => {
      expect(hunspellMisses(['Marża', 'Załączniki'])).toEqual([]);
      expect(hunspellMisses(['Marza'])).toEqual(['Marza']);
    },
  );

  hunspellIt(
    HUNSPELL_OK
      ? 'każda wartość słownika PL: 0 słów spoza pl_PL i listy wyjątków'
      : `każda wartość słownika PL — SKIP: ${skipHunspell}`,
    () => {
      const byWord = new Map<string, string[]>();
      for (const [key, val] of Object.entries(I18N_ALL.pl)) {
        for (const w of plWords(val)) {
          if (EXC.has(w) || EXC.has(w.toLowerCase())) continue;
          byWord.set(w, [...(byWord.get(w) ?? []), key]);
        }
      }
      const misses = hunspellMisses([...byWord.keys()]);
      const report = misses.map((w) => `${w} ← ${byWord.get(w)?.slice(0, 3).join(', ')}`);
      expect(report).toEqual([]);
    },
  );

  it('formy bez znaków, które słownik przyjmuje jako inne słowa — zakazane w PL (marzy, swoja, pol, spor, Formula, Wyplata)', () => {
    const FORBIDDEN = ['marzy', 'swoja', 'pol', 'spor', 'Formula', 'Wyplata', 'para wjazd', 'Na pokladzie'];
    const hits = Object.entries(I18N_ALL.pl).flatMap(([k, v]) =>
      FORBIDDEN.filter((f) => new RegExp(`(^|[^\\p{L}])${f}([^\\p{L}]|$)`, 'u').test(v)).map((f) => `${f} ← ${k}`));
    expect(hits).toEqual([]);
  });

  it('plWords pomija znaczniki, kody i adresy', () => {
    expect(plWords('Usuń {n} pozycji KSH/1 SG-01 https://x.pl plik.xlsx CMR')).toEqual(['Usuń', 'pozycji']);
  });
});
