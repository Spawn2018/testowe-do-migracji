/**
 * SEFS-KOREKTA — 0166 średnia bierze korektę (migawka 32.3) na PROD / TEST.
 *   node scripts/m0166-migrate.mjs dry-run-prod | apply-prod | verify-prod | apply-test
 * Najpierw tests/db/gate.sh (PG17 :5433) zielone. Zawsze w transakcji; adresów baz nie drukuje.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const ROOT = resolve(import.meta.dirname, '..');
const SQL = readFileSync(resolve(ROOT, 'supabase/migrations/0166_sefs_korekta.sql'), 'utf8');
const PROD = 'nglnnrmzmhusvxslousq';
const TEST = 'emkbykwenwrjmbprydml';

function parseEnv(text) {
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    let v = line.slice(i + 1);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    map.set(line.slice(0, i).trim(), v);
  }
  return map;
}
const env = parseEnv(readFileSync(resolve(ROOT, '.env.local'), 'utf8'));
const mode = process.argv[2] || '';

async function withUrl(url, fn) {
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try { return await fn(c); } finally { await c.end(); }
}

async function verify(c) {
  const q = async (s) => (await c.query(s)).rows[0];
  console.log('sefs_week_calc', await q(`select pg_get_functiondef('public.sefs_week_calc(uuid,date)'::regprocedure) like '%coalesce(c.value, r.value)%' as uses_correction`));
  console.log('l1b_sefs_note', await q(`select pg_get_functiondef('public.l1b_sefs_note(uuid,date)'::regprocedure) like '%coalesce(c.value, r.value)%' as uses_correction`));
  console.log('mig', await q(`select exists (select 1 from supabase_migrations.schema_migrations where version='0166') as ok`));
}

async function applyTx(c, commit) {
  await c.query('begin');
  try {
    await c.query(SQL);
    if (commit) {
      await c.query(
        `insert into supabase_migrations.schema_migrations (version, name, statements)
         values ('0166', 'sefs_korekta', array[$1::text]) on conflict (version) do nothing`,
        [SQL.slice(0, 200)],
      );
    }
    await verify(c);
    await c.query(commit ? 'commit' : 'rollback');
    console.log(commit ? 'COMMIT OK 0166' : 'dry-run: ROLLBACK OK');
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  }
}

const prodUrl = () => {
  const u = env.get('SUPABASE_DB_POOLER_URL') || env.get('SUPABASE_DB_URL');
  if (!u?.includes(PROD)) throw new Error('brak PROD URL');
  return u;
};
if (mode === 'dry-run-prod') await withUrl(prodUrl(), (c) => applyTx(c, false));
else if (mode === 'apply-prod') await withUrl(prodUrl(), (c) => applyTx(c, true));
else if (mode === 'verify-prod') await withUrl(prodUrl(), verify);
else if (mode === 'apply-test') {
  const u = env.get('TEST_DB_URL') || env.get('TEST_DB_POOLER_URL');
  if (!u?.includes(TEST) || u.includes(PROD)) throw new Error('TEST only');
  await withUrl(u, (c) => applyTx(c, true));
} else {
  console.error('tryb: dry-run-prod | apply-prod | verify-prod | apply-test');
  process.exit(2);
}
