/**
 * Dry-run / apply 0129 daily_admin_digest.
 *   node scripts/m0129-migrate.mjs dry-run-prod | apply-prod | apply-test | digest-test
 * Nie wypisuje sekretów.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const ROOT = resolve(import.meta.dirname, '..');
const SQL = readFileSync(resolve(ROOT, 'supabase/migrations/0129_daily_admin_digest.sql'), 'utf8');
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
const cmd = process.argv[2] || '';

async function withUrl(url, fn) {
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

async function apply(c, version, name) {
  await c.query('begin');
  await c.query(SQL);
  await c.query(
    `insert into supabase_migrations.schema_migrations (version, name, statements)
     values ($1, $2, array[$3::text])
     on conflict (version) do nothing`,
    [version, name, SQL],
  ).catch(async () => {
    await c.query(
      `insert into supabase_migrations.schema_migrations (version) values ($1) on conflict do nothing`,
      [version],
    );
  });
  await c.query('commit');
}

const mode = cmd;
if (mode === 'dry-run-prod') {
  const url = env.get('SUPABASE_DB_POOLER_URL') || env.get('SUPABASE_DB_URL');
  if (!url?.includes(PROD)) throw new Error('brak PROD URL');
  await withUrl(url, async (c) => {
    await c.query('begin');
    try {
      await c.query(SQL);
      const r = await c.query(`select public.daily_admin_digest(now())`);
      console.log('dry-run digest email=', r.rows[0]?.daily_admin_digest?.email || r.rows[0]);
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
    await apply(c, '0129', 'daily_admin_digest');
    console.log('apply-prod: OK 0129');
  });
} else if (mode === 'apply-test') {
  const url = env.get('TEST_DB_URL') || env.get('TEST_DB_POOLER_URL');
  if (!url?.includes(TEST) || url.includes(PROD)) throw new Error('TEST only');
  await withUrl(url, async (c) => {
    await apply(c, '0129', 'daily_admin_digest');
    const r = await c.query(`select public.daily_admin_digest(now())`);
    console.log('digest-test:', JSON.stringify(r.rows[0]));
    console.log('apply-test: OK 0129');
  });
} else if (mode === 'digest-test') {
  const url = env.get('TEST_DB_URL') || env.get('TEST_DB_POOLER_URL');
  if (!url?.includes(TEST) || url.includes(PROD)) throw new Error('TEST only');
  await withUrl(url, async (c) => {
    const r = await c.query(`select public.daily_admin_digest(now())`);
    console.log(JSON.stringify(r.rows[0]));
  });
} else {
  console.error('użycie: dry-run-prod | apply-prod | apply-test | digest-test');
  process.exit(2);
}
