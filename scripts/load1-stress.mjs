/**
 * LOAD-1 — test obciążenia na TEST: 140 transportów + pomiary zapytań (kokpit/harmonogram/mapa).
 * 20 jednoczesnych użytkowników = 20 równoległych sesji odczytu (3 role).
 * Nie wypisuje sekretów.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

const ROOT = resolve(import.meta.dirname, '..');
const TEST_REF = 'emkbykwenwrjmbprydml';
const PROD_REF = 'nglnnrmzmhusvxslousq';
const N_LOADS = 140;
const N_USERS = 20;

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

const env = parseEnv(readFileSync(resolve(ROOT, '.env.local'), 'utf8'));
const url = env.get('TEST_DB_URL') || '';
if (!url.includes(TEST_REF) || url.includes(PROD_REF)) {
  console.error('ODMOWA: tylko TEST');
  process.exit(2);
}

const pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 10 });
const q = (c, sql, params = []) => c.query(sql, params);

const ms = async (fn) => {
  const t0 = performance.now();
  const r = await fn();
  return { ms: Math.round(performance.now() - t0), r };
};

try {
  const c = await pool.connect();
  try {
    const orgs = (await q(c, `select id, code from organizations where code in ('HHL','SCX','KSH')`)).rows;
    const hhl = orgs.find((o) => o.code === 'HHL')?.id;
    const scx = orgs.find((o) => o.code === 'SCX')?.id;
    const ksh = orgs.find((o) => o.code === 'KSH')?.id;
    const project = (
      await q(
        c,
        `select p.id from projects p join organizations o on o.id = p.client_org_id where o.code='KSH' limit 1`,
      )
    ).rows[0]?.id;
    if (!hhl || !scx || !ksh || !project) throw new Error('brak org/projektu');

    // usuń poprzednie LOAD1
    await q(c, `delete from loads where order_no like 'KSH/LOAD1-%'`);

    const tSeed = await ms(async () => {
      // batch insert 140
      const values = [];
      const params = [];
      let p = 1;
      for (let i = 1; i <= N_LOADS; i++) {
        const id = `b${String(i).padStart(7, '0')}-5000-4000-8000-${String(i).padStart(12, '0')}`;
        values.push(
          `($${p++}::uuid, $${p++}::uuid, $${p++}::uuid, $${p++}, $${p++}, $${p++}, 'READY', $${p++}::date, $${p++}::date)`,
        );
        const day = 4 + (i % 20);
        params.push(
          id,
          project,
          scx,
          `KSH/LOAD1-${i}`,
          `HHL/LOAD1-${i}`,
          `SCX/LOAD1-${i}`,
          `2026-10-${String(day).padStart(2, '0')}`,
          `2026-10-${String(Math.min(day + 3, 28)).padStart(2, '0')}`,
        );
      }
      await q(
        c,
        `insert into loads (id, project_id, carrier_org_id, order_no, hhl_order_no, carrier_order_no, status, plan_load_date, plan_delivery_date)
         values ${values.join(',')}`,
        params,
      );
      return N_LOADS;
    });
    const cnt = (await q(c, `select count(*)::int as n from loads where order_no like 'KSH/LOAD1-%'`)).rows[0].n;
    console.log(`SEED: ${cnt} transportów w ${tSeed.ms} ms`);

    // role auth ids
    const users = (
      await q(
        c,
        `select auth_id, role from app_users where active is true and role in ('HHL_ADMIN','CLIENT_ADMIN','CARRIER_DISPATCH') and auth_id is not null`,
      )
    ).rows;
    if (users.length < 3) throw new Error(`za mało kont aktywnych z auth_id: ${users.length}`);

    const sessions = [];
    for (let i = 0; i < N_USERS; i++) sessions.push(users[i % users.length]);

    const runAs = async (authId, label, sql) => {
      const client = await pool.connect();
      try {
        await client.query('begin');
        await client.query(`select set_config('request.jwt.claim.sub', $1, true)`, [authId]);
        await client.query(`select set_config('request.jwt.claim.role', 'authenticated', true)`);
        await client.query(`set local role authenticated`);
        const t = await ms(() => client.query(sql));
        await client.query('rollback');
        return { label, ms: t.ms, rows: t.r.rowCount ?? t.r.rows?.length ?? 0 };
      } finally {
        client.release();
      }
    };

    // zapytania jak widoki: kokpit (loads+ryzyka), harmonogram, mapa (pozycje/geofences)
    const queries = {
      kokpit: `select l.id, l.status, l.order_no, l.eta_site,
                 (select count(*) from risk_signals r where r.load_id = l.id and r.resolved_at is null) as open_risks
               from loads l order by l.plan_load_date nulls last limit 200`,
      harmonogram: `select id, order_no, status, plan_load_date, plan_delivery_date, hhl_order_no, carrier_order_no
                    from loads order by plan_load_date nulls last, order_no limit 500`,
      mapa: `select g.id, g.name, g.kind, ST_AsGeoJSON(g.geom)::text as geo
             from geofences g limit 100`,
    };

    const results = { kokpit: [], harmonogram: [], mapa: [] };
    const tAll = await ms(async () => {
      // Session pooler Free: max ~15 klientów — falami po 8
      const wave = 8;
      for (let i = 0; i < sessions.length; i += wave) {
        const chunk = sessions.slice(i, i + wave);
        await Promise.all(
          chunk.map(async (u, j) => {
            const idx = i + j;
            for (const [name, sql] of Object.entries(queries)) {
              const r = await runAs(u.auth_id, `${u.role}#${idx}`, sql);
              results[name].push(r);
            }
          }),
        );
      }
    });

    const summarize = (arr) => {
      const times = arr.map((x) => x.ms).sort((a, b) => a - b);
      const sum = times.reduce((a, b) => a + b, 0);
      return {
        n: times.length,
        min: times[0],
        p50: times[Math.floor(times.length / 2)],
        p95: times[Math.floor(times.length * 0.95)],
        max: times[times.length - 1],
        avg: Math.round(sum / times.length),
      };
    };

    console.log(`CONCURRENT: ${N_USERS} użytkowników × 3 zapytania w ${tAll.ms} ms wall`);
    for (const name of Object.keys(results)) {
      console.log(`VIEW ${name}:`, JSON.stringify(summarize(results[name])));
    }
    console.log(`LOADS_TOTAL=${(await q(c, `select count(*)::int as n from loads`)).rows[0].n}`);
  } finally {
    c.release();
  }
} catch (e) {
  console.error('LOAD-1 FAIL:', e.message || e);
  process.exitCode = 1;
} finally {
  await pool.end();
}
