/**
 * Dry-run / apply migration 0128 advisor auth_rls_initplan.
 *   node scripts/m0128-migrate.mjs dry-run-prod | apply-prod | apply-test
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
  new URL('../supabase/migrations/0128_advisor_security_perf.sql', import.meta.url),
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
  const pol = await c.query(`
    select polname, pg_get_expr(polqual, polrelid) as using_expr
      from pg_policy
     where polname in ('users_self','user_prefs_own','ops_thresholds_read','system_broadcast_read')`);
  const uidWrapped = pol.rows.filter((r) =>
    /\(\s*SELECT auth\.uid\(\)/i.test(r.using_expr || ''),
  ).length;
  return { policies: pol.rows.length, uidWrapped };
}

async function recordMigration(c) {
  await c
    .query(
      `insert into supabase_migrations.schema_migrations (version, name, statements)
       values ('0128', 'advisor_security_perf', array[$1::text])
       on conflict (version) do nothing`,
      [sql.slice(0, 200)],
    )
    .catch(async () => {
      await c.query(
        `insert into supabase_migrations.schema_migrations (version)
         values ('0128') on conflict do nothing`,
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
  const url = env.TEST_DB_URL || env.TEST_DB_POOLER_URL;
  const out = await withClient(url, async (c) => {
    await c.query(sql);
    await recordMigration(c);
    return verify(c);
  });
  console.log('APPLY TEST OK', JSON.stringify(out));
} else {
  console.error('usage: dry-run-prod | apply-prod | apply-test');
  process.exit(2);
}
