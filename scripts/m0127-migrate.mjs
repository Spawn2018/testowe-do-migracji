/**
 * Dry-run / apply migration 0127 risk matrix group map. Usage:
 *   node scripts/m0127-migrate.mjs dry-run-prod
 *   node scripts/m0127-migrate.mjs apply-prod
 *   node scripts/m0127-migrate.mjs apply-test
 */
import { readFileSync } from 'node:fs';
import { Client } from 'pg';

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i), l.slice(i + 1)];
    }),
);

const sql = readFileSync(
  new URL('../supabase/migrations/0127_risk_matrix_group_map.sql', import.meta.url),
  'utf8',
);
const cmd = process.argv[2] ?? 'dry-run-prod';

async function withClient(url, fn) {
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

async function verify(c) {
  const src = await c.query(`
    select pg_get_functiondef(p.oid) as def
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname='public' and p.proname='trg_risk_matrix_notify'`);
  const def = src.rows[0]?.def || '';
  return {
    hasEta: /ETA_BREACH/.test(def),
    elseSystem: /else 'SYSTEM'/.test(def),
    noElseFerry: !/else 'RISK_FERRY_WEATHER'/.test(def),
  };
}

async function recordMigration(c) {
  await c
    .query(
      `insert into supabase_migrations.schema_migrations (version, name, statements)
       values ('0127', 'risk_matrix_group_map', array[$1::text])
       on conflict (version) do nothing`,
      [sql.slice(0, 200)],
    )
    .catch(async () => {
      await c.query(
        `insert into supabase_migrations.schema_migrations (version)
         values ('0127') on conflict do nothing`,
      );
    });
}

if (cmd === 'dry-run-prod') {
  const url = env.SUPABASE_DB_POOLER_URL || env.SUPABASE_DB_URL;
  const out = await withClient(url, async (c) => {
    await c.query('BEGIN');
    try {
      await c.query(sql);
      const v = await verify(c);
      await c.query('ROLLBACK');
      return { ok: true, ...v };
    } catch (e) {
      await c.query('ROLLBACK').catch(() => {});
      throw e;
    }
  });
  console.log('DRY-RUN PROD ROLLBACK OK', JSON.stringify(out));
} else if (cmd === 'apply-prod') {
  const url = env.SUPABASE_DB_POOLER_URL || env.SUPABASE_DB_URL;
  const out = await withClient(url, async (c) => {
    await c.query(sql);
    await recordMigration(c);
    return verify(c);
  });
  console.log('APPLY PROD OK', JSON.stringify(out));
} else if (cmd === 'apply-test') {
  const url = env.TEST_DB_URL;
  if (!url || url.includes('nglnnrmzmhusvxslousq')) {
    console.error('ODMOWA: TEST_DB_URL');
    process.exit(2);
  }
  const out = await withClient(url, async (c) => {
    await c.query(sql);
    await recordMigration(c);
    return verify(c);
  });
  console.log('APPLY TEST OK', JSON.stringify(out));
} else {
  console.error('Użycie: dry-run-prod | apply-prod | apply-test');
  process.exit(1);
}
