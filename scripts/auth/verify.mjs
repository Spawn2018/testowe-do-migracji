// BK2: weryfikacja end-to-end na hostowanym Supabase — BEZ wysyłki e-maili.
// Magic link: auth.admin.generate_link (nie wysyła) → /auth/v1/verify → sesja
// → sprawdzenie ról i RLS z 0001/0005 dla każdej z trzech firm.
// Użycie: node scripts/auth/verify.mjs   (exit 1 przy jakiejkolwiek porażce)
import { loadEnvLocal, TEST_ACCOUNTS, ensureLiveFiveRoles, accountEmail } from './env.mjs';

const env = loadEnvLocal();
const host = await ensureLiveFiveRoles(env);
const base = host.url;
const SR = host.serviceKey;
const ANON = host.anonKey;
let pass = 0, fail = 0;
const check = (name, cond) => { cond ? pass++ : fail++; console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); };

async function req(path, { key = ANON, token, method = 'GET', body, headers = {} } = {}) {
  const r = await fetch(base + path, {
    method,
    headers: { apikey: key, Authorization: `Bearer ${token ?? key}`, 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const t = await r.text();
  let b; try { b = t ? JSON.parse(t) : null; } catch { b = t; }
  return { status: r.status, ok: r.ok, body: b };
}

async function magicLinkSession(email) {
  const g = await req('/auth/v1/admin/generate_link', { key: SR, method: 'POST', body: { type: 'magiclink', email } });
  if (!g.ok) throw new Error(`generate_link HTTP ${g.status}`);
  const token_hash = g.body.hashed_token ?? g.body.properties?.hashed_token;
  const v = await req('/auth/v1/verify', { method: 'POST', body: { type: 'magiclink', token_hash } });
  if (!v.ok || !v.body?.access_token) throw new Error(`verify HTTP ${v.status}`);
  return v.body.access_token;
}

const tok = {};
for (const a of TEST_ACCOUNTS) {
  try { tok[a.org] = await magicLinkSession(accountEmail(env, a)); check(`${a.org}: magic link → sesja`, true); }
  catch (e) { check(`${a.org}: magic link → sesja (${e.message})`, false); }
}
const rpc = (org, fn, body) => req(`/rest/v1/rpc/${fn}`, { token: tok[org], method: 'POST', body });

for (const a of TEST_ACCOUNTS) {
  const p = await rpc(a.org, 'my_profile', {});
  check(`${a.org}: my_profile = ${a.role}@${a.org}`, p.ok && p.body?.[0]?.role === a.role && p.body?.[0]?.org_code === a.org);
}
const usersHHL = await req('/rest/v1/app_users?select=id,role,auth_id', { token: tok.HHL });
check('HHL widzi wszystkich użytkowników (>=3)', usersHHL.ok && usersHHL.body.length >= 3);
const usersKSH = await req('/rest/v1/app_users?select=id', { token: tok.KSH });
check('KSH widzi tylko siebie (RLS users_self)', usersKSH.ok && usersKSH.body.length === 1);
const usersSCX = await req('/rest/v1/app_users?select=id', { token: tok.SCX });
check('SCX widzi tylko siebie (RLS users_self)', usersSCX.ok && usersSCX.body.length === 1);
const invSCX = await req('/rest/v1/user_invites?select=id', { token: tok.SCX });
check('SCX nie widzi zaproszeń', invSCX.ok && invSCX.body.length === 0);
const anonUsers = await req('/rest/v1/app_users?select=id');
check('anon nie czyta app_users', !anonUsers.ok || (Array.isArray(anonUsers.body) && anonUsers.body.length === 0));

const kshId = usersKSH.body?.[0]?.id;
const selfUpd = await req(`/rest/v1/app_users?id=eq.${kshId}`, { token: tok.KSH, method: 'PATCH', body: { role: 'HHL_ADMIN' }, headers: { Prefer: 'return=representation' } });
check('KSH nie może sam zmienić swojej roli (UPDATE zabroniony)', !selfUpd.ok || (Array.isArray(selfUpd.body) && selfUpd.body.length === 0));

const probe = `bk2-verify-${Date.now()}@example.test`;
const kshInv = await rpc('KSH', 'admin_invite_user', { p_email: probe, p_org_code: 'KSH', p_role: 'CLIENT_USER' });
check('KSH nie może zapraszać (42501)', !kshInv.ok);
const scxRole = await rpc('SCX', 'admin_set_user_role', { p_user: kshId, p_role: 'CLIENT_USER' });
check('SCX nie może nadawać ról', !scxRole.ok);
const bad = await rpc('HHL', 'admin_invite_user', { p_email: probe, p_org_code: 'SCX', p_role: 'CLIENT_USER' });
check('HHL: rola niezgodna z organizacją odrzucona', !bad.ok);
const good = await rpc('HHL', 'admin_invite_user', { p_email: probe, p_org_code: 'KSH', p_role: 'CLIENT_USER', p_first_name: 'BK2', p_last_name: 'probe', p_phone: '+48000000001' });
check('HHL zaprasza użytkownika KSH', good.ok && typeof good.body === 'string');
const invHHL = await req(`/rest/v1/user_invites?select=id,role&email=eq.${encodeURIComponent(probe)}`, { token: tok.HHL });
check('HHL widzi zaproszenie', invHHL.ok && invHHL.body.length === 1 && invHHL.body[0].role === 'CLIENT_USER');
if (good.ok) {
  const rv = await rpc('HHL', 'admin_revoke_invite', { p_invite: good.body });
  check('HHL cofa zaproszenie', rv.ok);
}
const r1 = await rpc('HHL', 'admin_set_user_role', { p_user: kshId, p_role: 'CLIENT_ADMIN' });
const p1 = await rpc('KSH', 'my_profile', {});
const r2 = await rpc('HHL', 'admin_set_user_role', { p_user: kshId, p_role: 'CLIENT_USER' });
check('HHL zmienia rolę KSH i przywraca CLIENT_USER', r1.ok && r2.ok && p1.body?.[0]?.role === 'CLIENT_ADMIN');
const hhlSelf = usersHHL.body?.find((u) => u.role === 'HHL_ADMIN' && tok.HHL && JSON.parse(Buffer.from(tok.HHL.split('.')[1], 'base64url')).sub === u.auth_id);
const demote = await rpc('HHL', 'admin_set_user_role', { p_user: hhlSelf?.id, p_role: 'HHL_OPS' });
check('HHL nie może odebrać sobie roli admina', !demote.ok);
const rogue = await req('/auth/v1/admin/users', { key: SR, method: 'POST', body: { email: `bk2-noinvite-${Date.now()}@example.test`, email_confirm: true } });
check('Konto bez zaproszenia odrzucone (wyzwalacz)', !rogue.ok);

console.log(`\nBK2 verify: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
