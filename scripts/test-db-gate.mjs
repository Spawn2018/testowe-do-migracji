/**
 * Brama bazy na projekcie testowym Supabase (TEST_DB_URL).
 * 1) Bezpiecznik produkcji  2) status projektu  3) wyczyść public
 * 4) migracje 0001…0099  5) seed  6) zestawy z gate.sh  7) wynik liczbami
 *
 * Nie wypisuje haseł. Nie zmienia produkcji.
 *
 * Użycie: node scripts/test-db-gate.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { resetPublic, applyMigrationsAndSeed, refuseProdUrl } from './lib/test-db-migrate.mjs';
import {
  ensureSeedAuthUsers,
  removeSeedAuthUsers,
  cleanupTestAuthUsers,
} from './lib/test-auth-admin.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const PROD_REF = 'nglnnrmzmhusvxslousq';
const TEST_REF = 'emkbykwenwrjmbprydml';

/** Oczekiwane OK na hosted. security: 88−4 SKIP (spatial_ref_sys free). */
const EXPECTED = {
  security: 84,
  status: 44,
  storage: 37,
  money: 130,
  release: 145,
  session: 27,
  archive: 18,
  watchdog: 27,
  invite: 48,
  risks: 21, // 23 − 2 SKIP (tower_test_status wymaga CREATE DATABASE)
  import: 66,
  nullguard: 379,
  i2: 510,
  workflows: 46,
  insurance: 33,
};

/** Zestawy wymagające kont seed w auth.users (FK auth.sessions / auth.mfa_factors). */
const NEED_SEED_AUTH = new Set(['session', 'i2']);

/** Invite wymaga osieroconych app_users (bez auth.users dla seed). */
const NEED_ORPHAN_SEED = new Set(['invite']);

function loadEnv() {
  const text = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
  const map = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    let v = line.slice(i + 1);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    map[line.slice(0, i).trim()] = v;
  }
  return map;
}

function refuseProd(url) {
  if (!url || url.includes(PROD_REF)) {
    console.error('ODMOWA: TEST_DB_URL wskazuje produkcję lub jest pusty');
    process.exit(2);
  }
  if (!url.includes(TEST_REF)) {
    console.error('ODMOWA: TEST_DB_URL bez ref projektu testowego');
    process.exit(2);
  }
}

function findPsql() {
  const candidates = [
    process.env.TOWER_REAL_PSQL,
    'D:\\OMNIROUTE\\tools\\pg16\\pgsql\\bin\\psql.exe',
    'psql',
  ].filter(Boolean);
  for (const c of candidates) {
    const r = spawnSync(c, ['--version'], { encoding: 'utf8' });
    if (r.status === 0) return c;
  }
  console.error('BRAK psql — zainstaluj klienta PostgreSQL albo ustaw TOWER_REAL_PSQL');
  process.exit(1);
}

function findBash() {
  const candidates = [process.env.BASH_PATH, 'D:\\Git\\bin\\bash.exe', 'bash'];
  for (const c of candidates) {
    if (!c) continue;
    const r = spawnSync(c, ['-c', 'echo ok'], { encoding: 'utf8' });
    if (r.status === 0) return c;
  }
  console.error('BRAK bash');
  process.exit(1);
}

async function assertProjectAwake(token) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${TEST_REF}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) {
    console.error('Management API project:', res.status);
    process.exit(1);
  }
  const p = await res.json();
  const st = String(p.status || '');
  console.log(`project_status=${st}`);
  if (/INACTIVE|PAUSE/i.test(st) || st === 'COMING_UP') {
    console.error('STOP: projekt testowy jest uśpiony lub budzi się. Wybuduj go w panelu Supabase i uruchom ponownie.');
    process.exit(3);
  }
  if (st !== 'ACTIVE_HEALTHY' && st !== 'ACTIVE_UNHEALTHY') {
    console.error(`STOP: nieoczekiwany status projektu: ${st}`);
    process.exit(3);
  }
}

async function resetAndMigrate(url, psqlBin) {
  refuseProdUrl(url);
  await resetPublic(url);
  await applyMigrationsAndSeed(ROOT, url, psqlBin);
}

function runSuite(bash, psqlReal, suiteFile) {
  const r = spawnSync(bash, [join(ROOT, 'scripts/run-hosted-suite.sh'), suiteFile], {
    encoding: 'utf8',
    cwd: ROOT,
    env: {
      ...process.env,
      TOWER_REAL_PSQL: psqlReal,
      TOWER_HOSTED_READY: '1',
      LANG: 'C.UTF-8',
      PGCLIENTENCODING: 'UTF8',
      PGTZ: 'Europe/Warsaw',
    },
    maxBuffer: 20 * 1024 * 1024,
  });
  return (r.stdout || '') + (r.stderr || '');
}

function parseWynik(out) {
  const m = out.match(/WYNIK:\s*(\d+)\s*OK,\s*(\d+)\s*FAIL/);
  if (!m) return null;
  const skips = [...out.matchAll(/^\s*SKIP\s/gm)].length;
  return { ok: Number(m[1]), fail: Number(m[2]), skips };
}

const env = loadEnv();
const url = env.TEST_DB_URL || '';
refuseProd(url);
if (!env.SUPABASE_ACCESS_TOKEN) {
  console.error('BRAK SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}
if (!env.TEST_SERVICE_ROLE_KEY) {
  console.error('BRAK TEST_SERVICE_ROLE_KEY — uruchom setup kluczy Management API');
  process.exit(1);
}

const authCtx = {
  dbUrl: url,
  supabaseUrl: env.TEST_SUPABASE_URL || `https://${TEST_REF}.supabase.co`,
  serviceKey: env.TEST_SERVICE_ROLE_KEY,
};

await assertProjectAwake(env.SUPABASE_ACCESS_TOKEN);
const psqlReal = findPsql();
const bash = findBash();
console.log(`psql=${psqlReal}`);
console.log(`bash=${bash}`);
console.log('klient: istniejący psql (pg16) + Node pg; bez Dockera / bez winget');
console.log('auth: Admin API (TEST_SERVICE_ROLE_KEY), bez atrapy auth');

const suites = [
  { name: 'security', file: 'security.sh' },
  { name: 'status', file: 'status.sh' },
  { name: 'storage', file: 'storage.sh' },
  { name: 'money', file: 'money.sh' },
  { name: 'release', file: 'release.sh' },
  { name: 'backup', skip: 'CREATE DATABASE — niedostępne na hosted Supabase' },
  { name: 'session', file: 'session.sh' },
  { name: 'archive', file: 'archive.sh' },
  { name: 'watchdog', file: 'watchdog.sh' },
  { name: 'invite', file: 'invite.sh' },
  { name: 'risks', file: 'risks.sh' },
  { name: 'import', file: 'import.sh' },
  { name: 'nullguard', file: 'nullguard.sh' },
  { name: 'i2', file: 'i2.sh' },
  { name: 'workflows', file: 'workflows.sh' },
  { name: 'insurance', file: 'insurance.sh' },
];

let allOk = true;
const results = [];
const categoryB = [];

for (const suite of suites) {
  console.log(`\n======== ${suite.name} ========`);
  if (suite.skip) {
    console.log(`[db] ${suite.name}: SKIP (${suite.skip})`);
    results.push({ name: suite.name, skip: true, reason: suite.skip });
    continue;
  }

  await cleanupTestAuthUsers(authCtx);
  await resetAndMigrate(url, psqlReal);

  if (NEED_SEED_AUTH.has(suite.name)) {
    console.log('auth: ensure-seed (Admin API)');
    try {
      await ensureSeedAuthUsers(authCtx);
    } catch (e) {
      console.error(`auth ensure-seed FAIL: ${String(e.message || e).slice(0, 300)}`);
      allOk = false;
      results.push({ name: suite.name, error: `ensure-seed: ${String(e.message || e).slice(0, 200)}` });
      categoryB.push({ suite: suite.name, fail: -1, lines: [`ensure-seed: ${String(e.message || e).slice(0, 200)}`] });
      continue;
    }
  }
  if (NEED_ORPHAN_SEED.has(suite.name)) {
    console.log('auth: remove-seed (orphan app_users dla invite/relink)');
    try {
      await removeSeedAuthUsers(authCtx);
    } catch (e) {
      console.error(`auth remove-seed FAIL: ${String(e.message || e).slice(0, 300)}`);
    }
  }

  const out = runSuite(bash, psqlReal, suite.file);
  const failLines = out.split(/\r?\n/).filter((l) => /\bFAIL\b/.test(l) && !/WYNIK/.test(l));

  const w = parseWynik(out);
  const exp = EXPECTED[suite.name];
  if (!w) {
    console.log(out.slice(-2000));
    console.log(`[db] ${suite.name}: brak WYNIK`);
    allOk = false;
    results.push({ name: suite.name, error: 'brak WYNIK', failLines });
    continue;
  }
  const line = `WYNIK: ${w.ok} OK, ${w.fail} FAIL` + (w.skips ? `, ${w.skips} SKIP` : '');
  if (w.fail === 0 && w.ok === exp) {
    console.log(`[db] ${suite.name} ${w.ok}/${exp} OK` + (w.skips ? ` (+${w.skips} SKIP)` : ''));
  } else {
    console.log(`[db] ${suite.name}: oczekiwano ${exp}/${exp}, jest: ${line}`);
    allOk = false;
    if (failLines.length) {
      console.log('--- FAIL ---');
      console.log(failLines.slice(0, 40).join('\n'));
    }
    categoryB.push({ suite: suite.name, fail: w.fail, lines: failLines });
  }
  results.push({
    name: suite.name,
    ok: w.ok,
    fail: w.fail,
    skips: w.skips,
    expected: exp,
    failLines,
  });
}

await cleanupTestAuthUsers(authCtx).catch(() => {});

console.log('\n======== PODSUMOWANIE ========');
for (const r of results) {
  if (r.skip) console.log(`${r.name}: SKIP — ${r.reason}`);
  else if (r.error) console.log(`${r.name}: ERROR — ${r.error}`);
  else {
    const st = r.fail === 0 && r.ok === r.expected ? 'OK' : 'FAIL';
    console.log(
      `${r.name}: ${r.ok} OK, ${r.fail} FAIL` +
        (r.skips ? `, ${r.skips} SKIP` : '') +
        ` (oczekiwano ${r.expected}) [${st}]`,
    );
  }
}

if (categoryB.length) {
  console.log('\n======== KANDYDACI (b) — FAIL po adaptacji środowiska ========');
  for (const c of categoryB) {
    console.log(`${c.suite}: ${c.fail} FAIL`);
    for (const l of c.lines.slice(0, 15)) console.log(`  ${l}`);
  }
}

process.exit(allOk ? 0 : 1);
