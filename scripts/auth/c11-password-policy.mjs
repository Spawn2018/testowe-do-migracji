/**
 * #588 / C11 — test Auth na TEST: hasło ≥ 12 z literami a–z i cyframi (W1).
 * „111111111111” i „ąęśćżźółń1234” → odmowa; „Haslo-testowe-12” → przyjęte.
 * Gdy serwer przyjmie hasło bez litery a–z albo bez cyfry → sygnał „C11 — Auth”.
 * Preferencje: po createUser (z 0323) EUR; bez 0323 → FAIL „0323 niewdrożone na TEST”.
 *
 * Użycie: node scripts/auth/c11-password-policy.mjs
 * Wymaga .env.local: TEST_SUPABASE_URL, TEST_SERVICE_ROLE_KEY, TEST_ANON_KEY (bez produkcji).
 */
import {
  loadEnvLocal,
  assertTestProjectUrl,
  maskEmail,
  TEST_REF,
} from './env.mjs';

const env = loadEnvLocal();
const serviceKey = env.TEST_SERVICE_ROLE_KEY || '';
const anonKey = env.TEST_ANON_KEY || '';
if (!env.TEST_SUPABASE_URL || !serviceKey || !anonKey) {
  throw new Error('Brak TEST_SUPABASE_URL, TEST_SERVICE_ROLE_KEY lub TEST_ANON_KEY');
}
const base = assertTestProjectUrl(env.TEST_SUPABASE_URL);

const H = (key) => ({
  apikey: key,
  Authorization: `Bearer ${key}`,
  'Content-Type': 'application/json',
});

let pass = 0;
let fail = 0;
let authSignal = false;
const check = (name, cond) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
};

async function call(path, { key = serviceKey, token, method = 'GET', body, headers = {} } = {}) {
  const r = await fetch(base + path, {
    method,
    headers: {
      ...H(key),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { ok: r.ok, status: r.status, body: parsed };
}

/** Ścieżka użytkownika: zmiana hasła z sesją (nie Admin API — Admin bywa bez walidacji znaków). */
async function setPasswordAsUser(accessToken, password) {
  return call('/auth/v1/user', {
    key: anonKey,
    token: accessToken,
    method: 'PUT',
    body: { password },
  });
}

async function passwordLogin(email, password) {
  return call('/auth/v1/token?grant_type=password', {
    key: anonKey,
    method: 'POST',
    body: { email, password },
  });
}

function isWeakPasswordReject(x) {
  return !x.ok && (x.body?.error_code === 'weak_password' || x.status === 422);
}

const mgmt = env.SUPABASE_ACCESS_TOKEN;
if (mgmt) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${TEST_REF}/config/auth`, {
    headers: { Authorization: `Bearer ${mgmt}` },
  });
  const body = await r.json().catch(() => ({}));
  const min = body.password_min_length;
  const req = body.password_required_characters ?? '';
  console.log(`TEST Auth config HTTP ${r.status}: min=${min ?? '?'}, required_characters=${JSON.stringify(req)}`);
  if (
    r.ok &&
    (Number(min) < 12 ||
      !String(req).includes('abcdefghijklmnopqrstuvwxyz') ||
      !String(req).includes('0123456789'))
  ) {
    console.log('C11 — Auth: konfiguracja TEST bez min 12 albo bez wymogu liter a–z / cyfr');
    authSignal = true;
  }
} else {
  console.log('Brak SUPABASE_ACCESS_TOKEN — pomijam odczyt config/auth');
}

const probeEmail = `c11-pw-${Date.now()}@tower-db-test.local`;
let userId = null;
let appId = null;

try {
  const orgs = await call('/rest/v1/organizations?select=id,code&code=eq.HHL');
  if (!orgs.ok || !orgs.body?.[0]?.id) throw new Error(`organizations HHL: HTTP ${orgs.status}`);
  const orgId = orgs.body[0].id;

  const inv = await call('/rest/v1/user_invites?on_conflict=email', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: {
      email: probeEmail,
      org_id: orgId,
      role: 'HHL_OPS',
      full_name: 'C11 probe',
      locale: 'pl',
    },
  });
  if (!inv.ok) throw new Error(`invite: HTTP ${inv.status} ${JSON.stringify(inv.body)}`);

  const created = await call('/auth/v1/admin/users', {
    method: 'POST',
    body: {
      email: probeEmail,
      email_confirm: true,
      password: 'Haslo-testowe-12',
      user_metadata: { tower_test: true, c11: true },
    },
  });
  check('Haslo-testowe-12 → przyjęte (createUser)', created.ok);
  userId = created.body?.id;
  check('konto probe istnieje', Boolean(userId));

  if (userId) {
    const login = await passwordLogin(probeEmail, 'Haslo-testowe-12');
    check('logowanie Haslo-testowe-12', Boolean(login.ok && login.body?.access_token));
    const at = login.body?.access_token;

    if (at) {
      const onlyDigits = await setPasswordAsUser(at, '111111111111');
      check('111111111111 → odmowa (sesja użytkownika)', isWeakPasswordReject(onlyDigits));
      if (onlyDigits.ok) authSignal = true;

      if (onlyDigits.ok) await setPasswordAsUser(at, 'Haslo-testowe-12');
      const login2 = onlyDigits.ok
        ? await passwordLogin(probeEmail, 'Haslo-testowe-12')
        : login;
      const at2 = login2.body?.access_token ?? at;

      const polishOnly = await setPasswordAsUser(at2, 'ąęśćżźółń1234');
      check('ąęśćżźółń1234 → odmowa (brak litery a–z)', isWeakPasswordReject(polishOnly));
      if (polishOnly.ok) authSignal = true;

      if (polishOnly.ok) await setPasswordAsUser(at2, 'Haslo-testowe-12');
      const login3 = await passwordLogin(probeEmail, 'Haslo-testowe-12');
      check('Haslo-testowe-12 → logowanie po próbach', Boolean(login3.ok && login3.body?.access_token));
    }

    const appUser = await call(`/rest/v1/app_users?select=id&auth_id=eq.${userId}`);
    appId = appUser.body?.[0]?.id;
    check('app_users po zaproszeniu', Boolean(appId));

    if (appId) {
      const prefs = await call(
        `/rest/v1/user_preferences?select=display_currency&user_id=eq.${appId}`,
      );
      const cur = prefs.ok && prefs.body?.[0]?.display_currency;
      if (cur === 'EUR') {
        check('po utworzeniu konta: user_preferences.display_currency=EUR (0323)', true);
      } else {
        check('po utworzeniu konta: user_preferences.display_currency=EUR (0323)', false);
        console.log('0323 niewdrożone na TEST (brak EUR z wyzwalacza)');
      }
    }
  }
} finally {
  if (userId) {
    await call(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
  }
  await call(`/rest/v1/app_users?email=eq.${encodeURIComponent(probeEmail)}`, { method: 'DELETE' });
  await call(`/rest/v1/user_invites?email=eq.${encodeURIComponent(probeEmail)}`, { method: 'DELETE' });
}

console.log(`\nC11 Auth TEST (${maskEmail(probeEmail)}): ${pass} passed, ${fail} failed`);
if (authSignal) {
  console.log('C11 — Auth: serwer przyjął hasło bez litery a–z albo bez cyfry (albo config TEST bez wymogu)');
  process.exit(2);
}
process.exit(fail ? 1 : 0);
