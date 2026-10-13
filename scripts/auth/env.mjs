// Minimal .env.local reader for BK2 ops scripts. Never logs values.
import { readFileSync } from 'node:fs';

export function loadEnvLocal(path = '.env.local') {
  const file = String(path).replace(/\.\.\//g, '').replace(/\.\.\\/g, '');
  if (file !== path || file.includes('..')) throw new Error('Niedozwolona ścieżka env');
  const out = {};
  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return { ...out, ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k in out)) };
}

export function need(env, keys) {
  const missing = keys.filter((k) => !env[k]);
  if (missing.length) throw new Error(`Missing env keys: ${missing.join(', ')}`);
}

/** Redact e-mail for logs: a***@d*** (keeps org tag after "+"). */
export function maskEmail(e) {
  const [local, dom] = String(e).split('@');
  const tag = local.includes('+') ? '+' + local.split('+')[1] : '';
  return `${local[0]}***${tag}@${(dom ?? '')[0] ?? ''}***`;
}

/**
 * BK2 verify/e2e: jedno konto na firmę.
 * P1 / E18: adresy na TEST to 5 ról z P0b. Klucze TEST_USER_* z produkcji
 * (+tower-test / +tower-sec) nie są używane — patrz accountEmail.
 */
export const TEST_ACCOUNTS = [
  { key: 'TEST_USER_HHL_EMAIL', org: 'HHL', role: 'HHL_ADMIN', name: 'Test HHL (admin)', fallback: 'hhl-admin@tower-db-test.local' },
  { key: 'TEST_USER_KSH_EMAIL', org: 'KSH', role: 'CLIENT_USER', name: 'Test KSH', fallback: 'ksh-user@tower-db-test.local' },
  { key: 'TEST_USER_SCX_EMAIL', org: 'SCX', role: 'CARRIER_DISPATCH', name: 'Test SCX', fallback: 'scx-dispatch@tower-db-test.local' },
];

/**
 * P0b / E9: 5 rodzajów kont na TEST.
 * seed-test-users.mjs — key opcjonalny (fallback @tower-db-test.local).
 */
/** Hasło kont 5 ról na TEST (tylko testy na żywo / brama). */
export const FIVE_ROLE_LIVE_PASSWORD = 'TowerDbTest-12roles!';

export const FIVE_ROLE_ACCOUNTS = [
  { key: 'TEST_USER_HHL_EMAIL', org: 'HHL', role: 'HHL_ADMIN', name: 'Test HHL (admin)', fallback: 'hhl-admin@tower-db-test.local' },
  { key: 'TEST_USER_HHL_OPS_EMAIL', org: 'HHL', role: 'HHL_OPS', name: 'Test HHL (ops)', fallback: 'hhl-ops@tower-db-test.local' },
  { key: 'TEST_USER_KSH_USER_EMAIL', org: 'KSH', role: 'CLIENT_USER', name: 'Test KSH (user)', fallback: 'ksh-user@tower-db-test.local' },
  { key: 'TEST_USER_SCX_EMAIL', org: 'SCX', role: 'CARRIER_DISPATCH', name: 'Test SCX (dispatch)', fallback: 'scx-dispatch@tower-db-test.local' },
  { key: 'TEST_USER_SCX_USER_EMAIL', org: 'SCX', role: 'CARRIER_USER', name: 'Test SCX (user)', fallback: 'scx-user@tower-db-test.local' },
];

export const PROD_REF = 'nglnnrmzmhusvxslousq';
export const TEST_REF = 'emkbykwenwrjmbprydml';

/** P1 / E18: żaden skrypt scripts/auth/* na adresie produkcji. */
export function refuseProdUrl(url) {
  if (String(url || '').includes(PROD_REF)) {
    throw new Error(`ODMOWA: produkcja (${PROD_REF}) — skrypt auth tylko na TEST / localhost`);
  }
}

/** Odmowa, gdy którykolwiek podany adres wskazuje produkcję (test e18). */
export function refuseProdUrls(env = {}) {
  const keys = [
    'VITE_SUPABASE_URL',
    'TEST_SUPABASE_URL',
    'SUPABASE_DB_URL',
    'TEST_DB_URL',
    'DATABASE_URL',
    'PROD_DB_URL',
  ];
  for (const k of keys) {
    const u = env[k] || '';
    if (u) refuseProdUrl(u);
  }
}

/** Adres, którego skrypt naprawdę użyje: tylko TEST albo localhost. */
export function assertTestProjectUrl(url) {
  const u = String(url || '').replace(/\/$/, '');
  refuseProdUrl(u);
  if (!u.includes(TEST_REF) && !u.includes('127.0.0.1') && !u.includes('localhost')) {
    throw new Error(`ODMOWA: tylko TEST (${TEST_REF}) / localhost`);
  }
  return u;
}

/**
 * Host testów na żywo. Nie bierze VITE_SUPABASE_URL ani klucza produkcji
 * (w .env.local te wartości wskazują produkcję).
 */
export function testHost(env = {}) {
  const url = assertTestProjectUrl(env.TEST_SUPABASE_URL || '');
  const serviceKey = env.TEST_SERVICE_ROLE_KEY || '';
  const anonKey = env.TEST_ANON_KEY || '';
  if (!url || !serviceKey || !anonKey) {
    throw new Error('Brak TEST_SUPABASE_URL, TEST_SERVICE_ROLE_KEY lub TEST_ANON_KEY');
  }
  return { url, serviceKey, anonKey };
}

/**
 * P1: testy logowania na TEST same zakładają 5 ról (ta sama funkcja co po kroku prep).
 * Po bramie kont nie ma — nie zakładaj, że zostały.
 */
export async function ensureLiveFiveRoles(env = {}) {
  const host = testHost(env);
  const dbUrl = env.TEST_DB_URL || '';
  if (!dbUrl) throw new Error('BRAK TEST_DB_URL');
  const { ensureFiveRoleAccounts } = await import('../lib/test-auth-admin.mjs');
  await ensureFiveRoleAccounts({
    dbUrl,
    supabaseUrl: host.url,
    serviceKey: host.serviceKey,
  });
  const { FIVE_ROLE_USERS } = await import('../lib/test-auth-admin.mjs');
  for (const u of FIVE_ROLE_USERS) {
    const pw = await fetch(`${host.url.replace(/\/$/, '')}/auth/v1/admin/users/${u.id}`, {
      method: 'PUT',
      headers: {
        apikey: host.serviceKey,
        Authorization: `Bearer ${host.serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password: FIVE_ROLE_LIVE_PASSWORD, email_confirm: true }),
    });
    if (!pw.ok) {
      throw new Error(`ensureLiveFiveRoles password ${u.email}: HTTP ${pw.status}`);
    }
  }
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();
  try {
    await client.query(
      `update app_users set must_set_password = false where email = any($1::text[])`,
      [FIVE_ROLE_USERS.map((u) => u.email)],
    );
  } finally {
    await client.end();
  }
  return host;
}

/** Adres konta na TEST. Wzorzec +tower-sec / +tower-test to konta z produkcji (E18 P2/P3). */
export function accountEmail(env, account) {
  const raw = String(env[account.key] || '').trim();
  const banned = raw.includes('+tower-sec') || raw.includes('+tower-test');
  const email = !raw || banned ? account.fallback : raw;
  if (!email) throw new Error(`Brak adresu konta ${account.org}`);
  return email.toLowerCase();
}
