// BK2: konta testowe — po jednym na firmę (HHL_ADMIN / CLIENT_ADMIN / CARRIER_DISPATCH).
// Idempotentne. Service role (tylko lokalnie z .env.local); e-maile NIE są wysyłane
// (auth.admin.createUser z email_confirm=true). Adresy w .env.local: TEST_USER_*_EMAIL.
// Użycie: node scripts/auth/seed-test-users.mjs
import { loadEnvLocal, need, maskEmail, TEST_ACCOUNTS } from './env.mjs';

const env = loadEnvLocal();
need(env, ['VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', ...TEST_ACCOUNTS.map((a) => a.key)]);
const base = env.VITE_SUPABASE_URL.replace(/\/$/, '');
const H = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
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

for (const a of TEST_ACCOUNTS) {
  const email = env[a.key].toLowerCase();
  const existing = await call(`/rest/v1/app_users?select=id,role&email=eq.${encodeURIComponent(email)}`);
  if (existing.ok && existing.body.length) {
    console.log(`${a.org}: exists (${existing.body[0].role}) ${maskEmail(email)}`);
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
    body: JSON.stringify({ email, email_confirm: true, user_metadata: { tower_test: true, org: a.org } }),
  });
  if (!u.ok) throw new Error(`${a.org} createUser: HTTP ${u.status} ${JSON.stringify(u.body?.msg ?? u.body?.error_code ?? '')}`);
  console.log(`${a.org}: created ${a.role} ${maskEmail(email)}`);
}
