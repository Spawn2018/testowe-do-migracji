/**
 * Szybka brama tylko wybranych zestawów (po pełnej bramie z FAIL).
 * Użycie: node scripts/test-db-gate-subset.mjs nullguard i2 dec5 workflows
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
const TEST_REF = 'emkbykwenwrjmbprydml';
const EXPECTED = {
  nullguard: 528,
  i2: 524,
  dec2: 18,
  dec3: 13,
  dec5: 11,
  workflows: 47,
  security: 84,
  money: 131,
  dec6: 15,
  adm10: 8,
  insurance: 42,
  hist11: 11,
};
const NEED_SEED_AUTH = new Set(['session', 'i2']);
const names = process.argv.slice(2);
if (!names.length) {
  console.error('Podaj zestawy, np. nullguard i2 dec5');
  process.exit(2);
}

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

const env = loadEnv();
const url = env.TEST_DB_URL || '';
refuseProdUrl(url);
const psqlReal = 'D:\\OMNIROUTE\\tools\\pg16\\pgsql\\bin\\psql.exe';
const bash = 'D:\\Git\\bin\\bash.exe';
const authCtx = {
  dbUrl: url,
  supabaseUrl: env.TEST_SUPABASE_URL || `https://${TEST_REF}.supabase.co`,
  serviceKey: env.TEST_SERVICE_ROLE_KEY,
};

let allOk = true;
for (const name of names) {
  const file = `${name}.sh`;
  console.log(`\n======== ${name} ========`);
  await cleanupTestAuthUsers(authCtx);
  await resetPublic(url);
  await applyMigrationsAndSeed(ROOT, url, psqlReal);
  if (NEED_SEED_AUTH.has(name)) await ensureSeedAuthUsers(authCtx);
  const r = spawnSync(bash, [join(ROOT, 'scripts/run-hosted-suite.sh'), file], {
    encoding: 'utf8',
    cwd: ROOT,
    env: { ...process.env, TOWER_REAL_PSQL: psqlReal, TOWER_HOSTED_READY: '1', LANG: 'C.UTF-8', PGCLIENTENCODING: 'UTF8', PGTZ: 'Europe/Warsaw' },
    maxBuffer: 20 * 1024 * 1024,
  });
  const out = (r.stdout || '') + (r.stderr || '');
  const m = out.match(/WYNIK:\s*(\d+)\s*OK,\s*(\d+)\s*FAIL/);
  const exp = EXPECTED[name];
  if (!m) {
    console.log(out.slice(-1500));
    allOk = false;
    continue;
  }
  const ok = Number(m[1]);
  const fail = Number(m[2]);
  const line = `WYNIK: ${ok} OK, ${fail} FAIL`;
  if (fail === 0 && ok === exp) console.log(`[db] ${name} ${ok}/${exp} OK`);
  else {
    allOk = false;
    console.log(`[db] ${name}: oczekiwano ${exp}/${exp}, jest: ${line}`);
    console.log(out.split(/\r?\n/).filter((l) => /\bFAIL\b/.test(l) && !/WYNIK/.test(l)).slice(0, 30).join('\n'));
  }
}
await cleanupTestAuthUsers(authCtx).catch(() => {});
process.exit(allOk ? 0 : 1);
