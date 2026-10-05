/**
 * 0189 — BAF PROGNOZA: przyszłe tygodnie = ostatni OSTATECZNY (nie częściowa średnia).
 *   node scripts/m0189-migrate.mjs dry-run-prod | apply-prod | verify-prod | fix-prod
 * fix-prod: po apply przelicza PROGNOZA (sefs_refresh_prognoza) i raportuje 1.12→1.13.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const ROOT = resolve(import.meta.dirname, '..');
const SQL = readFileSync(resolve(ROOT, 'supabase/migrations/0189_baf_prognoza.sql'), 'utf8');

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

const P = 'cbb008cd-4c26-48a8-9743-02878b86ff10';

async function verify(c) {
  const q = async (s) => { try { return (await c.query(s)).rows; } catch (e) { return [{ ok: false, err: e.message }]; } };
  console.log('w41', JSON.stringify((await q(`select sefs_week_calc('${P}','2026-10-06') r`))[0]?.r));
  console.log('future', JSON.stringify((await q(`select sefs_week_calc('${P}','2026-10-16') r`))[0]?.r));
  console.log('counts', await q(`
    select fuel_status, round(fuel_applied_mult::numeric, 2) mult, count(*) n
      from load_cost c join loads l on l.id = c.load_id
     where l.project_id = '${P}' and fuel_load_date(l.id) >= '2026-10-16'
     group by 1, 2 order by 1, 2`));
  console.log('mig', await q(`select version from supabase_migrations.schema_migrations where version in ('0187','0188','0189') order by 1`));
}

async function fixCounts(c) {
  const before = await c.query(`
    select count(*)::int n from load_cost c join loads l on l.id = c.load_id
     where l.project_id = $1 and fuel_load_date(l.id) between '2026-10-16' and '2026-12-15'
       and round(c.fuel_applied_mult::numeric, 2) = 1.12`, [P]);
  console.log('before_1_12', before.rows[0].n);
  const refreshed = await c.query(`select sefs_refresh_prognoza($1) n`, [P]);
  console.log('refreshed', refreshed.rows[0].n);
  const after = await c.query(`
    select count(*)::int n_112,
           count(*) filter (where round(c.fuel_applied_mult::numeric,2)=1.13 and c.fuel_status='PROGNOZA')::int n_113_prog
      from load_cost c join loads l on l.id = c.load_id
     where l.project_id = $1 and fuel_load_date(l.id) between '2026-10-16' and '2026-12-15'`, [P]);
  console.log('after', after.rows[0]);
  const sample = await c.query(`
    select l.order_no, fuel_load_date(l.id)::text d, c.fuel_applied_mult mult, c.fuel_status
      from load_cost c join loads l on l.id = c.load_id
     where l.project_id = $1 and fuel_load_date(l.id) between '2026-10-16' and '2026-12-15'
     order by fuel_load_date(l.id), l.order_no limit 8`, [P]);
  console.log('sample', JSON.stringify(sample.rows));
}

async function has(c, v) {
  return (await c.query(`select 1 from supabase_migrations.schema_migrations where version = $1`, [v])).rowCount > 0;
}

async function applyTx(c, commit) {
  await c.query('begin');
  try {
    if (!(await has(c, '0188'))) throw new Error('0188 nie jest nałożona — najpierw m0188');
    if (await has(c, '0189')) {
      console.log('0189 już nałożona');
    } else {
      await c.query(SQL);
      if (commit) {
        await c.query(
          `insert into supabase_migrations.schema_migrations (version, name, statements)
           values ('0189', 'baf_prognoza', array[$1::text]) on conflict (version) do nothing`,
          [SQL.slice(0, 200)],
        );
      }
    }
    if (commit) await fixCounts(c);
    else {
      await verify(c);
      // dry-run: also simulate refresh inside tx then rollback
      await fixCounts(c);
    }
    await c.query(commit ? 'commit' : 'rollback');
    console.log(commit ? 'COMMIT OK 0189' : 'dry-run: ROLLBACK OK');
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  }
}

const pooler = env.get('SUPABASE_DB_POOLER_URL');
if (mode === 'dry-run-prod') await withUrl(pooler, (c) => applyTx(c, false));
else if (mode === 'apply-prod') await withUrl(pooler, (c) => applyTx(c, true));
else if (mode === 'verify-prod') await withUrl(pooler, verify);
else if (mode === 'fix-prod') await withUrl(pooler, async (c) => { await fixCounts(c); await verify(c); });
else {
  console.error('usage: dry-run-prod | apply-prod | verify-prod | fix-prod');
  process.exit(1);
}
