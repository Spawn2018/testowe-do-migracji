/**
 * Jednorazowy backfill odczytów SEK/PLN za 28.09–04.10 (i dziś) przez RPC fuel_se_pl_ingest.
 * Bez sekretów w logu. node scripts/fuel-backfill-week.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

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

const env = parseEnv(readFileSync(resolve(import.meta.dirname, '../.env.local'), 'utf8'));
const UA = 'Watch Tower/1.0 (+https://tower.log-mar.pl; fuel-index)';

async function fetchJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error(`${url} ${r.status}`);
  return r.json();
}

// OKQ8 history from excel via python subprocess is heavy — use known sheet values from live confirm + page for today
const sekHist = {
  '2026-09-28': 22.71, '2026-09-29': 22.71, '2026-09-30': 22.71,
  '2026-10-01': 23.11, '2026-10-02': 23.11, '2026-10-03': 23.11, '2026-10-04': 23.11,
};

const orlen = await fetchJson('https://tool.orlen.pl/api/wholesalefuelprices/ByProduct?productId=43&from=2026-09-28&to=2026-10-05');
const plnByDay = {};
for (const row of orlen) {
  if (row.productName !== 'ONEkodiesel') continue;
  const d = String(row.effectiveDate).slice(0, 10);
  plnByDay[d] = Math.round((row.value / 1000) * 10000) / 10000;
}
// forward-fill Orlen for days without publish within week
let last = null;
for (const d of ['2026-09-28','2026-09-29','2026-09-30','2026-10-01','2026-10-02','2026-10-03','2026-10-04']) {
  if (plnByDay[d] != null) last = plnByDay[d];
  else if (last != null) plnByDay[d] = last;
}

const rows = [];
for (const [period, value] of Object.entries(sekHist)) {
  rows.push({
    index_code: 'SEK', period, reading_date: period, value,
    source_url: 'https://www.okq8.se/foretag/priser/',
    source_note: `backfill Q8Trucks Diesel z prishistorik (wartość wprost) ${period}`,
  });
}
for (const [period, value] of Object.entries(plnByDay)) {
  if (period > '2026-10-04') continue;
  rows.push({
    index_code: 'PLN', period, reading_date: period, value,
    source_url: 'https://www.orlen.pl/pl/dla-biznesu/hurtowe-ceny-paliw',
    source_note: `backfill Orlen ONEkodiesel PLN/l ${period}`,
  });
}

const c = new pg.Client({ connectionString: env.get('SUPABASE_DB_POOLER_URL'), ssl: { rejectUnauthorized: false } });
await c.connect();
const proj = (await c.query(`select id from projects where code='STEGRA_BODEN'`)).rows[0].id;
const { rows: [ing] } = await c.query(`select fuel_se_pl_ingest($1::uuid, $2::jsonb) as r`, [proj, JSON.stringify(rows)]);
console.log('ingest', ing.r);
const { rows: [calc] } = await c.query(
  `select sefs_week_calc($1::uuid, '2026-10-06'::date) as r`,
  [proj],
);
console.log('sefs_week_calc load 2026-10-06 (prev=28.09-04.10)', JSON.stringify(calc.r));
await c.end();
