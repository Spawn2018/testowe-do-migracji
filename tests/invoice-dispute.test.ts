/** III-7 (SCOPE 7.10) — reguły ścieżki sporu faktury i treści powiadomień PL/EN/SV. */
import { describe, expect, it } from 'vitest';
import { canReplyDispute, disputeActorSide, paymentBlockedByDispute, correctionFileError } from '../src/lib/invoiceDispute';
import { renderNotice } from '../supabase/functions/_shared/notifyTemplates';

describe('III-7 ścieżka sporu faktury', () => {
  it('odpowiada tylko wystawca faktury SPORNA; zapłata kosztowej wstrzymana w sporze', () => {
    expect(canReplyDispute('HHL', { issuer: 'HHL', verification: 'SPORNA' })).toBe(true);
    expect(canReplyDispute('KSH', { issuer: 'HHL', verification: 'SPORNA' })).toBe(false);
    expect(canReplyDispute('HHL', { issuer: 'HHL', verification: 'ZGODNA' })).toBe(false);
    expect(paymentBlockedByDispute({ recipient: 'HHL', verification: 'SPORNA' })).toBe(true);
    expect(paymentBlockedByDispute({ recipient: 'KSH', verification: 'SPORNA' })).toBe(false);
    expect(paymentBlockedByDispute({ recipient: 'HHL', verification: 'ZAAKCEPTOWANA' })).toBe(false);
    expect(disputeActorSide('REPLY')).toBe('issuer');
    expect(disputeActorSide('OPENED')).toBe('recipient');
  });
  it('szablony INVOICE_DISPUTED / _REPLY / _RESOLVED mają własny tekst w 3 językach', () => {
    for (const template of ['INVOICE_DISPUTED', 'INVOICE_DISPUTE_REPLY', 'INVOICE_DISPUTE_RESOLVED']) {
      const seen = new Set<string>();
      for (const locale of ['pl', 'en', 'sv'] as const) {
        const r = renderNotice({ template, payload: { number: 'HHL/9/2026', note: 'stawka poz. 1' } }, locale);
        expect(r.subject).toContain('HHL/9/2026');
        expect(r.subject).not.toBe(template);
        expect(r.view).toBe('inv');
        seen.add(r.subject);
      }
      expect(seen.size).toBe(3);
    }
    expect(renderNotice({ template: 'INVOICE_DISPUTED', payload: { number: 'X', note: 'brak CMR' } }, 'pl').body).toContain('brak CMR');
  });
  it('0082: korekta — tylko PDF do 10 MB', () => {
    expect(correctionFileError({ name: 'k.pdf', type: 'application/pdf', size: 1000 })).toBeNull();
    expect(correctionFileError({ name: 'K.PDF', type: '', size: 1000 })).toBeNull();
    expect(correctionFileError({ name: 'k.jpg', type: 'image/jpeg', size: 1000 })).toBe('type');
    expect(correctionFileError({ name: 'k.pdf', type: 'application/pdf', size: 10 * 1048576 + 1 })).toBe('size');
  });
});
