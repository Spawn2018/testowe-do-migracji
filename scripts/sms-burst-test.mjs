#!/usr/bin/env node
/**
 * TEL/SMS — seria 10 SMS testowych na numer właściciela (lista sms_test_numbers).
 * Użycie (po instalacji APK, bramka włączona):
 *   node scripts/sms-burst-test.mjs
 * Wymaga: .env.local z SUPABASE_DB_POOLER_URL; numer w sms_test_numbers.
 * Odstęp not_before: 4 s (telefon ma własne 3 s).
 * SQL przez plik UTF-8 (Windows: unikamy błędu 0x97 przy -c).
 */
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
if (!url) {
  console.error('Brak SUPABASE_DB_POOLER_URL');
  process.exit(2);
}

const sql = `
do $$
declare
  v_to text;
  v_tag text := to_char(now() at time zone 'UTC', 'YYYYMMDDHH24MISS');
  i int;
begin
  select to_e164 into v_to from sms_test_numbers order by created_at limit 1;
  if v_to is null then
    raise exception 'Brak numeru w sms_test_numbers — dodaj w Opcjach';
  end if;
  for i in 1..10 loop
    insert into sms_outbox (kind, to_e164, locale, body, priority, not_before, dedup_key, created_by)
    values (
      'TEST', v_to, 'pl',
      'Watch Tower test ' || i || '/10 ' || v_tag,
      100,
      now() + ((i - 1) * interval '4 seconds'),
      'BURST10:' || v_tag || ':' || i,
      (select id from app_users where role = 'HHL_ADMIN' and active order by created_at limit 1)
    );
  end loop;
  raise notice 'OK: 10 SMS TEST na % tag=%', v_to, v_tag;
end $$;

select id::text, status, attempts,
       to_char(not_before at time zone 'Europe/Warsaw', 'HH24:MI:SS') as not_before,
       to_char(sent_at at time zone 'Europe/Warsaw', 'HH24:MI:SS') as sent,
       to_char(delivered_at at time zone 'Europe/Warsaw', 'HH24:MI:SS') as delivered,
       right(to_e164, 4) as last4
  from sms_outbox
 where dedup_key like 'BURST10:%'
   and created_at > now() - interval '5 minutes'
 order by created_at;
`;

const sqlPath = join(tmpdir(), `tower-sms-burst-${Date.now()}.sql`);
writeFileSync(sqlPath, sql, 'utf8');
const r = spawnSync('psql', ['--dbname=' + url, '-v', 'ON_ERROR_STOP=1', '-f', sqlPath], {
  encoding: 'utf8',
  env: { ...process.env, PGCLIENTENCODING: 'UTF8' },
  maxBuffer: 2 * 1024 * 1024,
});
try { unlinkSync(sqlPath); } catch { /* ignore */ }
const scrub = (s) => (s || '').replace(/postgres(ql)?:\/\/[^\s]+/g, 'postgres://***');
process.stdout.write(scrub(r.stdout));
process.stderr.write(scrub(r.stderr));
process.exit(r.status ?? 1);
