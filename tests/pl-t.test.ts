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
import { DEC_I18N } from '../src/i18n/decisions';
import { E49_PL } from '../src/i18n/e49';
import { E49_THR } from '../src/i18n/e49Thr';
import { E49_WX_PL } from '../src/i18n/e49Wx';
import { M2_PL } from '../src/i18n/mfa2';
import { A10_PL } from '../src/i18n/p10a';
import { P6E_PL } from '../src/i18n/p6e';
import { P6F_PL } from '../src/i18n/p6f';
import { P8_PL } from '../src/i18n/p8';
import { P8B_PL } from '../src/i18n/p8b';
import { P8C_PL } from '../src/i18n/p8c';
import { P8D_PL } from '../src/i18n/p8d';
import { PL as FIRST_PL } from '../src/i18n/first';
import { PL as HELP_PL } from '../src/i18n/help';
import { PL as J4_PL } from '../src/i18n/j4';
import { PL as P10B_PL } from '../src/i18n/p10b';
import { PL as P4C_WF_PL } from '../src/i18n/p4cWf';
import { PL as P5_PL } from '../src/i18n/p5';
import { PL as P5B_PL } from '../src/i18n/p5b';
import { PL as P5C_PL } from '../src/i18n/p5c';
import { PL as P6_PL } from '../src/i18n/p6';
import { PL as P6B_PL } from '../src/i18n/p6b';
import { PL as P6C_PL } from '../src/i18n/p6c';
import { PL as P7_PL } from '../src/i18n/p7';
import { PL as P9A_PL } from '../src/i18n/p9a';
import { PL as P9C_PL } from '../src/i18n/p9c';
import { PL as P9E_PL } from '../src/i18n/p9e';
import { PL as SAIL7_PL } from '../src/i18n/sail7';
import { PL as SCHED7_PL } from '../src/i18n/sched7';
import { PL as SYS_PL } from '../src/i18n/sys';

/** DP-63: słowniki PL modułów (poza `I18N_ALL.pl`) — nazwa modułu → słownik; w raporcie klucz jako `moduł:klucz`. */
const PL_MODULES: Record<string, Record<string, unknown>> = {
  decisions: DEC_I18N.pl, e49: E49_PL, e49Thr: E49_THR, e49Wx: E49_WX_PL, mfa2: M2_PL, p10a: A10_PL,
  p6e: P6E_PL, p6f: P6F_PL, p8: P8_PL, p8b: P8B_PL, p8c: P8C_PL, p8d: P8D_PL,
  first: FIRST_PL, help: HELP_PL, j4: J4_PL, p10b: P10B_PL, p4cWf: P4C_WF_PL, p5: P5_PL, p5b: P5B_PL, p5c: P5C_PL,
  p6: P6_PL, p6b: P6B_PL, p6c: P6C_PL, p7: P7_PL, p9a: P9A_PL, p9c: P9C_PL, p9e: P9E_PL,
  sail7: SAIL7_PL, sched7: SCHED7_PL, sys: SYS_PL,
};
/** Wszystkie wartości tekstowe PL do sprawdzenia: `I18N_ALL.pl` + słowniki modułów. */
export const PL_ENTRIES: [string, string][] = [
  ...Object.entries(I18N_ALL.pl),
  ...Object.entries(PL_MODULES).flatMap(([mod, d]) =>
    Object.entries(d).filter((e): e is [string, string] => typeof e[1] === 'string').map(([k, v]) => [`${mod}:${k}`, v] as [string, string])),
];

const EXC = new Set(
  readFileSync(new URL('./fixtures/pl-t-exceptions.txt', import.meta.url), 'utf8')
    .split('\n').map((l) => l.replace(/#.*/, '').trim()).filter(Boolean),
);

/**
 * hunspell + pl_PL — na Windows zwykle brak (Debian: apt install hunspell hunspell-pl).
 * DP-42: `-i utf-8` — słownik pl_PL jest w ISO8859-2; bez jawnego kodowania wejścia hunspell przy locale C/POSIX
 * tnie polskie litery („Załączniki” → „czniki”) i test padał fałszywie.
 */
const HUNSPELL_ARGS = ['-d', 'pl_PL', '-i', 'utf-8', '-l'];
function hunspellAvailable(): boolean {
  try {
    execFileSync('hunspell', HUNSPELL_ARGS, { input: 'test\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return true;
  } catch {
    return false;
  }
}

/**
 * DP-42: co zrobić z testem pisowni.
 * - słownik jest → `run`;
 * - brak słownika lokalnie → `skip` z czytelnym powodem;
 * - brak słownika w CI (`CI=true`, GitHub Actions) → `fail` — w CI słownik instaluje `.github/workflows/unit.yml`,
 *   więc jego brak to błąd konfiguracji, a nie powód do cichego pominięcia.
 */
export function plDictMode(available: boolean, env: Record<string, string | undefined>, platform: string): { mode: 'run' | 'skip' | 'fail'; reason: string } {
  if (available) return { mode: 'run', reason: '' };
  const missing = platform === 'win32'
    ? 'brak hunspell/pl_PL na Windows (wymaga Linux CI lub apt install hunspell hunspell-pl)'
    : 'brak hunspell ze słownikiem pl_PL (apt install hunspell hunspell-pl)';
  if (env.CI === 'true') return { mode: 'fail', reason: `CI=true, a ${missing} — CI musi mieć słownik (unit.yml)` };
  return { mode: 'skip', reason: `pominięte — ${missing}` };
}

const HUNSPELL_OK = hunspellAvailable();
const DICT = plDictMode(HUNSPELL_OK, process.env, process.platform);
const skipHunspell = DICT.mode === 'skip' ? DICT.reason : false;

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
  const out = execFileSync('hunspell', HUNSPELL_ARGS, { input: words.join('\n'), encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  return [...new Set(out.split('\n').map((l) => l.trim()).filter(Boolean))];
}

describe('PL-T — słownik PL bez błędów pisowni (hunspell pl_PL + wyjątki)', () => {
  // Jawny powód w nazwie (lokalnie bez słownika — skip; w CI brak słownika = błąd, DP-42).
  const hunspellIt = DICT.mode === 'skip' ? it.skip : it;

  if (DICT.mode === 'fail') {
    it(`słownik hunspell pl_PL dostępny w CI — ${DICT.reason}`, () => {
      throw new Error(DICT.reason);
    });
  }

  hunspellIt(
    DICT.mode !== 'skip'
      ? 'hunspell z pl_PL jest zainstalowany'
      : `hunspell z pl_PL jest zainstalowany — SKIP: ${skipHunspell}`,
    () => {
      expect(hunspellMisses(['Marża', 'Załączniki'])).toEqual([]);
      expect(hunspellMisses(['Marza'])).toEqual(['Marza']);
    },
  );

  hunspellIt(
    DICT.mode !== 'skip'
      ? 'każda wartość słownika PL: 0 słów spoza pl_PL i listy wyjątków'
      : `każda wartość słownika PL — SKIP: ${skipHunspell}`,
    () => {
      const byWord = new Map<string, string[]>();
      for (const [key, val] of PL_ENTRIES) {
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
    /* DP-63: „tylko swoja cena” — mianownik („swoja”), poprawna forma, nie „swoją” bez ogonka */
    const OK = new Set(['swoja ← p5:p5_inv_who_r3_ksh', 'swoja ← p5:p5_inv_who_r3_scx']);
    const hits = PL_ENTRIES.flatMap(([k, v]) =>
      FORBIDDEN.filter((f) => new RegExp(`(^|[^\\p{L}])${f}([^\\p{L}]|$)`, 'u').test(v)).map((f) => `${f} ← ${k}`)).filter((h) => !OK.has(h));
    expect(hits).toEqual([]);
  });

  it('DP-42: brak słownika — lokalnie skip z powodem, w CI (CI=true) błąd; słownik jest — uruchom', () => {
    expect(plDictMode(true, { CI: 'true' }, 'linux').mode).toBe('run');
    expect(plDictMode(true, {}, 'win32').mode).toBe('run');
    const local = plDictMode(false, {}, 'linux');
    expect(local.mode).toBe('skip');
    expect(local.reason).toMatch(/pominięte — brak hunspell ze słownikiem pl_PL/);
    expect(plDictMode(false, {}, 'win32').reason).toMatch(/Windows/);
    const ci = plDictMode(false, { CI: 'true' }, 'linux');
    expect(ci.mode).toBe('fail');
    expect(ci.reason).toMatch(/CI=true/);
    expect(plDictMode(false, { CI: 'false' }, 'linux').mode).toBe('skip');
  });

  it('DP-63: słowniki PL modułów (p7, sail7 i pozostałe) wchodzą do sprawdzenia', () => {
    const mods = new Set(PL_ENTRIES.map(([k]) => (k.includes(':') ? k.split(':')[0] : 'messages')));
    for (const m of ['messages', 'p7', 'sail7', ...Object.keys(PL_MODULES)]) expect(mods.has(m), m).toBe(true);
    expect(PL_ENTRIES.some(([k]) => k === 'p7:p7_m_sailing_empty')).toBe(true);
  });

  it('plWords pomija znaczniki, kody i adresy', () => {
    expect(plWords('Usuń {n} pozycji KSH/1 SG-01 https://x.pl plik.xlsx CMR')).toEqual(['Usuń', 'pozycji']);
  });
});
