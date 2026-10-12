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

/** BK2 verify/e2e: jedno konto na firmę (klucze .env.local). */
export const TEST_ACCOUNTS = [
  { key: 'TEST_USER_HHL_EMAIL', org: 'HHL', role: 'HHL_ADMIN', name: 'Test HHL (admin)' },
  { key: 'TEST_USER_KSH_EMAIL', org: 'KSH', role: 'CLIENT_ADMIN', name: 'Test KSH' },
  { key: 'TEST_USER_SCX_EMAIL', org: 'SCX', role: 'CARRIER_DISPATCH', name: 'Test SCX' },
];

/**
 * P0b / E9: 5 rodzajów kont na TEST.
 * seed-test-users.mjs — key opcjonalny (fallback @tower-db-test.local).
 */
export const FIVE_ROLE_ACCOUNTS = [
  { key: 'TEST_USER_HHL_EMAIL', org: 'HHL', role: 'HHL_ADMIN', name: 'Test HHL (admin)', fallback: 'hhl-admin@tower-db-test.local' },
  { key: 'TEST_USER_HHL_OPS_EMAIL', org: 'HHL', role: 'HHL_OPS', name: 'Test HHL (ops)', fallback: 'hhl-ops@tower-db-test.local' },
  { key: 'TEST_USER_KSH_USER_EMAIL', org: 'KSH', role: 'CLIENT_USER', name: 'Test KSH (user)', fallback: 'ksh-user@tower-db-test.local' },
  { key: 'TEST_USER_SCX_EMAIL', org: 'SCX', role: 'CARRIER_DISPATCH', name: 'Test SCX (dispatch)', fallback: 'scx-dispatch@tower-db-test.local' },
  { key: 'TEST_USER_SCX_USER_EMAIL', org: 'SCX', role: 'CARRIER_USER', name: 'Test SCX (user)', fallback: 'scx-user@tower-db-test.local' },
];

export const PROD_REF = 'nglnnrmzmhusvxslousq';
export const TEST_REF = 'emkbykwenwrjmbprydml';
