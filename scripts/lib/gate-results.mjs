/**
 * Wyniki bramy: tmp-gate/wyniki.json (poza gitem). Dopisywanie, bez kasowania innych commitów.
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { listMigrationFiles } from './test-db-migrate.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
export const RESULTS_PATH = resolve(ROOT, 'tmp-gate/wyniki.json');

export function redactSecrets(text) {
  return String(text ?? '')
    .replace(/postgres(?:ql)?:\/\/[^\s'"\\]+/gi, 'postgres://***')
    .replace(/((?:password|secret|service_role|access_token)=)([^\s&]+)/gi, '$1***');
}

export function gitCommit() {
  const r = spawnSync('git', ['-c', 'filter.lfs.process=', '-c', 'filter.lfs.required=false', 'rev-parse', 'HEAD'], {
    cwd: ROOT, encoding: 'utf8',
  });
  if (r.status !== 0) {
    console.error('ODMOWA: brak git HEAD');
    process.exit(1);
  }
  return r.stdout.trim();
}

export function lastMigration() {
  const files = listMigrationFiles();
  return files[files.length - 1];
}

/** ISO 8601 z offsetem Europe/Warsaw. */
export function warsawIso(d = new Date()) {
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Warsaw',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const p = Object.fromEntries(dtf.formatToParts(d).map((x) => [x.type, x.value]));
  const asUtc = Date.parse(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}Z`);
  const offsetMin = Math.round((asUtc - d.getTime()) / 60000);
  const sign = offsetMin >= 0 ? '+' : '-';
  const ah = String(Math.floor(Math.abs(offsetMin) / 60)).padStart(2, '0');
  const am = String(Math.abs(offsetMin) % 60).padStart(2, '0');
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}${sign}${ah}:${am}`;
}

function readStore() {
  try {
    const raw = readFileSync(RESULTS_PATH, 'utf8');
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.entries)) throw new Error('zły kształt');
    return data;
  } catch (e) {
    if (e && e.code === 'ENOENT') return { entries: [] };
    console.error(`ODMOWA: ${RESULTS_PATH} nie do odczytu — nie nadpisuję`);
    process.exit(1);
  }
}

export function appendResult(entry) {
  const data = readStore();
  const row = {
    suite: entry.suite,
    ok: entry.ok,
    fail: entry.fail,
    skip: entry.skip,
    expected: entry.expected,
    commit: entry.commit,
    migration: entry.migration,
    at: entry.at || warsawIso(),
    status: entry.status,
  };
  for (const k of Object.keys(row)) {
    if (row[k] === undefined) throw new Error(`brak pola ${k}`);
  }
  data.entries.push(row);
  mkdirSync(resolve(ROOT, 'tmp-gate'), { recursive: true });
  const tmp = RESULTS_PATH + '.tmp';
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n');
  renameSync(tmp, RESULTS_PATH);
  return row;
}

/** Ostatni wpis każdego zestawu dla commita i migracji. */
export function latestFor(commit, migration) {
  const data = readStore();
  const map = new Map();
  for (const e of data.entries) {
    if (e.commit !== commit || e.migration !== migration) continue;
    map.set(e.suite, e);
  }
  return map;
}
