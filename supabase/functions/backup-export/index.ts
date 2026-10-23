/**
 * ANEKS 4 PR2 — codzienna kopia zapasowa (02:30, pg_cron → pg_net → ta funkcja, klucz service role).
 *  1. Każda tabela schematu public z katalogu minus jawne wyłączenia (I-2B; bez surowych pozycji GPS)
 *     → CSV (select porcjami + składanie w kodzie), gzip, szyfrowanie age X25519
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
 *  6. #479 F7 A: **bez COPY** w Edge — `select` keyset po ctid (SELECT_BATCH_ROWS), CSV w kodzie
 *     (csvEscapeField / rowsToCsv); przedział n0/n1; Promise.race na całą tabelę → ERROR z nazwą
 *     (nie wiszenie do I-33). Przyczyna hangów 35/38–42: `readable()` po kawałkach COPY.
 *  7. #498: duże tabele w częściach (`t.part0001.csv.gz.age`…), ≤ PART_MAX_ROWS / część;
 *     stan w `backup_runs.progress` + `progress_at`; cron `tower-backup-continue` co 1 min;
 *     I-33 = 10 min bez postępu. Manifest: `table_parts`.
 * Sekrety: BACKUP_AGE_RECIPIENT, BACKUP_WRITER_URL, BACKUP_WRITER_SECRET.
 * SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL — platforma.
 * Utrata danych w najgorszym razie: do 24 h (kopia raz na dobę).
 */
import postgres from 'npm:postgres@3';
import { Encrypter } from 'npm:age-encryption@0.3';
import {
  BACKUP_BUCKETS, BUCKET_OBJECTS_SQL, CATALOG_TABLES_SQL, PART_MAX_ROWS, SELECT_BATCH_ROWS,
  WALL_BUDGET_MS, assertSafeCtid, assertSafeIdent, backupTables, csvEscapeField, csvRowCount,
  assertCsvInCountWindow, dailyPrefix, manifest, monthlyPrefix, parseBackupProgress, parseSelectColumns,
  partObjectKey, pastWallBudget, remainingTables, rerunPrefix, rowsToCsv, sealTable, selectTextCastSql,
  sha256Hex, writerClient, type BackupTableProgress,
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

/** A7 / E44: lista kolumn `loads` bez `rio_secret` do CSV. */
async function loadColumnsWithoutRioSecret(sql: ReturnType<typeof postgres>): Promise<string> {
  const cols = await sql<{ column_name: string }[]>`
    select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'loads' and column_name <> 'rio_secret'
     order by ordinal_position`;
  if (!cols.length) throw new Error('kopia: brak kolumn loads');
  return cols.map((c) => `"${String(c.column_name).replace(/"/g, '""')}"`).join(', ');
}

async function tableColumns(
  sql: ReturnType<typeof postgres>,
  table: string,
  selectList: string | null,
): Promise<string[]> {
  const parsed = parseSelectColumns(selectList);
  if (parsed) return parsed;
  const t = assertSafeIdent(table);
  const cols = await sql<{ column_name: string }[]>`
    select column_name from information_schema.columns
     where table_schema = 'public' and table_name = ${t}
     order by ordinal_position`;
  if (!cols.length) throw new Error(`kopia: brak kolumn ${t}`);
  return cols.map((c) => String(c.column_name));
}

/**
 * #498: jedna część tabeli — max PART_MAX_ROWS od `afterCtid` (null = od początku).
 * Nagłówek CSV tylko w części 1 (`withHeader`).
 */
async function selectTablePartCsv(
  sql: ReturnType<typeof postgres>,
  table: string,
  selectList: string | null,
  afterCtid: string | null,
  withHeader: boolean,
  maxRows = PART_MAX_ROWS,
): Promise<{ csv: Uint8Array; after: string | null; rows: number; done: boolean }> {
  const t = assertSafeIdent(table);
  const columns = await tableColumns(sql, t, selectList);
  const casts = selectTextCastSql(columns);
  const dataRows: (string | null)[][] = [];
  let after: string | null = afterCtid;
  let fetched = 0;

  while (fetched < maxRows) {
    const take = Math.min(SELECT_BATCH_ROWS, maxRows - fetched);
    const q = after == null
      ? `select ctid::text as __bk_ctid, ${casts} from public.${t} order by ctid limit ${take}`
      : `select ctid::text as __bk_ctid, ${casts} from public.${t} where ctid > '${assertSafeCtid(after)}'::tid order by ctid limit ${take}`;
    const batch = await sql.unsafe(q) as Record<string, string | null>[];
    if (!batch.length) {
      const body = withHeader
        ? rowsToCsv(columns, dataRows)
        : (dataRows.length
          ? `${dataRows.map((r) => r.map((c) => csvEscapeField(c)).join(',')).join('\n')}\n`
          : '');
      return {
        csv: new TextEncoder().encode(body),
        after,
        rows: dataRows.length,
        done: true,
      };
    }
    for (const row of batch) {
      const ctid = row.__bk_ctid;
      if (ctid == null) throw new Error(`kopia: brak ctid w ${t}`);
      after = assertSafeCtid(String(ctid));
      dataRows.push(columns.map((c) => {
        const v = row[c];
        return v === undefined || v === null ? null : String(v);
      }));
    }
    fetched += batch.length;
    if (batch.length < take) {
      const body = withHeader
        ? rowsToCsv(columns, dataRows)
        : `${dataRows.map((r) => r.map((c) => csvEscapeField(c)).join(',')).join('\n')}\n`;
      return {
        csv: new TextEncoder().encode(body),
        after,
        rows: dataRows.length,
        done: true,
      };
    }
  }

  const body = withHeader
    ? rowsToCsv(columns, dataRows)
    : `${dataRows.map((r) => r.map((c) => csvEscapeField(c)).join(',')).join('\n')}\n`;
  return {
    csv: new TextEncoder().encode(body),
    after,
    rows: dataRows.length,
    done: false,
  };
}

type PartsMap = Record<string, { part: number; rows: number; key: string }[]>;

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
  let partsMap: PartsMap = {};
  let progress: BackupTableProgress | null = null;
  let bytes = 0;
  let prefixes: string[] = [];

  try {
    if (continueRun != null) {
      const [row] = await sql<{
        id: number; status: string; prefix: string | null;
        tables: Record<string, number> | null; bytes: string | number | null;
        progress: unknown; parts: unknown;
      }[]>`select id, status, prefix, tables, bytes, progress, parts from backup_runs where id = ${continueRun}`;
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
      partsMap = row.parts && typeof row.parts === 'object' ? { ...(row.parts as PartsMap) } : {};
      progress = parseBackupProgress(row.progress);
      bytes = Number(row.bytes ?? 0) || 0;
      prefixes = [row.prefix];
      const now = new Date();
      if (now.getUTCDate() === 1) {
        const m = monthlyPrefix(now);
        if (!prefixes.includes(m)) prefixes.push(m);
      }
      console.log(JSON.stringify({
        backup: 'continue', runId, done: Object.keys(counts).length, bytes, prefix: row.prefix,
        progress: progress?.table ?? null,
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
      await sql`update backup_runs set prefix = ${prefixes[0]}, progress_at = now() where id = ${runId}`;
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
    const loadsCols = tables.includes('loads')
      ? await loadColumnsWithoutRioSecret(sql)
      : null;

    const persistProgress = async (
      next: BackupTableProgress | null,
      nextCounts: Record<string, number>,
      nextParts: PartsMap,
      nextBytes: number,
    ) => {
      await sql`
        update backup_runs set
          tables = ${sql.json(nextCounts)},
          parts = ${sql.json(nextParts)},
          bytes = ${nextBytes},
          prefix = ${prefixes[0]},
          progress = ${next == null ? null : sql.json(next)},
          progress_at = now()
        where id = ${runId!}`;
    };

    const continueResponse = () => {
      scheduleContinue(runId!);
      return new Response(JSON.stringify({
        ok: true, continued: true, run: runId, tables: counts, bytes, ms: Date.now() - wallStarted,
        progress: progress?.table ?? null,
      }), { headers: { 'Content-Type': 'application/json' } });
    };

    // Wznów niedokończoną tabelę albo bierz następną.
    while (true) {
      if (pastWallBudget(wallStarted)) {
        console.log(JSON.stringify({
          backup: 'budget', runId, ms: Date.now() - wallStarted, done: Object.keys(counts).length,
          next: progress?.table ?? remainingTables(tables, counts)[0] ?? null,
        }));
        return continueResponse();
      }

      if (!progress) {
        const left = remainingTables(tables, counts);
        if (!left.length) break;
        const t = left[0]!;
        const [cnt0] = await sql.unsafe(`select count(*)::bigint as n from public.${assertSafeIdent(t)}`) as { n: string | number }[];
        const n0 = Number(cnt0?.n ?? 0);
        if (n0 === 0) {
          const t0 = Date.now();
          const emptyPart = await selectTablePartCsv(sql, t, t === 'loads' ? loadsCols : null, null, true, 1);
          const sealedEmpty = await sealTable(emptyPart.csv, encrypt);
          bytes += sealedEmpty.byteLength;
          for (const p of prefixes) await putTable(`${p}${t}.csv.gz.age`, sealedEmpty);
          counts[t] = 0;
          await persistProgress(null, counts, partsMap, bytes);
          console.log(JSON.stringify({
            backup: 'table', runId, table: t, rows: 0, parts: 0, ms: Date.now() - t0, wallMs: Date.now() - wallStarted,
          }));
          continue;
        }
        progress = {
          table: t,
          after_ctid: null,
          next_part: 1,
          n0,
          rows_so_far: 0,
          parts: [],
        };
      }

      const t = progress.table;
      const t0 = Date.now();
      const partNum = progress.next_part;
      const withHeader = partNum === 1;
      const part = await selectTablePartCsv(
        sql, t, t === 'loads' ? loadsCols : null, progress.after_ctid, withHeader, PART_MAX_ROWS,
      );

      if (part.rows === 0 && part.done) {
        // Koniec po pełnej poprzedniej części (ta próba pusta) albo anomalia — finalizuj stan.
        counts[t] = progress.rows_so_far;
        if (progress.parts.length > 1) partsMap[t] = progress.parts;
        progress = null;
        await persistProgress(null, counts, partsMap, bytes);
        console.log(JSON.stringify({
          backup: 'table', runId, table: t, rows: counts[t], parts: partsMap[t]?.length ?? 1,
          ms: Date.now() - t0, wallMs: Date.now() - wallStarted,
        }));
        continue;
      }

      const key = partObjectKey(t, partNum);
      const sealed = await sealTable(part.csv, encrypt);
      bytes += sealed.byteLength;
      for (const p of prefixes) await putTable(`${p}${key}`, sealed);

      const partMeta = { part: partNum, rows: part.rows, key };
      progress = {
        ...progress,
        after_ctid: part.after,
        next_part: partNum + 1,
        rows_so_far: progress.rows_so_far + part.rows,
        parts: [...progress.parts, partMeta],
      };

      if (part.done) {
        const [cnt1] = await sql.unsafe(`select count(*)::bigint as n from public.${assertSafeIdent(t)}`) as { n: string | number }[];
        const n1 = Number(cnt1?.n ?? -1);
        assertCsvInCountWindow(progress.rows_so_far, progress.n0, n1, t);
        counts[t] = progress.rows_so_far;
        if (progress.parts.length === 1) {
          for (const p of prefixes) await putTable(`${p}${t}.csv.gz.age`, sealed);
        } else {
          partsMap[t] = progress.parts;
        }
        console.log(JSON.stringify({
          backup: 'table', runId, table: t, rows: counts[t], parts: progress.parts.length,
          n0: progress.n0, n1, ms: Date.now() - t0, wallMs: Date.now() - wallStarted,
        }));
        progress = null;
        await persistProgress(null, counts, partsMap, bytes);
      } else {
        await persistProgress(progress, counts, partsMap, bytes);
        console.log(JSON.stringify({
          backup: 'part', runId, table: t, part: partNum, rows: part.rows,
          soFar: progress.rows_so_far, ms: Date.now() - t0, wallMs: Date.now() - wallStarted,
        }));
        return continueResponse();
      }
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
    const man = new TextEncoder().encode(JSON.stringify(
      manifest(prefixes[0], recipient, counts, files, now, partsMap),
      null,
      2,
    ));
    for (const p of prefixes) await putNew(`${p}manifest.json.age`, await encrypt(man));
    await sql`update backup_runs set status = 'OK', finished_at = now(), prefix = ${prefixes[0]},
              tables = ${sql.json(counts)}, parts = ${sql.json(partsMap)}, files = ${files.length},
              bytes = ${bytes}, progress = null, progress_at = now() where id = ${runId}`;
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
