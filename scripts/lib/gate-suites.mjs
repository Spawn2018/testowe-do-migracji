/**
 * Katalog bramy TEST: oczekiwane OK i części nullguard / i2.
 * Asercje zostają w tests/db/*.sh — tu tylko liczby i kolejność.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');

/** Oczekiwane OK na hosted. security: 88−4 SKIP (spatial_ref_sys free). */
export const EXPECTED = {
  security: 84,
  status: 44,
  storage: 37,
  money: 131,
  release: 146,
  session: 27,
  archive: 18,
  watchdog: 27,
  invite: 48,
  risks: 21, // 23 − 2 SKIP (tower_test_status wymaga CREATE DATABASE)
  import: 66,
  nullguard: 533,
  i2: 526, // +2 asercje 0133 — POSTEP
  i30: 10,
  i31: 6,
  dec2: 24,
  dec3: 13,
  dec5: 11,
  dec6: 15,
  adm10: 8,
  hist11: 11,
  workflows: 47,
  insurance: 42,
  'dec-auto': 64, // 39 + 25 asercji L-1b (ten commit)
};

export const SUITE_FILE = {
  security: 'security.sh',
  status: 'status.sh',
  storage: 'storage.sh',
  money: 'money.sh',
  release: 'release.sh',
  session: 'session.sh',
  archive: 'archive.sh',
  watchdog: 'watchdog.sh',
  invite: 'invite.sh',
  risks: 'risks.sh',
  import: 'import.sh',
  i30: 'i30.sh',
  i31: 'i31.sh',
  dec2: 'dec2.sh',
  dec3: 'dec3.sh',
  dec5: 'dec5.sh',
  dec6: 'dec6.sh',
  adm10: 'adm10.sh',
  hist11: 'hist11.sh',
  workflows: 'workflows.sh',
  insurance: 'insurance.sh',
  'dec-auto': 'dec-auto.sh',
};

const NEED_SEED_BASE = new Set(['session']);
const NEED_ORPHAN = new Set(['invite']);

function callLines() {
  return readFileSync(resolve(ROOT, 'tests/db/null-guard-calls.txt'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#'));
}

/** nullguard-1..3 z listy wywołań; nullguard-4 = reszta do 528 (kontrola dodatnia, w tym n/d). */
export function nullguardParts() {
  const lines = callLines();
  const slices = [
    ['nullguard-1', 0, 40, 1],
    ['nullguard-2', 40, 80, 0],
    ['nullguard-3', 80, lines.length, 0],
  ];
  const parts = {};
  for (const [name, a, b, extra] of slices) {
    let denial = 0;
    for (const line of lines.slice(a, b)) {
      const kind = line.split('|')[1]?.trim();
      if (kind === 'GUARD' || kind === 'EMPTY' || kind === 'TOKEN') denial += 4;
    }
    parts[name] = { file: 'nullguard.sh', env: { TOWER_NG_PART: name.slice(-1) }, expected: denial + extra, group: 'nullguard' };
  }
  const head = parts['nullguard-1'].expected + parts['nullguard-2'].expected + parts['nullguard-3'].expected;
  const rest = EXPECTED.nullguard - head;
  if (rest !== 103) {
    throw new Error(`nullguard: części 1–3 dają ${head}, część 4 wyszłaby ${rest}, oczekiwano 103 (łącznie 528)`);
  }
  parts['nullguard-4'] = { file: 'nullguard.sh', env: { TOWER_NG_PART: '4' }, expected: rest, group: 'nullguard' };
  return parts;
}

export function i2Parts() {
  const text = readFileSync(resolve(ROOT, 'tests/db/i2.sh'), 'utf8');
  const parts = {};
  let cur = null;
  for (const line of text.split(/\r?\n/)) {
    const open = /^if _i2_part_ok (\d+); then$/.exec(line);
    if (open) {
      cur = `i2-${open[1]}`;
      parts[cur] = { file: 'i2.sh', env: { TOWER_I2_PART: open[1] }, expected: 0, group: 'i2' };
      continue;
    }
    if (cur && /^fi # tower-i2-part \d+$/.test(line)) {
      cur = null;
      continue;
    }
    if (cur && /^[ \t]*(val|err|chk) /.test(line)) parts[cur].expected += 1;
  }
  const names = Object.keys(parts).sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)));
  const sum = names.reduce((s, n) => s + parts[n].expected, 0);
  if (sum !== EXPECTED.i2) {
    throw new Error(`i2: suma części ${sum} !== ${EXPECTED.i2}`);
  }
  if (names.length < 2) throw new Error('i2: brak podziału na części');
  const ordered = {};
  for (const n of names) ordered[n] = parts[n];
  return ordered;
}

let _steps;
export function gateSteps() {
  if (_steps) return _steps;
  const ng = nullguardParts();
  const i2 = i2Parts();
  const steps = {};
  const order = ['prep'];
  const whole = [
    'security', 'status', 'storage', 'money', 'release', 'session', 'archive', 'watchdog', 'invite', 'risks', 'import',
  ];
  for (const name of whole) {
    steps[name] = { file: SUITE_FILE[name], env: {}, expected: EXPECTED[name], group: null };
    order.push(name);
  }
  for (const name of Object.keys(ng)) {
    steps[name] = ng[name];
    order.push(name);
  }
  for (const name of Object.keys(i2)) {
    steps[name] = i2[name];
    order.push(name);
  }
  for (const name of ['i30', 'i31', 'dec2', 'dec3', 'dec5', 'dec6', 'adm10', 'hist11', 'workflows', 'insurance', 'dec-auto']) {
    steps[name] = { file: SUITE_FILE[name], env: {}, expected: EXPECTED[name], group: null };
    order.push(name);
  }
  _steps = { steps, order };
  return _steps;
}

export function needsSeedAuth(name) {
  return NEED_SEED_BASE.has(name) || name.startsWith('i2-');
}
export function needsOrphanSeed(name) {
  return NEED_ORPHAN.has(name);
}
