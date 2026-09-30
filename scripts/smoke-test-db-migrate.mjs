import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { resetPublic, applyMigrationsAndSeed, refuseProdUrl } from './lib/test-db-migrate.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const text = readFileSync(resolve(ROOT, '.env.local'), 'utf8');
const env = {};
for (const line of text.split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue;
  const i = line.indexOf('=');
  if (i < 0) continue;
  let v = line.slice(i + 1);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  env[line.slice(0, i).trim()] = v;
}
const url = env.TEST_DB_URL;
refuseProdUrl(url);
if (!url.includes('emkbykwenwrjmbprydml')) {
  console.error('ODMOWA: brak ref testowego');
  process.exit(2);
}
const psql = process.env.TOWER_REAL_PSQL || 'D:/OMNIROUTE/tools/pg16/pgsql/bin/psql.exe';
await resetPublic(url);
await applyMigrationsAndSeed(ROOT, url, psql);
console.log('OK');
