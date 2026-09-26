/**
 * ANEKS 4 PR2 — codzienna kopia zapasowa (02:30, pg_cron → pg_net → ta funkcja, klucz service role).
 *  1. COPY każdej tabeli biznesowej do CSV (bez surowych pozycji GPS), gzip, szyfrowanie age X25519
 *     KLUCZEM PUBLICZNYM (BACKUP_AGE_RECIPIENT); klucz prywatny wyłącznie u właściciela, offline.
 *  2. Zapis do Cloudflare R2 (S3 API): daily/RRRR-MM-DD/<tabela>.csv.gz.age + manifest.json.age;
 *     pierwszego dnia miesiąca kopia także do monthly/RRRR-MM/.
 *  3. Pliki (Storage): przyrostowo — tylko dokumenty wgrane od ostatniej udanej kopii → files/<ścieżka>.age.
 *  4. Retencja: dzienne 30 dni, miesięczne 12 miesięcy. Przebieg w backup_runs (historia, błędy).
 * Sekrety: BACKUP_AGE_RECIPIENT, R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
 * SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL — platforma.
 * Utrata danych w najgorszym razie: do 24 h (kopia raz na dobę).
 */
import postgres from 'npm:postgres@3';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { AwsClient } from 'npm:aws4fetch@1';
import { Encrypter } from 'npm:age-encryption@0.3';
import {
  BACKUP_TABLES, csvRowCount, dailyPrefix, manifest, monthlyPrefix, retentionDeletes, sealTable,
} from '../_shared/backup/core.ts';

const env = (k: string) => {
  const v = Deno.env.get(k);
  if (!v) throw new Error(`brak sekretu ${k}`);
  return v;
};

Deno.serve(async (req) => {
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!service || req.headers.get('Authorization') !== `Bearer ${service}`) return new Response('forbidden', { status: 403 });
  const sql = postgres(env('SUPABASE_DB_URL'), { max: 1, prepare: false });
  const sb = createClient(env('SUPABASE_URL'), service, { auth: { persistSession: false } });
  const [run] = await sql`insert into backup_runs (status) values ('RUNNING') returning id`;
  try {
    const recipient = env('BACKUP_AGE_RECIPIENT');
    if (!recipient.startsWith('age1')) throw new Error('BACKUP_AGE_RECIPIENT musi być kluczem publicznym age (age1…)');
    const encrypt = async (plain: Uint8Array) => { const e = new Encrypter(); e.addRecipient(recipient); return await e.encrypt(plain); };
    const r2 = new AwsClient({ accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY'), service: 's3', region: 'auto' });
    const base = `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${env('R2_BUCKET')}`;
    const put = async (key: string, body: Uint8Array) => {
      const res = await r2.fetch(`${base}/${key}`, { method: 'PUT', body });
      if (!res.ok) throw new Error(`R2 PUT ${key}: ${res.status} ${await res.text()}`);
    };
    const now = new Date();
    const prefixes = [dailyPrefix(now), ...(now.getUTCDate() === 1 ? [monthlyPrefix(now)] : [])];
    const counts: Record<string, number> = {};
    let bytes = 0;
    for (const t of BACKUP_TABLES) {
      const chunks: Uint8Array[] = [];
      const stream = await sql.unsafe(`copy public.${t} to stdout with (format csv, header true)`).readable();
      for await (const c of stream) chunks.push(c as Uint8Array);
      const csv = new Uint8Array(await new Blob(chunks as BlobPart[]).arrayBuffer());
      counts[t] = csvRowCount(new TextDecoder().decode(csv));
      const sealed = await sealTable(csv, encrypt);
      bytes += sealed.byteLength;
      for (const p of prefixes) await put(`${p}${t}.csv.gz.age`, sealed);
    }
    // pliki: przyrostowo od ostatniej udanej kopii
    const [last] = await sql`select max(started_at) as at from backup_runs where status = 'OK'`;
    const docs = await sql`select id, storage_path from documents
                           where storage_path not in ('', '-')
                             and uploaded_at > coalesce(${last?.at ?? null}::timestamptz, 'epoch')`;
    const files: { key: string; document_id: string; bytes: number }[] = [];
    for (const d of docs) {
      const [bucket, ...rest] = String(d.storage_path).split('/');
      const dl = await sb.storage.from(bucket).download(rest.join('/'));
      if (dl.error || !dl.data) continue;                 // brak obiektu (np. wycofana rejestracja)
      const sealed = await encrypt(new Uint8Array(await dl.data.arrayBuffer()));
      const key = `files/${d.storage_path}.age`;
      await put(key, sealed);
      files.push({ key, document_id: d.id, bytes: sealed.byteLength });
      bytes += sealed.byteLength;
    }
    const man = new TextEncoder().encode(JSON.stringify(manifest(prefixes[0], recipient, counts, files, now), null, 2));
    for (const p of prefixes) await put(`${p}manifest.json.age`, await encrypt(man));
    // retencja
    const list = await r2.fetch(`${base}?list-type=2&prefix=`, { method: 'GET' });
    const keys = [...(await list.text()).matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1]);
    for (const k of retentionDeletes(keys, now)) await r2.fetch(`${base}/${k}`, { method: 'DELETE' });
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
