/**
 * TELM live owner block + phase + orphans — 0176 na PROD / TEST.
 *   node scripts/m0170-migrate.mjs dry-run-prod | apply-prod | verify-prod | apply-test
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const ROOT = resolve(import.meta.dirname, '..');
const SQL = readFileSync(resolve(ROOT, 'supabase/migrations/0176_telm_live_owner_block.sql'), 'utf8');

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
  console.log('redirect', await q(`select load_id::text, owner_email, owner_phone_e164, active from pilot_notify_redirect where load_id='963e19dd-fe83-4690-9306-5c7fc4b95468'`));
  console.log('orphan_tbl', await q(`select to_regclass('public.telematics_orphan_positions') is not null as ok`));
  console.log('fn_phase', await q(`select to_regprocedure('public.telm_infer_phase_from_position(uuid,double precision,double precision,timestamptz)') is not null as ok`));
  console.log('fn_orphan', await q(`select to_regprocedure('public.telm_save_orphan_position(text,text,double precision,double precision,timestamptz,position_source,numeric,numeric,boolean,jsonb)') is not null as ok`));
  console.log('telm_flag', await q(`select enabled from security_flags where key='TELM_EMTRACK_WEB'`));
  console.log('h1', await q(`select enabled from security_flags where key='H1_ROUTE_CHECK'`));
  console.log('h3', await q(`select enabled from security_flags where key='H3_CORRIDOR_OBSTACLES'`));
  console.log('h6', await q(`select enabled from security_flags where key='H6_MAP_OBSTACLES'`));
  console.log('mig', await q(`select exists (select 1 from supabase_migrations.schema_migrations where version='0176') as ok`));
}

async function applyTx(c, commit) {
  await c.query('begin');
  try {
    await c.query(SQL);
    if (commit) {
      await c.query(
        `insert into supabase_migrations.schema_migrations (version, name, statements)
         values ('0176', 'telm_live_owner_block', array[$1::text]) on conflict (version) do nothing`,
        [SQL.slice(0, 200)],
      );
    }
    await verify(c);
    await c.query(commit ? 'commit' : 'rollback');
    console.log(commit ? 'COMMIT OK 0176' : 'dry-run: ROLLBACK OK');
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  }
}

const pooler = env.get('SUPABASE_DB_POOLER_URL');
const testUrl = env.get('TEST_DB_URL');
if (mode === 'dry-run-prod') await withUrl(pooler, (c) => applyTx(c, false));
else if (mode === 'apply-prod') await withUrl(pooler, (c) => applyTx(c, true));
else if (mode === 'verify-prod') await withUrl(pooler, verify);
else if (mode === 'apply-test' && testUrl) await withUrl(testUrl, (c) => applyTx(c, true));
else {
  console.error('usage: dry-run-prod | apply-prod | verify-prod | apply-test');
  process.exit(1);
}
