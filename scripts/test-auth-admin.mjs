#!/usr/bin/env node
/**
 * CLI dla skryptów bash: create | delete | ensure-seed | remove-seed | cleanup | patch
 * Nie wypisuje sekretów.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  createAuthUser,
  deleteAuthUser,
  ensureSeedAuthUsers,
  removeSeedAuthUsers,
  cleanupTestAuthUsers,
  patchAuthUserTimestamps,
} from './lib/test-auth-admin.mjs';

function loadEnv() {
  const text = readFileSync(resolve(import.meta.dirname, '..', '.env.local'), 'utf8');
  const map = {};
  for (const line of text.split(/\r?\n/)) {
    if (!line || /^\s*#/.test(line)) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    let v = line.slice(i + 1);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    map[line.slice(0, i).trim()] = v;
  }
  return map;
}

const env = loadEnv();
const ctx = {
  dbUrl: env.TEST_DB_URL,
  supabaseUrl: env.TEST_SUPABASE_URL || `https://emkbykwenwrjmbprydml.supabase.co`,
  serviceKey: env.TEST_SERVICE_ROLE_KEY,
};

const [cmd, ...rest] = process.argv.slice(2);

try {
  switch (cmd) {
    case 'ensure-seed':
      await ensureSeedAuthUsers(ctx);
      console.log('OK ensure-seed');
      break;
    case 'remove-seed':
      await removeSeedAuthUsers(ctx);
      console.log('OK remove-seed');
      break;
    case 'cleanup':
      await cleanupTestAuthUsers(ctx);
      console.log('OK cleanup');
      break;
    case 'create': {
      // create <email> [id] [--no-trigger]
      const email = rest[0];
      const id = rest.find((a) => a.includes('-') && !a.startsWith('--'));
      const disableTrigger = rest.includes('--no-trigger');
      const uid = await createAuthUser(ctx, { email, id, disableTrigger });
      console.log(uid);
      break;
    }
    case 'delete':
      await deleteAuthUser(ctx, rest[0]);
      console.log('OK delete');
      break;
    case 'patch': {
      // patch <id> created_at=... last_sign_in_at=...
      const id = rest[0];
      const opts = { id };
      for (const a of rest.slice(1)) {
        const [k, v] = a.split('=');
        if (k === 'created_at') opts.createdAt = v;
        if (k === 'last_sign_in_at') opts.lastSignInAt = v;
      }
      await patchAuthUserTimestamps(ctx, opts);
      console.log('OK patch');
      break;
    }
    default:
      console.error('usage: ensure-seed|remove-seed|cleanup|create|delete|patch');
      process.exit(2);
  }
} catch (e) {
  console.error(String(e.message || e).slice(0, 300));
  process.exit(1);
}
