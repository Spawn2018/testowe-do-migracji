/**
 * Test bezpiecznika: skrypty bazy odmawiają, gdy URL zawiera ref produkcji.
 * Uruchom: node --test tests/db/refuse-prod.test.mjs
 */
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = resolve(import.meta.dirname, '../..');
const PROD = 'nglnnrmzmhusvxslousq';
const TEST = 'emkbykwenwrjmbprydml';
const BASH = process.env.BASH_PATH || 'bash';

function runRefuse(envExtra) {
  const script = `
set -e
ADMIN="${envExtra.ADMIN || ''}"
PGADMIN="${envExtra.PGADMIN || ''}"
PGURL="${envExtra.PGURL || ''}"
TEST_DB_URL="${envExtra.TEST_DB_URL || ''}"
. "${ROOT.replace(/\\/g, '/')}/tests/db/refuse-prod.sh"
echo PASS
`;
  return spawnSync(BASH, ['-c', script], {
    encoding: 'utf8',
    env: { ...process.env, ...envExtra },
  });
}

test('odmowa gdy ADMIN zawiera ref produkcji', () => {
  const r = runRefuse({ ADMIN: `postgresql://u:p@db.${PROD}.supabase.co:5432/postgres` });
  assert.equal(r.status, 2);
  assert.match(r.stderr + r.stdout, /ODMOWA/);
});

test('odmowa gdy TEST_DB_URL zawiera ref produkcji', () => {
  const r = runRefuse({ TEST_DB_URL: `postgresql://postgres.${PROD}:x@aws-1-eu-west-1.pooler.supabase.com:5432/postgres` });
  assert.equal(r.status, 2);
  assert.match(r.stderr + r.stdout, /ODMOWA/);
});

test('odmowa gdy PGURL zawiera ref produkcji', () => {
  const r = runRefuse({ PGURL: `postgres://x:y@${PROD}.supabase.co:5432/postgres` });
  assert.equal(r.status, 2);
});

test('przepuszcza adres projektu testowego', () => {
  const r = runRefuse({
    TEST_DB_URL: `postgresql://postgres.${TEST}:x@aws-1-eu-west-1.pooler.supabase.com:5432/postgres`,
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /PASS/);
});

test('przepuszcza localhost', () => {
  const r = runRefuse({ ADMIN: 'postgres://postgres@localhost:5433/postgres' });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /PASS/);
});
