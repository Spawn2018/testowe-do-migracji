/**
 * ANEKS 5 §4.5 — sesja roczna na PRAWDZIWYM GoTrue, wyłącznie lokalny Supabase (Docker).
 * Uruchamia scripts/bk5/local.sh (BK5_LOCAL=1); poza lokalnym adresem test się nie uruchomi.
 */
import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';

const URL_ = process.env.VITE_SUPABASE_URL ?? '';
const LOCAL = process.env.BK5_LOCAL === '1' && /^http:\/\/(127\.0\.0\.1|localhost):/.test(URL_);
const ANON = process.env.VITE_SUPABASE_ANON_KEY ?? '';
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const DB = process.env.SUPABASE_DB_URL ?? '';
const psql = (sql: string) => execFileSync('psql', [DB, '-Atq', '-c', sql]).toString().trim();

async function post(path: string, body: unknown, key = ANON, bearer = key) {
  const r = await fetch(URL_ + path, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const t = await r.text();
  return { status: r.status, body: t ? JSON.parse(t) : null };
}
async function login(email: string) {
  const g = await post('/auth/v1/admin/generate_link', { type: 'magiclink', email }, SR);
  const hash = g.body.hashed_token ?? g.body.properties?.hashed_token;
  const v = await post('/auth/v1/verify', { type: 'magiclink', token_hash: hash });
  return { hash, v };
}
const claims = (jwt: string) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());

describe.skipIf(!LOCAL)('A5 §4.5 sesja roczna — lokalny GoTrue', () => {
  it('JWT (token dostępu) = 3600 s', async () => {
    const { v } = await login('hhl@bk5.local');
    const c = claims(v.body.access_token);
    expect(c.exp - c.iat).toBe(3600);
    expect(v.body.expires_in).toBe(3600);
  });
  it('link z e-maila użyty drugi raz — odrzucony', async () => {
    const { hash, v } = await login('ksh@bk5.local');
    expect(v.status).toBe(200);
    const again = await post('/auth/v1/verify', { type: 'magiclink', token_hash: hash });
    expect(again.status).toBeGreaterThanOrEqual(400);
  });
  it('sesja > 365 dni usunięta przez zadanie → odświeżenie tokenu odrzucone; młodsza nietknięta', async () => {
    const a = (await login('scx@bk5.local')).v.body;
    const b = (await login('scx@bk5.local')).v.body;
    const sa = claims(a.access_token).session_id, sb = claims(b.access_token).session_id;
    psql(`update auth.sessions set created_at = now() - interval '366 days' where id = '${sa}'`);
    expect(Number(psql('select purge_expired_sessions()'))).toBeGreaterThanOrEqual(1);
    const ra = await post('/auth/v1/token?grant_type=refresh_token', { refresh_token: a.refresh_token });
    expect(ra.status).toBeGreaterThanOrEqual(400);            // aplikacja → ekran logowania z komunikatem
    const rb = await post('/auth/v1/token?grant_type=refresh_token', { refresh_token: b.refresh_token });
    expect(rb.status).toBe(200);
    expect(psql(`select count(*) from auth.sessions where id = '${sb}'`)).toBe('1');
  });
  it('„wyloguj wszędzie” (RPC) usuwa wszystkie sesje; odświeżenie odrzucone', async () => {
    const a = (await login('ksh@bk5.local')).v.body;
    await login('ksh@bk5.local');
    const r = await post('/rest/v1/rpc/revoke_user_sessions', {}, ANON, a.access_token);
    expect(r.status).toBe(200);
    expect(Number(r.body)).toBeGreaterThanOrEqual(2);
    expect(psql(`select count(*) from auth.sessions s join auth.users u on u.id = s.user_id where u.email = 'ksh@bk5.local'`)).toBe('0');
    expect((await post('/auth/v1/token?grant_type=refresh_token', { refresh_token: a.refresh_token })).status).toBeGreaterThanOrEqual(400);
  });
  it('KSH nie wyloguje innego; HHL wylogowuje przewoźnika', async () => {
    const k = (await login('ksh@bk5.local')).v.body;
    const h = (await login('hhl@bk5.local')).v.body;
    await login('scx@bk5.local');
    const scxId = psql(`select id from app_users where email = 'scx@bk5.local'`);
    const deny = await post('/rest/v1/rpc/revoke_user_sessions', { p_user: scxId }, ANON, k.access_token);
    expect(deny.status).toBeGreaterThanOrEqual(400);
    const ok = await post('/rest/v1/rpc/revoke_user_sessions', { p_user: scxId }, ANON, h.access_token);
    expect(ok.status).toBe(200);
    expect(psql(`select count(*) from auth.sessions s join auth.users u on u.id = s.user_id where u.email = 'scx@bk5.local'`)).toBe('0');
  });
  it('zdezaktywowany z ważnym tokenem: 0 wierszy w tabelach API', async () => {
    const s = (await login('scx@bk5.local')).v.body;
    psql(`update app_users set active = false where email = 'scx@bk5.local'`);
    try {
      let rows = 0;
      for (const t of ['loads', 'organizations', 'projects', 'app_users', 'documents', 'invoices', 'risk_signals', 'load_events', 'sailings', 'geofences']) {
        const r = await fetch(`${URL_}/rest/v1/${t}?select=*`, { headers: { apikey: ANON, Authorization: `Bearer ${s.access_token}` } });
        const b = await r.json();
        rows += Array.isArray(b) ? b.length : 0;
      }
      expect(rows).toBe(0);
      expect(psql(`select count(*) from auth.sessions s join auth.users u on u.id = s.user_id where u.email = 'scx@bk5.local'`)).toBe('0');
    } finally {
      psql(`update app_users set active = true where email = 'scx@bk5.local'`);
    }
  });
});
