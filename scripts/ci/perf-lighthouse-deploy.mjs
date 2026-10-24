/**
 * #508 / #422 — Lighthouse po deploy-main: p1–p3 (login + widoki publiczne, bez kont testowych).
 * Zapis przez PostgREST RPC (service_role z Management API) — nie psql na host db.* (tylko IPv6).
 * Fallback: psql na SUPABASE_DB_URL gdy to pula (pooler.supabase.com).
 * Niezaliczony pomiar → ok=false; błąd LH nie kończy procesu kodem ≠0 (deploy-main continue-on-error).
 *
 * Env: SUPABASE_ACCESS_TOKEN + PROJECT_REF (zapis REST), albo SUPABASE_DB_URL (pula),
 *      PERF_BASE_URL (domyślnie https://tower.log-mar.pl), GITHUB_SHA (opcjonalnie).
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const base = (process.env.PERF_BASE_URL || 'https://tower.log-mar.pl').replace(/\/$/, '');
const projectRef = process.env.PROJECT_REF || 'nglnnrmzmhusvxslousq';
const accessToken = process.env.SUPABASE_ACCESS_TOKEN || '';
const dbUrl = process.env.SUPABASE_DB_URL || '';
const sha = (process.env.GITHUB_SHA || '').slice(0, 12);

export const LIMIT = { lcpMs: 2500, cls: 0.1, tbtMs: 300 };
export const LIMIT_TEXT = 'LCP ≤ 2,5 s · CLS ≤ 0,1 · TBT ≤ 300 ms';

/** Identyfikatory i etykiety zgodne z mierzoną stroną (bez sesji = logowanie; offline ≠ mapa). */
export const METRICS = [
  { id: 'p1', what: 'Logowanie · telefon', how: 'LCP · CLS · TBT', path: '/', formFactor: 'mobile' },
  { id: 'p2', what: 'Offline · telefon', how: 'LCP · CLS · TBT', path: '/offline.html', formFactor: 'mobile' },
  { id: 'p3', what: 'Logowanie · komputer', how: 'LCP · CLS · TBT', path: '/', formFactor: 'desktop' },
];

const LH_PKG = 'lighthouse@12.8.2';

function sqlLiteral(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}

function fmtNum(n, digits) {
  return n.toFixed(digits).replace('.', ',');
}

export function formatResult(lcpMs, cls, tbtMs) {
  return `${fmtNum(lcpMs / 1000, 1)} s · ${fmtNum(cls, 2)} · ${Math.round(tbtMs)} ms`;
}

export function passesLimits(lcpMs, cls, tbtMs) {
  return lcpMs <= LIMIT.lcpMs && cls <= LIMIT.cls && tbtMs <= LIMIT.tbtMs;
}

function redactErr(msg) {
  let t = String(msg || '').slice(0, 400);
  if (dbUrl) t = t.split(dbUrl).join('[adres]');
  if (accessToken) t = t.split(accessToken).join('[token]');
  return t;
}

async function fetchServiceRoleKey() {
  if (!accessToken) return null;
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/api-keys`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`Management API api-keys HTTP ${res.status}`);
  }
  const keys = await res.json();
  const list = Array.isArray(keys) ? keys : [];
  const row = list.find((k) => k.name === 'service_role' || k.id === 'service_role' || k.type === 'service_role');
  const key = row?.api_key || row?.apiKey || null;
  if (!key) throw new Error('brak service_role w api-keys');
  return key;
}

async function rpcRest(serviceKey, name, args) {
  const url = `https://${projectRef}.supabase.co/rest/v1/rpc/${name}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`RPC ${name} HTTP ${res.status}: ${body.slice(0, 200)}`);
  }
}

function psql(sql) {
  if (!dbUrl) throw new Error('brak SUPABASE_DB_URL');
  if (!dbUrl.includes('pooler.supabase.com')) {
    throw new Error('SUPABASE_DB_URL nie jest pulą (host db.* tylko IPv6 — użyj REST albo pooler)');
  }
  const r = spawnSync('psql', [dbUrl, '-v', 'ON_ERROR_STOP=1', '-Atc', sql], {
    encoding: 'utf8',
    timeout: 60_000,
    shell: false,
    env: { ...process.env, PGOPTIONS: '-c statement_timeout=30000' },
  });
  if (r.status !== 0) {
    throw new Error(redactErr(r.stderr || r.stdout || 'psql failed'));
  }
  return (r.stdout || '').trim();
}

/** @type {'rest'|'psql'|null} */
let writeMode = null;
/** @type {string|null} */
let serviceKeyCache = null;

async function ensureWriter() {
  if (writeMode) return;
  try {
    serviceKeyCache = await fetchServiceRoleKey();
    writeMode = 'rest';
    console.log('zapis: PostgREST (service_role)');
    return;
  } catch (e) {
    console.error('Management API:', redactErr(e.message || e));
  }
  if (dbUrl.includes('pooler.supabase.com')) {
    writeMode = 'psql';
    console.log('zapis: psql (pula)');
    return;
  }
  throw new Error('brak zapisu: ani service_role (ACCESS_TOKEN), ani URL puli');
}

async function recordPerf(m, measured) {
  let resultText;
  let ok;
  let source;
  if (measured.error) {
    resultText = 'brak pomiaru';
    ok = null;
    source = `lighthouse:${m.path}:${m.formFactor}:error`;
  } else {
    resultText = formatResult(measured.lcpMs, measured.cls, measured.tbtMs);
    ok = passesLimits(measured.lcpMs, measured.cls, measured.tbtMs);
    source = `lighthouse:${m.path}:${m.formFactor}`;
  }
  const src = source.slice(0, 80);
  await ensureWriter();
  if (writeMode === 'rest') {
    await rpcRest(serviceKeyCache, 'perf_result_record', {
      p_metric_id: m.id,
      p_what: m.what,
      p_how: m.how,
      p_result_text: resultText,
      p_limit_text: LIMIT_TEXT,
      p_ok: ok,
      p_source: src,
    });
  } else {
    const okSql = ok === null ? 'null' : ok ? 'true' : 'false';
    psql(
      `select public.perf_result_record(${sqlLiteral(m.id)}, ${sqlLiteral(m.what)}, ${sqlLiteral(m.how)}, `
      + `${sqlLiteral(resultText)}, ${sqlLiteral(LIMIT_TEXT)}, ${okSql}, ${sqlLiteral(src)})`,
    );
  }
  return { id: m.id, result: resultText, ok, source: src };
}

async function recordDeploy() {
  const deployResult = { sha: sha || null, base, at: new Date().toISOString() };
  await ensureWriter();
  if (writeMode === 'rest') {
    await rpcRest(serviceKeyCache, 'deploy_success_record', {
      p_ran_at: new Date().toISOString(),
      p_result: deployResult,
    });
  } else {
    psql(
      `select public.deploy_success_record(now(), ${sqlLiteral(JSON.stringify(deployResult))}::jsonb)`,
    );
  }
}

export function runLighthouse(url, formFactor) {
  const dir = mkdtempSync(join(tmpdir(), 'lh-508-'));
  const reportRel = join(dir, 'report.json');
  const chromeFlags = '--headless=new --no-sandbox --disable-dev-shm-usage';
  const args = [
    '--yes',
    LH_PKG,
    url,
    '--only-categories=performance',
    formFactor === 'desktop' ? '--preset=desktop' : '--form-factor=mobile',
    `--chrome-flags=${chromeFlags}`,
    '--output=json',
    `--output-path=${reportRel}`,
    '--quiet',
  ];
  try {
    const r = spawnSync('npx', args, {
      encoding: 'utf8',
      shell: false,
      timeout: 240_000,
      cwd: process.cwd(),
    });
    if (r.status !== 0) {
      return { error: redactErr(r.stderr || r.stdout || 'lighthouse failed') };
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

async function main() {
  let writesOk = 0;

  try {
    await recordDeploy();
    writesOk += 1;
    console.log('deploy_success_record: ok');
  } catch (e) {
    console.error('deploy_success_record:', redactErr(e.message || e));
  }

  const summary = [];
  for (const m of METRICS) {
    const url = `${base}${m.path}`;
    console.log(`Lighthouse ${m.id} ${m.formFactor} ${url}`);
    let measured;
    try {
      measured = runLighthouse(url, m.formFactor);
    } catch (e) {
      measured = { error: redactErr(e.message || e) };
    }
    try {
      summary.push(await recordPerf(m, measured));
      writesOk += 1;
    } catch (e) {
      summary.push({ id: m.id, error: redactErr(e.message || e) });
      console.error(`zapis ${m.id}:`, redactErr(e.message || e));
    }
  }

  console.log(`writes_ok=${writesOk}`);
  if (writesOk === 0) {
    console.error('::warning::Lighthouse: żaden zapis do bazy się nie udał (deploy_success / p1–p3)');
  }

  const outDir = join(process.cwd(), 'tmp-gate');
  try {
    writeFileSync(join(outDir, 'lighthouse-508.json'), JSON.stringify({ base, summary, writesOk }, null, 2));
  } catch { /* katalog może nie istnieć poza CI */ }
  console.log(JSON.stringify({ base, summary, writesOk }));
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((e) => {
    console.error(redactErr(e.message || e));
    console.log('writes_ok=0');
    console.error('::warning::Lighthouse: żaden zapis do bazy się nie udał (deploy_success / p1–p3)');
    process.exit(0);
  });
}
