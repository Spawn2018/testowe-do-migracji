/** Wypisuje `export TEST_DB_URL=…` bezpiecznie (JSON). Odmowa produkcji. */
import { readFileSync } from 'node:fs';

const PROD = 'nglnnrmzmhusvxslousq';
const TEST = 'emkbykwenwrjmbprydml';
const t = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const m = {};
for (const line of t.split(/\r?\n/)) {
  if (!line || line.startsWith('#')) continue;
  const i = line.indexOf('=');
  if (i < 0) continue;
  let v = line.slice(i + 1);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
  m[line.slice(0, i).trim()] = v;
}
const u0 = m.TEST_DB_URL || '';
if (!u0 || u0.includes(PROD)) {
  console.error('ODMOWA: produkcja lub brak TEST_DB_URL');
  process.exit(2);
}
if (!u0.includes(TEST)) {
  console.error('ODMOWA: brak ref projektu testowego');
  process.exit(2);
}
const u = /[?&]client_encoding=/i.test(u0)
  ? u0
  : u0 + (u0.includes('?') ? '&' : '?') + 'client_encoding=UTF8';
console.log('export TEST_DB_URL=' + JSON.stringify(u));
