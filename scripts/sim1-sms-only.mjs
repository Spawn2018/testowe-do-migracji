/**
 * SIM-1 — tylko krok SMS (OWNER_SMS_E164 wymagany). Nie wypisuje numeru w pełnej formie.
 *   node scripts/sim1-sms-only.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const ROOT = resolve(import.meta.dirname, '..');
const TEST = 'emkbykwenwrjmbprydml';
const PROD = 'nglnnrmzmhusvxslousq';

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

function maskPhone(e164) {
  if (!e164 || e164.length < 6) return '***';
  return `${e164.slice(0, 3)}…${e164.slice(-2)}`;
}

const env = parseEnv(readFileSync(resolve(ROOT, '.env.local'), 'utf8'));
const url = env.get('TEST_DB_URL');
const OWNER_SMS = (process.env.OWNER_SMS_E164 || env.get('OWNER_SMS_E164') || '').trim();
if (!url?.includes(TEST) || url.includes(PROD)) throw new Error('TEST only');
if (!OWNER_SMS) throw new Error('brak OWNER_SMS_E164');

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  const load = await c.query(
    `select id from loads
      where hhl_order_no like 'SIM1%' or order_no like 'SIM1%'
      order by created_at desc nulls last
      limit 1`,
  );
  let loadId = load.rows[0]?.id;
  if (!loadId) {
    const any = await c.query(`select id from loads order by created_at desc nulls last limit 1`);
    loadId = any.rows[0]?.id;
  }
  if (!loadId) throw new Error('brak ładunku na TEST do podpięcia SMS');

  await c.query(
    `insert into sms_test_numbers (to_e164, label)
     select $1, 'SIM1 owner'
      where not exists (select 1 from sms_test_numbers where to_e164 = $1)`,
    [OWNER_SMS],
  );

  const ins = await c.query(
    `insert into sms_outbox (kind, to_e164, locale, body, priority, load_id, status)
     values ('TEST', $1, 'pl', 'Watch Tower: SIM-1 test SMS (zmyslony transport).', 10, $2, 'QUEUED')
     returning id, status`,
    [OWNER_SMS, loadId],
  );

  const other = await c.query(
    `select count(*)::int as n from sms_outbox where load_id = $1 and to_e164 is distinct from $2`,
    [loadId, OWNER_SMS],
  );

  console.log(
    JSON.stringify({
      ok: true,
      sms_id: ins.rows[0]?.id,
      status: ins.rows[0]?.status,
      to: maskPhone(OWNER_SMS),
      load_id: loadId,
      other_numbers_for_load: other.rows[0]?.n,
    }),
  );
} finally {
  await c.end();
}
