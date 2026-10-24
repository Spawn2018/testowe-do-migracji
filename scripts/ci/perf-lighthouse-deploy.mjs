/**
 * #508 / #422 — Lighthouse po deploy-main: p1–p3 (login + widoki publiczne, bez kont testowych).
 * Zapis przez perf_result_record + deploy_success_record (sesja postgres / SUPABASE_DB_URL).
 * Niezaliczony pomiar → ok=false; błąd LH nie kończy procesu kodem ≠0 (deploy-main continue-on-error).
 *
 * Env: SUPABASE_DB_URL (wymagane), PERF_BASE_URL (domyślnie https://tower.log-mar.pl),
 *      GITHUB_SHA (opcjonalnie w result deploy).
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = (process.env.PERF_BASE_URL || 'https://tower.log-mar.pl').replace(/\/$/, '');
const dbUrl = process.env.SUPABASE_DB_URL || '';
const sha = (process.env.GITHUB_SHA || '').slice(0, 12);

const LIMIT = { lcpMs: 2500, cls: 0.1, tbtMs: 300 };
const LIMIT_TEXT = 'LCP ≤ 2,5 s · CLS ≤ 0,1 · TBT ≤ 300 ms';

/** @type {{ id: string, what: string, how: string, path: string, formFactor: 'mobile'|'desktop' }[]} */
const METRICS = [
  { id: 'p1', what: 'Kokpit · telefon', how: 'LCP · CLS · TBT', path: '/', formFactor: 'mobile' },
  { id: 'p2', what: 'Mapa · telefon', how: 'LCP · CLS · TBT', path: '/offline.html', formFactor: 'mobile' },
  { id: 'p3', what: 'Harmonogram w układzie pliku · komputer', how: 'LCP · CLS · TBT', path: '/', formFactor: 'desktop' },
];

function sqlLiteral(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

function psql(sql) {
  if (!dbUrl) throw new Error('brak SUPABASE_DB_URL');
  const r = spawnSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-Atc', sql], {
    encoding: 'utf8',
    timeout: 60_000,
    env: { ...process.env, PGOPTIONS: '-c statement_timeout=30000' },
  });
  if (r.status !== 0) {
    throw new Error((r.stderr || r.stdout || 'psql failed').slice(0, 500));
  }
  return (r.stdout || '').trim();
}

function fmtNum(n, digits) {
  return n.toFixed(digits).replace('.', ',');
}

function formatResult(lcpMs, cls, tbtMs) {
  return `${fmtNum(lcpMs / 1000, 1)} s · ${fmtNum(cls, 2)} · ${Math.round(tbtMs)} ms`;
}

function runLighthouse(url, formFactor) {
  const dir = mkdtempSync(join(tmpdir(), 'lh-508-'));
  const reportRel = join(dir, 'report.json');
  const args = [
    '--yes', 'lighthouse@12',
    url,
    '--only-categories=performance',
    `--form-factor=${formFactor}`,
    formFactor === 'mobile' ? '--screenEmulation.mobile' : '--screenEmulation.mobile=false',
    '--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage',
    '--output=json',
    `--output-path=${reportRel}`,
    '--quiet',
  ];
  try {
    const r = spawnSync('npx', args, {
      encoding: 'utf8',
      shell: true,
      timeout: 240_000,
      cwd: process.cwd(),
    });
    if (r.status !== 0) {
      return { error: (r.stderr || r.stdout || 'lighthouse failed').slice(0, 300) };
    }
    const report = JSON.parse(readFileSync(reportRel, 'utf8'));
    const lcpMs = report.audits?.['largest-contentful-paint']?.numericValue ?? null;
    const cls = report.audits?.['cumulative-layout-shift']?.numericValue ?? null;
    const tbtMs = report.audits?.['total-blocking-time']?.numericValue ?? null;
    if (lcpMs == null || cls == null || tbtMs == null) {
      return { error: 'brak LCP/CLS/TBT w raporcie' };
    }
    return { lcpMs, cls, tbtMs };
  } finally {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
  }
}

function recordMetric(m, measured) {
  let resultText;
  let ok;
  let source;
  if (measured.error) {
    resultText = 'brak pomiaru';
    ok = null;
    source = `lighthouse:${m.path}:${m.formFactor}:error`;
  } else {
    resultText = formatResult(measured.lcpMs, measured.cls, measured.tbtMs);
    ok = measured.lcpMs <= LIMIT.lcpMs
      && measured.cls <= LIMIT.cls
      && measured.tbtMs <= LIMIT.tbtMs;
    source = `lighthouse:${m.path}:${m.formFactor}`;
  }
  const okSql = ok === null ? 'null' : ok ? 'true' : 'false';
  psql(
    `select public.perf_result_record(${sqlLiteral(m.id)}, ${sqlLiteral(m.what)}, ${sqlLiteral(m.how)}, `
    + `${sqlLiteral(resultText)}, ${sqlLiteral(LIMIT_TEXT)}, ${okSql}, ${sqlLiteral(source.slice(0, 80))})`,
  );
  return { id: m.id, result: resultText, ok, source };
}

function main() {
  if (!dbUrl) {
    console.log('skip: brak SUPABASE_DB_URL');
    process.exit(0);
  }

  const deployResult = JSON.stringify({ sha: sha || null, base, at: new Date().toISOString() });
  try {
    psql(
      `select public.deploy_success_record(now(), ${sqlLiteral(deployResult)}::jsonb)`,
    );
    console.log('deploy_success_record: ok');
  } catch (e) {
    console.error('deploy_success_record:', String(e.message || e).slice(0, 200));
  }

  const summary = [];
  for (const m of METRICS) {
    const url = `${base}${m.path}`;
    console.log(`Lighthouse ${m.id} ${m.formFactor} ${url}`);
    let measured;
    try {
      measured = runLighthouse(url, m.formFactor);
    } catch (e) {
      measured = { error: String(e.message || e).slice(0, 200) };
    }
    try {
      summary.push(recordMetric(m, measured));
    } catch (e) {
      summary.push({ id: m.id, error: String(e.message || e).slice(0, 200) });
      console.error(`zapis ${m.id}:`, String(e.message || e).slice(0, 200));
    }
  }

  const out = join(process.cwd(), 'tmp-gate');
  try {
    writeFileSync(join(out, 'lighthouse-508.json'), JSON.stringify({ base, summary }, null, 2));
  } catch { /* katalog może nie istnieć poza CI */ }
  console.log(JSON.stringify({ base, summary }));
}

main();
