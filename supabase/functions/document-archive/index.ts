/**
 * ANEKS 4 PR7 — archiwizacja starych dokumentów do Cloudflare R2, gdy pliki zajmują ≥ 70% limitu Storage.
 * PRZYGOTOWANE, NIEWDROŻONE: czeka na klucze R2 i SUPABASE_ACCESS_TOKEN (właściciel). Bez harmonogramu.
 *  1. document_archive_candidates(limit) — rozładowane > 90 dni, faktury OPLACONA, najstarsze pierwsze
 *     (pusta lista poniżej 70%).
 *  2. Plik z Storage → R2 `archiwum/<ścieżka>` (kubełek prywatny) → sprawdzenie rozmiaru (HEAD).
 *  3. mark_document_archived(id, ścieżka) — dopiero po potwierdzeniu w R2; potem plik usuwany ze Storage.
 *  Wiersz w `documents` zostaje; kopia zapasowa pomija dokumenty z `archived_at` (plik jest w R2).
 * Wywołanie: POST z nagłówkiem Authorization: Bearer <service role>; body opcjonalnie {"limit_bytes":…, "max":…, "dry_run":true}.
 * Sekrety: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ARCHIVE_BUCKET (domyślnie R2_BUCKET).
 */
import postgres from 'npm:postgres@3';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { AwsClient } from 'npm:aws4fetch@1';

const env = (k: string, fallback?: string) => {
  const v = Deno.env.get(k) ?? fallback;
  if (!v) throw new Error(`brak sekretu ${k}`);
  return v;
};

Deno.serve(async (req) => {
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!service || req.headers.get('Authorization') !== `Bearer ${service}`) return new Response('forbidden', { status: 403 });
  const opts = (await req.json().catch(() => ({}))) as { limit_bytes?: number; max?: number; dry_run?: boolean };
  const sql = postgres(env('SUPABASE_DB_URL'), { max: 1, prepare: false });
  const sb = createClient(env('SUPABASE_URL'), service, { auth: { persistSession: false } });
  const done: { id: string; key: string; bytes: number }[] = [];
  const errors: string[] = [];
  try {
    const rows = await sql`select id, storage_path, size_bytes from document_archive_candidates(
      ${opts.limit_bytes ?? 1073741824}, ${opts.max ?? 200})`;
    if (opts.dry_run) return Response.json({ ok: true, dry_run: true, candidates: rows.length });
    const r2 = new AwsClient({ accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY'), service: 's3', region: 'auto' });
    const base = `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${env('R2_ARCHIVE_BUCKET', Deno.env.get('R2_BUCKET'))}`;
    for (const d of rows) {
      const [bucket, ...rest] = String(d.storage_path).split('/');
      const object = rest.join('/');
      try {
        const dl = await sb.storage.from(bucket).download(object);
        if (dl.error || !dl.data) throw new Error(`Storage: ${dl.error?.message ?? 'brak pliku'}`);
        const body = new Uint8Array(await dl.data.arrayBuffer());
        const key = `archiwum/${d.storage_path}`;
        const put = await r2.fetch(`${base}/${key}`, { method: 'PUT', body });
        if (!put.ok) throw new Error(`R2 PUT ${put.status}`);
        const head = await r2.fetch(`${base}/${key}`, { method: 'HEAD' });
        if (!head.ok || Number(head.headers.get('content-length')) !== body.byteLength) throw new Error('R2: rozmiar się nie zgadza');
        await sql`select mark_document_archived(${d.id}, ${key})`;
        const rm = await sb.storage.from(bucket).remove([object]);
        if (rm.error) errors.push(`${d.id}: zarchiwizowany, ale nie usunięty ze Storage (${rm.error.message})`);
        done.push({ id: d.id, key, bytes: body.byteLength });
      } catch (e) {
        errors.push(`${d.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return Response.json({ ok: errors.length === 0, archived: done.length, bytes: done.reduce((a, x) => a + x.bytes, 0), errors });
  } catch (e) {
    return Response.json({ ok: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  } finally {
    await sql.end();
  }
});
