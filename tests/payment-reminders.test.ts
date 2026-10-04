/** M7 — terminy i przypomnienia: kadencja, odbiorcy (tylko płatnik i wierzyciel), cisza po opłaceniu, treść w języku odbiorcy. */
import { describe, expect, it } from 'vitest';
import { REMINDER_CADENCE, receivesReminders, reminderPlan, reminderRecipients } from '../src/lib/invoices3';
import { remindersDueToday } from '../src/lib/money/engine';
import { formatInvoiceAmount, renderEmail, renderNotice } from '../supabase/functions/_shared/notifyTemplates';
import { notificationFromRow } from '../src/data/mappers';

const cost = { issuer: 'SCX', recipient: 'HHL' } as const;
const rev = { issuer: 'HHL', recipient: 'KSH' } as const;

describe('M7 — kadencja i odbiorcy', () => {
  it('kadencja −3 / 0 / +1 / +7 / +14; opłacona → brak', () => {
    expect([...REMINDER_CADENCE]).toEqual([-3, 0, 1, 7, 14]);
    expect(remindersDueToday('2026-10-30', '2026-10-27')).toEqual([-3]);
    expect(remindersDueToday('2026-10-30', '2026-10-28')).toEqual([]);
    expect(remindersDueToday('2026-10-30', '2026-11-13')).toEqual([14]);
    expect(remindersDueToday('2026-10-30', '2026-10-30', '2026-10-29')).toEqual([]);
  });
  it('wyłącznie płatnik i wierzyciel: KSH nigdy o kosztowej, SCX nigdy o przychodowej', () => {
    expect(reminderRecipients(cost)).toEqual({ payer: 'HHL', payee: 'SCX' });
    expect(reminderRecipients(rev)).toEqual({ payer: 'KSH', payee: 'HHL' });
    expect(receivesReminders('KSH', cost)).toBe(false);
    expect(receivesReminders('SCX', rev)).toBe(false);
    expect(receivesReminders('HHL', cost) && receivesReminders('SCX', cost)).toBe(true);
    expect(receivesReminders('HHL', rev) && receivesReminders('KSH', rev)).toBe(true);
  });
  it('plan: wysłane / zaplanowane; po opłaceniu pozostałe wstrzymane', () => {
    const open = reminderPlan({ dueDate: '2026-10-30', paidAt: null, payment: 'NIEOPLACONA' }, '2026-10-31');
    expect(open.map((r) => `${r.date}:${r.state}`)).toEqual([
      '2026-10-27:WYSLANE', '2026-10-30:WYSLANE', '2026-10-31:WYSLANE', '2026-11-06:ZAPLANOWANE', '2026-11-13:ZAPLANOWANE',
    ]);
    const paid = reminderPlan({ dueDate: '2026-10-30', paidAt: '2026-10-29', payment: 'OPLACONA' }, '2026-11-20');
    expect(paid.map((r) => r.state)).toEqual(['WYSLANE', 'WSTRZYMANE', 'WSTRZYMANE', 'WSTRZYMANE', 'WSTRZYMANE']);
  });
});

describe('M7 — treść w języku odbiorcy, kwota w walucie faktury', () => {
  const row = (locale: string, offset: number, party = 'PAYER') => ({
    template: 'PAYMENT_REMINDER',
    payload: { number: 'SCX/FV/39/8', due: '2026-10-30', offset, currency: 'PLN', gross: 12345.6, party, locale },
  });
  it('PL / EN / SV — temat i treść z kwotą w walucie faktury (kod, liczba wg języka)', () => {
    expect(formatInvoiceAmount(12345.6, 'PLN', 'pl')).toMatch(/^12\s345,60 PLN$/);
    expect(formatInvoiceAmount(12345.6, 'EUR', 'en')).toBe('12,345.60 EUR');
    const pl = renderNotice(row('pl', -3));
    expect(pl.subject).toBe('Faktura SCX/FV/39/8: termin za 3 dni');
    expect(pl.body).toMatch(/12\s345,60 PLN/);
    expect(pl.body).toContain('30.10.2026');
    expect(renderNotice(row('en', 0)).subject).toBe('Invoice SCX/FV/39/8: due today');
    expect(renderNotice(row('sv', 7, 'PAYEE')).subject).toBe('Faktura SCX/FV/39/8: 7 dagar efter förfallodagen');
    expect(renderNotice(row('sv', 7, 'PAYEE')).body).toMatch(/^Fordran/);
    expect(renderNotice(row('en', 1)).severity).toBe('HIGH');
  });
  it('e-mail: tekst + HTML (escapowany), link do aplikacji', () => {
    const m = renderEmail({ template: 'INVOICE_NEW', payload: { number: 'A<b>', gross: 1, currency: 'EUR', due: '2026-10-01', week: '2026-W39', locale: 'pl' } }, 'https://app.example/');
    expect(m.subject).toBe('Nowa faktura A<b> do weryfikacji');
    expect(m.html).toContain('A&lt;b&gt;');
    expect(m.text).toContain('https://app.example/#/');
  });
  it('centrum powiadomień: wiersz serwera → powiadomienie (id srv-, przeczytane, odnośnik do faktur)', () => {
    const n = notificationFromRow({ id: 42, template: 'PAYMENT_REMINDER', payload: { ...row('pl', 1).payload, invoice_id: 'abc' }, load_id: null, created_at: '2026-10-31T00:15:00Z', read_at: null });
    expect(n.id).toBe('srv-42');
    expect(n.read).toBe(false);
    expect(n.href).toEqual({ view: 'inv', entityId: 'abc', loadId: undefined, path: '/finanse/faktury/abc', allowed: true });
    expect(n.title).toBe('Faktura SCX/FV/39/8: 1 dzień po terminie');
  });
});
