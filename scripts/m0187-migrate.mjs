/**
 * 0187 — BAF GoEasy + średnia z publikacji + wstępny/ostateczny + ceny 94 transportów.
 *   node scripts/m0187-migrate.mjs dry-run-prod | apply-prod | verify-prod | report-prod
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const ROOT = resolve(import.meta.dirname, '..');
const SQL = readFileSync(resolve(ROOT, 'supabase/migrations/0187_baf_goeasy_ceny.sql'), 'utf8');

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
  console.log('w40', JSON.stringify((await q(`select sefs_week_calc('${P}','2026-10-01') r`))[0]?.r));
  console.log('w41', JSON.stringify((await q(`select sefs_week_calc('${P}','2026-10-06') r`))[0]?.r));
  console.log('params', await q(`select version, valid_from, index_sek from sefs_parameters where project_id='${P}' order by version`));
  console.log('pub_null', await q(`select index_code, count(*) filter (where published_on is null) n_null, count(*) n from fuel_index_readings where project_id='${P}' group by 1`));
  console.log('priced', await q(`select (select count(*) from load_cost) cost_rows, (select count(*) from load_revenue) rev_rows, (select count(*) from loads where project_id='${P}') loads`));
  console.log('mig', await q(`select exists (select 1 from supabase_migrations.schema_migrations where version='0187') as ok`));
}

async function report(c) {
  const { rows } = await c.query(`
    select l.order_no, coalesce(l.hhl_order_no,'') hhl, l.status::text status, si.shipment_code, shipment_family(si.shipment_code) fam,
           si.length_m, si.width_m, si.height_m, coalesce(si.total_weight_t, si.unit_weight_t*coalesce(si.qty,1)) weight_t,
           fuel_load_date(l.id) load_date,
           c.rate_basis->>'symbol' symbol, c.rate_basis->>'convoy' convoy, (c.rate_basis->>'height_adopted') height_adopted,
           c.base_amount cost_rate, r.base_amount rev_rate, c.fuel_applied_mult mult, c.fuel_status status_mult,
           c.baf_amount cost_baf, c.total_amount cost_total, r.baf_amount rev_baf, r.total_amount rev_total,
           coalesce(c.rate_basis->>'reason',
             case when c.load_id is null then (select rate_match_sys(rc.id, l.id)->>'reason' from rate_cards rc
                                                where rc.project_id = l.project_id and rc.side = 'COST' order by rc.version desc limit 1) end, '') reason
      from loads l
      left join lateral (select * from shipment_items s where s.load_id = l.id order by s.assembly_seq nulls last, s.shipment_code limit 1) si on true
      left join load_cost c on c.load_id = l.id
      left join load_revenue r on r.load_id = l.id
     where l.project_id = '${P}'
     order by fuel_load_date(l.id) nulls last, l.order_no`);
  console.log(JSON.stringify(rows));
}

async function applyTx(c, commit) {
  await c.query('begin');
  try {
    await c.query(SQL);
    if (!commit && process.env.REPORT === '1') { await verify(c); await report(c); }
    if (commit) {
      await c.query(
        `insert into supabase_migrations.schema_migrations (version, name, statements)
         values ('0187', 'baf_goeasy_ceny', array[$1::text]) on conflict (version) do nothing`,
        [SQL.slice(0, 200)],
      );
    }
    await c.query(commit ? 'commit' : 'rollback');
    console.log(commit ? 'COMMIT OK 0187' : 'dry-run: ROLLBACK OK');
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  }
}

const pooler = env.get('SUPABASE_DB_POOLER_URL');
if (mode === 'dry-run-prod') await withUrl(pooler, (c) => applyTx(c, false));
else if (mode === 'apply-prod') await withUrl(pooler, (c) => applyTx(c, true));
else if (mode === 'verify-prod') await withUrl(pooler, verify);
else if (mode === 'report-prod') await withUrl(pooler, report);
else {
  console.error('usage: dry-run-prod | apply-prod | verify-prod | report-prod');
  process.exit(1);
}
