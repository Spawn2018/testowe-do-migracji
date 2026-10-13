#!/usr/bin/env node
/**
 * E19 pkt 6 — porównanie doradcy Supabase „security” z tests/db/advisor-exceptions.txt.
 * Użycie:
 *   node scripts/security-advisor-check.mjs --project-ref emkbykwenwrjmbprydml
 *   node scripts/security-advisor-check.mjs --from-json path.json
 * Wyjście 0 = brak nowych zgłoszeń; 1 = nowe spoza listy (blokuje wdrożenie).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const EXC = resolve(ROOT, 'tests/db/advisor-exceptions.txt');

function parseExceptions(text) {
  const set = new Set();
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [lint, object] = t.split(/\t/);
    if (lint && object) set.add(`${lint}\t${object}`);
  }
  return set;
}

function flattenLints(lints) {
  const out = [];
  for (const lint of lints ?? []) {
    const name = lint.name ?? 'unknown';
    const findings = lint.findings?.length ? lint.findings : [{ metadata: { schema: 'public', name: '*' } }];
    for (const f of findings) {
      const schema = f.metadata?.schema ?? 'public';
      const obj = f.metadata?.name ?? '*';
      out.push({
        key: `${name}\t${schema}.${obj}`,
        lint: name,
        object: `${schema}.${obj}`,
        level: lint.level ?? 'INFO',
        detail: f.detail ?? lint.title ?? '',
      });
    }
  }
  return out;
}

function loadLintsFromArgs(argv) {
  const jsonIdx = argv.indexOf('--from-json');
  if (jsonIdx >= 0) {
    const raw = JSON.parse(readFileSync(argv[jsonIdx + 1], 'utf8'));
    const lints = Array.isArray(raw) ? raw : (raw.lints ?? raw.result?.lints ?? []);
    return lints;
  }
  const refIdx = argv.indexOf('--project-ref');
  const ref = refIdx >= 0 ? argv[refIdx + 1] : process.env.SUPABASE_PROJECT_REF;
  if (!ref) {
    console.error('Podaj --project-ref lub --from-json');
    process.exit(2);
  }
  const r = spawnSync(
    'npx',
    ['supabase', 'db', 'advisors', '--project-ref', ref, '--type', 'security', '--output', 'json'],
    { cwd: ROOT, encoding: 'utf8', shell: true },
  );
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout || 'supabase db advisors failed');
    process.exit(2);
  }
  const raw = JSON.parse(r.stdout);
  return Array.isArray(raw) ? raw : (raw.lints ?? raw.result?.lints ?? []);
}

const exceptions = parseExceptions(readFileSync(EXC, 'utf8'));
const findings = flattenLints(loadLintsFromArgs(process.argv.slice(2)));
const novel = findings.filter((f) => {
  if (exceptions.has(f.key)) return false;
  // wzorzec auth.*
  const [lint, object] = f.key.split('\t');
  if (exceptions.has(`${lint}\tauth.*`) && object.startsWith('auth.')) return false;
  return true;
});

if (novel.length === 0) {
  console.log(`OK doradca security: ${findings.length} zgłoszeń, 0 nowych (wyjątki ${exceptions.size})`);
  process.exit(0);
}

console.error(`FAIL doradca security: ${novel.length} nowych zgłoszeń spoza advisor-exceptions.txt:`);
for (const n of novel.slice(0, 40)) {
  console.error(`  [${n.level}] ${n.lint} ${n.object} — ${n.detail.slice(0, 120)}`);
}
if (novel.length > 40) console.error(`  … +${novel.length - 40}`);
process.exit(1);
