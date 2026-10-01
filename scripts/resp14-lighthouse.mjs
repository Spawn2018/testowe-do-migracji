/**
 * RESP-14 — szybki Lighthouse (mobile) na lokalnym podglądzie.
 * Użycie: BASE_URL=http://127.0.0.1:4173 node scripts/resp14-lighthouse.mjs
 * Lokalnie bez HTTPS: service-worker / installable mogą być 0 — nie blokują.
 * Kryterium twarde: viewport + raport zapisany.
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const url = process.env.BASE_URL || 'http://127.0.0.1:4173/';
const outDir = process.env.LH_OUT || join(process.cwd(), 'tmp', 'resp14-lh');
mkdirSync(outDir, { recursive: true });
const reportJson = join(outDir, 'report.json');
// Ścieżka z spacją (Watch Tower) psuje flagi LH — używamy relative path
const reportRel = process.env.LH_OUT
  ? reportJson
  : join('tmp', 'resp14-lh', 'report.json');

const r = spawnSync(
  'npx',
  [
    '--yes', 'lighthouse@12',
    url,
    '--only-categories=performance,accessibility',
    '--form-factor=mobile',
    '--screenEmulation.mobile',
    '--chrome-flags=--headless=new --no-sandbox',
    '--output=json',
    `--output-path=${reportRel}`,
    '--quiet',
  ],
  { encoding: 'utf8', shell: true, timeout: 180_000, cwd: process.cwd() },
);

if (r.status !== 0) {
  console.error(r.stderr || r.stdout || 'lighthouse failed');
  process.exit(r.status ?? 1);
}

const report = JSON.parse(readFileSync(reportRel, 'utf8'));
const cats = report.categories ?? {};
const summary = {
  url,
  scores: {
    performance: cats.performance?.score ?? null,
    accessibility: cats.accessibility?.score ?? null,
  },
  audits: {
    'installable-manifest': report.audits?.['installable-manifest']?.score ?? null,
    'service-worker': report.audits?.['service-worker']?.score ?? null,
    viewport: report.audits?.viewport?.score ?? null,
  },
};
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));

if (summary.audits.viewport !== 1) {
  console.error('FAIL: brak viewport meta');
  process.exit(1);
}
console.log('OK RESP-14 Lighthouse (viewport + raport zapisany)');
