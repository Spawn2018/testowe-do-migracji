/**
 * MIG-0159-REG — dopisz brakujące numerowane wersje do schema_migrations
 * BEZ ponownego wykonania SQL. Timestampowe wpisy (0150–0152, 0160–0161) zostają.
 *   node scripts/m0159-registry.mjs dry-run-prod | apply-prod | verify-prod | apply-test
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const ROOT = resolve(import.meta.dirname, '..');
const PROD = 'nglnnrmzmhusvxslousq';
const TEST = 'emkbykwenwrjmbprydml';

/** Brakujące numerowane wersje wobec repo (SQL już nałożony wcześniej). */
const MISSING = [
  { version: '0150', name: 'email_status_from_resend' },
  { version: '0151', name: 'l6_backup_retry' },
  { version: '0152', name: 'l12_geofence_creator' },
  { version: '0159', name: 'ais_src' },
  { version: '0160', name: 'ferry_status' },
  { version: '0161', name: 'pl_data' },
];

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
  const { rows } = await c.query(
    `select version, name from supabase_migrations.schema_migrations
      where version = any($1::text[]) order by version`,
    [MISSING.map((m) => m.version)],
  );
  console.log('present', rows);
  const have = new Set(rows.map((r) => r.version));
  const miss = MISSING.filter((m) => !have.has(m.version)).map((m) => m.version);
  console.log('still_missing', miss);
  // sanity: 0159 objects
  const src = await c.query(
    `select exists (
       select 1 from information_schema.columns
        where table_schema='public' and table_name='vessel_positions' and column_name='eta_at'
     ) as eta_col,
     exists (
       select 1 from pg_constraint
        where conname='vessel_positions_source_check'
     ) as source_chk`,
  );
  console.log('ais_src_objects', src.rows[0]);
}

async function applyTx(c, commit) {
  await c.query('begin');
  try {
    for (const m of MISSING) {
      const r = await c.query(
        `insert into supabase_migrations.schema_migrations (version, name, statements)
         values ($1, $2, array['registry-only: already applied']::text[])
         on conflict (version) do nothing
         returning version`,
        [m.version, m.name],
      );
      console.log(m.version, r.rowCount ? 'inserted' : 'exists');
    }
    await verify(c);
    await c.query(commit ? 'commit' : 'rollback');
    console.log(commit ? 'COMMIT OK registry' : 'dry-run: ROLLBACK OK');
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
