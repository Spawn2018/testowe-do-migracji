#!/usr/bin/env node
/**
 * Automatyczny smoke APK bramki SMS — PRZED przekazaniem do instalacji.
 *   node scripts/sms-apk-smoke.mjs [ścieżka.apk]
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, unlinkSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const ROOT = resolve(import.meta.dirname, '..');
const apkPath = resolve(process.argv[2] || 'D:/Watch Tower/dane/apk/WatchTowerSMS.apk');
let failed = 0;
function ok(msg) { console.log('OK  ', msg); }
function bad(msg) { console.error('FAIL', msg); failed++; }
function scrub(s) {
  return (s || '')
    .replace(/postgres(ql)?:\/\/[^\s]+/g, 'postgres://***')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, 'jwt:***');
}

function loadEnv() {
  const map = {};
  const p = resolve(ROOT, '.env.local');
  if (!existsSync(p)) return map;
  for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    let v = line.slice(i + 1);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    map[line.slice(0, i).trim()] = v;
  }
  return map;
}

function sdkRoot() {
  return process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT ||
    join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk');
}

function findTool(name) {
  const bt = join(sdkRoot(), 'build-tools');
  if (!existsSync(bt)) return null;
  let vers = [];
  try { vers = readdirSync(bt).sort().reverse(); } catch { return null; }
  for (const v of vers) {
    for (const f of [`${name}.exe`, `${name}.bat`, name]) {
      const p = join(bt, v, f);
      if (existsSync(p)) return p;
    }
  }
  return null;
}

function psqlFile(url, sql) {
  const sqlPath = join(tmpdir(), `tower-apk-smoke-${Date.now()}.sql`);
  writeFileSync(sqlPath, sql, 'utf8');
  const r = spawnSync('psql', ['--dbname=' + url, '-v', 'ON_ERROR_STOP=1', '-f', sqlPath], {
    encoding: 'utf8',
    env: { ...process.env, PGCLIENTENCODING: 'UTF8' },
    maxBuffer: 2 * 1024 * 1024,
  });
  try { unlinkSync(sqlPath); } catch { /* ignore */ }
  return r;
}

function mustInclude(text, needle, label) {
  if (text.includes(needle)) ok(label);
  else bad(label + ' — brak „' + needle + '”');
}

console.log('=== sms-apk-smoke ===');
console.log('APK', apkPath);
console.log('SDK', sdkRoot());

if (!existsSync(apkPath)) {
  bad('brak pliku APK');
  process.exit(1);
}
const buf = readFileSync(apkPath);
const sha = createHash('sha256').update(buf).digest('hex');
ok(`rozmiar ${buf.length} B, SHA-256 ${sha}`);
if (buf.length < 1_000_000) bad('APK podejrzanie mały');

const svcSrc = readFileSync(
  resolve(ROOT, 'android/sms-gateway/app/src/main/java/pl/logmar/watchtower/sms/GatewayService.kt'),
  'utf8',
);
const destroyBlock = svcSrc.split('override fun onDestroy')[1]?.split('override fun')[0] || '';
if (/prefs\.enabled\s*=\s*false/.test(destroyBlock)) bad('onDestroy kasuje prefs.enabled');
else ok('onDestroy nie kasuje prefs.enabled');
mustInclude(svcSrc, 'START_STICKY', 'źródło: START_STICKY');
mustInclude(svcSrc, 'ACTION_STOP', 'źródło: ACTION_STOP');
mustInclude(svcSrc, 'onTaskRemoved', 'źródło: onTaskRemoved');
mustInclude(svcSrc, 'startForeground', 'źródło: startForeground');

mustInclude(
  readFileSync(resolve(ROOT, 'android/sms-gateway/app/src/main/java/pl/logmar/watchtower/sms/SmsResultReceiver.kt'), 'utf8'),
  'goAsync',
  'SmsResultReceiver: goAsync',
);
mustInclude(
  readFileSync(resolve(ROOT, 'android/sms-gateway/app/src/main/java/pl/logmar/watchtower/sms/BootReceiver.kt'), 'utf8'),
  'QUICKBOOT',
  'BootReceiver: QUICKBOOT',
);
if (existsSync(resolve(ROOT, 'android/sms-gateway/app/src/main/java/pl/logmar/watchtower/sms/KeepAliveReceiver.kt'))) {
  ok('KeepAliveReceiver.kt');
} else bad('brak KeepAliveReceiver.kt');

const strings = readFileSync(resolve(ROOT, 'android/sms-gateway/app/src/main/res/values/strings.xml'), 'utf8');
mustInclude(strings, 'realme', 'UI: instrukcja realme');

const manSrc = readFileSync(resolve(ROOT, 'android/sms-gateway/app/src/main/AndroidManifest.xml'), 'utf8');
for (const needle of [
  'RECEIVE_BOOT_COMPLETED',
  'FOREGROUND_SERVICE_DATA_SYNC',
  'REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
  'SCHEDULE_EXACT_ALARM',
  'KeepAliveReceiver',
  'BOOT_COMPLETED',
  'MY_PACKAGE_REPLACED',
  'QUICKBOOT_POWERON',
  'stopWithTask="false"',
]) {
  mustInclude(manSrc, needle, 'manifest: ' + needle);
}

const aapt = findTool('aapt');
if (aapt) {
  const out = spawnSync(aapt, ['dump', 'badging', apkPath], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }).stdout || '';
  const vm = out.match(/versionName='([^']+)'/);
  const vc = out.match(/versionCode='([^']+)'/);
  if (vm?.[1] === '1.0.3') ok(`aapt versionName=${vm[1]}`);
  else bad(`versionName oczekiwane 1.0.3, jest ${vm?.[1] || '?'}`);
  if (vc?.[1] === '4') ok(`aapt versionCode=${vc[1]}`);
  else bad(`versionCode oczekiwane 4, jest ${vc?.[1] || '?'}`);
  mustInclude(out, 'RECEIVE_BOOT_COMPLETED', 'aapt: BOOT');
  mustInclude(out, 'FOREGROUND_SERVICE', 'aapt: FGS');

  const xml = spawnSync(aapt, ['dump', 'xmltree', apkPath, 'AndroidManifest.xml'], {
    encoding: 'utf8',
    maxBuffer: 4 * 1024 * 1024,
  }).stdout || '';
  for (const n of ['KeepAliveReceiver', 'BootReceiver', 'GatewayService', 'SmsResultReceiver']) {
    mustInclude(xml, n, 'xmltree: ' + n);
  }
} else {
  bad('brak aapt w ' + sdkRoot());
}

for (const s of ['eyJhbGciOi', 'service_role', 'SUPABASE_DB_POOLER', '-----BEGIN']) {
  if (buf.toString('latin1').includes(s)) bad(`sekret w APK: ${s.slice(0, 12)}`);
}
ok('brak oczywistych sekretów w binarium');

const signer = findTool('apksigner');
if (signer) {
  const r = spawnSync(`"${signer}"`, ['verify', '--verbose', `"${apkPath}"`], {
    encoding: 'utf8',
    shell: true,
    windowsVerbatimArguments: false,
  });
  // fallback: cmd /c with quoted paths
  const r2 = (r.status ?? 1) === 0 ? r : spawnSync(
    'cmd',
    ['/c', `"${signer}" verify --verbose "${apkPath}"`],
    { encoding: 'utf8' },
  );
  if ((r2.status ?? 1) === 0) ok('apksigner: Verified');
  else bad(`apksigner: ${(r2.stderr || r2.stdout || r.stderr || '').slice(0, 180)}`);
} else console.log('SKIP apksigner');

const env = loadEnv();

if (env.SUPABASE_DB_POOLER_URL) {
  const r = psqlFile(env.SUPABASE_DB_POOLER_URL, `
select jobname, schedule, active::text
  from cron.job where jobname = 'tower-sms-straznik';
`);
  process.stdout.write(scrub(r.stdout));
  process.stderr.write(scrub(r.stderr));
  if ((r.stdout || '').includes('tower-sms-straznik') && (r.stdout || '').includes('true')) {
    ok('PROD: cron tower-sms-straznik aktywny');
  } else bad('PROD: cron tower-sms-straznik nieaktywny');
} else bad('brak SUPABASE_DB_POOLER_URL');

if (env.TEST_DB_URL) {
  const r = psqlFile(env.TEST_DB_URL, `
begin;
do $$
declare
  r jsonb;
  v_dev uuid;
begin
  select id into v_dev from sms_devices where revoked_at is null order by last_seen_at desc nulls last limit 1;
  if v_dev is null then
    insert into sms_devices (label, token_hash, created_by)
    values (
      'smoke-keepalive',
      sha256(convert_to('smoke-token-' || gen_random_uuid()::text, 'UTF8')),
      (select id from app_users where role = 'HHL_ADMIN' and active order by created_at limit 1)
    )
    returning id into v_dev;
  end if;
  update sms_devices set last_seen_at = now() - interval '20 minutes', revoked_at = null where id = v_dev;
  r := sms_watchdog();
  if (r->>'cisza') is distinct from 'true' then
    raise exception 'SMOKE_FAIL cisza=%', r;
  end if;
  if not exists (
    select 1 from risk_signals
     where dedup_key like 'sms-gateway:%' and resolved_at is null and severity = 'HIGH'
  ) then
    raise exception 'SMOKE_FAIL brak ryzyka HIGH';
  end if;
  if not exists (select 1 from notifications where template = 'SMS_GATEWAY_SILENT') then
    raise exception 'SMOKE_FAIL brak SMS_GATEWAY_SILENT';
  end if;
  raise notice 'SMOKE_OK cisza+ryzyko+email_template';
end $$;
rollback;
`);
  process.stdout.write(scrub(r.stdout));
  process.stderr.write(scrub(r.stderr));
  const all = (r.stdout || '') + (r.stderr || '');
  if ((r.status ?? 1) !== 0) bad('TEST: sms_watchdog dry-run FAIL');
  else if (all.includes('SMOKE_OK')) ok('TEST: cisza>15min → ryzyko + SMS_GATEWAY_SILENT (ROLLBACK)');
  else bad('TEST: brak SMOKE_OK');
} else bad('brak TEST_DB_URL');

console.log(failed === 0 ? '\nWYNIK: PASS — APK gotowy do instalacji' : `\nWYNIK: FAIL (${failed})`);
console.log('SHA-256', sha);
process.exit(failed === 0 ? 0 : 1);
