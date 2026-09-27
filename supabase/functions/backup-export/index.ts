/**
 * ANEKS 4 PR2 — codzienna kopia zapasowa (02:30, pg_cron → pg_net → ta funkcja, klucz service role).
 *  1. COPY każdej tabeli biznesowej do CSV (bez surowych pozycji GPS), gzip, szyfrowanie age X25519
 *     KLUCZEM PUBLICZNYM (BACKUP_AGE_RECIPIENT); klucz prywatny wyłącznie u właściciela, offline.
 *  2. Zapis do Cloudflare R2 przez Worker tower-backup-writer (wiązanie R2, tylko PUT nowego obiektu,
 *     nagłówek X-Backup-Secret; bez klucza R2 i bez S3): daily/RRRR-MM-DD/<tabela>.csv.gz.age + manifest.json.age;
 *     pierwszego dnia miesiąca kopia także do monthly/RRRR-MM/. Ponowny przebieg tego samego dnia → katalog z godziną.
 *  3. Pliki (Storage): przyrostowo — tylko dokumenty wgrane od ostatniej udanej kopii → files/<ścieżka>.age.
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
  BACKUP_TABLES, csvRowCount, dailyPrefix, manifest, monthlyPrefix, rerunPrefix, sealTable, sha256Hex, writerClient,
} from '../_shared/backup/core.ts';
import { isServiceRequest } from '../_shared/serviceAuth.ts';

const env = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`brak sekretu ${k}`);
  return v;
};

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
    for (const t of BACKUP_TABLES) {
      const chunks: Uint8Array[] = [];
      const stream = await sql.unsafe(`copy public.${t} to stdout with (format csv, header true)`).readable();
      // zdarzenia zamiast `for await`: w Edge Runtime iterator strumienia COPY zawieszał się na tabelach > ~16 kB (PR2, 27.09)
      await new Promise<void>((res, rej) => {
        stream.on('data', (c: Uint8Array) => chunks.push(c));
        stream.on('end', () => res());
        stream.on('error', rej);
      });
      const csv = new Uint8Array(await new Blob(chunks as BlobPart[]).arrayBuffer());
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
    const files: { key: string; document_id: string; bytes: number; size: number; sha256: string }[] = [];
    // supabase-js ładowany tylko, gdy są pliki do skopiowania (mniej pracy przy starcie funkcji)
    const sb = docs.length ? (await import('npm:@supabase/supabase-js@2')).createClient(env('SUPABASE_URL'), service, { auth: { persistSession: false } }) : null;
    for (const d of docs) {
      const [bucket, ...rest] = String(d.storage_path).split('/');
      const dl = await sb!.storage.from(bucket).download(rest.join('/'));
      if (dl.error || !dl.data) continue;                 // brak obiektu (np. wycofana rejestracja)
      const plain = new Uint8Array(await dl.data.arrayBuffer());
      const sealed = await encrypt(plain);
      const key = `files/${d.storage_path}.age`;
      if ((await writer(key, sealed)) === 'EXISTS') continue;   // plik już w kopii (klucz = ścieżka dokumentu)
      files.push({ key, document_id: d.id, bytes: sealed.byteLength, size: plain.byteLength, sha256: await sha256Hex(plain) });
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
