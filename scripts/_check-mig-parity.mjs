#!/usr/bin/env node
import { readFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
const ROOT = resolve(import.meta.dirname, '..');
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
const url = env.SUPABASE_DB_POOLER_URL;
const local = readdirSync(resolve(ROOT, 'supabase/migrations'))
  .filter((f) => /^\d{4}_.*\.sql$/.test(f))
  .map((f) => f.slice(0, 4))
  .sort();
const sqlPath = join(tmpdir(), 'tower-mig-check.sql');
writeFileSync(sqlPath, `select version from supabase_migrations.schema_migrations order by version;`, 'utf8');
const r = spawnSync('psql', ['--dbname=' + url, '-v', 'ON_ERROR_STOP=1', '-Atq', '-f', sqlPath], {
  encoding: 'utf8', env: { ...process.env, PGCLIENTENCODING: 'UTF8' },
});
try { unlinkSync(sqlPath); } catch {}
const remote = (r.stdout || '').trim().split(/\r?\n/).filter(Boolean);
console.log('LOCAL', local.length, local[0] + '…' + local[local.length - 1]);
console.log('PROD ', remote.length, remote[0] + '…' + remote[remote.length - 1]);
const missLocal = remote.filter((v) => !local.includes(v));
const missRemote = local.filter((v) => !remote.includes(v));
console.log('missing_in_repo', missLocal.join(',') || '—');
console.log('missing_on_prod', missRemote.join(',') || '—');
console.log('MATCH', missLocal.length === 0 && missRemote.length === 0 && local.length === remote.length ? 'YES' : 'NO');
process.exit(r.status ?? 1);
