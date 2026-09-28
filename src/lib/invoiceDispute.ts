/** III-7 (SCOPE 7.10) — ścieżka sporu i akceptacji faktury: reguły wspólne dla UI i trybu demo. */
import type { Bill, RoleId } from '../types';

export type DisputeKind = 'OPENED' | 'REPLY' | 'CORRECTION' | 'RESOLVED' | 'WITHDRAWN';
export interface DisputeEvent { id: string; kind: DisputeKind; statusTo: string | null; note: string | null; at: string }

/** Na spór odpowiada wyłącznie wystawca, gdy faktura jest SPORNA (lustro invoice_dispute_reply). */
export const canReplyDispute = (role: RoleId, b: Pick<Bill, 'issuer' | 'verification'>): boolean =>
  b.issuer === role && b.verification === 'SPORNA';

/** Zapłata faktury kosztowej (HHL = odbiorca) wstrzymana, dopóki trwa spór (lustro mark_invoice_paid, 0079). */
export const paymentBlockedByDispute = (b: Pick<Bill, 'recipient' | 'verification'>): boolean =>
  b.recipient === 'HHL' && b.verification === 'SPORNA';

/** Strona, która dokonała kroku: zgłoszenie / rozstrzygnięcie — odbiorca, odpowiedź i korekta — wystawca. */
export const disputeActorSide = (k: DisputeKind): 'recipient' | 'issuer' =>
  k === 'REPLY' || k === 'CORRECTION' ? 'issuer' : 'recipient';
