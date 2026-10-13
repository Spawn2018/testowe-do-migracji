#!/usr/bin/env node
/**
 * D-20261012-2210-01 R3 — parytet schema_migrations na produkcji.
 * Wzór: scripts/m0159-registry.mjs. Bez wykonywania SQL migracji.
 *   node scripts/mig-registry-parity.mjs dry-run-prod | apply-prod | verify-prod
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const ROOT = resolve(import.meta.dirname, '..');
const PROD = 'nglnnrmzmhusvxslousq';

/** 10 wierszy ze znacznikiem czasu (dopisek, tabela 12.10). */
const EXPECTED_TS = [
  { version: '20261004180552', name: 'email_status_from_resend', file: '0150' },
  { version: '20261004180725', name: 'l6_backup_retry', file: '0151' },
  { version: '20261004192928', name: 'l12_geofence_creator', file: '0152' },
  { version: '20261005003650', name: 'ferry_status', file: '0160' },
  { version: '20261005011518', name: 'pl_data', file: '0161' },
  { version: '20261005103503', name: 'h2pl_here_traffic', file: '0171' },
  { version: '20261005105010', name: 'd78_here_pools_confirmed', file: '0172' },
  { version: '20261005105317', name: 'telm_emtrack_web', file: '0173' },
  { version: '20261006145638', name: '0191_aud01d_here_tiles_report', file: '0191' },
  { version: '20261006222552', name: '0192_aud03_ksh_panel_dates', file: '0192' },
];

const INSERTS = [
  { version: '0171', name: 'h2pl_here_traffic', stamp: '20261005103503' },
  { version: '0172', name: 'd78_here_pools_confirmed', stamp: '20261005105010' },
  { version: '0173', name: 'telm_emtrack_web', stamp: '20261005105317' },
  { version: '0191', name: 'aud01d_here_tiles_report', stamp: '20261006145638' },
  { version: '0192', name: 'aud03_ksh_panel_dates', stamp: '20261006222552' },
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

function localFiles() {
  return readdirSync(resolve(ROOT, 'supabase/migrations'))
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .map((f) => ({
      version: f.slice(0, 4),
      file: f,
      bare: f.replace(/^\d{4}_/, '').replace(/\.sql$/, ''),
      stem: f.replace(/\.sql$/, ''),
    }));
}

function prodUrl() {
  const u = env.get('SUPABASE_DB_POOLER_URL') || env.get('SUPABASE_DB_URL') || '';
  if (!u.includes(PROD)) throw new Error('ODMOWA: adres bez ref produkcji');
  return u;
}

async function withUrl(url, fn) {
  const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

async function rowsOf(c) {
  const r = await c.query(
    `select version, name from supabase_migrations.schema_migrations order by version`,
  );
  return r.rows;
}

function stop(msg) {
  const e = new Error(msg);
  e.stop = true;
  throw e;
}

async function assertFinal(c) {
  const rows = await rowsOf(c);
  const ts = rows.filter((r) => !/^\d{4}$/.test(r.version));
  if (ts.length) stop(`zostały znaczniki czasu: ${ts.map((r) => r.version).join(',')}`);
  const files = localFiles();
  const fileVers = new Set(files.map((f) => f.version));
  for (const r of rows) {
    if (!fileVers.has(r.version)) stop(`wersja bez pliku: ${r.version}`);
  }
  const have = new Set(rows.map((r) => r.version));
  const missing = files.map((f) => f.version).filter((v) => !have.has(v));
  const ok = missing.length === 0 || (missing.length === 1 && missing[0] === '0193');
  if (!ok) stop(`brak na produkcji poza 0193: ${missing.join(',')}`);
  console.log('kontrola: znaczniki=0, brak_pliku=0, missing_on_prod=', missing.join(',') || '—');
}

async function applyTx(c, commit) {
  await c.query('begin');
  try {
    const files = localFiles();
    const rows = await rowsOf(c);
    const ts = rows.filter((r) => !/^\d{4}$/.test(r.version));
    if (ts.length !== 10) stop(`znaczniki czasu: ${ts.length}, oczekiwano 10`);

    for (const exp of EXPECTED_TS) {
      const row = ts.find((r) => r.version === exp.version);
      if (!row || row.name !== exp.name) {
        stop(`brak wiersza ${exp.version} ${exp.name}`);
      }
      const matches = files.filter((f) => f.bare === row.name || f.stem === row.name);
      if (matches.length !== 1 || matches[0].version !== exp.file) {
        stop(`${exp.version} nie pasuje do jednego pliku ${exp.file}`);
      }
      console.log(`${row.version}\t${row.name}`);
    }
    const extra = ts.filter((r) => !EXPECTED_TS.some((e) => e.version === r.version));
    if (extra.length) stop(`obce znaczniki: ${extra.map((r) => r.version).join(',')}`);

    let inserted = 0;
    for (const ins of INSERTS) {
      const r = await c.query(
        `insert into supabase_migrations.schema_migrations (version, name, statements)
         values ($1, $2, array[$3]::text[])
         on conflict (version) do nothing
         returning version`,
        [ins.version, ins.name, `registry-only: already applied (${ins.stamp})`],
      );
      inserted += r.rowCount;
    }
    if (inserted !== 5) stop(`dopisano ${inserted}, oczekiwano 5`);
    console.log('dopisane: 0171,0172,0173,0191,0192');

    const del = await c.query(
      `delete from supabase_migrations.schema_migrations where version = any($1::text[])`,
      [EXPECTED_TS.map((e) => e.version)],
    );
    if (del.rowCount !== 10) stop(`usunięto ${del.rowCount}, oczekiwano 10`);
    console.log('usunięte znaczniki: 10');

    await assertFinal(c);
    await c.query(commit ? 'commit' : 'rollback');
    console.log(commit ? 'apply-prod: COMMIT OK' : 'dry-run-prod: ROLLBACK OK');
  } catch (e) {
    await c.query('rollback').catch(() => {});
    throw e;
  }
}

try {
  if (mode === 'dry-run-prod') await withUrl(prodUrl(), (c) => applyTx(c, false));
  else if (mode === 'apply-prod') await withUrl(prodUrl(), (c) => applyTx(c, true));
  else if (mode === 'verify-prod') await withUrl(prodUrl(), assertFinal);
  else {
    console.error('użycie: dry-run-prod | apply-prod | verify-prod');
    process.exit(2);
  }
} catch (e) {
  console.error(e.stop ? `STOP: ${e.message}` : e.message);
  process.exit(e.stop ? 3 : 1);
}
