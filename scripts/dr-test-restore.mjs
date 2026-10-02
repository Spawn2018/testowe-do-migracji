/**
 * DR-TEST restore (Windows-safe): age → gunzip → COPY via pg-copy-streams.
 * Nie wypisuje sekretów / klucza.
 *
 *   node scripts/dr-test-restore.mjs
 */
import { readFileSync, mkdtempSync, rmSync, createWriteStream, createReadStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync, spawn } from 'node:child_process';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import pg from 'pg';
import { from as copyFrom } from 'pg-copy-streams';

const ROOT = join(import.meta.dirname, '..');
const DIR = 'D:\\Watch Tower\\dane\\restore-dr-test\\daily-2026-10-02';
const AGE_IDENTITY = 'D:\\Watch Tower\\dane\\klucz\\tower-backup-age-key.txt';
const PROD = 'nglnnrmzmhusvxslousq';
const TEST = 'emkbykwenwrjmbprydml';

function envGet(name) {
  for (const line of readFileSync(join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    if (line.slice(0, i).trim() === name) {
      let v = line.slice(i + 1);
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      return v;
    }
  }
  return '';
}

function ageDecrypt(src, dest) {
  const r = spawnSync('age', ['-d', '-i', AGE_IDENTITY, '-o', dest, src], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`age fail: ${(r.stderr || r.stdout || '').slice(0, 200)}`);
}

async function ageDecryptGunzip(src, destCsv) {
  await new Promise((resolve, reject) => {
    const age = spawn('age', ['-d', '-i', AGE_IDENTITY, src], { stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    age.stderr.on('data', (d) => {
      err += d;
    });
    age.on('error', reject);
    age.on('close', (code) => {
      if (code !== 0) reject(new Error(`age ${code}: ${err.slice(0, 200)}`));
    });
    pipeline(age.stdout, createGunzip(), createWriteStream(destCsv)).then(resolve).catch(reject);
  });
}

const url = envGet('TEST_DB_URL');
if (!url.includes(TEST) || url.includes(PROD)) throw new Error('TEST only');
readFileSync(AGE_IDENTITY); // istnieje

const start = Date.now();
console.log('START', new Date().toISOString());

const TMP = mkdtempSync(join(tmpdir(), 'tower-restore-'));
const manifestPath = join(TMP, 'manifest.json');
ageDecrypt(join(DIR, 'manifest.json.age'), manifestPath);
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const tables = Object.keys(manifest.tables);
const schema = `restore_${String(manifest.created_at).slice(0, 10).replace(/-/g, '')}`;
if (!/^restore_[a-z0-9_]+$/.test(schema)) throw new Error('zły schemat');

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  await client.query(`create schema if not exists ${schema}`);
  let n = 0;
  let rows = 0;
  const bad = [];

  for (const t of tables) {
    if (!/^[a-z_]+$/.test(t)) throw new Error(`nazwa tabeli ${t}`);
    const csv = join(TMP, `${t}.csv`);
    await ageDecryptGunzip(join(DIR, `${t}.csv.gz.age`), csv);
    const header = readFileSync(csv, 'utf8').split(/\r?\n/, 1)[0];
    if (!header || !/^[a-z0-9_, ]+$/i.test(header)) throw new Error(`zły nagłówek ${t}`);

    await client.query(`drop table if exists ${schema}.${t}`);
    await client.query(`create table ${schema}.${t} (like public.${t})`);

    const copySql = `COPY ${schema}.${t} (${header}) FROM STDIN WITH (FORMAT csv, HEADER true)`;
    const stream = client.query(copyFrom(copySql));
    await pipeline(createReadStream(csv), stream);

    const got = Number((await client.query(`select count(*)::int as n from ${schema}.${t}`)).rows[0].n);
    const exp = Number(manifest.tables[t]);
    if (got !== exp) bad.push(`${t}(${got}≠${exp})`);
    n += 1;
    rows += got;
    process.stdout.write('.');
  }
  console.log('');
  if (bad.length) {
    console.log('RESTORE FAIL: liczba wierszy:', bad.join(' '));
    process.exitCode = 1;
  } else {
    console.log(`RESTORE OK tabel=${n} wierszy=${rows} tryb=schema schemat=${schema}`);
  }
} finally {
  await client.end().catch(() => {});
  rmSync(TMP, { recursive: true, force: true });
}

console.log('END', new Date().toISOString());
console.log(`ELAPSED_SEC=${Math.round((Date.now() - start) / 1000)}`);
