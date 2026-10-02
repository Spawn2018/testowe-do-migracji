/**
 * Jeden krok bramy TEST. Nie czyści schematu poza krokiem `prep`.
 *
 *   node scripts/test-db-gate-step.mjs prep
 *   node scripts/test-db-gate-step.mjs security
 *   node scripts/test-db-gate-step.mjs nullguard-1
 *   node scripts/test-db-gate-step.mjs next
 *
 * Nie wypisuje haseł. Produkcja nglnnrmzmhusvxslousq jest odmową.
 * Zestaw nie nakłada migracji. nullguard/i2: własne połączenie, keepalive,
 * ponowienie tylko przy zerwaniu połączenia (nie przy FAIL merytorycznym).
 */
import { readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import pg from 'pg';
import { resetPublic, applyMigrationsAndSeed, refuseProdUrl, redactSecrets } from './lib/test-db-migrate.mjs';
import {
  ensureSeedAuthUsers,
  removeSeedAuthUsers,
  cleanupTestAuthUsers,
} from './lib/test-auth-admin.mjs';
import { gateSteps, needsSeedAuth, needsOrphanSeed } from './lib/gate-suites.mjs';
import { appendResult, gitCommit, lastMigration, latestFor, redactSecrets as redact2, warsawIso } from './lib/gate-results.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const TEST_REF = 'emkbykwenwrjmbprydml';
const STEP_MS = Number(process.env.TOWER_GATE_STEP_MS || 30 * 60 * 1000);
const MAX_ATTEMPTS = 3;

const CONN_RE = /database "[^"]*" does not exist|connection reset|server closed the connection|could not connect to server|SSL SYSCALL error|ECONNRESET|Connection refused|FATAL\s*:/i;

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

function findPsql() {
  const candidates = [process.env.TOWER_REAL_PSQL, 'psql'].filter(Boolean);
  for (const c of candidates) {
    const r = spawnSync(c, ['--version'], { encoding: 'utf8' });
    if (r.status === 0) return c;
  }
  console.error('BRAK psql — ustaw TOWER_REAL_PSQL');
  process.exit(1);
}

function findBash() {
  const candidates = [process.env.BASH_PATH, 'bash'].filter(Boolean);
  for (const c of candidates) {
    const r = spawnSync(c, ['-c', 'echo ok'], { encoding: 'utf8' });
    if (r.status === 0) return c;
  }
  console.error('BRAK bash');
  process.exit(1);
}

function parseWynik(out) {
  const m = out.match(/WYNIK:\s*(\d+)\s*OK,\s*(\d+)\s*FAIL/);
  if (!m) return null;
  const skips = [...out.matchAll(/^\s*SKIP\s/gm)].length;
  return { ok: Number(m[1]), fail: Number(m[2]), skips };
}

function isConnectionDrop(out) {
  const lines = out.split(/\r?\n/);
  if (!lines.some((l) => CONN_RE.test(l))) return false;
  const failLines = lines.filter((l) => /\bFAIL\b/.test(l) && !/WYNIK:/.test(l));
  const substantive = failLines.filter((l) => !CONN_RE.test(l));
  return substantive.length === 0;
}

function printTail(out) {
  const red = redactSecrets(redact2(out));
  const failLines = red.split(/\r?\n/).filter((l) => /\bFAIL\b/.test(l) && !/WYNIK/.test(l));
  if (failLines.length) console.log(failLines.slice(0, 40).join('\n'));
  else console.log(red.slice(-1500));
}

const arg = process.argv[2];
const { steps, order } = gateSteps();
if (!arg || process.argv.length > 3) {
  console.error('Użycie: node scripts/test-db-gate-step.mjs <prep|zestaw|next>');
  console.error('Kolejność: ' + order.join(' '));
  process.exit(2);
}

const commit = gitCommit();
let migration = '';
try { migration = lastMigration(); } catch { migration = ''; }

if (arg === 'next') {
  const map = migration ? latestFor(commit, migration) : new Map();
  const nxt = order.find((name) => map.get(name)?.status !== 'ok');
  if (!nxt) console.log('brama: komplet na tym commicie i tej migracji');
  else console.log(nxt);
  process.exit(0);
}

if (arg !== 'prep' && !steps[arg]) {
  console.error(`ODMOWA: nieznany krok ${arg}`);
  console.error('Kolejność: ' + order.join(' '));
  process.exit(2);
}

const env = loadEnv();
const url = env.TEST_DB_URL || '';
refuseProdUrl(url);
if (!url.includes(TEST_REF)) {
  console.error('ODMOWA: TEST_DB_URL bez ref projektu testowego');
  process.exit(2);
}

let recorded = false;
function record(partial) {
  if (recorded) return;
  recorded = true;
  const row = appendResult({
    suite: arg,
    ok: partial.ok ?? 0,
    fail: partial.fail ?? 0,
    skip: partial.skip ?? 0,
    expected: partial.expected ?? (arg === 'prep' ? 1 : steps[arg].expected),
    commit,
    migration: partial.migration || migration || 'brak',
    at: warsawIso(),
    status: partial.status,
  });
  console.log(`[db] zapis ${row.suite} status=${row.status} ok=${row.ok} fail=${row.fail} skip=${row.skip} expected=${row.expected} migration=${row.migration}`);
}

const killer = () => {
  record({ status: 'interrupted', migration });
  process.exit(1);
};
process.on('SIGINT', killer);
process.on('SIGTERM', killer);
process.on('exit', (code) => {
  if (recorded) return;
  try {
    record({ status: code === 0 ? 'interrupted' : 'fail', migration });
  } catch { /* wynik już zapisany albo plik zablokowany */ }
});
const stepTimer = setTimeout(() => {
  console.error('PRZERWANE: limit czasu kroku');
  record({ status: 'interrupted', migration });
  process.exit(1);
}, STEP_MS);

try {
  if (arg === 'prep') {
    const psqlBin = findPsql();
    console.log(`psql=${psqlBin}`);
    console.log('prep: czyszczenie schematu TEST i migracje + seed');
    await resetPublic(url);
    const last = await applyMigrationsAndSeed(ROOT, url, psqlBin);
    migration = last;
    record({ status: 'ok', ok: 1, fail: 0, skip: 0, expected: 1, migration: last });
  } else {
    const spec = steps[arg];
    if (!env.TEST_SERVICE_ROLE_KEY) {
      console.error('BRAK TEST_SERVICE_ROLE_KEY');
      record({ status: 'fail', expected: spec.expected });
      process.exit(1);
    }
    const psqlBin = findPsql();
    const bash = findBash();
    const authCtx = {
      dbUrl: url,
      supabaseUrl: env.TEST_SUPABASE_URL || `https://${TEST_REF}.supabase.co`,
      serviceKey: env.TEST_SERVICE_ROLE_KEY,
    };
    await cleanupTestAuthUsers(authCtx);
    if (needsSeedAuth(arg)) {
      console.log('auth: ensure-seed');
      await ensureSeedAuthUsers(authCtx);
    }
    if (needsOrphanSeed(arg)) {
      console.log('auth: remove-seed');
      await removeSeedAuthUsers(authCtx);
    }

    let lastOut = '';
    let wynik = null;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const client = new pg.Client({
        connectionString: url,
        ssl: { rejectUnauthorized: false },
        keepAlive: true,
        keepAliveInitialDelayMillis: 10000,
      });
      await client.connect();
      const ping = setInterval(() => { client.query('select 1').catch(() => {}); }, 15000);
      console.log(`\n======== ${arg} próba ${attempt}/${MAX_ATTEMPTS} (osobne połączenie) ========`);
      const r = spawnSync(bash, [join(ROOT, 'scripts/run-hosted-suite.sh'), spec.file], {
        encoding: 'utf8',
        cwd: ROOT,
        env: {
          ...process.env,
          ...spec.env,
          TOWER_REAL_PSQL: psqlBin,
          TOWER_HOSTED_READY: '1',
          LANG: 'C.UTF-8',
          PGCLIENTENCODING: 'UTF8',
          PGTZ: 'Europe/Warsaw',
          PGKEEPALIVES: '1',
          PGKEEPALIVESIDLE: '30',
          PGKEEPALIVESINTERVAL: '10',
          PGKEEPALIVESCOUNT: '5',
        },
        maxBuffer: 20 * 1024 * 1024,
      });
      clearInterval(ping);
      await client.end().catch(() => {});
      lastOut = (r.stdout || '') + (r.stderr || '');
      wynik = parseWynik(lastOut);
      const drop = isConnectionDrop(lastOut) && (!wynik || wynik.fail > 0);
      if (drop && attempt < MAX_ATTEMPTS) {
        console.log('połączenie zerwane — ponawiam część (bez zmiany asercji)');
        continue;
      }
      break;
    }

    const exp = spec.expected;
    if (!wynik) {
      printTail(lastOut);
      console.log(`[db] ${arg}: brak WYNIK`);
      record({ status: 'fail', ok: 0, fail: 0, skip: 0, expected: exp });
      process.exit(1);
    }
    const line = `WYNIK: ${wynik.ok} OK, ${wynik.fail} FAIL` + (wynik.skips ? `, ${wynik.skips} SKIP` : '');
    const good = wynik.fail === 0 && wynik.ok === exp;
    if (good) console.log(`[db] ${arg} ${wynik.ok}/${exp} OK` + (wynik.skips ? ` (+${wynik.skips} SKIP)` : ''));
    else {
      console.log(`[db] ${arg}: oczekiwano ${exp}/${exp}, jest: ${line}`);
      printTail(lastOut);
    }
    record({
      status: good ? 'ok' : 'fail',
      ok: wynik.ok,
      fail: wynik.fail,
      skip: wynik.skips,
      expected: exp,
    });
    if (!good) process.exit(1);
  }
} catch (e) {
  const msg = redactSecrets(redact2(e && e.stack ? e.message : e));
  console.error(msg.slice(0, 500));
  const drop = CONN_RE.test(String(e && e.message));
  record({ status: drop ? 'interrupted' : 'fail' });
  process.exit(1);
} finally {
  clearTimeout(stepTimer);
}

process.exit(0);
