/**
 * TOWER PR2 — zapis kopii do R2 wyłącznie przez dopisywanie.
 *  PUT /<klucz>  + nagłówek X-Backup-Secret  → 201 (nowy obiekt)
 *  PUT bez/zły sekret → 401 · istniejący klucz → 409 (nadpisanie zabronione)
 *  GET / HEAD / DELETE / LIST / POST … → 405
 * Klucze tylko daily/…, monthly/…, files/… (bez „..”). Usuwanie po retencji: reguły cyklu życia R2.
 */
export interface Env { BUCKET: R2Bucket; BACKUP_WRITER_SECRET: string }

const PREFIX = /^(daily|monthly|files)\/[^\u0000-\u001f\\]+$/;

async function sameSecret(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(a)), crypto.subtle.digest('SHA-256', enc.encode(b))]);
  return crypto.subtle.timingSafeEqual(x, y);
}

const text = (status: number, body: string, extra: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'content-type': 'text/plain; charset=utf-8', ...extra } });

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    if (req.method !== 'PUT') return text(405, 'method not allowed', { allow: 'PUT' });
    const secret = req.headers.get('x-backup-secret') ?? '';
    if (!env.BACKUP_WRITER_SECRET || !secret || !(await sameSecret(secret, env.BACKUP_WRITER_SECRET))) return text(401, 'unauthorized');
    const key = decodeURIComponent(new URL(req.url).pathname.replace(/^\/+/, ''));
    if (!PREFIX.test(key) || key.includes('..') || key.endsWith('/')) return text(400, 'bad key');
    if (!req.body) return text(400, 'empty body');
    if (await env.BUCKET.head(key)) return text(409, 'exists');
    const put = await env.BUCKET.put(key, req.body, { onlyIf: new Headers({ 'if-none-match': '*' }) });
    if (!put) return text(409, 'exists');
    return new Response(JSON.stringify({ key, size: put.size, etag: put.etag }), { status: 201, headers: { 'content-type': 'application/json' } });
  },
} satisfies ExportedHandler<Env>;
