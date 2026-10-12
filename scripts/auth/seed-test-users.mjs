// P0b: konta testowe 5 rodzajów na bazie TEST.
// Idempotentne. Wyłącznie TEST_SUPABASE_URL + TEST_SERVICE_ROLE_KEY (P1: bez adresu produkcji).
// E-maile NIE są wysyłane (email_confirm=true). Adresy: TEST_USER_*_EMAIL lub fallback.
// Odmowa produkcji nglnnrmzmhusvxslousq.
// Użycie: node scripts/auth/seed-test-users.mjs
import { loadEnvLocal, maskEmail, FIVE_ROLE_ACCOUNTS, accountEmail, assertTestProjectUrl } from './env.mjs';

const env = loadEnvLocal();
const serviceKey = env.TEST_SERVICE_ROLE_KEY || '';
if (!env.TEST_SUPABASE_URL || !serviceKey) {
  throw new Error('Brak TEST_SUPABASE_URL lub TEST_SERVICE_ROLE_KEY');
}
const base = assertTestProjectUrl(env.TEST_SUPABASE_URL);

const H = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
};

async function call(path, init = {}) {
  const r = await fetch(base + path, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
  const text = await r.text();
  let body; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: r.ok, status: r.status, body };
}

const orgs = await call('/rest/v1/organizations?select=id,code');
if (!orgs.ok) throw new Error(`organizations: HTTP ${orgs.status}`);
const orgId = Object.fromEntries(orgs.body.map((o) => [o.code, o.id]));

for (const a of FIVE_ROLE_ACCOUNTS) {
  const email = accountEmail(env, a);
  const existing = await call(`/rest/v1/app_users?select=id,role&email=eq.${encodeURIComponent(email)}`);
  if (existing.ok && existing.body.length) {
    console.log(`${a.org} ${a.role}: exists (${existing.body[0].role}) ${maskEmail(email)}`);
    continue;
  }
  const inv = await call('/rest/v1/user_invites?on_conflict=email', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ email, org_id: orgId[a.org], role: a.role, full_name: a.name, locale: 'pl' }),
  });
  if (!inv.ok) throw new Error(`${a.org} invite: HTTP ${inv.status} ${JSON.stringify(inv.body)}`);
  const u = await call('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, email_confirm: true, user_metadata: { tower_test: true, org: a.org, role: a.role } }),
  });
  if (!u.ok) throw new Error(`${a.org} createUser: HTTP ${u.status} ${JSON.stringify(u.body?.msg ?? u.body?.error_code ?? '')}`);
  console.log(`${a.org}: created ${a.role} ${maskEmail(email)}`);
}
