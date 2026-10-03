/**
 * III-7 — historia sporu faktury w trybie Supabase (chunk leniwy; paczka demo go nie zawiera).
 * Odczyt: `invoice_dispute_events` (RLS: strony faktury i HHL). Odpowiedź: `invoice_dispute_reply` (tylko wystawca).
 * 0082: korekta z plikiem — PDF rejestrowany jako dokument INVOICE projektu faktury (create_document → Storage),
 * potem `invoice_dispute_reply(…, p_document)`; baza łączy plik z fakturą (KOREKTA), więc odbiorca go otworzy.
 */
import { getSupabase } from '../auth/client';
import type { DisputeEvent } from '../lib/invoiceDispute';
import { SIGNED_URL_TTL_S } from './registry';
import { splitStoragePath } from './storageFiles';
import { safeStorageTarget } from './storagePath';

export async function loadDisputeEvents(invoiceId: string): Promise<DisputeEvent[]> {
  const sb = await getSupabase();
  const r = await sb.from('invoice_dispute_events').select('id,kind,status_to,note,created_at,document_id')
    .eq('invoice_id', invoiceId).order('created_at', { ascending: true }).order('id', { ascending: true });
  if (r.error) throw new Error(r.error.message);
  const rows = (r.data ?? []) as { id: number; kind: DisputeEvent['kind']; status_to: string | null; note: string | null; created_at: string; document_id: string | null }[];
  const ids = rows.map((x) => x.document_id).filter((x): x is string => Boolean(x));
  const names = new Map<string, string>();
  if (ids.length) {
    const d = await sb.from('documents').select('id,file_name').in('id', ids);
    for (const x of (d.data ?? []) as { id: string; file_name: string }[]) names.set(x.id, x.file_name);
  }
  return rows.map((x) => ({
    id: String(x.id), kind: x.kind, statusTo: x.status_to, note: x.note, at: x.created_at,
    docId: x.document_id, docName: x.document_id ? names.get(x.document_id) ?? null : null,
  }));
}

/** Link podpisany (15 min) do pliku korekty — Storage wystawi go tylko stronie faktury (RLS documents). */
export async function disputeDocUrl(docId: string): Promise<string> {
  const sb = await getSupabase();
  const d = await sb.from('documents').select('storage_path,file_name').eq('id', docId).maybeSingle();
  const row = d.data as { storage_path: string; file_name: string } | null;
  if (d.error || !row) throw new Error(d.error?.message ?? 'Brak dostępu do pliku');
  const [bucketName, rawPath] = splitStoragePath(row.storage_path);
  const stored = safeStorageTarget(bucketName, rawPath);
  const path = stored.objectPath.replace(/\.\.\//g, '');
  const u = await sb.storage.from(stored.bucket).createSignedUrl(path, SIGNED_URL_TTL_S);
  if (u.error || !u.data?.signedUrl) throw new Error(u.error?.message ?? 'Brak linku');
  return u.data.signedUrl;
}

export async function replyDispute(invoiceId: string, note: string, file?: File | null): Promise<void> {
  const sb = await getSupabase();
  if (!file) {
    const r = await sb.rpc('invoice_dispute_reply', { p_invoice: invoiceId, p_note: note });
    if (r.error) throw new Error(r.error.message);
    return;
  }
  const inv = await sb.from('invoices').select('project_id').eq('id', invoiceId).maybeSingle();
  const projectId = (inv.data as { project_id: string } | null)?.project_id;
  if (inv.error || !projectId) throw new Error(inv.error?.message ?? 'Brak faktury');
  const created = await sb.rpc('create_document', {
    p_load_id: null, p_category: 'INVOICE', p_file_name: file.name || 'korekta.pdf',
    p_mime: 'application/pdf', p_size: file.size, p_project_id: projectId,
  });
  const row = (Array.isArray(created.data) ? created.data[0] : created.data) as { id: string; bucket: string; object_path: string } | null;
  if (created.error || !row) throw new Error(`korekta: ${created.error?.message ?? 'brak rejestracji'}`);
  const stored = safeStorageTarget(row.bucket, row.object_path);
  const objectPath = stored.objectPath.replace(/\.\.\//g, '');
  const up = await sb.storage.from(stored.bucket).upload(objectPath, file, { contentType: 'application/pdf', upsert: false });
  if (up.error) {
    await sb.rpc('discard_document', { p_id: row.id });
    throw new Error(`korekta: ${up.error.message}`);
  }
  const r = await sb.rpc('invoice_dispute_reply', { p_invoice: invoiceId, p_note: note, p_document: row.id });
  if (r.error) {
    await sb.storage.from(stored.bucket).remove([objectPath]);
    await sb.rpc('discard_document', { p_id: row.id });
    throw new Error(r.error.message);
  }
}
