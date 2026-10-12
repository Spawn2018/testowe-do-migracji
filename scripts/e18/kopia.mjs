/**
 * P1 / E18 — kopia wierszy przed migracją porządków (poza repozytorium).
 * Zapis: D:\Watch Tower\dane\e18\kopia-e18-<data>.json (+ .sha256).
 * Logi: tylko liczby i maskEmail — bez PII i kwot.
 *
 * Domyślnie TEST. Produkcja: TOWER_E18_PROD=1 + DATABASE_URL / SUPABASE_DB_URL.
 * Użycie: node scripts/e18/kopia.mjs
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { loadEnvLocal, maskEmail, PROD_REF, TEST_REF } from '../auth/env.mjs';

const DANE = process.env.TOWER_DANE || 'D:/Watch Tower/dane';
const allowProd = process.env.TOWER_E18_PROD === '1';
const env = loadEnvLocal();

function pickUrl() {
  if (allowProd) {
    return env.DATABASE_URL || env.SUPABASE_DB_URL || env.PROD_DB_URL || '';
  }
  return env.TEST_DB_URL || '';
}

const url = pickUrl();
if (!url) {
  console.error(allowProd ? 'BRAK DATABASE_URL / SUPABASE_DB_URL' : 'BRAK TEST_DB_URL');
  process.exit(1);
}
if (url.includes(PROD_REF) && !allowProd) {
  console.error(`ODMOWA: produkcja (${PROD_REF}) — ustaw TOWER_E18_PROD=1 tylko przed wdrożeniem P1`);
  process.exit(2);
}
if (!allowProd && !url.includes(TEST_REF)) {
  console.error(`ODMOWA: oczekiwano TEST (${TEST_REF})`);
  process.exit(2);
}

const client = new pg.Client({
  connectionString: url,
  ssl: url.includes('localhost') ? undefined : { rejectUnauthorized: false },
});

async function q(sql, params = []) {
  const r = await client.query(sql, params);
  return r.rows;
}

function sha(obj) {
  return createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

await client.connect();
try {
  const towerUsers = await q(
    `select * from app_users where email ilike '%+tower-sec%' or email ilike '%+tower-test%' order by email`,
  );
  const ids = towerUsers.map((u) => u.id);
  const emails = towerUsers.map((u) => u.email);

  const dump = {
    created_at: new Date().toISOString(),
    ref: allowProd ? 'prod' : 'test',
    tables: {},
  };

  async function put(name, rows) {
    dump.tables[name] = { count: rows.length, rows };
    console.log(`  ${name}: ${rows.length}`);
  }

  console.log('E18 kopia — tabele (liczby):');
  await put('app_users', towerUsers);

  if (ids.length) {
    await put(
      'audit_log_pointing',
      await q(
        `select * from audit_log
         where user_id = any($1::uuid[]) or acting_as_user_id = any($1::uuid[])
         order by id`,
        [ids],
      ),
    );
    await put(
      'notifications',
      await q(`select * from notifications where user_id = any($1::uuid[]) order by id`, [ids]),
    );
    await put(
      'load_message_reads',
      await q(`select * from load_message_reads where user_id = any($1::uuid[]) order by message_id, user_id`, [ids]),
    );
    await put(
      'impersonation_state',
      await q(
        `select * from impersonation_state
         where admin_user_id = any($1::uuid[]) or target_user_id = any($1::uuid[])`,
        [ids],
      ),
    );
    await put(
      'user_invites',
      await q(
        `select * from user_invites
         where email ilike '%+tower-test%' or invited_by = any($1::uuid[])
         order by id`,
        [ids],
      ),
    );
  } else {
    await put('audit_log_pointing', []);
    await put('notifications', []);
    await put('load_message_reads', []);
    await put('impersonation_state', []);
    await put(
      'user_invites',
      await q(`select * from user_invites where email ilike '%+tower-test%' order by id`),
    );
  }

  // auth.users — tylko gdy service role / bezpośredni dostęp do auth
  try {
    await put(
      'auth_users',
      await q(
        `select id, email, created_at, banned_until, deleted_at
         from auth.users
         where email ilike '%+tower-test%' or email ilike '%+tower-sec%'
         order by email`,
      ),
    );
  } catch (e) {
    console.log(`  auth_users: SKIP (${String(e.message || e).slice(0, 80)})`);
    await put('auth_users', []);
  }

  await put(
    'insurance_policies',
    await q(
      `select * from insurance_policies
       where policy_no in ('OCP-SCX-2026-WT', '436000430439')
       order by policy_no`,
    ),
  );
  await put(
    'invoices',
    await q(`select * from invoices where invoice_number = 'WT-TEST-P6-20261005'`),
  );
  await put(
    'invoice_lines',
    await q(
      `select il.* from invoice_lines il
       join invoices i on i.id = il.invoice_id
       where i.invoice_number = 'WT-TEST-P6-20261005'`,
    ),
  );
  await put(
    'load_messages',
    await q(`select * from load_messages where id in (29, 31, 32, 33) order by id`),
  );

  const sg24 = await q(
    `select l.* from loads l
     join shipment_items si on si.load_id = l.id
     where si.shipment_code = 'SG-24'`,
  );
  await put('loads_sg24', sg24);
  if (sg24[0]) {
    await put(
      'geofence_states_sg24',
      await q(`select * from geofence_states where load_id = $1`, [sg24[0].id]),
    );
    await put(
      'risk_signals_sg24_open',
      await q(
        `select * from risk_signals
         where load_id = $1 and resolved_at is null
           and (
             (kind = 'ETA_BREACH' and coalesce(title,'') like 'Opóźnienie 5400 min%')
             or (kind = 'JOB_FAILURE' and coalesce(title,'') like 'Decyzja po terminie: Opóźnienie 5400 min%')
           )`,
        [sg24[0].id],
      ),
    );
  } else {
    await put('geofence_states_sg24', []);
    await put('risk_signals_sg24_open', []);
  }

  const sg03 = await q(
    `select l.id from loads l
     join shipment_items si on si.load_id = l.id
     where si.shipment_code = 'SG-03' limit 1`,
  );
  if (sg03[0]) {
    const exit = await q(
      `select occurred_at from load_events
       where load_id = $1 and event_type = 'GEOFENCE_EXIT'
         and coalesce(payload->>'zone_kind', payload->>'kind', '') in ('SITE', 'site')
       order by occurred_at asc limit 1`,
      [sg03[0].id],
    );
    // fallback: zdarzenie z 07.10 ~12:19 PL jeśli brak kind
    const cutoff = exit[0]?.occurred_at
      || (await q(
        `select occurred_at from load_events
         where load_id = $1 and event_type = 'GEOFENCE_EXIT'
           and occurred_at >= timestamptz '2026-10-07 10:19:00+00'
           and occurred_at < timestamptz '2026-10-07 10:20:00+00'
         order by occurred_at asc limit 1`,
        [sg03[0].id],
      ))[0]?.occurred_at;
    if (cutoff) {
      await put(
        'positions_sg03_after_exit',
        await q(
          `select * from positions where load_id = $1 and ts > $2::timestamptz order by ts`,
          [sg03[0].id, cutoff],
        ),
      );
      dump.tables.positions_sg03_after_exit.meta = { cutoff };
    } else {
      await put('positions_sg03_after_exit', []);
    }
  } else {
    await put('positions_sg03_after_exit', []);
  }

  await put(
    'risk_signals_p13',
    await q(
      `select * from risk_signals
       where resolved_at is null and kind = 'JOB_FAILURE'
         and (
           (coalesce(title,'') like 'SMS bez potwierdzenia doręczenia%'
             and detected_at >= timestamptz '2026-10-01 17:00:00+00'
             and detected_at < timestamptz '2026-10-01 18:00:00+00')
           or (coalesce(title,'') like 'Błędy w przeglądarce użytkowników%'
             and detected_at >= timestamptz '2026-10-03 17:00:00+00'
             and detected_at < timestamptz '2026-10-03 18:00:00+00')
         )
       order by id`,
    ),
  );

  const sg01 = await q(
    `select l.id from loads l join shipment_items si on si.load_id = l.id
     where si.shipment_code = 'SG-01' limit 1`,
  );
  if (sg01[0]) {
    await put(
      'driver_tokens_sg01',
      await q(
        `select * from driver_tokens
         where load_id = $1
           and issued_at >= timestamptz '2026-10-01 20:00:00+00'
           and issued_at < timestamptz '2026-10-01 21:00:00+00'
         order by id`,
        [sg01[0].id],
      ),
    );
  } else {
    await put('driver_tokens_sg01', []);
  }

  await put(
    'eta_breach_planned_open',
    await q(
      `select rs.* from risk_signals rs
       join loads l on l.id = rs.load_id
       where rs.resolved_at is null and rs.kind = 'ETA_BREACH'
         and l.status = 'PLANNED'`,
    ),
  );

  const digest = sha(dump);
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const dir = resolve(DANE, 'e18');
  mkdirSync(dir, { recursive: true });
  const out = resolve(dir, `kopia-e18-${stamp}.json`);
  writeFileSync(out, JSON.stringify(dump, null, 2));
  writeFileSync(out + '.sha256', digest + '\n');

  console.log('SHA-256:', digest);
  console.log('plik:', out);
  console.log(
    'konta (mask):',
    emails.map(maskEmail).join(', ') || '(brak)',
  );
} finally {
  await client.end();
}
