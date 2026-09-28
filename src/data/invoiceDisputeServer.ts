/**
 * III-7 — historia sporu faktury w trybie Supabase (chunk leniwy; paczka demo go nie zawiera).
 * Odczyt: `invoice_dispute_events` (RLS: strony faktury i HHL). Odpowiedź: `invoice_dispute_reply` (tylko wystawca).
 */
import { getSupabase } from '../auth/client';
import type { DisputeEvent } from '../lib/invoiceDispute';

export async function loadDisputeEvents(invoiceId: string): Promise<DisputeEvent[]> {
  const sb = await getSupabase();
  const r = await sb.from('invoice_dispute_events').select('id,kind,status_to,note,created_at')
    .eq('invoice_id', invoiceId).order('created_at', { ascending: true }).order('id', { ascending: true });
  if (r.error) throw new Error(r.error.message);
  return ((r.data ?? []) as { id: number; kind: DisputeEvent['kind']; status_to: string | null; note: string | null; created_at: string }[])
    .map((x) => ({ id: String(x.id), kind: x.kind, statusTo: x.status_to, note: x.note, at: x.created_at }));
}

export async function replyDispute(invoiceId: string, note: string): Promise<void> {
  const sb = await getSupabase();
  const r = await sb.rpc('invoice_dispute_reply', { p_invoice: invoiceId, p_note: note });
  if (r.error) throw new Error(r.error.message);
}
