/**
 * 0184 — fix notify_load_chat_message (loads.code → hhl_order_no/order_no).
 *   node scripts/m0184-migrate.mjs dry-run-prod | apply-prod | verify-prod
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const ROOT = resolve(import.meta.dirname, '..');
const SQL = readFileSync(resolve(ROOT, 'supabase/migrations/0184_fix_chat_notify_load_code.sql'), 'utf8');

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
  const q = async (s) => { try { return (await c.query(s)).rows[0]; } catch (e) { return { ok: false, err: e.message }; } };
  console.log('fn_src', await q(`select pg_get_functiondef(oid) as def from pg_proc where proname='notify_load_chat_message' limit 1`));
  console.log('no_l_code', await q(`select position('l.code' in pg_get_functiondef(oid))=0 as ok from pg_proc where proname='notify_load_chat_message' limit 1`));
  console.log('has_hhl', await q(`select position('hhl_order_no' in pg_get_functiondef(oid))>0 as ok from pg_proc where proname='notify_load_chat_message' limit 1`));
  console.log('telm', await q(`select enabled from security_flags where key='TELM_EMTRACK_WEB'`));
  console.log('mig', await q(`select exists (select 1 from supabase_migrations.schema_migrations where version='0184') as ok`));
}

async function applyTx(c, commit) {
  await c.query('begin');
  try {
    await c.query(SQL);
    if (commit) {
      await c.query(
        `insert into supabase_migrations.schema_migrations (version, name, statements)
         values ('0184', 'fix_chat_notify_load_code', array[$1::text]) on conflict (version) do nothing`,
        [SQL.slice(0, 200)],
      );
    }
    await c.query(commit ? 'commit' : 'rollback');
    console.log(commit ? 'COMMIT OK 0184' : 'dry-run: ROLLBACK OK');
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  }
}

const pooler = env.get('SUPABASE_DB_POOLER_URL');
if (mode === 'dry-run-prod') await withUrl(pooler, (c) => applyTx(c, false));
else if (mode === 'apply-prod') await withUrl(pooler, (c) => applyTx(c, true));
else if (mode === 'verify-prod') await withUrl(pooler, verify);
else {
  console.error('usage: dry-run-prod | apply-prod | verify-prod');
  process.exit(1);
}
