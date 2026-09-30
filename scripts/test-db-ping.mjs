/** Smoke: SELECT version() na TEST_DB_URL. Bez wypisywania haseł. */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const PROD = 'nglnnrmzmhusvxslousq';
const TEST = 'emkbykwenwrjmbprydml';

function loadEnv() {
  const text = readFileSync(resolve(import.meta.dirname, '../.env.local'), 'utf8');
  const map = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    let v = line.slice(i + 1);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    map[line.slice(0, i).trim()] = v;
  }
  return map;
}

const env = loadEnv();
const url = env.TEST_DB_URL || '';
if (!url.startsWith('postgres')) {
  console.error('TEST_DB_URL nie jest adresem postgres');
  process.exit(1);
}
if (url.includes(PROD)) {
  console.error('ODMOWA: TEST_DB_URL wskazuje produkcję');
  process.exit(2);
}
if (!url.includes(TEST)) {
  console.error('ODMOWA: TEST_DB_URL bez ref projektu testowego');
  process.exit(2);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
const r = await client.query('select version() as v');
console.log('CONNECT_OK');
console.log('VERSION=' + String(r.rows[0].v).split(',')[0]);
await client.end();
