/**
 * Buduje TEST_DB_URL (Session pooler) z Management API + TEST_DB_PASSWORD.
 * Nie wypisuje haseł. Naprawia też przypadek, gdy hasło trafiło omyłkowo do TEST_DB_URL.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const ENV_PATH = resolve(ROOT, '.env.local');
const PROD_REF = 'nglnnrmzmhusvxslousq';
const TEST_REF = 'emkbykwenwrjmbprydml';

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

function serializeEnv(original, map) {
  const keys = new Set(map.keys());
  const out = [];
  for (const line of original.split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) {
      out.push(line);
      continue;
    }
    const i = line.indexOf('=');
    if (i < 0) {
      out.push(line);
      continue;
    }
    const k = line.slice(0, i).trim();
    if (!map.has(k)) {
      out.push(line);
      continue;
    }
    out.push(`${k}=${map.get(k)}`);
    keys.delete(k);
  }
  for (const k of keys) out.push(`${k}=${map.get(k)}`);
  return out.join('\n').replace(/\n+$/, '\n');
}

function looksLikeDbUrl(v) {
  return /^postgres(ql)?:\/\//i.test(v || '');
}

/** Management API bywa obiektem albo tablicą wpisów poolera. */
function pickPoolerEntry(raw) {
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  if (list.length === 0) return null;
  const session = list.find((e) => String(e.pool_mode || '').toLowerCase() === 'session');
  return session || list[0];
}

const raw = readFileSync(ENV_PATH, 'utf8');
const env = parseEnv(raw);

let password = env.get('TEST_DB_PASSWORD') || '';
const existingUrl = env.get('TEST_DB_URL') || '';

if (!password && existingUrl && !looksLikeDbUrl(existingUrl)) {
  // Hasło omyłkowo w TEST_DB_URL
  password = existingUrl;
  env.set('TEST_DB_PASSWORD', password);
}

if (!password) {
  console.error('BRAK: TEST_DB_PASSWORD w .env.local (oraz TEST_DB_URL nie wygląda na hasło do odzyskania).');
  process.exit(1);
}

const token = env.get('SUPABASE_ACCESS_TOKEN');
if (!token) {
  console.error('BRAK: SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

const res = await fetch(`https://api.supabase.com/v1/projects/${TEST_REF}/config/database/pooler`, {
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
});
if (!res.ok) {
  console.error('Management API pooler:', res.status);
  process.exit(1);
}
const poolerRaw = await res.json();
const pooler = pickPoolerEntry(poolerRaw);
const user = pooler?.db_user || `postgres.${TEST_REF}`;
const host = pooler?.db_host;
if (!host || !user) {
  console.error('Pooler: brak db_host/db_user (kształt odpowiedzi API?)');
  process.exit(1);
}

// Session mode = port 5432 (Transaction = 6543 z API — nie używamy do migracji/testów)
const sessionPort = 5432;
const encUser = encodeURIComponent(user);
const encPass = encodeURIComponent(password);
const url = `postgresql://${encUser}:${encPass}@${host}:${sessionPort}/postgres`;

if (url.includes(PROD_REF)) {
  console.error('ODMOWA: wygenerowany URL zawiera ref produkcji');
  process.exit(2);
}
if (!url.includes(TEST_REF)) {
  console.error('ODMOWA: URL nie zawiera ref projektu testowego');
  process.exit(2);
}

env.set('TEST_DB_URL', url);
writeFileSync(ENV_PATH, serializeEnv(raw, env), 'utf8');

console.log('OK: TEST_DB_URL zapisany (Session pooler)');
console.log(`host=${host} port=${sessionPort} user=${user} pool_mode_api=${pooler.pool_mode || '?'}`);
console.log(`contains_test_ref=${url.includes(TEST_REF)} contains_prod_ref=${url.includes(PROD_REF)}`);
