/**
 * SIM-1 — symulacja pełnego transportu na TEST (zmyślone dane).
 * GPS: Śrem → Gdańsk → (prom) → Nynäshamn → Boden.
 * Nie wypisuje numerów telefonów ani sekretów.
 *
 * Użycie:
 *   node scripts/setup-test-db-url.mjs
 *   node scripts/sim1-full-transport.mjs
 * Opcjonalnie: OWNER_SMS_E164=+48… (tylko lokalnie) — wtedy kolejkujemy 1 SMS TEST.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const ROOT = resolve(import.meta.dirname, '..');
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

function maskPhone(e164) {
  if (!e164 || e164.length < 6) return '(brak)';
  return `${e164.slice(0, 3)}…${e164.slice(-4)}`;
}

const env = parseEnv(readFileSync(resolve(ROOT, '.env.local'), 'utf8'));
const url = env.get('TEST_DB_URL') || '';
if (!url.includes(TEST_REF) || url.includes(PROD_REF)) {
  console.error('ODMOWA: TEST_DB_URL musi wskazywać wyłącznie projekt testowy');
  process.exit(2);
}

const OWNER_SMS = (process.env.OWNER_SMS_E164 || env.get('OWNER_SMS_E164') || '').trim();

const report = [];
const step = (name, detail) => {
  report.push({ name, detail, at: new Date().toISOString() });
  console.log(`STEP ${report.length}. ${name}: ${detail}`);
};

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

const q = async (sql, params = []) => {
  const r = await client.query(sql, params);
  return r;
};

const one = async (sql, params = []) => (await q(sql, params)).rows[0];
const val = async (sql, params = []) => {
  const r = await one(sql, params);
  return r ? Object.values(r)[0] : null;
};

try {
  // --- fixture IDs (zmyślone, stałe na przebieg) ---
  const ids = {
    project: 'a1111111-5111-4111-8111-111111111101',
    load: 'a2222222-5222-4222-8222-222222222201',
    vessel: 'a3333333-5333-4333-8333-333333333301',
    sailing: 'a4444444-5444-4444-8444-444444444401',
    scxOrg: null,
    hhlOrg: null,
  };

  const orgs = (await q(`select id, code from organizations where code in ('HHL','SCX','KSH')`)).rows;
  ids.hhlOrg = orgs.find((o) => o.code === 'HHL')?.id;
  ids.scxOrg = orgs.find((o) => o.code === 'SCX')?.id;
  const kshOrg = orgs.find((o) => o.code === 'KSH')?.id;
  if (!ids.hhlOrg || !ids.scxOrg || !kshOrg) throw new Error('brak organizacji HHL/SCX/KSH na TEST');

  step('start', 'połączenie TEST OK; org HHL/SCX/KSH obecne');

  // Czyść poprzedni przebieg SIM-1
  await q(`delete from positions where load_id = $1`, [ids.load]);
  await q(`delete from load_events where load_id = $1`, [ids.load]);
  await q(`delete from risk_signals where load_id = $1`, [ids.load]);
  await q(`delete from notifications where load_id = $1`, [ids.load]);
  await q(`delete from decisions where load_id = $1`, [ids.load]);
  await q(`delete from decision_events where decision_id in (select id from decisions where load_id = $1)`, [ids.load]).catch(() => {});
  await q(`delete from sms_outbox where load_id = $1`, [ids.load]);
  await q(`delete from geofence_states where load_id = $1`, [ids.load]);
  await q(`delete from loads where id = $1`, [ids.load]);
  await q(`delete from sailings where id = $1`, [ids.sailing]);
  await q(`delete from vessels where id = $1`, [ids.vessel]);
  await q(`delete from geofences where project_id = $1 and name like 'SIM1 %'`, [ids.project]);
  await q(`delete from projects where id = $1`, [ids.project]);

  // Użyj projektu KSH jeśli jest; inaczej utwórz SIM1
  const existingProj = await one(
    `select p.id from projects p
     join organizations o on o.id = p.client_org_id
     where o.code = 'KSH' order by p.created_at nulls last limit 1`,
  );
  if (existingProj) {
    ids.project = existingProj.id;
    step('projekt', `użyto istniejącego projektu KSH ${ids.project.slice(0, 8)}…`);
  } else {
    await q(
      `insert into projects (id, code, name, client_org_id, active)
       values ($1, 'SIM1_TEST', 'SIM-1 Stegra (zmyslone)', $2, true)`,
      [ids.project, kshOrg],
    );
    step('projekt', 'utworzono SIM1_TEST');
  }

  // Geofences SIM-1
  await q(`
    insert into geofences (project_id, name, kind, geom, hysteresis_m, dwell_seconds, debounce_fixes, country) values
     ($1,'SIM1 Zaladunek Srem','LOADING',     make_circle_fence(52.0900,17.0200,  800), 200,   0, 2,'PL'),
     ($1,'SIM1 Bufor Gdansk',  'PRE_PORT',    make_circle_fence(54.4030,18.6800,20000), 500,   0, 2,'PL'),
     ($1,'SIM1 Port Gdansk',   'PORT_OUT',    make_circle_fence(54.4030,18.6800,  800), 200, 900, 2,'PL'),
     ($1,'SIM1 Port Nynashamn','PORT_IN',     make_circle_fence(58.9350,17.9500,  800), 200, 600, 2,'SE'),
     ($1,'SIM1 Bufor Boden',   'PRE_ARRIVAL', make_circle_fence(65.8054,21.7591,50000),1000,   0, 2,'SE'),
     ($1,'SIM1 Plac Stegra',   'SITE',        make_circle_fence(65.8054,21.7591, 1500), 300, 600, 2,'SE')
  `, [ids.project]);
  step('strefy', '6 geofence SIM1 (Śrem…Boden)');

  await q(
    `insert into vessels (id, name, operator) values ($1, 'M/F SIM Nova', 'Polferries')
     on conflict (id) do nothing`,
    [ids.vessel],
  );
  await q(
    `insert into sailings (id, project_id, vessel_id, departure_at, arrival_at, status)
     values ($1, $2, $3, '2026-10-05 12:00+00', '2026-10-06 06:00+00', 'ZAPLANOWANY')
     on conflict (id) do update set departure_at = excluded.departure_at`,
    [ids.sailing, ids.project, ids.vessel],
  );

  await q(
    `insert into loads (
       id, project_id, carrier_org_id, order_no, hhl_order_no, carrier_order_no,
       status, sailing_id, plan_load_date, plan_delivery_date,
       plan_load_from, plan_load_to, plan_delivery_from, plan_delivery_to,
       driver_name, tractor_plate
     ) values (
       $1, $2, $3, 'KSH/SIM-1', 'HHL/SIM-1', 'SCX/SIM-1',
       'READY', $4, '2026-10-04', '2026-10-07',
       '2026-10-04 06:00+02', '2026-10-04 10:00+02',
       '2026-10-07 08:00+02', '2026-10-07 16:00+02',
       'Jan Testowy', 'TEST12AB'
     )`,
    [ids.load, ids.project, ids.scxOrg, ids.sailing],
  );
  step('ładunek', `READY KSH/SIM-1 id=${ids.load.slice(0, 8)}…`);

  const pos = async (lat, lon, ts) => {
    await q(`select process_position($1::uuid, $2::float8, $3::float8, $4::timestamptz)`, [
      ids.load,
      lat,
      lon,
      ts,
    ]);
  };
  const status = async () => val(`select status from loads where id = $1`, [ids.load]);

  // 1) Załadunek Śrem
  await pos(52.0900, 17.0200, '2026-10-04 07:00+02');
  await pos(52.0901, 17.0201, '2026-10-04 07:05+02');
  let st = await status();
  step('GPS Śrem (załadunek)', `status=${st}`);
  await q(
    `insert into load_events (load_id, event_type, occurred_at)
     values ($1, 'MILESTONE_LOADED', '2026-10-04 07:30+02')`,
    [ids.load],
  );
  await pos(52.30, 17.30, '2026-10-04 09:00+02');
  await pos(52.31, 17.31, '2026-10-04 09:05+02');
  st = await status();
  step('wyjazd po załadunku', `status=${st} (oczekiwano IN_TRANSIT_PL)`);

  // 2) Port Gdańsk
  await pos(54.4030, 18.6800, '2026-10-05 10:00+02');
  await pos(54.4031, 18.6801, '2026-10-05 10:05+02');
  st = await status();
  step('GPS Port Gdańsk', `status=${st} (oczekiwano AT_PORT_GDANSK)`);

  // 3) Prom
  const promoted = await val(`select promote_ferry_departures('2026-10-05 12:01+00')`);
  st = await status();
  step('prom odejście', `promote=${promoted} status=${st} (oczekiwano FERRY)`);

  // 4) Nynäshamn
  await pos(58.9350, 17.9500, '2026-10-06 08:00+02');
  await pos(58.9351, 17.9501, '2026-10-06 08:05+02');
  // dwell 600s — druga seria po czasie
  await pos(58.9350, 17.9500, '2026-10-06 08:20+02');
  await pos(58.9351, 17.9501, '2026-10-06 08:25+02');
  st = await status();
  step('GPS Nynäshamn', `status=${st}`);

  // 5) Boden / Stegra
  await pos(65.80, 21.70, '2026-10-07 10:00+02');
  await pos(65.801, 21.701, '2026-10-07 10:05+02');
  st = await status();
  step('GPS bufor Boden', `status=${st}`);
  await pos(65.8054, 21.7591, '2026-10-07 12:00+02');
  await pos(65.8055, 21.7592, '2026-10-07 12:05+02');
  await pos(65.8054, 21.7591, '2026-10-07 12:20+02');
  await pos(65.8055, 21.7592, '2026-10-07 12:25+02');
  st = await status();
  step('GPS plac Stegra', `status=${st}`);

  // ETA
  const eta = await one(`select * from compute_load_eta($1::uuid, '2026-10-05 11:00+00'::timestamptz)`, [ids.load]);
  step(
    'ETA',
    eta
      ? `segment=${eta.segment ?? eta.current_segment ?? '?'} eta_site=${eta.eta_site ?? eta.eta ?? 'null'}`
      : 'brak wyniku compute_load_eta',
  );

  // Decyzje / powiadomienia
  const decisions = await val(`select count(*)::int from decisions where load_id = $1`, [ids.load]);
  const notif = await val(`select count(*)::int from notifications where load_id = $1`, [ids.load]);
  const risks = await val(`select count(*)::int from risk_signals where load_id = $1`, [ids.load]);
  const events = await val(`select count(*)::int from load_events where load_id = $1`, [ids.load]);
  const positions = await val(`select count(*)::int from positions where load_id = $1`, [ids.load]);
  step('agregaty', `pozycje=${positions} zdarzenia=${events} ryzyka=${risks} decyzje=${decisions} powiadomienia=${notif}`);

  const notifBy = (
    await q(
      `select channel, status, count(*)::int as n
       from notifications where load_id = $1
       group by 1,2 order by 1,2`,
      [ids.load],
    )
  ).rows;
  if (notifBy.length) step('powiadomienia wg kanału', JSON.stringify(notifBy));

  // SMS tylko na numer właściciela
  if (OWNER_SMS) {
    await q(
      `insert into sms_test_numbers (e164, label) values ($1, 'SIM1 owner')
       on conflict do nothing`,
      [OWNER_SMS],
    ).catch(async () => {
      // tabela może mieć inny unikalny klucz
      await q(`insert into sms_test_numbers (e164, label) select $1, 'SIM1 owner'
               where not exists (select 1 from sms_test_numbers where e164 = $1)`, [OWNER_SMS]);
    });
    await q(
      `insert into sms_outbox (kind, to_e164, locale, body, priority, load_id, status)
       values ('TEST', $1, 'pl', 'Watch Tower: SIM-1 test SMS (zmyslony transport).', 10, $2, 'QUEUED')`,
      [OWNER_SMS, ids.load],
    );
    const smsOther = await val(
      `select count(*)::int from sms_outbox where load_id = $1 and to_e164 is distinct from $2`,
      [ids.load, OWNER_SMS],
    );
    step('SMS', `1× TEST → ${maskPhone(OWNER_SMS)}; inne numery dla ładunku=${smsOther}`);
  } else {
    step('SMS', 'SKIP — brak OWNER_SMS_E164 w .env.local (ustaw lokalnie, nie w czacie)');
  }

  const finalStatus = await status();
  step('koniec', `status końcowy=${finalStatus}`);

  console.log('\n=== SIM-1 RAPORT ===');
  for (const [i, s] of report.entries()) console.log(`${i + 1}. ${s.name}: ${s.detail}`);
  console.log(`LOAD_ID=${ids.load}`);
} catch (e) {
  console.error('SIM-1 FAIL:', e.message || e);
  process.exitCode = 1;
} finally {
  await client.end();
}
