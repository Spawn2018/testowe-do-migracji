/**
 * Użytkownicy auth w projekcie testowym — Admin API (service_role testowy).
 * Nie wypisuje sekretów. Nigdy nie używa klucza produkcji.
 *
 * Hosted free: brak DISABLE TRIGGER / session_replication_role na auth.users.
 * Seed: kasujemy app_users → zaproszenie → Admin API createUser (stałe UUID).
 */
import pg from 'pg';

export const TEST_REF = 'emkbykwenwrjmbprydml';
export const PROD_REF = 'nglnnrmzmhusvxslousq';

/** Fixtures zestawów DB (stałe UUID z seed.sql) — nie zmieniać ról bez przepisania asercji. */
export const SEED_AUTH_USERS = [
  {
    id: '11111111-0000-0000-0000-000000000001',
    email: 'hhl@test',
    org: '00000000-0000-0000-0000-00000000a001',
    role: 'HHL_ADMIN',
  },
  {
    id: '11111111-0000-0000-0000-000000000002',
    email: 'ksh@test',
    org: '00000000-0000-0000-0000-00000000a002',
    role: 'CLIENT_ADMIN',
  },
  {
    id: '11111111-0000-0000-0000-000000000003',
    email: 'scx@test',
    org: '00000000-0000-0000-0000-00000000a003',
    role: 'CARRIER_DISPATCH',
  },
];

/**
 * P0b / E9: 5 rodzajów kont na TEST (po prep).
 * HHL Administrator, HHL Operacje, KSH Użytkownik, SCX Dyspozytor, SCX Użytkownik.
 */
export const FIVE_ROLE_USERS = [
  {
    id: '11111111-0000-0000-0000-0000000000a1',
    email: 'hhl-admin@tower-db-test.local',
    org: '00000000-0000-0000-0000-00000000a001',
    role: 'HHL_ADMIN',
    label: 'HHL Administrator',
  },
  {
    id: '11111111-0000-0000-0000-0000000000a2',
    email: 'hhl-ops@tower-db-test.local',
    org: '00000000-0000-0000-0000-00000000a001',
    role: 'HHL_OPS',
    label: 'HHL Operacje',
  },
  {
    id: '11111111-0000-0000-0000-0000000000a3',
    email: 'ksh-user@tower-db-test.local',
    org: '00000000-0000-0000-0000-00000000a002',
    role: 'CLIENT_USER',
    label: 'KSH Użytkownik',
  },
  {
    id: '11111111-0000-0000-0000-0000000000a4',
    email: 'scx-dispatch@tower-db-test.local',
    org: '00000000-0000-0000-0000-00000000a003',
    role: 'CARRIER_DISPATCH',
    label: 'SCX Dyspozytor',
  },
  {
    id: '11111111-0000-0000-0000-0000000000a5',
    email: 'scx-user@tower-db-test.local',
    org: '00000000-0000-0000-0000-00000000a003',
    role: 'CARRIER_USER',
    label: 'SCX Użytkownik',
  },
];

const TEST_EMAIL_RE = /@(test|firma\.pl|tower-db-test\.local)$/i;

function assertTestProject(url, serviceKey, supabaseUrl) {
  if (!url || url.includes(PROD_REF)) throw new Error('ODMOWA: produkcja');
  if (!url.includes(TEST_REF)) throw new Error('ODMOWA: zły ref TEST_DB_URL');
  if (!supabaseUrl || !supabaseUrl.includes(TEST_REF)) {
    throw new Error('ODMOWA: TEST_SUPABASE_URL bez ref testowego');
  }
  if (!serviceKey) throw new Error('BRAK TEST_SERVICE_ROLE_KEY');
}

async function adminFetch(supabaseUrl, serviceKey, path, init = {}) {
  const r = await fetch(`${supabaseUrl.replace(/\/$/, '')}${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: r.ok, status: r.status, body };
}

async function withDb(url, fn) {
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/**
 * Tworzy konta seed (stałe UUID) przez Admin API + zaproszenie.
 * Nie wyłącza triggerów (hosted free: must be owner).
 */
export async function ensureSeedAuthUsers({ dbUrl, supabaseUrl, serviceKey }) {
  assertTestProject(dbUrl, serviceKey, supabaseUrl);
  await withDb(dbUrl, async (client) => {
    for (const u of SEED_AUTH_USERS) {
      const exists = await client.query(`select 1 from auth.users where id = $1`, [u.id]);
      if (exists.rowCount > 0) continue;

      // Zwolnij e-mail / auth_id pod createUser + wyzwalacz
      await client.query(`delete from user_preferences where user_id in (select id from app_users where email = $1)`, [
        u.email,
      ]);
      await client.query(`delete from app_users where email = $1 or auth_id = $2`, [u.email, u.id]);
      await client.query(`delete from user_invites where email = $1`, [u.email]);
      await client.query(
        `insert into user_invites (email, org_id, role, locale, created_at)
         values ($1, $2, $3::user_role, 'pl', now())`,
        [u.email, u.org, u.role],
      );
    }
  });

  for (const u of SEED_AUTH_USERS) {
    const already = await withDb(dbUrl, (c) => c.query(`select 1 from auth.users where id = $1`, [u.id]));
    if (already.rowCount > 0) continue;

    const created = await adminFetch(supabaseUrl, serviceKey, '/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        id: u.id,
        email: u.email,
        email_confirm: true,
        user_metadata: { tower_db_test: true },
      }),
    });
    if (!created.ok) {
      throw new Error(
        `ensureSeedAuthUsers ${u.email}: API ${created.status} ${JSON.stringify(created.body).slice(0, 200)}`,
      );
    }
  }

  await withDb(dbUrl, async (client) => {
    for (const u of SEED_AUTH_USERS) {
      const r = await client.query(
        `select auth_id::text, role::text from app_users where email = $1`,
        [u.email],
      );
      if (r.rowCount !== 1 || r.rows[0].auth_id !== u.id || r.rows[0].role !== u.role) {
        throw new Error(
          `ensureSeedAuthUsers verify ${u.email}: ${JSON.stringify(r.rows[0] || null)}`,
        );
      }
    }
  });
}

/**
 * P0b: 5 rodzajów kont na TEST po prep. Odmowa produkcji.
 * Po resecie schematu auth.users może zostać — wtedy odtwarzamy zaproszenie
 * i wiersz app_users (wyzwalacz na INSERT auth nie odpala się ponownie).
 */
export async function ensureFiveRoleAccounts({ dbUrl, supabaseUrl, serviceKey }) {
  assertTestProject(dbUrl, serviceKey, supabaseUrl);

  await withDb(dbUrl, async (client) => {
    for (const u of FIVE_ROLE_USERS) {
      const linked = await client.query(
        `select 1 from app_users where email = $1 and auth_id = $2 and role = $3::user_role`,
        [u.email, u.id, u.role],
      );
      if (linked.rowCount === 1) continue;

      await client.query(`delete from user_preferences where user_id in (select id from app_users where email = $1 or auth_id = $2)`, [
        u.email,
        u.id,
      ]);
      await client.query(`delete from app_users where email = $1 or auth_id = $2`, [u.email, u.id]);
      await client.query(`delete from user_invites where email = $1`, [u.email]);
      await client.query(
        `insert into user_invites (email, org_id, role, locale, created_at)
         values ($1, $2, $3::user_role, 'pl', now())`,
        [u.email, u.org, u.role],
      );

      const authExists = await client.query(`select 1 from auth.users where id = $1`, [u.id]);
      if (authExists.rowCount === 0) {
        // createUser poniżej (Admin API)
      } else {
        // auth jest, schemat wyczyszczony — wstaw app_users jak wyzwalacz zaproszenia
        await client.query(
          `insert into app_users (auth_id, org_id, email, role, active)
           values ($1, $2, $3, $4::user_role, true)
           on conflict (auth_id) do update set org_id = excluded.org_id, email = excluded.email, role = excluded.role, active = true`,
          [u.id, u.org, u.email, u.role],
        );
        await client.query(`update user_invites set accepted_at = now() where email = $1 and accepted_at is null`, [
          u.email,
        ]);
      }
    }
  });

  for (const u of FIVE_ROLE_USERS) {
    const already = await withDb(dbUrl, (c) => c.query(`select 1 from auth.users where id = $1`, [u.id]));
    if (already.rowCount > 0) continue;

    const created = await adminFetch(supabaseUrl, serviceKey, '/auth/v1/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        id: u.id,
        email: u.email,
        email_confirm: true,
        user_metadata: { tower_db_test: true, tower_five_role: true },
      }),
    });
    if (!created.ok) {
      throw new Error(
        `ensureFiveRoleAccounts ${u.email}: API ${created.status} ${JSON.stringify(created.body).slice(0, 200)}`,
      );
    }
  }

  await withDb(dbUrl, async (client) => {
    for (const u of FIVE_ROLE_USERS) {
      const r = await client.query(
        `select auth_id::text, role::text from app_users where email = $1`,
        [u.email],
      );
      if (r.rowCount !== 1 || r.rows[0].auth_id !== u.id || r.rows[0].role !== u.role) {
        throw new Error(
          `ensureFiveRoleAccounts verify ${u.email}: ${JSON.stringify(r.rows[0] || null)}`,
        );
      }
    }
  });
}

/** Usuwa konta seed z auth (invite wymaga osieroconych app_users). */
export async function removeSeedAuthUsers({ dbUrl, supabaseUrl, serviceKey }) {
  assertTestProject(dbUrl, serviceKey, supabaseUrl);
  for (const u of SEED_AUTH_USERS) {
    await adminFetch(supabaseUrl, serviceKey, `/auth/v1/admin/users/${u.id}`, { method: 'DELETE' });
  }
  await withDb(dbUrl, async (client) => {
    for (const u of SEED_AUTH_USERS) {
      await client.query(`delete from auth.sessions where user_id = $1`, [u.id]);
      await client.query(`delete from auth.users where id = $1 or lower(email) = lower($2)`, [
        u.id,
        u.email,
      ]);
    }
  });
}

export async function createAuthUser(
  { dbUrl, supabaseUrl, serviceKey },
  { id, email, createdAt = null, lastSignInAt = null },
) {
  assertTestProject(dbUrl, serviceKey, supabaseUrl);
  const created = await adminFetch(supabaseUrl, serviceKey, '/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({
      ...(id ? { id } : {}),
      email,
      email_confirm: true,
      user_metadata: { tower_db_test: true },
    }),
  });
  if (!created.ok) {
    throw new Error(`createAuthUser ${email}: ${created.status} ${JSON.stringify(created.body).slice(0, 180)}`);
  }
  const uid = created.body?.id || id;
  if (createdAt || lastSignInAt) {
    await patchAuthUserTimestamps({ dbUrl }, { id: uid, createdAt, lastSignInAt });
  }
  return uid;
}

export async function patchAuthUserTimestamps({ dbUrl }, { id, createdAt, lastSignInAt }) {
  await withDb(dbUrl, async (client) => {
    if (createdAt != null) {
      await client.query(`update auth.users set created_at = $2::timestamptz where id = $1`, [id, createdAt]);
    }
    if (lastSignInAt != null) {
      await client.query(`update auth.users set last_sign_in_at = $2::timestamptz where id = $1`, [
        id,
        lastSignInAt,
      ]);
    }
  });
}

export async function deleteAuthUser({ dbUrl, supabaseUrl, serviceKey }, idOrEmail) {
  assertTestProject(dbUrl, serviceKey, supabaseUrl);
  let id = idOrEmail;
  if (String(idOrEmail).includes('@')) {
    await withDb(dbUrl, async (client) => {
      const r = await client.query(`select id from auth.users where lower(email) = lower($1)`, [idOrEmail]);
      id = r.rows[0]?.id;
    });
  }
  if (!id) return;
  await adminFetch(supabaseUrl, serviceKey, `/auth/v1/admin/users/${id}`, { method: 'DELETE' });
  await withDb(dbUrl, async (client) => {
    await client.query(`delete from auth.sessions where user_id = $1`, [id]);
    await client.query(`delete from auth.users where id = $1`, [id]);
  });
}

export async function cleanupTestAuthUsers({ dbUrl, supabaseUrl, serviceKey }) {
  assertTestProject(dbUrl, serviceKey, supabaseUrl);
  const ids = await withDb(dbUrl, async (client) => {
    const r = await client.query(`select id, email from auth.users`);
    return r.rows.filter((row) => TEST_EMAIL_RE.test(String(row.email || ''))).map((row) => row.id);
  });
  for (const id of ids) {
    await adminFetch(supabaseUrl, serviceKey, `/auth/v1/admin/users/${id}`, { method: 'DELETE' });
  }
  await withDb(dbUrl, async (client) => {
    await client.query(
      `delete from auth.sessions where user_id in (select id from auth.users where email ~* '@(test|firma\\.pl|tower-db-test\\.local)$')`,
    );
    await client.query(`delete from auth.users where email ~* '@(test|firma\\.pl|tower-db-test\\.local)$'`);
  });
}
