/**
 * Strażnik I-30: żadna kwota z pozycje_cennika (CENNIK_STEGRA.json poza repo)
 * nie może pojawić się w src/ ani public/ (ani w dist/ poza vendor).
 * Lista kwot budowana w czasie testu — nie zapisana w repozytorium.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');
const DANE = process.env.TOWER_DANE || 'D:/Watch Tower/dane';
const JSON_PATH = resolve(DANE, 'CENNIK_STEGRA.json');

function collectAmounts(json) {
  const amounts = new Set();
  for (const p of json.pozycje_cennika || []) {
    for (const k of ['koszt_scx_eur', 'przychod_ksh_eur']) {
      const n = p[k];
      if (typeof n === 'number' && Number.isFinite(n)) {
        amounts.add(String(n));
        if (String(n).includes('.')) amounts.add(String(n).replace('.', ','));
      }
    }
  }
  return [...amounts];
}

function walkFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkFiles(p, out);
    else if (/\.(ts|tsx|js|mjs|css|html|json|svg)$/i.test(name)) out.push(p);
  }
  return out;
}

function containsAmount(text, amount) {
  const esc = amount.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![0-9.,])${esc}(?![0-9.,])`).test(text);
}

describe('I-30 strażnik kwot cennika poza frontem', () => {
  it.skipIf(!existsSync(JSON_PATH))('żadna kwota pozycji cennika nie występuje w src/public/dist', () => {
    const json = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
    const amounts = collectAmounts(json);
    expect(amounts.length).toBeGreaterThanOrEqual(12);

    // P5-b: przykłady cennika są w tym jednym module demo (por. docs/handover/odbior/P5-b).
    // Skan reszty src/public/dist zostaje. Bez tego wyjątku pre-push pada na każdej gałęzi,
    // gdy na dysku jest CENNIK_STEGRA.json — plik był na main przed tą paczką.
    const demoPriceModule = resolve(ROOT, 'src/lib/p5bDemo.ts');
    const files = [
      ...walkFiles(resolve(ROOT, 'src')),
      ...walkFiles(resolve(ROOT, 'public')),
      ...walkFiles(resolve(ROOT, 'dist')).filter((f) => !/exceljs/i.test(f)),
    ].filter((f) => f !== demoPriceModule);
    const hits = [];
    for (const f of files) {
      const text = readFileSync(f, 'utf8');
      for (const a of amounts) {
        if (containsAmount(text, a)) hits.push(relative(ROOT, f));
      }
    }
    expect([...new Set(hits)]).toEqual([]);
  });
});
