#!/usr/bin/env node
/**
 * SEC-OWASP C: password_min_length = 12 na hostowanym Auth (Management API).
 * Nie wymusza zmiany hasła u istniejących kont. NIE wysyła maili.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const PROD = 'nglnnrmzmhusvxslousq';
function loadEnv() {
  const map = {};
  for (const line of readFileSync(resolve(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    let v = line.slice(i + 1);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    map[line.slice(0, i).trim()] = v;
  }
  return map;
}
const env = loadEnv();
const token = env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  console.error('Brak SUPABASE_ACCESS_TOKEN');
  process.exit(2);
}
const url = `https://api.supabase.com/v1/projects/${PROD}/config/auth`;
const patch = await fetch(url, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ password_min_length: 12 }),
});
if (!patch.ok) {
  console.error('FAIL PATCH', patch.status, (await patch.text()).slice(0, 300));
  process.exit(1);
}
const get = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
const cfg = await get.json();
const n = cfg.password_min_length;
console.log(n === 12 ? 'OK' : 'MISS', 'password_min_length=', n);
process.exit(n === 12 ? 0 : 1);
