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
 * Sekrety: BACKUP_AGE_RECIPIENT, BACKUP_WRITER_URL, BACKUP_WRITER_SECRET.
 * SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL — platforma.
 * Utrata danych w najgorszym razie: do 24 h (kopia raz na dobę).
 */
import postgres from 'npm:postgres@3';
import { Encrypter } from 'npm:age-encryption@0.3';
import {
  BACKUP_BUCKETS, BUCKET_OBJECTS_SQL, CATALOG_TABLES_SQL, TABLE_COPY_TIMEOUT_MS, assertCsvMatchesDbCount,
  assertSafeIdent, backupTables, copyCtidRangeSql, csvRowCount, ctidPageRanges, dailyPrefix, heapPagesFromBytes,
  manifest, monthlyPrefix, rerunPrefix, sealTable, sha256Hex, shouldChunkByEstimate, writerClient,
} from '../_shared/backup/core.ts';
import { isServiceRequest } from '../_shared/serviceAuth.ts';

const env = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`brak sekretu ${k}`);
  return v;
};

/** A7 / E44: lista kolumn `loads` bez `rio_secret` do COPY. */
async function loadColumnsWithoutRioSecret(sql: ReturnType<typeof postgres>): Promise<string> {
  const cols = await sql<{ column_name: string }[]>`
    select column_name from information_schema.columns
     where table_schema = 'public' and table_name = 'loads' and column_name <> 'rio_secret'
     order by ordinal_position`;
  if (!cols.length) throw new Error('kopia: brak kolumn loads');
  return cols.map((c) => `"${String(c.column_name).replace(/"/g, '""')}"`).join(', ');
}

/** Odczyt strumienia COPY z limitem czasu (#463 — bez wiszenia do I-33). */
function readCopyStream(stream: { on: (ev: string, fn: (...args: unknown[]) => void) => void }, label: string, timeoutMs = TABLE_COPY_TIMEOUT_MS): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  return new Promise<Uint8Array>((res, rej) => {
    const timer = setTimeout(() => rej(new Error(`kopia: timeout COPY ${label} po ${timeoutMs} ms`)), timeoutMs);
    stream.on('data', (c: unknown) => chunks.push(c as Uint8Array));
    stream.on('end', () => {
      clearTimeout(timer);
      void (async () => {
        try {
          res(new Uint8Array(await new Blob(chunks as BlobPart[]).arrayBuffer()));
        } catch (e) {
          rej(e);
        }
      })();
    });
    stream.on('error', (e: unknown) => {
      clearTimeout(timer);
      rej(e);
    });
  });
}

/**
 * Jedna tabela w jednej transakcji repeatable read (F7 #472):
 * mała → jeden COPY; duża → kawałki ctid (ostatni bez górnej granicy);
 * na końcu csvRowCount = count(*) albo ERROR.
 */
async function copyTableCsv(
  sql: ReturnType<typeof postgres>,
  table: string,
  selectList: string | null,
): Promise<Uint8Array> {
  const t = assertSafeIdent(table);
  return sql.begin('isolation level repeatable read', async (tx) => {
    const [meta] = await tx<{ est: string | number; bytes: string | number; block: number }[]>`
      select c.reltuples::bigint as est,
             pg_relation_size(c.oid)::bigint as bytes,
             current_setting('block_size')::int as block
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = ${table}`;
    const est = Number(meta?.est ?? 0);
    const pages = heapPagesFromBytes(Number(meta?.bytes ?? 0), Number(meta?.block ?? 8192));
    let csv: Uint8Array;
    if (!shouldChunkByEstimate(est)) {
      const copySql = selectList
        ? `copy (select ${selectList} from public.${t}) to stdout with (format csv, header true)`
        : `copy public.${t} to stdout with (format csv, header true)`;
      const stream = await tx.unsafe(copySql).readable();
      csv = await readCopyStream(stream, t);
    } else {
      const parts: Uint8Array[] = [];
      let header = true;
      for (const { from, to } of ctidPageRanges(pages)) {
        const copySql = copyCtidRangeSql(t, from, to, selectList, header);
        const stream = await tx.unsafe(copySql).readable();
        const label = to === null ? `${t}[${from},∞)` : `${t}[${from},${to})`;
        const part = await readCopyStream(stream, label);
        if (part.byteLength) parts.push(part);
        header = false;
      }
      if (!parts.length) {
        // pusta duża tabela — sam nagłówek
        const copySql = selectList
          ? `copy (select ${selectList} from public.${t} where false) to stdout with (format csv, header true)`
          : `copy (select * from public.${t} where false) to stdout with (format csv, header true)`;
        const stream = await tx.unsafe(copySql).readable();
        csv = await readCopyStream(stream, `${t}[empty]`);
      } else {
        csv = new Uint8Array(await new Blob(parts as BlobPart[]).arrayBuffer());
      }
    }
    const [cnt] = await tx.unsafe(`select count(*)::bigint as n from public.${t}`) as { n: string | number }[];
    assertCsvMatchesDbCount(csvRowCount(new TextDecoder().decode(csv)), Number(cnt?.n ?? -1), t);
    return csv;
  });
}

Deno.serve(async (req) => {
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!service || !(await isServiceRequest(req, { url: Deno.env.get('SUPABASE_URL') ?? '', service }))) return new Response('forbidden', { status: 403 });
  const sql = postgres(env('SUPABASE_DB_URL'), { max: 1, prepare: false });
  // PR2-B: blokada współbieżności (0044) — drugi start w trakcie przebiegu → SKIPPED i koniec
  const [begin] = await sql`select run_id, run_status from backup_run_begin()`;
  if (begin.run_status !== 'RUNNING') {
    await sql.end();
    return new Response(JSON.stringify({ ok: true, skipped: true, run: begin.run_id }), { headers: { 'Content-Type': 'application/json' } });
  }
  const run = { id: begin.run_id };
  try {
    const recipient = env('BACKUP_AGE_RECIPIENT');
    if (!recipient.startsWith('age1')) throw new Error('BACKUP_AGE_RECIPIENT musi być kluczem publicznym age (age1…)');
    const encrypt = async (plain: Uint8Array) => { const e = new Encrypter(); e.addRecipient(recipient); return await e.encrypt(plain); };
    const writer = writerClient(env('BACKUP_WRITER_URL'), env('BACKUP_WRITER_SECRET'));
    const put = async (key: string, body: Uint8Array) => {
      if ((await writer(key, body)) === 'EXISTS') throw new Error(`R2: obiekt ${key} już istnieje (nadpisanie zabronione)`);
    };
    const now = new Date();
    let prefixes = [dailyPrefix(now), ...(now.getUTCDate() === 1 ? [monthlyPrefix(now)] : [])];
    // ponowny przebieg: katalog dnia już zapisany (blokada, bez nadpisania) → katalog z godziną
    const probe = new TextEncoder().encode(JSON.stringify({ run: run.id, at: now.toISOString() }));
    prefixes = await Promise.all(prefixes.map(async (p) => ((await writer(`${p}_run.json`, probe)) === 'CREATED' ? p : rerunPrefix(p, now))));
    for (const p of prefixes) if (/-\d{6}\/$/.test(p)) await put(`${p}_run.json`, probe);
    const counts: Record<string, number> = {};
    let bytes = 0;
    const catalog = (await sql.unsafe(CATALOG_TABLES_SQL)).map((r) => String(r.name));
    const tables = backupTables(catalog);
    // loads bez rio_secret — raz na przebieg (A7 / E44)
    const loadsCols = tables.includes('loads') ? await loadColumnsWithoutRioSecret(sql) : null;
    for (const t of tables) {
      // #463: duże tabele stronicowane po ctid; każdy kawałek z timeoutem (zamiast wiszenia do I-33)
      const csv = await copyTableCsv(sql, t, t === 'loads' ? loadsCols : null);
      counts[t] = csvRowCount(new TextDecoder().decode(csv));
      const sealed = await sealTable(csv, encrypt);
      bytes += sealed.byteLength;
      for (const p of prefixes) await put(`${p}${t}.csv.gz.age`, sealed);
      await sql`update backup_runs set tables = ${sql.json(counts)}, bytes = ${bytes} where id = ${run.id}`;   // postęp (diagnostyka przerwanego przebiegu)
    }
    // pliki: przyrostowo od ostatniej udanej kopii
    const [last] = await sql`select max(started_at) as at from backup_runs where status = 'OK'`;
    const docs = await sql`select id, storage_path from documents
                           where storage_path not in ('', '-') and archived_at is null   -- PR7: plik już w archiwum R2
                             and uploaded_at > coalesce(${last?.at ?? null}::timestamptz, 'epoch')`;
    // kubełki: WSZYSTKIE obiekty przy każdym przebiegu (od = null) — obiekt sprzed wdrożenia I-2B też trafi do kopii;
    // już skopiowane pomija Worker (409 EXISTS, klucz = ścieżka). Harmonogramy są małe (≤ 10 MB, kilka na tydzień).
    const objs = await sql.unsafe(BUCKET_OBJECTS_SQL, [BACKUP_BUCKETS as unknown as string[], null]);
    const items = [
      ...docs.map((d) => ({ path: String(d.storage_path), ref: { document_id: String(d.id) } })),
      ...objs.map((o) => ({ path: String(o.storage_path), ref: { object_id: String(o.id) } })),
    ];
    const files: { key: string; document_id?: string; object_id?: string; bytes: number; size: number; sha256: string }[] = [];
    // supabase-js ładowany tylko, gdy są pliki do skopiowania (mniej pracy przy starcie funkcji)
    const sb = items.length ? (await import('npm:@supabase/supabase-js@2')).createClient(env('SUPABASE_URL'), service, { auth: { persistSession: false } }) : null;
    for (const d of items) {
      const [bucket, ...rest] = d.path.split('/');
      const dl = await sb!.storage.from(bucket).download(rest.join('/'));
      if (dl.error || !dl.data) continue;                 // brak obiektu (np. wycofana rejestracja)
      const plain = new Uint8Array(await dl.data.arrayBuffer());
      const sealed = await encrypt(plain);
      const key = `files/${d.path}.age`;
      if ((await writer(key, sealed)) === 'EXISTS') continue;   // plik już w kopii (klucz = ścieżka dokumentu)
      files.push({ key, ...d.ref, bytes: sealed.byteLength, size: plain.byteLength, sha256: await sha256Hex(plain) });
      bytes += sealed.byteLength;
    }
    const man = new TextEncoder().encode(JSON.stringify(manifest(prefixes[0], recipient, counts, files, now), null, 2));
    for (const p of prefixes) await put(`${p}manifest.json.age`, await encrypt(man));
    await sql`update backup_runs set status = 'OK', finished_at = now(), prefix = ${prefixes[0]},
              tables = ${sql.json(counts)}, files = ${files.length}, bytes = ${bytes} where id = ${run.id}`;
    return new Response(JSON.stringify({ ok: true, prefix: prefixes[0], tables: counts, files: files.length, bytes }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await sql`update backup_runs set status = 'ERROR', finished_at = now(), error = ${msg.slice(0, 1000)} where id = ${run.id}`;
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500 });
  } finally {
    await sql.end();
  }
});
