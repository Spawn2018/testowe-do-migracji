/**
 * I-31 — załadunek parametrów SEFS (tabele mnożników) z CENNIK_STEGRA.json do bazy.
 * Nie wypisuje progów ani kwot. Domyślnie TEST_DB_URL; PROD: TOWER_CENNIK_PROD=1.
 *
 * Użycie: node scripts/i31-load-sefs.mjs [--dry-run]
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
    /* brak */
  }
  return map;
}

function refuse(url, allowProd) {
  if (!url) {
    console.error('BRAK URL');
    process.exit(1);
  }
  if (url.includes(PROD_REF) && !allowProd) {
    console.error('ODMOWA produkcji');
    process.exit(2);
  }
  if (!allowProd && !url.includes(TEST_REF)) {
    console.error('ODMOWA: oczekiwano TEST');
    process.exit(2);
  }
}

async function main() {
  const env = loadEnv();
  const allowProd = process.env.TOWER_CENNIK_PROD === '1';
  const url = allowProd
    ? env.SUPABASE_DB_POOLER_URL || env.SUPABASE_DB_URL || env.DATABASE_URL
    : env.TEST_DB_URL;
  refuse(url, allowProd);

  const json = JSON.parse(readFileSync(resolve(DANE, 'CENNIK_STEGRA.json'), 'utf8'));
  const sefs = json.sefs;
  const tiersSek = (sefs.tabela_sek || []).map((r) => ({ lte: r.do_sek_l, mult: r.mnoznik }));
  const tiersPln = (sefs.tabela_pln || []).map((r) => ({ lte: r.do_pln_l, mult: r.mnoznik }));
  if (tiersSek.length !== 51 || tiersPln.length !== 51) {
    console.error('STOP: oczekiwano 51+51 progów');
    process.exit(1);
  }

  const payload = {
    valid_from: '2026-09-28',
    base_sek: Number(sefs.cena_bazowa_sek_l),
    base_pln: Number(sefs.cena_bazowa_pln_l),
    index_sek: 'OKQ8_GOEASY_DIESEL',
    index_pln: 'ORLEN_EKODIESEL',
    source_url_sek: sefs.zrodla?.SEK?.url || 'https://www.okq8.se/foretag/priser/',
    source_url_pln: sefs.zrodla?.PLN?.url || 'https://www.orlen.pl/pl/dla-biznesu/hurtowe-ceny-paliw',
    cycle: 'WEEKLY',
    tiers_sek: tiersSek,
    tiers_pln: tiersPln,
    agreed_with_carrier: false,
    note: 'I-31 import z CENNIK_STEGRA.json — III-10 WOB wyłączone (niezgodne z umową)',
  };

  console.log(
    JSON.stringify({
      target: allowProd ? 'PROD' : 'TEST',
      dry,
      tiers_sek: tiersSek.length,
      tiers_pln: tiersPln.length,
      cycle: 'WEEKLY',
    }),
  );
  if (dry) {
    console.log('OK dry-run');
    return;
  }

  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query('begin');
    const proj = await client.query(
      `select id from projects where code in ('STEGRA_BODEN','STEGRA') order by case code when 'STEGRA_BODEN' then 0 else 1 end limit 1`,
    );
    if (!proj.rows[0]) throw new Error('brak projektu');
    // jak cennik: ustaw JWT HHL
    const hhl = await client.query(
      `select auth_id from app_users where role in ('HHL_ADMIN','HHL_OPS') and active order by role limit 1`,
    );
    if (!hhl.rows[0]) throw new Error('brak HHL');
    await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [hhl.rows[0].auth_id]);
    const v = await client.query(`select sefs_save_parameters($1::uuid, $2::jsonb) as v`, [
      proj.rows[0].id,
      JSON.stringify(payload),
    ]);
    await client.query('commit');
    console.log('OK sefs version', v.rows[0].v);
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
