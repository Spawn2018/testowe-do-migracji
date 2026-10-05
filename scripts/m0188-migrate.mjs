/**
 * 0188 — TELM: podłączenie w trasie nie ustawia rzeczywistego załadunku + korekta (SG-03).
 *   node scripts/m0188-migrate.mjs dry-run-prod   (0187 jeśli brak + 0188 w wycofanej transakcji)
 *   node scripts/m0188-migrate.mjs apply-prod | verify-prod
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const ROOT = resolve(import.meta.dirname, '..');
const SQL87 = readFileSync(resolve(ROOT, 'supabase/migrations/0187_baf_goeasy_ceny.sql'), 'utf8');
const SQL = readFileSync(resolve(ROOT, 'supabase/migrations/0188_telm_faza_bez_zaladunku.sql'), 'utf8');

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

const SG03 = '15062/2026/OSL/GDA/P';
async function verify(c) {
  const q = async (s) => { try { return (await c.query(s)).rows; } catch (e) { return [{ ok: false, err: e.message }]; } };
  console.log('sg03', JSON.stringify(await q(`
    select l.order_no, l.status, l.plan_load_date::text plan, l.actual_load_at, fuel_load_date(l.id)::text fuel_date,
           c.fuel_applied_mult mult, c.fuel_status, c.fuel_ref_date::text ref, c.base_amount, c.baf_amount, c.total_amount,
           r.total_amount rev_total, p.phase, p.note, p.observed_at
      from loads l left join load_cost c on c.load_id = l.id left join load_revenue r on r.load_id = l.id
      left join telm_attach_phase p on p.load_id = l.id where l.order_no = '${SG03}'`)));
  console.log('attach_phase', JSON.stringify(await q(`select l.order_no, p.phase, p.observed_at, p.note from telm_attach_phase p join loads l on l.id = p.load_id`)));
  console.log('bad_left', JSON.stringify(await q(`select count(*) n from loads l join load_events e on e.load_id = l.id and e.dedup_key = 'TELM_PHASE_EXIT_LOAD:' || l.id::text where l.actual_load_at = e.occurred_at`)));
  console.log('mig', JSON.stringify(await q(`select version from supabase_migrations.schema_migrations where version in ('0187','0188') order by 1`)));
}

async function has(c, v) {
  return (await c.query(`select 1 from supabase_migrations.schema_migrations where version = $1`, [v])).rowCount > 0;
}

async function applyTx(c, commit) {
  await c.query('begin');
  try {
    if (!(await has(c, '0187'))) {
      if (commit) throw new Error('0187 nie jest nałożona — najpierw m0187-migrate apply-prod');
      await c.query(SQL87);
      console.log('(dry-run: 0187 w tej samej transakcji)');
    }
    const res = await c.query(SQL);
    const last = Array.isArray(res) ? res[res.length - 1] : res;
    console.log('fixed', JSON.stringify(last?.rows ?? []));
    await verify(c);
    if (commit) {
      await c.query(
        `insert into supabase_migrations.schema_migrations (version, name, statements)
         values ('0188', 'telm_faza_bez_zaladunku', array[$1::text]) on conflict (version) do nothing`,
        [SQL.slice(0, 200)],
      );
    }
    await c.query(commit ? 'commit' : 'rollback');
    console.log(commit ? 'COMMIT OK 0188' : 'dry-run: ROLLBACK OK');
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
