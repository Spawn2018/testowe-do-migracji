/**
 * Buduje TEST_DB_URL (Session pooler) + TEST_SERVICE_ROLE_KEY z Management API.
 * Nie wypisuje haseł ani kluczy.
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
  password = existingUrl;
  env.set('TEST_DB_PASSWORD', password);
}

if (!password) {
  console.error('BRAK: TEST_DB_PASSWORD w .env.local');
  process.exit(1);
}

const token = env.get('SUPABASE_ACCESS_TOKEN');
if (!token) {
  console.error('BRAK: SUPABASE_ACCESS_TOKEN');
  process.exit(1);
}

const poolerRes = await fetch(`https://api.supabase.com/v1/projects/${TEST_REF}/config/database/pooler`, {
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
});
if (!poolerRes.ok) {
  console.error('Management API pooler:', poolerRes.status);
  process.exit(1);
}
const pooler = pickPoolerEntry(await poolerRes.json());
const user = pooler?.db_user || `postgres.${TEST_REF}`;
const host = pooler?.db_host;
if (!host || !user) {
  console.error('Pooler: brak db_host/db_user');
  process.exit(1);
}

const sessionPort = 5432;
const url = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${sessionPort}/postgres`;
if (url.includes(PROD_REF) || !url.includes(TEST_REF)) {
  console.error('ODMOWA: zły URL poolera');
  process.exit(2);
}
env.set('TEST_DB_URL', url);

const keysRes = await fetch(`https://api.supabase.com/v1/projects/${TEST_REF}/api-keys`, {
  headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
});
if (!keysRes.ok) {
  console.error('Management API api-keys:', keysRes.status);
  process.exit(1);
}
const keys = await keysRes.json();
let service = null;
let anon = null;
for (const k of Array.isArray(keys) ? keys : []) {
  const name = String(k.name || '').toLowerCase();
  const val = k.api_key || k.key || '';
  if (name === 'service_role' && val) service = String(val);
  if (name === 'anon' && val) anon = String(val);
}
if (!service) {
  console.error('BRAK service_role w api-keys projektu testowego');
  process.exit(1);
}
if (env.get('SUPABASE_SERVICE_ROLE_KEY') && service === env.get('SUPABASE_SERVICE_ROLE_KEY')) {
  console.error('STOP: TEST_SERVICE_ROLE_KEY wygląda na klucz produkcji');
  process.exit(2);
}
env.set('TEST_SERVICE_ROLE_KEY', service);
env.set('TEST_SUPABASE_URL', `https://${TEST_REF}.supabase.co`);
if (anon) env.set('TEST_ANON_KEY', anon);

writeFileSync(ENV_PATH, serializeEnv(raw, env), 'utf8');

console.log('OK: TEST_DB_URL zapisany (Session pooler)');
console.log(`host=${host} port=${sessionPort} user=${user}`);
console.log(`OK: TEST_SERVICE_ROLE_KEY zapisany (len=${service.length})`);
console.log(`OK: TEST_SUPABASE_URL=https://${TEST_REF}.supabase.co`);
console.log('contains_test_ref=true contains_prod_ref=false');
