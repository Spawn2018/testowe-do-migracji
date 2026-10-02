/**
 * Apply 0130 daily digest distinct fingerprint on PROD (+ optional TEST).
 *   node scripts/m0130-migrate.mjs dry-run-prod | apply-prod | apply-test
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const ROOT = resolve(import.meta.dirname, '..');
const SQL = readFileSync(resolve(ROOT, 'supabase/migrations/0130_daily_digest_distinct_errors.sql'), 'utf8');
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
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

async function apply(c) {
  await c.query(SQL);
  await c
    .query(
      `insert into supabase_migrations.schema_migrations (version, name, statements)
       values ('0130', 'daily_digest_distinct_errors', array[$1::text])
       on conflict (version) do nothing`,
      [SQL.slice(0, 200)],
    )
    .catch(async () => {
      await c.query(`insert into supabase_migrations.schema_migrations (version) values ('0130') on conflict do nothing`);
    });
}

if (mode === 'dry-run-prod') {
  const url = env.get('SUPABASE_DB_POOLER_URL') || env.get('SUPABASE_DB_URL');
  if (!url?.includes(PROD)) throw new Error('brak PROD URL');
  await withUrl(url, async (c) => {
    await c.query('begin');
    try {
      await c.query(SQL);
      const r = await c.query(`select public.daily_admin_digest(now()) as j`);
      const j = r.rows[0]?.j;
      console.log('dry-run types=', j?.client_error_types, 'sms_failed=', j?.sms_failed, 'email=', j?.email);
      await c.query('rollback');
      console.log('dry-run-prod: ROLLBACK OK');
    } catch (e) {
      await c.query('rollback').catch(() => {});
      throw e;
    }
  });
} else if (mode === 'apply-prod') {
  const url = env.get('SUPABASE_DB_POOLER_URL') || env.get('SUPABASE_DB_URL');
  if (!url?.includes(PROD)) throw new Error('brak PROD URL');
  await withUrl(url, async (c) => {
    await apply(c);
    console.log('apply-prod: OK 0130');
  });
} else if (mode === 'apply-test') {
  const url = env.get('TEST_DB_URL') || env.get('TEST_DB_POOLER_URL');
  if (!url?.includes(TEST) || url.includes(PROD)) throw new Error('TEST only');
  await withUrl(url, async (c) => {
    await apply(c);
    console.log('apply-test: OK 0130');
  });
} else {
  console.error('użycie: dry-run-prod | apply-prod | apply-test');
  process.exit(2);
}
