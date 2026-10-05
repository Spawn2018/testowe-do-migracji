/**
 * B-6e — 0164 dziennik logowań (auth_login_events + wyzwalacz na auth.sessions) na PROD / TEST.
 *   node scripts/m0164-migrate.mjs dry-run-prod | apply-prod | verify-prod | apply-test
 * Najpierw tests/db/gate.sh (PG17 :5433) zielone. Zawsze w transakcji; adresów baz nie drukuje.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const ROOT = resolve(import.meta.dirname, '..');
const SQL = readFileSync(resolve(ROOT, 'supabase/migrations/0164_b6e_login_log.sql'), 'utf8');
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
  console.log('tabela', await q(`select to_regclass('public.auth_login_events') is not null as ok`));
  console.log('wiersze', await q(`select count(*)::int n, count(*) filter (where source='LAST_SIGN_IN')::int last_sign_in from public.auth_login_events`));
  console.log('wyzwalacz', await q(`select count(*)::int n from pg_trigger where tgname='tower_on_auth_session_created' and not tgisinternal`));
  console.log('rls', await q(`select relrowsecurity rls from pg_class where oid='public.auth_login_events'::regclass`));
  console.log('uprawnienia', await q(`select has_function_privilege('authenticated','public.tower_log_auth_session()','execute') fn_auth,
    has_table_privilege('authenticated','public.auth_login_events','select') tbl_auth,
    has_table_privilege('anon','public.auth_login_events','select') tbl_anon,
    has_function_privilege('anon','public.admin_auth_login_log(integer)','execute') rpc_anon`));
}

async function applyTx(c, commit) {
  await c.query('begin');
  try {
    await c.query(SQL);
    if (commit) {
      await c.query(
        `insert into supabase_migrations.schema_migrations (version, name, statements)
         values ('0164', 'b6e_login_log', array[$1::text]) on conflict (version) do nothing`,
        [SQL.slice(0, 200)],
      );
    }
    await verify(c);
    await c.query(commit ? 'commit' : 'rollback');
    console.log(commit ? 'COMMIT OK 0164' : 'dry-run: ROLLBACK OK');
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
