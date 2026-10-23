/**
 * ANEKS 4 PR2 — codzienna kopia zapasowa (02:30, pg_cron → pg_net → ta funkcja, klucz service role).
 *  1. COPY każdej tabeli schematu public z katalogu minus jawne wyłączenia (I-2B; bez surowych pozycji GPS) do CSV, gzip, szyfrowanie age X25519
 *     KLUCZEM PUBLICZNYM (BACKUP_AGE_RECIPIENT); klucz prywatny wyłącznie u właściciela, offline.
 *  2. Zapis do Cloudflare R2 przez Worker tower-backup-writer (wiązanie R2, tylko PUT nowego obiektu,
 *     nagłówek X-Backup-Secret; bez klucza R2 i bez S3): daily/RRRR-MM-DD/<tabela>.csv.gz.age + manifest.json.age;
 *     pierwszego dnia miesiąca kopia także do monthly/RRRR-MM/. Ponowny przebieg tego samego dnia → katalog z godziną.
 *  3. Pliki (Storage): przyrostowo — dokumenty wgrane od ostatniej udanej kopii oraz obiekty kubełków BACKUP_BUCKETS
 *     (I-2B: harmonogramy) → files/<kubeł>/<ścieżka>.age.
 *  0. Blokada współbieżności: backup_run_begin() (0044) — równoległy start kończy się wpisem SKIPPED.
 *  4. Retencja: blokada usuwania R2 (daily 30 dni, monthly 360 dni) + reguły cyklu życia R2 (31 / 361 dni);
 *     funkcja niczego nie usuwa ani nie listuje. Przebieg w backup_runs (historia, błędy).
 *  5. #463 (F7 po #472): limit wall-clock Edge ~150 s → po WALL_BUDGET_MS kończymy wywołanie i
 *     samowywołanie z `{ continue_run }` (stan: backup_runs.tables / prefix / bytes). Cron bez zmian.
 *  6. #479: COPY bez `sql.begin` i bez `await query` po `.readable()` (wzór id 37 / PR2).
 * Sekrety: BACKUP_AGE_RECIPIENT, BACKUP_WRITER_URL, BACKUP_WRITER_SECRET.
 * SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL — platforma.
 * Utrata danych w najgorszym razie: do 24 h (kopia raz na dobę).
 */
import postgres from 'npm:postgres@3';
import { Encrypter } from 'npm:age-encryption@0.3';
import {
  BACKUP_BUCKETS, BUCKET_OBJECTS_SQL, CATALOG_TABLES_SQL, TABLE_COPY_TIMEOUT_MS, WALL_BUDGET_MS,
  assertCsvInCountWindow, assertSafeIdent, backupTables, copyCtidRangeSql, csvRowCount, ctidPageRanges,
  dailyPrefix, heapPagesFromBytes, manifest, monthlyPrefix, pastWallBudget, remainingTables, rerunPrefix,
  sealTable, sha256Hex, shouldChunkByEstimate, writerClient,
} from '../_shared/backup/core.ts';
import { isServiceRequest } from '../_shared/serviceAuth.ts';

const env = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`brak sekretu ${k}`);
  return v;
};

type EdgeWait = { waitUntil(p: Promise<unknown>): void };
function scheduleContinue(runId: number): void {
  const base = (Deno.env.get('SUPABASE_URL') ?? '').replace(/\/+$/, '');
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!base || !service) {
    console.error(JSON.stringify({ backup: 'continue_skip', runId, reason: 'brak URL/klucza' }));
    return;
  }
  const p = fetch(`${base}/functions/v1/backup-export`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${service}`,
      apikey: service,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ continue_run: runId }),
  }).then(async (r) => {
    console.log(JSON.stringify({ backup: 'continue_scheduled', runId, status: r.status }));
    try { await r.text(); } catch { /* ignore */ }
  }).catch((e) => {
    console.error(JSON.stringify({ backup: 'continue_fail', runId, err: String(e).slice(0, 200) }));
  });
  const er = (globalThis as unknown as { EdgeRuntime?: EdgeWait }).EdgeRuntime;
  if (er?.waitUntil) er.waitUntil(p);
  else void p;
}

/** A7 / E44: lista kolumn `loads` bez `rio_secret` do COPY. */
async function loadColumnsWithoutRioSecret(sql: ReturnType<typeof postgres>): Promise<string> {
  const cols = await sql<{ column_name: string }[]>`
    select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'loads' and column_name <> 'rio_secret'
     order by ordinal_position`;
  if (!cols.length) throw new Error('kopia: brak kolumn loads');
  return cols.map((c) => `"${String(c.column_name).replace(/"/g, '""')}"`).join(', ');
}

type CopyReadable = {
  on: (ev: string, fn: (...args: unknown[]) => void) => void;
  destroy?: (err?: Error) => void;
};

/** Odczyt strumienia COPY z limitem czasu (#463 — bez wiszenia do I-33). */
function readCopyStream(stream: CopyReadable, label: string, timeoutMs = TABLE_COPY_TIMEOUT_MS): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  return new Promise<Uint8Array>((res, rej) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { stream.destroy?.(); } catch { /* ignore */ }
      fn();
    };
    const timer = setTimeout(() => {
      finish(() => rej(new Error(`kopia: timeout COPY ${label} po ${timeoutMs} ms`)));
    }, timeoutMs);
    stream.on('data', (c: unknown) => chunks.push(c as Uint8Array));
    stream.on('end', () => {
      void (async () => {
        try {
          const buf = new Uint8Array(await new Blob(chunks as BlobPart[]).arrayBuffer());
          finish(() => res(buf));
        } catch (e) {
          finish(() => rej(e));
        }
      })();
    });
    stream.on('error', (e: unknown) => {
      finish(() => rej(e instanceof Error ? e : new Error(String(e))));
    });
  });
}

/**
 * COPY TO STDOUT — wyłącznie zdarzenia data/end (PR2 `ccbfd8b5`, id 37 OK w 62 s).
 *
 * #479 / id 40: po #477 (`await query` po `.readable()` w `sql.begin` RR) Edge nadal
 * IDLE_TIMEOUT 150 s na pierwszej tabeli po `audit_log` (`auth_login_events`, 85 wierszy /
 * 24 kB) — `continue_run` bez postępu. `await query` w Deno nie domyka COPY; w `catch`
 * po timeout 40 s też wisi → brak ERROR w `backup_runs`. Bez `begin`: każdy COPY to
 * osobna niejawna transakcja (jak id 37). count przed i po COPY → przedział
 * `assertCsvInCountWindow` (F7 #480); kopia nie jest migawką między tabelami.
 */
async function copySqlToCsv(
  db: { unsafe: (s: string) => Promise<unknown> & { readable: () => Promise<CopyReadable> } },
  copySql: string,
  label: string,
): Promise<Uint8Array> {
  const stream = await db.unsafe(copySql).readable();
  try {
    return await readCopyStream(stream, label);
  } catch (e) {
    try { stream.destroy?.(e instanceof Error ? e : undefined); } catch { /* ignore */ }
    throw e;
  }
}

/**
 * Jedna tabela: count(*) → COPY (mała = jeden strzał; duża = kawałki ctid) → assert liczby.
 * Bez `sql.begin` — patrz komentarz przy `copySqlToCsv` (#479).
 */
async function copyTableCsv(
  sql: ReturnType<typeof postgres>,
  table: string,
  selectList: string | null,
): Promise<Uint8Array> {
  const t = assertSafeIdent(table);
  const [meta] = await sql<{ est: string | number; bytes: string | number; block: number }[]>`
    select c.reltuples::bigint as est,
           pg_relation_size(c.oid)::bigint as bytes,
           current_setting('block_size')::int as block
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = ${table}`;
  const [cnt0] = await sql.unsafe(`select count(*)::bigint as n from public.${t}`) as { n: string | number }[];
  const n0 = Number(cnt0?.n ?? -1);
  const est = Number(meta?.est ?? 0);
  const pages = heapPagesFromBytes(Number(meta?.bytes ?? 0), Number(meta?.block ?? 8192));
  let csv: Uint8Array;
  if (!shouldChunkByEstimate(est)) {
    const copySql = selectList
      ? `copy (select ${selectList} from public.${t}) to stdout with (format csv, header true)`
      : `copy public.${t} to stdout with (format csv, header true)`;
    csv = await copySqlToCsv(sql, copySql, t);
  } else {
    const parts: Uint8Array[] = [];
    let header = true;
    for (const { from, to } of ctidPageRanges(pages)) {
      const copySql = copyCtidRangeSql(t, from, to, selectList, header);
      const label = to === null ? `${t}[${from},∞)` : `${t}[${from},${to})`;
      const part = await copySqlToCsv(sql, copySql, label);
      if (part.byteLength) parts.push(part);
      header = false;
    }
    if (!parts.length) {
      const copySql = selectList
        ? `copy (select ${selectList} from public.${t} where false) to stdout with (format csv, header true)`
        : `copy (select * from public.${t} where false) to stdout with (format csv, header true)`;
      csv = await copySqlToCsv(sql, copySql, `${t}[empty]`);
    } else {
      csv = new Uint8Array(await new Blob(parts as BlobPart[]).arrayBuffer());
    }
  }
  const [cnt1] = await sql.unsafe(`select count(*)::bigint as n from public.${t}`) as { n: string | number }[];
  const n1 = Number(cnt1?.n ?? -1);
  assertCsvInCountWindow(csvRowCount(new TextDecoder().decode(csv)), n0, n1, t);
  return csv;
}

Deno.serve(async (req) => {
  const wallStarted = Date.now();
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!service || !(await isServiceRequest(req, { url: Deno.env.get('SUPABASE_URL') ?? '', service }))) {
    return new Response('forbidden', { status: 403 });
  }

  let continueRun: number | null = null;
  try {
    const body = req.method === 'POST' ? await req.json() as { continue_run?: unknown } : {};
    if (body?.continue_run != null && body.continue_run !== '') {
      const n = Number(body.continue_run);
      if (!Number.isInteger(n) || n < 1) {
        return new Response(JSON.stringify({ ok: false, error: 'continue_run: zły id' }), {
          status: 400, headers: { 'Content-Type': 'application/json' },
        });
      }
      continueRun = n;
    }
  } catch {
    // cron / puste ciało = nowy przebieg
  }

  const sql = postgres(env('SUPABASE_DB_URL'), { max: 1, prepare: false });
  let runId: number | undefined;
  let counts: Record<string, number> = {};
  let bytes = 0;
  let prefixes: string[] = [];

  try {
    if (continueRun != null) {
      const [row] = await sql<{
        id: number; status: string; prefix: string | null; tables: Record<string, number> | null; bytes: string | number | null;
      }[]>`select id, status, prefix, tables, bytes from backup_runs where id = ${continueRun}`;
      if (!row || row.status !== 'RUNNING') {
        return new Response(JSON.stringify({ ok: false, error: `continue_run ${continueRun}: brak RUNNING` }), {
          status: 409, headers: { 'Content-Type': 'application/json' },
        });
      }
      if (!row.prefix) {
        return new Response(JSON.stringify({ ok: false, error: `continue_run ${continueRun}: brak prefix` }), {
          status: 409, headers: { 'Content-Type': 'application/json' },
        });
      }
      runId = Number(row.id);
      counts = row.tables && typeof row.tables === 'object' ? { ...row.tables } : {};
      bytes = Number(row.bytes ?? 0) || 0;
      prefixes = [row.prefix];
      const now = new Date();
      if (now.getUTCDate() === 1) {
        const m = monthlyPrefix(now);
        if (!prefixes.includes(m)) prefixes.push(m);
      }
      console.log(JSON.stringify({
        backup: 'continue', runId, done: Object.keys(counts).length, bytes, prefix: row.prefix,
      }));
    } else {
      const [begin] = await sql`select run_id, run_status from backup_run_begin()`;
      if (begin.run_status !== 'RUNNING') {
        return new Response(JSON.stringify({ ok: true, skipped: true, run: begin.run_id }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
      runId = Number(begin.run_id);
      const now = new Date();
      prefixes = [dailyPrefix(now), ...(now.getUTCDate() === 1 ? [monthlyPrefix(now)] : [])];
      const writer0 = writerClient(env('BACKUP_WRITER_URL'), env('BACKUP_WRITER_SECRET'));
      const probe = new TextEncoder().encode(JSON.stringify({ run: runId, at: now.toISOString() }));
      prefixes = await Promise.all(prefixes.map(async (p) => ((await writer0(`${p}_run.json`, probe)) === 'CREATED' ? p : rerunPrefix(p, now))));
      for (const p of prefixes) if (/-\d{6}\/$/.test(p)) await writer0(`${p}_run.json`, probe).then(() => undefined);
      await sql`update backup_runs set prefix = ${prefixes[0]} where id = ${runId}`;
      console.log(JSON.stringify({ backup: 'start', runId, prefix: prefixes[0], budgetMs: WALL_BUDGET_MS }));
    }

    const recipient = env('BACKUP_AGE_RECIPIENT');
    if (!recipient.startsWith('age1')) throw new Error('BACKUP_AGE_RECIPIENT musi być kluczem publicznym age (age1…)');
    const encrypt = async (plain: Uint8Array) => { const e = new Encrypter(); e.addRecipient(recipient); return await e.encrypt(plain); };
    const writer = writerClient(env('BACKUP_WRITER_URL'), env('BACKUP_WRITER_SECRET'));
    /** Manifest — bez nadpisania. Tabele: EXISTS OK (ponowienie po 502 po PUT, przed update backup_runs). */
    const putNew = async (key: string, body: Uint8Array) => {
      if ((await writer(key, body)) === 'EXISTS') throw new Error(`R2: obiekt ${key} już istnieje (nadpisanie zabronione)`);
    };
    const putTable = async (key: string, body: Uint8Array) => {
      await writer(key, body); // CREATED | EXISTS
    };

    const catalog = (await sql.unsafe(CATALOG_TABLES_SQL)).map((r) => String(r.name));
    const tables = backupTables(catalog);
    const left = remainingTables(tables, counts);
    const loadsCols = left.includes('loads') || tables.includes('loads')
      ? await loadColumnsWithoutRioSecret(sql)
      : null;

    for (const t of left) {
      if (pastWallBudget(wallStarted)) {
        console.log(JSON.stringify({
          backup: 'budget', runId, ms: Date.now() - wallStarted, done: Object.keys(counts).length, next: t,
        }));
        scheduleContinue(runId);
        return new Response(JSON.stringify({
          ok: true, continued: true, run: runId, tables: counts, bytes, ms: Date.now() - wallStarted,
        }), { headers: { 'Content-Type': 'application/json' } });
      }

      const t0 = Date.now();
      const csv = await copyTableCsv(sql, t, t === 'loads' ? loadsCols : null);
      const rows = csvRowCount(new TextDecoder().decode(csv));
      counts[t] = rows;
      const sealed = await sealTable(csv, encrypt);
      bytes += sealed.byteLength;
      for (const p of prefixes) await putTable(`${p}${t}.csv.gz.age`, sealed);
      await sql`update backup_runs set tables = ${sql.json(counts)}, bytes = ${bytes}, prefix = ${prefixes[0]} where id = ${runId}`;
      console.log(JSON.stringify({
        backup: 'table', runId, table: t, rows, ms: Date.now() - t0, wallMs: Date.now() - wallStarted,
      }));
    }

    // pliki: przyrostowo od ostatniej udanej kopii
    const [last] = await sql`select max(started_at) as at from backup_runs where status = 'OK'`;
    const docs = await sql`select id, storage_path from documents
                           where storage_path not in ('', '-') and archived_at is null
                             and uploaded_at > coalesce(${last?.at ?? null}::timestamptz, 'epoch')`;
    const objs = await sql.unsafe(BUCKET_OBJECTS_SQL, [BACKUP_BUCKETS as unknown as string[], null]);
    const items = [
      ...docs.map((d) => ({ path: String(d.storage_path), ref: { document_id: String(d.id) } })),
      ...objs.map((o) => ({ path: String(o.storage_path), ref: { object_id: String(o.id) } })),
    ];
    const files: { key: string; document_id?: string; object_id?: string; bytes: number; size: number; sha256: string }[] = [];
    const sb = items.length
      ? (await import('npm:@supabase/supabase-js@2')).createClient(env('SUPABASE_URL'), service, { auth: { persistSession: false } })
      : null;
    for (const d of items) {
      const [bucket, ...rest] = d.path.split('/');
      const dl = await sb!.storage.from(bucket).download(rest.join('/'));
      if (dl.error || !dl.data) continue;
      const plain = new Uint8Array(await dl.data.arrayBuffer());
      const sealed = await encrypt(plain);
      const key = `files/${d.path}.age`;
      if ((await writer(key, sealed)) === 'EXISTS') continue;
      files.push({ key, ...d.ref, bytes: sealed.byteLength, size: plain.byteLength, sha256: await sha256Hex(plain) });
      bytes += sealed.byteLength;
    }
    const now = new Date();
    const man = new TextEncoder().encode(JSON.stringify(manifest(prefixes[0], recipient, counts, files, now), null, 2));
    for (const p of prefixes) await putNew(`${p}manifest.json.age`, await encrypt(man));
    await sql`update backup_runs set status = 'OK', finished_at = now(), prefix = ${prefixes[0]},
              tables = ${sql.json(counts)}, files = ${files.length}, bytes = ${bytes} where id = ${runId}`;
    console.log(JSON.stringify({
      backup: 'ok', runId, tables: Object.keys(counts).length, files: files.length, bytes, ms: Date.now() - wallStarted,
    }));
    return new Response(JSON.stringify({
      ok: true, prefix: prefixes[0], tables: counts, files: files.length, bytes, run: runId,
    }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try {
      if (runId != null) {
        await sql`update backup_runs set status = 'ERROR', finished_at = now(), error = ${msg.slice(0, 1000)} where id = ${runId}`;
      }
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500 });
  } finally {
    try { await sql.end(); } catch { /* ignore */ }
  }
});
