#!/usr/bin/env node
/**
 * SEC-OWASP: e2e PKCE na koncie TESTOWYM — BEZ wysyłki e-maili.
 * Zaproszenie (RPC + generate_link) → Dalej → hasło ≥12 → login → recovery → nowe hasło → login.
 */
import { chromium } from '@playwright/test';
import { loadEnvLocal, maskEmail, ensureLiveFiveRoles, accountEmail, TEST_ACCOUNTS } from './env.mjs';

const env = loadEnvLocal();
const host = await ensureLiveFiveRoles(env);
const BASE = (process.env.BK2_BASE ?? 'http://127.0.0.1:4178/').replace(/\/?$/, '/');
const sb = host.url;
const SR = host.serviceKey;
const ANON = host.anonKey;
const hhlEmail = accountEmail(env, TEST_ACCOUNTS[0]);
const stamp = Date.now();
const testEmail = `sebastian+tower-sec-pkce-${stamp}@log-mar.pl`;
const pw1 = `TowerSec1!${String(stamp).slice(-8)}xx`; // ≥12
const pw2 = `TowerSec2!${String(stamp).slice(-8)}yy`;
let pass = 0, fail = 0;
const check = (n, c) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); };
const H = { apikey: SR, Authorization: `Bearer ${SR}`, 'Content-Type': 'application/json' };

async function admin(path, init = {}) {
  const r = await fetch(sb + path, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
  const text = await r.text();
  let body; try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: r.ok, status: r.status, body };
}

async function fragmentFromGenerate(type, email) {
  const g = await admin('/auth/v1/admin/generate_link', {
    method: 'POST',
    body: JSON.stringify({ type, email }),
  });
  if (!g.ok) throw new Error(`generate_link ${type} HTTP ${g.status} ${JSON.stringify(g.body).slice(0, 160)}`);
  const link = g.body.action_link ?? g.body.properties?.action_link;
  const r = await fetch(link, { redirect: 'manual' });
  const loc = r.headers.get('location') ?? '';
  const hashIdx = loc.indexOf('#');
  if (hashIdx >= 0) return loc.slice(hashIdx);
  const qIdx = loc.indexOf('?');
  if (qIdx >= 0) {
    const u = new URL(loc);
    return u.search + u.hash;
  }
  const token_hash = g.body.hashed_token ?? g.body.properties?.hashed_token;
  if (!token_hash) throw new Error(`brak fragmentu ${type}`);
  const v = await fetch(`${sb}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, token_hash }),
  }).then((x) => x.json());
  if (!v.access_token) throw new Error(`verify ${type} failed`);
  return `#access_token=${v.access_token}&refresh_token=${v.refresh_token}&type=${type}`;
}

async function magicToken(email) {
  const g = await admin('/auth/v1/admin/generate_link', {
    method: 'POST', body: JSON.stringify({ type: 'magiclink', email }),
  });
  const token_hash = g.body.hashed_token ?? g.body.properties?.hashed_token;
  const v = await fetch(`${sb}/auth/v1/verify`, {
    method: 'POST',
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', token_hash }),
  }).then((x) => x.json());
  if (!v.access_token) throw new Error(`brak sesji ${maskEmail(email)}`);
  return v.access_token;
}

async function cleanup(email) {
  const list = await admin('/auth/v1/admin/users?page=1&per_page=200');
  const users = list.body?.users ?? [];
  const u = (Array.isArray(users) ? users : []).find((x) => String(x.email).toLowerCase() === email.toLowerCase());
  if (u?.id) await admin(`/auth/v1/admin/users/${u.id}`, { method: 'DELETE' });
  await admin(`/rest/v1/user_invites?email=eq.${encodeURIComponent(email)}`, { method: 'DELETE' });
  await admin(`/rest/v1/app_users?email=eq.${encodeURIComponent(email)}`, { method: 'DELETE' });
}

async function clickContinueIfNeeded(page) {
  const btn = page.locator('[data-auth="link-continue"]');
  try {
    await btn.waitFor({ state: 'visible', timeout: 5000 });
    await btn.click();
  } catch { /* brak Dalej */ }
}

async function fillSetPassword(page, pw) {
  await page.waitForSelector('[data-auth="set-password"]', { timeout: 20000 });
  await page.locator('#auth-new-pw').fill(pw);
  await page.locator('#auth-new-pw2').fill(pw);
  await page.locator('[data-auth="set-password"] button[type="submit"]').click();
}

async function expectSession(page) {
  await page.waitForSelector('[data-auth="session"], [data-auth="mfa"]', { timeout: 20000 });
  return (await page.locator('[data-auth="session"]').count()) > 0
    || (await page.locator('[data-auth="mfa"]').count()) > 0;
}

async function logout(page) {
  const btn = page.getByRole('button', { name: /Wyloguj|Sign out|Logga ut/i });
  if (await btn.count()) {
    await btn.click();
    await page.waitForSelector('[data-auth="login"]', { timeout: 15000 });
  }
}

async function passwordLogin(page, email, pw) {
  await page.goto(BASE);
  await page.waitForSelector('[data-auth="login"]', { timeout: 15000 });
  await page.locator('input[type=email]').fill(email);
  await page.locator('#auth-pw').fill(pw);
  await page.locator('[data-auth="login"] form button[type=submit]').click();
  return expectSession(page);
}

const browser = await chromium.launch();
try {
  {
    const page = await (await browser.newContext()).newPage();
    await page.goto(BASE, { waitUntil: 'networkidle' });
    const hasPkce = await page.evaluate(async () => {
      for (const s of document.querySelectorAll('script[src]')) {
        try {
          const t = await fetch(s.src).then((r) => r.text());
          if (/flowType\s*:\s*[`'"]pkce[`'"]/.test(t)) return 'pkce';
        } catch { /* ignore */ }
      }
      return 'unknown';
    });
    check(`build: flowType=${hasPkce}`, hasPkce === 'pkce');
    await page.close();
  }

  const hhlTok = await magicToken(hhlEmail);
  const inv = await fetch(`${sb}/rest/v1/rpc/admin_invite_user`, {
    method: 'POST',
    headers: {
      apikey: ANON, Authorization: `Bearer ${hhlTok}`, 'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_email: testEmail, p_org_code: 'KSH', p_role: 'CLIENT_USER', p_first_name: 'SEC', p_last_name: 'PKCE', p_phone: '+48111222333' }),
  });
  check(`zaproszenie RPC ${maskEmail(testEmail)}`, inv.ok);
  if (!inv.ok) console.log('  invite', inv.status, (await inv.text()).slice(0, 200));

  // invite link → set password
  {
    const frag = await fragmentFromGenerate('invite', testEmail);
    check('generate_link invite → access_token w hash', frag.includes('access_token='));
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE + frag);
    await clickContinueIfNeeded(page);
    try {
      await fillSetPassword(page, pw1);
      check('ustawienie hasła po zaproszeniu', await expectSession(page));
    } catch (e) {
      await page.screenshot({ path: '/tmp/pkce-invite-fail.png' }).catch(() => {});
      console.log('  invite UI fail', e.message, 'url', page.url(), 'auth', await page.locator('[data-auth]').evaluateAll((ns) => ns.map((n) => n.getAttribute('data-auth'))));
      check('ustawienie hasła po zaproszeniu', false);
      // admin fallback password so later steps can run
      const list = await admin('/auth/v1/admin/users?page=1&per_page=200');
      const u = (list.body?.users ?? []).find((x) => String(x.email).toLowerCase() === testEmail.toLowerCase());
      if (u?.id) await admin(`/auth/v1/admin/users/${u.id}`, { method: 'PUT', body: JSON.stringify({ password: pw1, email_confirm: true }) });
    }
    await logout(page);
    await ctx.close();
  }

  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    try {
      check('logowanie hasłem', await passwordLogin(page, testEmail, pw1));
    } catch (e) {
      check('logowanie hasłem', false);
      console.log('  login fail', e.message);
    }
    await logout(page);
    await ctx.close();
  }

  {
    const frag = await fragmentFromGenerate('recovery', testEmail);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(BASE + frag);
    await clickContinueIfNeeded(page);
    try {
      await fillSetPassword(page, pw2);
      check('reset hasła (recovery)', await expectSession(page));
    } catch (e) {
      await page.screenshot({ path: '/tmp/pkce-recovery-fail.png' }).catch(() => {});
      check('reset hasła (recovery)', false);
      console.log('  recovery fail', e.message);
      const list = await admin('/auth/v1/admin/users?page=1&per_page=200');
      const u = (list.body?.users ?? []).find((x) => String(x.email).toLowerCase() === testEmail.toLowerCase());
      if (u?.id) await admin(`/auth/v1/admin/users/${u.id}`, { method: 'PUT', body: JSON.stringify({ password: pw2 }) });
    }
    await logout(page);
    try {
      check('logowanie nowym hasłem', await passwordLogin(page, testEmail, pw2));
    } catch {
      check('logowanie nowym hasłem', false);
    }
    await ctx.close();
  }

  {
    const list = await admin('/auth/v1/admin/users?page=1&per_page=200');
    const u = (list.body?.users ?? []).find((x) => String(x.email).toLowerCase() === testEmail.toLowerCase());
    if (u?.id) {
      const bad = await admin(`/auth/v1/admin/users/${u.id}`, {
        method: 'PUT', body: JSON.stringify({ password: 'short1' }),
      });
      check('GoTrue odrzuca hasło < 12', !bad.ok);
    } else check('GoTrue odrzuca hasło < 12', false);
  }
} finally {
  await browser.close();
  await cleanup(testEmail).catch((e) => console.log('cleanup:', e.message));
}
console.log(`\nPKCE e2e: ${pass} passed, ${fail} failed · ${maskEmail(testEmail)}`);
process.exit(fail ? 1 : 0);
