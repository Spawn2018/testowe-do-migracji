/**
 * Reset public + migracje 0001…0097 + seed na TEST_DB_URL.
 * Windows psql: zawsze -d URI.
 * 0031: na free test trigger na spatial_ref_sys bywa bez uprawnień — funkcja i tak powstaje.
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const PROD = 'nglnnrmzmhusvxslousq';

export function refuseProdUrl(url) {
  if (!url || url.includes(PROD)) {
    console.error('ODMOWA: URL produkcji lub pusty');
    process.exit(2);
  }
}

function psqlFile(psqlBin, url, file, { stopOnError = true } = {}) {
  const args = ['-d', url, '-q', '-f', file];
  if (stopOnError) args.splice(3, 0, '-v', 'ON_ERROR_STOP=1');
  return spawnSync(psqlBin, args, { encoding: 'utf8' });
}

export async function resetPublic(url) {
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('reset: DROP SCHEMA public CASCADE');
  await client.query('DROP SCHEMA IF EXISTS public CASCADE');
  await client.query('CREATE SCHEMA public');
  await client.query('GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role');
  await client.query('GRANT ALL ON SCHEMA public TO postgres, service_role');
  await client.query('GRANT USAGE ON SCHEMA public TO anon, authenticated');
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

export async function applyMigrationsAndSeed(root, url, psqlBin) {
  const migrations = readdirSync(join(root, 'supabase/migrations'))
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort();
  if (migrations.length !== 100) {
    console.error(`Oczekiwano 100 migracji, jest ${migrations.length}`);
    process.exit(1);
  }
  console.log(`migracje: ${migrations[0]} … ${migrations[migrations.length - 1]} (${migrations.length})`);
  for (const f of migrations) {
    const path = join(root, 'supabase/migrations', f);
    if (f.startsWith('0031_')) {
      // Najpierw funkcja (zawsze); trigger może dostać permission denied na free test.
      const r = psqlFile(psqlBin, url, path, { stopOnError: false });
      const err = `${r.stderr || ''}${r.stdout || ''}`;
      if (r.status !== 0 && !/permission denied for table spatial_ref_sys/i.test(err)) {
        console.error(`MIGRACJA ${f} BŁĄD:`, err.slice(0, 2000));
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
      console.error(`MIGRACJA ${f} BŁĄD:`, (r.stderr || r.stdout || '').slice(0, 2000));
      process.exit(1);
    }
    process.stdout.write('.');
  }
  console.log('\nseed…');
  const seed = psqlFile(psqlBin, url, join(root, 'tests/db/seed.sql'), { stopOnError: true });
  if (seed.status !== 0) {
    console.error('SEED BŁĄD:', (seed.stderr || seed.stdout || '').slice(0, 2000));
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
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
}
