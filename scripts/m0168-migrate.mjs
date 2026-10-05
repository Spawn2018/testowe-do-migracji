/**
 * PALIWO-AUTO-B — 0168 na PROD / TEST.
 *   node scripts/m0168-migrate.mjs dry-run-prod | apply-prod | verify-prod | apply-test
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const ROOT = resolve(import.meta.dirname, '..');
const SQL = readFileSync(resolve(ROOT, 'supabase/migrations/0168_fuel_se_pl_ingest.sql'), 'utf8');
const CRON = readFileSync(resolve(ROOT, 'supabase/sql/cron_fuel_prices.sql'), 'utf8');

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
  console.log('flag', await q(`select enabled from security_flags where key='FUEL_SE_PL_INGEST'`));
  console.log('ingest_fn', await q(`select to_regprocedure('public.fuel_se_pl_ingest(uuid,jsonb)') is not null as ok`));
  console.log('watch_fn', await q(`select to_regprocedure('public.fuel_se_pl_missing_watch(uuid,date)') is not null as ok`));
  console.log('mig', await q(`select exists (select 1 from supabase_migrations.schema_migrations where version='0168') as ok`));
  console.log('cron', await q(`select exists (select 1 from cron.job where jobname='tower-fuel-prices') as ok`));
}

async function applyTx(c, commit, withCron) {
  await c.query('begin');
  try {
    await c.query(SQL);
    if (withCron) {
      await c.query(`select cron.unschedule(jobid) from cron.job where jobname = 'tower-fuel-prices'`);
      await c.query(CRON);
    }
    if (commit) {
      await c.query(
        `insert into supabase_migrations.schema_migrations (version, name, statements)
         values ('0168', 'fuel_se_pl_ingest', array[$1::text]) on conflict (version) do nothing`,
        [SQL.slice(0, 200)],
      );
    }
    await verify(c);
    await c.query(commit ? 'commit' : 'rollback');
    console.log(commit ? 'COMMIT OK 0168' : 'dry-run: ROLLBACK OK');
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  }
}

const pooler = env.get('SUPABASE_DB_POOLER_URL');
const testUrl = env.get('TEST_DB_URL');
if (mode === 'dry-run-prod') await withUrl(pooler, (c) => applyTx(c, false, false));
else if (mode === 'apply-prod') await withUrl(pooler, (c) => applyTx(c, true, true));
else if (mode === 'verify-prod') await withUrl(pooler, verify);
else if (mode === 'apply-test') await withUrl(testUrl, (c) => applyTx(c, true, false));
else {
  console.error('usage: dry-run-prod | apply-prod | verify-prod | apply-test');
  process.exit(1);
}
