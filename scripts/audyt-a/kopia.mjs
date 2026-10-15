/**
 * Audyt A (D-20261015-0300-01) — kopia wierszy przed migracjami danych A1/A6.
 * Zapis: D:\Watch Tower\dane\audyt-A\kopia-audyt-a-<data>.json (+ .sha256).
 * Domyślnie TEST. Produkcja: TOWER_AUDYT_A_PROD=1 + DATABASE_URL.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { loadEnvLocal, PROD_REF, TEST_REF } from '../auth/env.mjs';

const DANE = process.env.TOWER_DANE || 'D:/Watch Tower/dane';
const allowProd = process.env.TOWER_AUDYT_A_PROD === '1';
const env = loadEnvLocal();

function pickUrl() {
  if (allowProd) {
    return (
      env.DATABASE_URL ||
      env.SUPABASE_DB_POOLER_URL ||
      env.SUPABASE_DB_URL ||
      env.PROD_DB_URL ||
      ''
    );
  }
  return env.TEST_DB_URL || '';
}

const url = pickUrl();
if (!url) {
  console.error(allowProd ? 'BRAK DATABASE_URL' : 'BRAK TEST_DB_URL');
  process.exit(1);
}
if (url.includes(PROD_REF) && !allowProd) {
  console.error(`ODMOWA: produkcja — ustaw TOWER_AUDYT_A_PROD=1`);
  process.exit(2);
}

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes('localhost') ? undefined : { rejectUnauthorized: false },
});

await client.connect();
try {
  const dump = {
    created_at: new Date().toISOString(),
    ref: allowProd ? 'prod' : 'test',
    tables: {},
  };
  async function put(name, sql) {
    const { rows } = await client.query(sql);
    dump.tables[name] = { count: rows.length, rows };
    console.log(`  ${name}: ${rows.length}`);
  }
  console.log('Audyt-A kopia:');
  await put(
    'fuel_pln_oct',
    `select id, index_code, period, reading_date, published_on, value, source_url, source_note, corrects_id
       from fuel_index_readings
      where index_code='PLN' and coalesce(published_on, reading_date) between '2026-10-01' and '2026-10-18'
      order by coalesce(published_on, reading_date), id`,
  );
  await put(
    'loads_t42_fuel',
    `select l.id, si.shipment_code, l.plan_load_date, l.status,
            lc.fuel_applied_mult as cost_mult, lc.fuel_status as cost_status, lc.fuel_basis as cost_basis,
            lr.fuel_applied_mult as rev_mult, lr.fuel_status as rev_status
       from loads l
       join shipment_items si on si.load_id=l.id
       left join load_cost lc on lc.load_id=l.id
       left join load_revenue lr on lr.load_id=l.id
      where public.fuel_load_date(l.id) between '2026-10-12' and '2026-10-18'
      order by si.shipment_code`,
  );
  await put(
    'sg03_load',
    `select l.*, si.shipment_code
       from loads l join shipment_items si on si.load_id=l.id
      where si.shipment_code='SG-03'`,
  );
  await put(
    'sg03_events_status',
    `select e.* from load_events e
      join shipment_items si on si.load_id=e.load_id
     where si.shipment_code='SG-03'
       and (e.event_type like 'STATUS_%' or e.event_type like 'GEOFENCE_%' or e.id=301)
     order by e.occurred_at`,
  );
  await put(
    'sg03_positions_after',
    `select p.id, p.load_id, p.ts,
            st_y(p.geom_raw::geometry) as lat, st_x(p.geom_raw::geometry) as lon
       from positions p join shipment_items si on si.load_id=p.load_id
      where si.shipment_code='SG-03' and p.ts > timestamptz '2026-10-07 10:19:54+00'`,
  );

  const dir = resolve(DANE, 'audyt-A');
  mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = resolve(dir, `kopia-audyt-a-${stamp}.json`);
  const body = JSON.stringify(dump, null, 2);
  writeFileSync(file, body);
  const hash = createHash('sha256').update(body).digest('hex');
  writeFileSync(`${file}.sha256`, `${hash}  ${file}\n`);
  console.log(`OK ${file}`);
  console.log(`SHA256 ${hash}`);
} finally {
  await client.end();
}
