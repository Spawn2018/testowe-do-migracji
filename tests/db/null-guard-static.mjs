#!/usr/bin/env node
// TOWER — I-2A (0049): test statyczny strażników NULL.
// Zasada: NULL zawsze oznacza odmowę. Strażnik w postaci „if not <warunek>” przy NULL NIE rzuca wyjątku,
// więc jest zakazany — dozwolone: „if (<warunek>) is not true then raise”, „if not exists …”, „if not found …”,
// „if not coalesce(…)”. Zakazana też negacja helperów logicznych (not is_hhl() / not can_see_margin() / …) w dowolnym miejscu.
// Źródła:  (domyślnie) ostatnia definicja każdej funkcji w supabase/migrations/*.sql
//          --db <url>  definicje z żywej bazy (pg_get_functiondef, schemat public, bez funkcji rozszerzeń)
import { readFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const IGNORE = new Map([
  // funkcja platformy Supabase (event trigger „auto enable RLS”), nie z migracji repo
  ['rls_auto_enable', 'platforma Supabase'],
]);
const R_IFNOT = /\b(if|elsif|while|when)\s+not\b(?!\s+(exists|found|coalesce)\b)/i;
const R_NEGHELPER = /\bnot\s*\(?\s*(public\.)?(is_hhl|can_see_margin|role_matches_org|storage_upload_allowed|loaded_confirmed)\s*\(/i;

export function scanBody(name, body) {
  const bad = [];
  body.split('\n').forEach((raw, i) => {
    const line = raw.replace(/--.*$/, '');
    if (R_IFNOT.test(line) || R_NEGHELPER.test(line)) bad.push(`${name}:${i + 1}: ${raw.trim().slice(0, 160)}`);
  });
  return bad;
}

export function lastDefinitions(dir = 'supabase/migrations') {
  const defs = new Map();
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    const src = readFileSync(`${dir}/${f}`, 'utf8');
    const re = /create\s+(or\s+replace\s+)?function\s+(public\.)?([a-z_0-9]+)\s*\(/gi;
    let m;
    while ((m = re.exec(src))) {
      const open = /\$([a-z_]*)\$/i.exec(src.slice(m.index));
      if (!open) continue;
      const start = m.index + open.index + open[0].length;
      const end = src.indexOf(open[0], start);
      if (end < 0) continue;
      defs.set(m[3].toLowerCase(), { file: f, body: src.slice(start, end) });
      re.lastIndex = end + open[0].length;
    }
  }
  return defs;
}

function dbDefinitions(url) {
  const sql = `select p.proname || chr(1) || pg_get_functiondef(p.oid) || chr(2) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f' and not exists (select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')`;
  const out = execFileSync('psql', [url, '-Atq', '-c', sql], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const defs = new Map();
  for (const chunk of out.split('\x02')) {
    const [name, body] = chunk.replace(/^\n/, '').split('\x01');
    if (name && body) defs.set(name, { file: 'db', body });
  }
  return defs;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--db');
  const defs = i > 0 ? dbDefinitions(process.argv[i + 1]) : lastDefinitions();
  const bad = [];
  for (const [name, d] of defs) if (!IGNORE.has(name)) bad.push(...scanBody(`${name} (${d.file})`, d.body));
  if (bad.length) {
    console.error(`null-guard: ${bad.length} strażnik(ów) przepuszcza NULL — przepisz na „if (…) is not true then raise”:`);
    for (const b of bad) console.error('  ' + b);
    process.exit(1);
  }
  console.log(`null-guard: ${defs.size} definicji funkcji (${i > 0 ? 'baza' : 'migracje'}), 0 strażników „if not …” przepuszczających NULL`);
}
