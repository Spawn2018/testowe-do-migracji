/**
 * B-5 — 0165 kreator reguł (workflows + historia + cron) na PROD / TEST.
 *   node scripts/m0165-migrate.mjs dry-run-prod | apply-prod | verify-prod | apply-test
 * Najpierw tests/db/gate.sh (PG17 :5433) zielone. Zawsze w transakcji; adresów baz nie drukuje.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const ROOT = resolve(import.meta.dirname, '..');
const SQL = readFileSync(resolve(ROOT, 'supabase/migrations/0165_b5_workflow_creator.sql'), 'utf8');
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
  console.log('triggery', await q(`select ('STATUS_CHANGED' = any (wf_trigger_types())) ok_status, ('RISK_RAISED' = any (wf_trigger_types())) ok_risk`));
  console.log('funkcje', await q(`select to_regprocedure('public.wf_duplicate_check(text,jsonb,jsonb,uuid)') is not null as dup,
    to_regprocedure('public.workflow_rule_history(uuid,integer)') is not null as hist,
    to_regprocedure('public.wf_guard_delete()') is not null as guard`));
  console.log('start_off', await q(`select count(*) filter (where enabled)::int on_n, count(*)::int n from workflows where code like 'START-%'`));
  console.log('cron', await q(`select count(*) filter (where jobname='tower-reguly')::int worker,
    count(*) filter (where jobname='tower-reguly-dzien')::int daily from cron.job`));
  console.log('mig', await q(`select exists (select 1 from supabase_migrations.schema_migrations where version='0165') as ok`));
}

async function applyTx(c, commit) {
  await c.query('begin');
  try {
    await c.query(SQL);
    if (commit) {
      await c.query(
        `insert into supabase_migrations.schema_migrations (version, name, statements)
         values ('0165', 'b5_workflow_creator', array[$1::text]) on conflict (version) do nothing`,
        [SQL.slice(0, 200)],
      );
    }
    await verify(c);
    await c.query(commit ? 'commit' : 'rollback');
    console.log(commit ? 'COMMIT OK 0165' : 'dry-run: ROLLBACK OK');
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
