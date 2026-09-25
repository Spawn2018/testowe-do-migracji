// Minimal .env.local reader for BK2 ops scripts. Never logs values.
import { readFileSync } from 'node:fs';

export function loadEnvLocal(path = '.env.local') {
  const out = {};
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
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

export const TEST_ACCOUNTS = [
  { key: 'TEST_USER_HHL_EMAIL', org: 'HHL', role: 'HHL_ADMIN', name: 'Test HHL (admin)' },
  { key: 'TEST_USER_KSH_EMAIL', org: 'KSH', role: 'CLIENT_ADMIN', name: 'Test KSH' },
  { key: 'TEST_USER_SCX_EMAIL', org: 'SCX', role: 'CARRIER_DISPATCH', name: 'Test SCX' },
];
