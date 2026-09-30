/**
 * I-30 — załadunek cennika SYMBOL z D:\Watch Tower\dane do bazy.
 * Czyta CENNIK_STEGRA.json (poza repo). NIGDY nie wypisuje kwot.
 * Domyślnie tylko TEST_DB_URL (odmowa produkcji). Produkcja: TOWER_CENNIK_PROD=1 + DATABASE_URL.
 *
 * Użycie:
 *   node scripts/i30-load-cennik.mjs
 *   node scripts/i30-load-cennik.mjs --dry-run
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const ROOT = resolve(import.meta.dirname, '..');
const DANE = process.env.TOWER_DANE || 'D:/Watch Tower/dane';
const PROD_REF = 'nglnnrmzmhusvxslousq';
const TEST_REF = 'emkbykwenwrjmbprydml';
const dry = process.argv.includes('--dry-run');

function loadEnv() {
  const map = {};
  try {
    const text = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
    for (const line of text.split(/\r?\n/)) {
      if (!line || /^\s*#/.test(line)) continue;
      const i = line.indexOf('=');
      if (i < 0) continue;
      let v = line.slice(i + 1);
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      map[line.slice(0, i).trim()] = v;
    }
  } catch {
    /* brak .env.local */
  }
  return map;
}

function refuseProd(url, allowProd) {
  if (!url) {
    console.error('BRAK URL bazy');
    process.exit(1);
  }
  if (url.includes(PROD_REF) && !allowProd) {
    console.error('ODMOWA: adres produkcji — ustaw TOWER_CENNIK_PROD=1 tylko po decyzji właściciela');
    process.exit(2);
  }
  if (!allowProd && !url.includes(TEST_REF)) {
    console.error('ODMOWA: oczekiwano TEST_DB_URL (ref testowy)');
    process.exit(2);
  }
}

function buildPayload(pozycje, side) {
  const rules = pozycje.map((p) => {
    const family = String(p.rodzina || '').toUpperCase();
    const symbol = String(p.symbol || '').toUpperCase();
    const rate = side === 'COST' ? Number(p.koszt_scx_eur) : Number(p.przychod_ksh_eur);
    if (!Number.isFinite(rate) || rate < 0) throw new Error(`brak stawki ${side} dla ${symbol}`);
    const row = {
      cargo_class: 'SYMBOL',
      symbol,
      family,
      length_to: Number(p.max_dlugosc_m),
      width_to: Number(p.max_szerokosc_m),
      height_to: Number(p.max_wysokosc_m),
      weight_to: Number(p.max_masa_t),
      base_rate: rate,
      note: p.uwagi ? String(p.uwagi).slice(0, 200) : null,
    };
    if (family === 'KR') {
      const c = Number(p.auta_w_konwoju);
      if (![1, 2, 3].includes(c)) throw new Error(`KR bez convoy: ${symbol}`);
      row.convoy_cars = c;
    }
    return row;
  });
  return {
    valid_from: '2026-09-28',
    note: dry ? 'dry-run' : 'I-30 import z CENNIK_STEGRA.json (skrypt lokalny)',
    rules,
  };
}

async function main() {
  const env = loadEnv();
  const allowProd = process.env.TOWER_CENNIK_PROD === '1';
  const url = allowProd
    ? env.SUPABASE_DB_POOLER_URL || env.SUPABASE_DB_URL || env.DATABASE_URL || process.env.DATABASE_URL
    : env.TEST_DB_URL || process.env.TEST_DB_URL;
  refuseProd(url, allowProd);

  const json = JSON.parse(readFileSync(resolve(DANE, 'CENNIK_STEGRA.json'), 'utf8'));
  const pozycje = json.pozycje_cennika;
  if (!Array.isArray(pozycje) || pozycje.length !== 12) {
    console.error('STOP: oczekiwano 12 pozycji w pozycje_cennika');
    process.exit(1);
  }

  const cost = buildPayload(pozycje, 'COST');
  const rev = buildPayload(pozycje, 'REVENUE');
  console.log(
    JSON.stringify({
      target: allowProd ? 'PROD' : 'TEST',
      dry,
      pozycje: pozycje.length,
      cost_rules: cost.rules.length,
      revenue_rules: rev.rules.length,
      symbols: pozycje.map((p) => p.symbol),
    }),
  );
  if (dry) {
    console.log('OK dry-run — bez zapisu');
    return;
  }

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query('begin');
    await client.query(`select set_config('tower.cennik_import', 'on', true)`);
    const proj = await client.query(
      `select id from projects where code in ('STEGRA_BODEN','STEGRA') order by case code when 'STEGRA_BODEN' then 0 else 1 end limit 1`,
    );
    const car = await client.query(`select id from organizations where kind = 'CARRIER' order by code limit 1`);
    const cli = await client.query(`select id from organizations where kind = 'CLIENT' order by code limit 1`);
    if (!proj.rows[0] || !car.rows[0] || !cli.rows[0]) {
      throw new Error('brak projektu/organizacji w bazie (seed?)');
    }
    const vCost = await client.query(`select rate_card_import_symbol($1::uuid, 'COST', $2::uuid, $3::jsonb) as v`, [
      proj.rows[0].id,
      car.rows[0].id,
      JSON.stringify(cost),
    ]);
    const vRev = await client.query(`select rate_card_import_symbol($1::uuid, 'REVENUE', $2::uuid, $3::jsonb) as v`, [
      proj.rows[0].id,
      cli.rows[0].id,
      JSON.stringify(rev),
    ]);
    const cnt = await client.query(
      `select c.side, count(r.*) n
         from rate_cards c join rate_rules r on r.rate_card_id = c.id
        where c.project_id = $1 and c.version in ($2::int, $3::int) and r.cargo_class = 'SYMBOL'
        group by c.side order by c.side`,
      [proj.rows[0].id, vCost.rows[0].v, vRev.rows[0].v],
    );
    await client.query('commit');
    console.log(
      'OK import',
      JSON.stringify({
        cost_version: vCost.rows[0].v,
        revenue_version: vRev.rows[0].v,
        counts: cnt.rows,
      }),
    );
  } catch (e) {
    try {
      await client.query('rollback');
    } catch {
      /* ignore */
    }
    console.error('FAIL', e instanceof Error ? e.message : e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
