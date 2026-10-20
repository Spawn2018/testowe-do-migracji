/**
 * Jedno źródło oczekiwanych OK bramy bazy (P0b).
 * LOCAL = tests/db/gate.sh / CI db.yml; TEST = hosted emkbykwenwrjmbprydml.
 * Różnice TEST: security −4, risks −2, backup −8 (SKIP spatial_ref_sys / CREATE DATABASE / eksport+odtworzenie).
 * session / l13: zamknięte w 0218 (truck_ban active + L-13 DIGEST / decision_id).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = resolve(import.meta.dirname, '../..');

/** Oczekiwane OK na lokalnym Postgresie (gate.sh). */
export const EXPECTED_LOCAL = {
  security: 118, // A8 +3: emtrack_login_state bez SELECT, zero SOURCE_DOWN:EMTRACK_WEB:%
  status: 133, // A5: +9 + F7 source SCHEDULE/GPS + ETA Stena > Polferries
  storage: 37,
  money: 174, // A4 F7: +przywróć L5 / INVOICED przed zmianą kwoty (+2)
  release: 146,
  backup: 29,
  session: 33, // +6 my_session_revoke (D-20261014-1420-01 R3); 0218 truck_ban_holidays active
  archive: 18,
  watchdog: 27,
  invite: 48,
  risks: 33, // +6 D-20261018-1215-01 (w tym RES:DRIVER); wcześniej 27 (C1)
  import: 66,
  nullguard: 685, // A4: +update_invoice GUARD (+4 vs 681)
  i2: 553, // A7 F7 P9: KSH bez polisy SCX + asercja HHL widzi
  i30: 10,
  i31: 9,
  dec2: 42, // A3: katalog typów 19→20 (CMR_UPLOAD); liczba asercji bez zmian
  dec3: 13,
  dec5: 11,
  dec6: 25, // +2 B7 ETA_CONF_* (D-0300); wcześniej 23
  adm10: 8,
  hist11: 11,
  workflows: 67,
  insurance: 44, // A7 F7 P2: visible_to polisy SCX po document_id (+2)
  'dec-auto': 78, // D-0040: FERRY_CANCELLED i workflow e-mail SCX bez numeru KSH
  dwell: 17,
  l13: 34, // 0218: DIGEST przez l13_queue_email + e-mail DECISION w teście (było 21 OK / 13 FAIL)
  l12: 12,
  h1: 14,
  h3: 20,
  smsksh: 16,
  'ferry-status': 8,
  bmapa: 33,
  h4: 19,
  aud03: 32, // D-0005 F7: +OPS, by=HHL_ADMIN, P2 bez sprawy, ASK_FIX/DECISION_HOLD
  g20: 15, // P3-poprawki — G-20; D-0005: HHL_ADMIN może daty (err→val)
  baf: 45,
  e18: 41, // P1 — porządki E18 (0193), D-20261012-2335-01 K8
  e41: 36, // P2 + P2-poprawki; A4 +6 kolumny; A2 +4 (msgs_read + loads_read / drugi SCX, D-0330)
  e25: 79, // A4: +1 READY z CMR sprzed dostawy → odmowa
  'c16-push': 18, // C16 N8 + C16-H H5 (D-20261015-1955-01, D-20261016-0100-01)
  c3: 26, // C3-p + A4 inv_overdue/updated/corrected (asercja 28 event_key w c3.sh)
};

/**
 * Oczekiwane OK na hosted TEST.
 * security/risks/backup: SKIP (spatial_ref_sys free / tower_test_status CREATE DATABASE /
 *   backup: CREATE DATABASE + eksport harness — pełne 29 w CI db.yml, D-86).
 * Pozostałe = LOCAL (P0b: wyrównanie do gate.sh).
 */
export const EXPECTED_TEST = {
  ...EXPECTED_LOCAL,
  security: 114, // 118 − 4 SKIP (B6)
  risks: 31, // 33 − 2 SKIP (C1)
  // dec6: 25 − 4 SKIP — wstawki auth.sessions dla kont seeda (FK → auth.users); lokalnie/CI bez FK (stub)
  dec6: 21,
  backup: 21, // 29 − 8 SKIP (eksport/odtworzenie / CREATE DATABASE)
};

/** Alias historyczny — brama TEST / summary. */
export const EXPECTED = EXPECTED_TEST;

/** Zestawy uruchamiane w gate.sh, ale bez check liczby (puste po 0218). */
export const KNOWN_DEBT = new Set();

export const SUITE_FILE = {
  security: 'security.sh',
  status: 'status.sh',
  storage: 'storage.sh',
  money: 'money.sh',
  release: 'release.sh',
  backup: 'backup.sh',
  session: 'session.sh',
  archive: 'archive.sh',
  watchdog: 'watchdog.sh',
  invite: 'invite.sh',
  risks: 'risks.sh',
  import: 'import.sh',
  nullguard: 'nullguard.sh',
  i2: 'i2.sh',
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
  dwell: 'dwell.sh',
  l13: 'l13.sh',
  l12: 'l12.sh',
  h1: 'h1.sh',
  h3: 'h3.sh',
  smsksh: 'smsksh.sh',
  'ferry-status': 'ferry-status.sh',
  bmapa: 'bmapa.sh',
  h4: 'h4.sh',
  aud03: 'aud03.sh',
  g20: 'g20.sh',
  baf: 'baf.sh',
  e18: 'e18.sh',
  e41: 'e41.sh',
  e25: 'e25.sh',
  'c16-push': 'c16-push.sh',
  c3: 'c3.sh',
};

/** Jak uruchamiać lokalnie: boot = własna baza, tower = kopia tower_boot, pair = run.sh. */
export const LOCAL_RUN = {
  security: 'pair',
  status: 'pair',
  storage: 'boot',
  money: 'boot',
  release: 'boot',
  backup: 'boot',
  session: 'boot',
  archive: 'boot',
  watchdog: 'boot',
  invite: 'boot',
  risks: 'boot',
  import: 'boot',
  nullguard: 'boot',
  i2: 'boot',
  i30: 'boot',
  i31: 'boot',
  dec2: 'boot',
  dec3: 'boot',
  dec5: 'tower',
  dec6: 'tower',
  adm10: 'tower',
  hist11: 'tower',
  workflows: 'boot',
  insurance: 'boot',
  'dec-auto': 'tower',
  dwell: 'tower',
  l13: 'tower',
  l12: 'tower',
  h1: 'tower',
  h3: 'tower',
  smsksh: 'tower',
  'ferry-status': 'tower',
  bmapa: 'tower',
  h4: 'tower',
  aud03: 'tower',
  g20: 'tower',
  baf: 'boot',
  e18: 'boot',
  e41: 'tower',
  e25: 'tower',
  'c16-push': 'tower',
  c3: 'boot',
};

/** Kolejność lokalnej bramy (jak dawny gate.sh). */
export const LOCAL_ORDER = [
  'security', 'status', 'storage', 'money', 'release', 'backup', 'session', 'archive',
  'watchdog', 'invite', 'risks', 'import', 'nullguard', 'i2', 'i30', 'i31', 'dec2', 'dec3',
  'dec5', 'dec6', 'adm10', 'hist11', 'workflows', 'insurance', 'dec-auto', 'dwell', 'l13',
  'l12', 'h1', 'h3', 'smsksh', 'ferry-status', 'bmapa', 'h4', 'aud03', 'g20', 'baf', 'e18', 'e41', 'e25', 'c16-push', 'c3',
];

const NEED_SEED_BASE = new Set(['session']);
const NEED_ORPHAN = new Set(['invite']);

function callLines() {
  return readFileSync(resolve(ROOT, 'tests/db/null-guard-calls.txt'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.trim().startsWith('#'));
}

/**
 * nullguard-1..3 z listy wywołań; nullguard-4 = reszta do EXPECTED_TEST.nullguard
 * (kompletność + odmowy + kontrola pozytywna / helpery / static).
 */
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
  const rest = EXPECTED_TEST.nullguard - head;
  if (rest < 1) {
    throw new Error(`nullguard: części 1–3 dają ${head}, EXPECTED_TEST.nullguard=${EXPECTED_TEST.nullguard}`);
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
  if (sum !== EXPECTED_TEST.i2) {
    throw new Error(`i2: suma części ${sum} !== ${EXPECTED_TEST.i2}`);
  }
  if (names.length < 2) throw new Error('i2: brak podziału na części');
  const ordered = {};
  for (const n of names) ordered[n] = parts[n];
  return ordered;
}

/** Kolejność kroków bramy TEST (prep + części nullguard/i2). */
let _steps;
export function gateSteps() {
  if (_steps) return _steps;
  const ng = nullguardParts();
  const i2 = i2Parts();
  const steps = {};
  const order = ['prep'];
  // session / l13 — asertowane od 0218 (wcześniej KNOWN-DEBT).
  const whole = [
    'security', 'status', 'storage', 'money', 'release', 'archive', 'watchdog', 'invite', 'risks', 'import',
  ];
  for (const name of whole) {
    steps[name] = { file: SUITE_FILE[name], env: {}, expected: EXPECTED_TEST[name], group: null };
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
  const rest = [
    'i30', 'i31', 'dec2', 'dec3', 'dec5', 'dec6', 'adm10', 'hist11', 'workflows', 'insurance', 'dec-auto',
    'dwell', 'l12', 'h1', 'h3', 'smsksh', 'ferry-status', 'bmapa', 'h4', 'aud03', 'g20', 'baf', 'e18', 'e41', 'e25', 'c16-push', 'c3', 'backup',
  ];
  for (const name of rest) {
    if (!SUITE_FILE[name] || EXPECTED_TEST[name] == null) {
      throw new Error(`gate-suites: brak pliku/oczekiwanej dla ${name}`);
    }
    steps[name] = { file: SUITE_FILE[name], env: {}, expected: EXPECTED_TEST[name], group: null };
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

export function parseSuitesFilter(raw) {
  if (raw == null || String(raw).trim() === '') return null;
  const list = String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const s of list) {
    if (!LOCAL_ORDER.includes(s)) throw new Error(`SUITES: nieznany zestaw "${s}"`);
  }
  return list;
}

/** CLI: --local-expected | --test-expected | --local-order | --file NAME | --check */
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const cmd = process.argv[2] || '--local-expected';
  if (cmd === '--local-expected') {
    for (const [k, v] of Object.entries(EXPECTED_LOCAL)) console.log(`${k}=${v}`);
  } else if (cmd === '--test-expected') {
    for (const [k, v] of Object.entries(EXPECTED_TEST)) console.log(`${k}=${v}`);
  } else if (cmd === '--local-order') {
    for (const s of LOCAL_ORDER) console.log(s);
  } else if (cmd === '--debt') {
    for (const s of KNOWN_DEBT) console.log(s);
  } else if (cmd === '--file') {
    const name = process.argv[3];
    const f = SUITE_FILE[name];
    if (!f) {
      console.error(`brak pliku dla ${name}`);
      process.exit(2);
    }
    console.log(f);
  } else if (cmd === '--run') {
    const name = process.argv[3];
    const m = LOCAL_RUN[name];
    if (!m) {
      console.error(`brak LOCAL_RUN dla ${name}`);
      process.exit(2);
    }
    console.log(m);
  } else if (cmd === '--check') {
    gateSteps();
    console.log('gate-suites OK');
  } else {
    console.error(
      'Użycie: node scripts/lib/gate-suites.mjs --local-expected|--test-expected|--local-order|--debt|--file NAME|--run NAME|--check',
    );
    process.exit(2);
  }
}
