/**
 * Reset public + migracje 0001…0135 + seed na TEST_DB_URL.
 * Windows psql: zawsze -d URI.
 * 0031: na free test trigger na spatial_ref_sys bywa bez uprawnień — funkcja i tak powstaje.
 */
import { readdirSync, writeFileSync, unlinkSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import pg from 'pg';

const PROD = 'nglnnrmzmhusvxslousq';

/** Nie wypisuj URI ani haseł. */
export function redactSecrets(text) {
  return String(text ?? '')
    .replace(/postgres(?:ql)?:\/\/[^\s'"\\]+/gi, 'postgres://***')
    .replace(/((?:password|secret|service_role|access_token)=)([^\s&]+)/gi, '$1***');
}

function pgClient(url) {
  return new pg.Client({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000,
  });
}

export function refuseProdUrl(url) {
  if (!url || url.includes(PROD)) {
    console.error('ODMOWA: URL produkcji lub pusty');
    process.exit(2);
  }
}

function psqlFile(psqlBin, url, file, { stopOnError = true } = {}) {
  const hosted = /supabase\.(co|com)/i.test(url) || url.includes('emkbykwenwrjmbprydml');
  let runFile = file;
  let tmp = null;
  if (hosted) {
    // PGOPTIONS bywa za słabe dla CREATE FUNCTION … geometry; SET w tym samym pliku -f działa.
    tmp = join(tmpdir(), `tower-mig-${process.pid}-${Date.now()}.sql`);
    writeFileSync(
      tmp,
      `SET search_path TO public, extensions;\n${readFileSync(file, 'utf8')}`,
      'utf8',
    );
    runFile = tmp;
  }
  const args = ['-d', url, '-q', '-f', runFile];
  if (stopOnError) args.splice(3, 0, '-v', 'ON_ERROR_STOP=1');
  try {
    return spawnSync(psqlBin, args, {
      encoding: 'utf8',
      env: {
        ...process.env,
        PGOPTIONS: `${process.env.PGOPTIONS || ''} -c search_path=public,extensions`.trim(),
        PGTZ: process.env.PGTZ || 'Europe/Warsaw',
      },
    });
  } finally {
    if (tmp) {
      try {
        unlinkSync(tmp);
      } catch {
        /* ignore */
      }
    }
  }
}

export async function resetPublic(url) {
  refuseProdUrl(url);
  const TEST_REF = 'emkbykwenwrjmbprydml';
  if (!url.includes(TEST_REF)) {
    console.error('ODMOWA: reset schematu tylko na projekcie testowym');
    process.exit(2);
  }
  const client = pgClient(url);
  await client.connect();
  // DR-TEST zostawia restore_RRRRMMDD. DROP public go nie rusza, a information_schema
  // liczy kolumny ze wszystkich schematów (risks.sh: title_key = 2 zamiast 1).
  const extra = await client.query(
    `select nspname from pg_namespace where nspname ~ '^restore_[0-9]{8}$' order by 1`,
  );
  for (const row of extra.rows) {
    const name = String(row.nspname);
    if (!/^restore_[0-9]{8}$/.test(name)) continue;
    await client.query(`drop schema ${name} cascade`);
    console.log(`reset: DROP SCHEMA ${name} CASCADE`);
  }
  // P0b: sieroty (extnamespace bez nspname) → extensions. Typy używane przy
  // „SET search_path = public” (geometry, citext) muszą być w public po resecie.
  for (const ext of ['postgis', 'citext', 'btree_gist']) {
    const loc = await client.query(
      `select n.nspname
         from pg_extension e
         left join pg_namespace n on n.oid = e.extnamespace
        where e.extname = $1`,
      [ext],
    );
    if (loc.rowCount === 0) continue;
    if (loc.rows[0].nspname != null) continue;
    try {
      await client.query(`alter extension ${ext} set schema extensions`);
      console.log(`reset: ${ext} sierota → extensions`);
    } catch (e) {
      console.log(`reset: ${ext} sierota (${String(e.message || e).slice(0, 80)})`);
    }
  }
  console.log('reset: DROP SCHEMA public CASCADE');
  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.query('GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role');
  await client.query('GRANT ALL ON SCHEMA public TO postgres, service_role');
  await client.query('GRANT USAGE ON SCHEMA public TO anon, authenticated');
  for (const ext of ['postgis', 'citext', 'btree_gist']) {
    const loc = await client.query(
      `select n.nspname from pg_extension e
       left join pg_namespace n on n.oid = e.extnamespace where e.extname = $1`,
      [ext],
    );
    if (loc.rowCount > 0 && loc.rows[0].nspname === 'public') continue;
    if (loc.rowCount > 0 && loc.rows[0].nspname != null && loc.rows[0].nspname !== 'public') {
      await client.query(`drop extension ${ext} cascade`);
      console.log(`reset: drop ${ext} (było ${loc.rows[0].nspname})`);
    }
    await client.query(`create extension if not exists ${ext} with schema public`);
    console.log(`reset: ${ext} w schema public`);
  }
  await client.query(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, service_role, anon, authenticated',
  );
  await client.query(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, service_role, anon, authenticated',
  );
  await client.query(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO postgres, service_role, anon, authenticated',
  );
  // Hosted: storage.* przeżywa DROP public; bezpośrednie DELETE bywa zablokowane triggerem.
  try {
    await client.query('begin');
    await client.query(`set local session_replication_role = replica`);
    const del = await client.query(
      `delete from storage.objects
        where bucket_id in ('dokumenty','zdjecia','faktury','harmonogramy')`,
    );
    await client.query('commit');
    console.log(`reset: storage.objects usunięte=${del.rowCount}`);
  } catch (e) {
    await client.query('rollback').catch(() => {});
    console.log(`reset: storage.objects pominięte (${String(e.message || e).slice(0, 100)})`);
  }
  await client.end();
}

const REPO_ROOT = resolve(import.meta.dirname, '../..');
const MIGRATION_DIR = join(REPO_ROOT, 'supabase', 'migrations');
const SEED_FILE = join(REPO_ROOT, 'tests', 'db', 'seed.sql');

/** Nazwa pliku migracji z katalogu repo — bez .. i separatorów. */
function migrationName(f) {
  const name = basename(String(f));
  if (name !== f || name.includes('..') || !/^\d{4}_[A-Za-z0-9_]+\.sql$/.test(name)) {
    console.error('ODMOWA: nazwa migracji');
    process.exit(1);
  }
  return name;
}

export function listMigrationFiles() {
  const migrations = readdirSync(MIGRATION_DIR)
    .map((f) => migrationName(f))
    .filter((f) => /^\d{4}_[A-Za-z0-9_]+\.sql$/.test(f))
    .sort();
  if (!migrations.length) {
    console.error('ODMOWA: brak migracji');
    process.exit(1);
  }
  for (let i = 0; i < migrations.length; i++) {
    const n = Number(migrations[i].slice(0, 4));
    if (n !== i + 1) {
      console.error(`ODMOWA: dziura w numerach migracji przy ${migrations[i]}`);
      process.exit(1);
    }
  }
  return migrations;
}

export async function applyMigrationsAndSeed(_root, url, psqlBin) {
  const migrations = listMigrationFiles();
  console.log(`migracje: ${migrations[0]} … ${migrations[migrations.length - 1]} (${migrations.length})`);
  for (const f of migrations) {
    const path = join(MIGRATION_DIR, migrationName(f));
    if (f.startsWith('0031_')) {
      // Najpierw funkcja (zawsze); trigger może dostać permission denied na free test.
      const r = psqlFile(psqlBin, url, path, { stopOnError: false });
      const err = `${r.stderr || ''}${r.stdout || ''}`;
      if (r.status !== 0 && !/permission denied for table spatial_ref_sys/i.test(err)) {
        console.error(`MIGRACJA ${f} BŁĄD:`, redactSecrets(err).slice(0, 2000));
        process.exit(1);
      }
      if (/permission denied for table spatial_ref_sys/i.test(err)) {
        console.log(`  WARN ${f}: trigger pominięty (brak uprawnień na spatial_ref_sys w projekcie testowym)`);
      }
      process.stdout.write('.');
      continue;
    }
    const r = psqlFile(psqlBin, url, path, { stopOnError: true });
    if (r.status !== 0) {
      console.error(`MIGRACJA ${f} BŁĄD:`, redactSecrets(r.stderr || r.stdout || '').slice(0, 2000));
      process.exit(1);
    }
    process.stdout.write('.');
  }
  console.log('\nseed…');
  const seed = psqlFile(psqlBin, url, SEED_FILE, { stopOnError: true });
  if (seed.status !== 0) {
    console.error('SEED BŁĄD:', redactSecrets(seed.stderr || seed.stdout || '').slice(0, 2000));
    process.exit(1);
  }
  const client = pgClient(url);
  await client.connect();
  const n = await client.query(
    `select count(*)::int as n from information_schema.tables where table_schema='public' and table_name='loads'`,
  );
  const u = await client.query(`select count(*)::int as n from app_users`);
  await client.end();
  console.log(`verify loads=${n.rows[0].n} app_users=${u.rows[0].n}`);
  if (n.rows[0].n !== 1 || u.rows[0].n < 3) {
    console.error('VERIFY FAIL po migracjach/seed');
    process.exit(1);
  }
  return migrations[migrations.length - 1];
}
