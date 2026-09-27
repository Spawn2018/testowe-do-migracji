/**
 * M7 — treść powiadomień (e-mail + centrum powiadomień) w języku odbiorcy.
 * Jedno źródło dla funkcji `send-notifications` (Deno) i aplikacji (SupabaseProvider).
 * Kwota w walucie faktury, format P5: kod waluty, liczba wg języka. Bez importów (Deno + Vite).
 */
export type NotifyLocale = 'pl' | 'en' | 'sv';
export interface NotifyRow {
  template: string;
  payload: Record<string, unknown>;
}
export interface RenderedNotice {
  subject: string;
  body: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  view: 'inv' | 'risk' | null;
}

const NUM: Record<NotifyLocale, string> = { pl: 'pl-PL', en: 'en-GB', sv: 'sv-SE' };
export const asLocale = (v: unknown): NotifyLocale => (v === 'en' || v === 'sv' ? v : 'pl');

export function formatInvoiceAmount(amount: unknown, currency: unknown, locale: NotifyLocale): string {
  const n = Number(amount);
  const cur = String(currency ?? '').toUpperCase() === 'PLN' ? 'PLN' : 'EUR';
  if (!Number.isFinite(n)) return `— ${cur}`;
  return `${new Intl.NumberFormat(NUM[locale], { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)} ${cur}`;
}

export function formatDay(iso: unknown): string {
  const s = String(iso ?? '');
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : s;
}

function reminderPhrase(off: number, locale: NotifyLocale): string {
  const d = Math.abs(off);
  if (locale === 'en') return off < 0 ? `due in ${d} ${d === 1 ? 'day' : 'days'}` : off === 0 ? 'due today' : `${d} ${d === 1 ? 'day' : 'days'} overdue`;
  if (locale === 'sv') return off < 0 ? `förfaller om ${d} ${d === 1 ? 'dag' : 'dagar'}` : off === 0 ? 'förfaller i dag' : `${d} ${d === 1 ? 'dag' : 'dagar'} efter förfallodagen`;
  return off < 0 ? `termin za ${d} ${d === 1 ? 'dzień' : 'dni'}` : off === 0 ? 'termin dziś' : `${d} ${d === 1 ? 'dzień' : 'dni'} po terminie`;
}

export function renderNotice(row: NotifyRow, localeOverride?: NotifyLocale): RenderedNotice {
  const p = row.payload ?? {};
  const locale = localeOverride ?? asLocale(p.locale);
  const num = String(p.number ?? '');
  switch (row.template) {
    case 'PAYMENT_REMINDER': {
      const off = Number(p.offset ?? 0);
      const amount = formatInvoiceAmount(p.gross, p.currency, locale);
      const due = formatDay(p.due);
      const payer = p.party === 'PAYER';
      const phrase = reminderPhrase(off, locale);
      const subject = locale === 'en'
        ? `Invoice ${num}: ${phrase}`
        : locale === 'sv' ? `Faktura ${num}: ${phrase}` : `Faktura ${num}: ${phrase}`;
      const body = locale === 'en'
        ? `${payer ? 'Payment due' : 'Receivable'}: invoice ${num}, ${amount}, due ${due}. ${payer ? 'Please pay by the due date.' : 'Payment has not been marked as received yet.'}`
        : locale === 'sv'
          ? `${payer ? 'Att betala' : 'Fordran'}: faktura ${num}, ${amount}, förfallodag ${due}. ${payer ? 'Betala senast på förfallodagen.' : 'Betalningen är ännu inte markerad som mottagen.'}`
          : `${payer ? 'Do zapłaty' : 'Należność'}: faktura ${num}, ${amount}, termin ${due}. ${payer ? 'Prosimy o zapłatę w terminie.' : 'Płatność nie została jeszcze oznaczona jako otrzymana.'}`;
      return { subject, body, severity: off > 0 ? 'HIGH' : 'MEDIUM', view: 'inv' };
    }
    case 'INVOICE_NEW': {
      const amount = formatInvoiceAmount(p.gross, p.currency, locale);
      const due = formatDay(p.due);
      const subject = locale === 'en' ? `New invoice ${num} to verify` : locale === 'sv' ? `Ny faktura ${num} att granska` : `Nowa faktura ${num} do weryfikacji`;
      const body = locale === 'en'
        ? `Invoice ${num} (${String(p.week ?? '')}), ${amount}, due ${due}.`
        : locale === 'sv' ? `Faktura ${num} (${String(p.week ?? '')}), ${amount}, förfallodag ${due}.` : `Faktura ${num} (${String(p.week ?? '')}), ${amount}, termin ${due}.`;
      return { subject, body, severity: 'MEDIUM', view: 'inv' };
    }
    case 'ORDER_NO_MISSING': {
      const code = String(p.code ?? '');
      const hhl = p.side === 'HHL';
      const subject = locale === 'en'
        ? `${code}: missing ${hhl ? 'HHL' : 'carrier'} order number`
        : locale === 'sv' ? `${code}: ${hhl ? 'HHL' : 'transportörens'} ordernummer saknas` : `${code}: brak numeru zlecenia ${hhl ? 'HHL' : 'przewoźnika'}`;
      const body = locale === 'en'
        ? `Enter the order number before ${formatDay(p.due)}.`
        : locale === 'sv' ? `Ange ordernumret före ${formatDay(p.due)}.` : `Uzupełnij numer zlecenia przed ${formatDay(p.due)}.`;
      return { subject, body, severity: 'HIGH', view: 'risk' };
    }
    case 'SCHEDULE_DATE_CRITICAL': {
      const code = String(p.code ?? '');
      const ld = formatDay(p.load_date), dd = formatDay(p.delivery_date);
      const subject = locale === 'en'
        ? `${code}: schedule date changed on an advised transport`
        : locale === 'sv' ? `${code}: datum ändrat i schemat för aviserad transport` : `${code}: zmiana daty w harmonogramie na awizowanym transporcie`;
      const body = locale === 'en'
        ? `New plan: loading ${ld}, delivery ${dd}. Check the advice window.`
        : locale === 'sv' ? `Ny plan: lastning ${ld}, leverans ${dd}. Kontrollera aviseringsfönstret.` : `Nowy plan: załadunek ${ld}, dostawa ${dd}. Sprawdź okno awizacji.`;
      return { subject, body, severity: 'HIGH', view: null };
    }
    case 'PLAN_DATES_CHANGED': {
      // I-18 (0061): zmiana daty POTWIERDZONEJ przez KSH — HHL, przewoźnik i KSH (bez autora)
      const code = String(p.code ?? '');
      const ld = formatDay(p.load_date), dd = formatDay(p.delivery_date);
      const bl = formatDay(p.before_load_date), bd = formatDay(p.before_delivery_date);
      const by = String(p.by ?? '');
      const reconfirm = p.status === 'WSTEPNA';
      const subject = locale === 'en'
        ? `${code}: confirmed plan dates changed (${by})`
        : locale === 'sv' ? `${code}: bekräftade plandatum ändrade (${by})` : `${code}: zmiana potwierdzonych dat planu (${by})`;
      const body = (locale === 'en'
        ? `Loading ${bl} → ${ld}, delivery ${bd} → ${dd}.` + (reconfirm ? ' KSH must confirm the dates again.' : '')
        : locale === 'sv' ? `Lastning ${bl} → ${ld}, leverans ${bd} → ${dd}.` + (reconfirm ? ' KSH måste bekräfta datumen igen.' : '')
        : `Załadunek ${bl} → ${ld}, dostawa ${bd} → ${dd}.` + (reconfirm ? ' KSH musi ponownie potwierdzić daty.' : ''));
      return { subject, body, severity: 'HIGH', view: null };
    }
    default:
      return { subject: row.template, body: '', severity: 'LOW', view: null };
  }
}

/** Treść e-maila (tekst + prosty HTML) — bez zewnętrznych zasobów. */
/**
 * A6-T1 — język e-maila = `app_users.locale` odbiorcy (po user_id, zapasowo po adresie e-mail);
 * brak konta → `payload.locale` (renderNotice), dalej PL.
 */
export function recipientLocale(
  row: { user_id?: string | null; recipient?: string | null },
  users: { id: string; email?: string | null; locale?: string | null }[],
): NotifyLocale | undefined {
  const u = (row.user_id ? users.find((x) => x.id === row.user_id) : undefined)
    ?? users.find((x) => !!row.recipient && (x.email ?? '').toLowerCase() === row.recipient.toLowerCase());
  return u?.locale === 'pl' || u?.locale === 'en' || u?.locale === 'sv' ? u.locale : undefined;
}

export function renderEmail(row: NotifyRow, appUrl: string, localeOverride?: NotifyLocale): { subject: string; text: string; html: string } {
  const n = renderNotice(row, localeOverride);
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const link = appUrl ? `${appUrl.replace(/\/$/, '')}/#/` : '';
  const text = `${n.body}${link ? `\n\n${link}` : ''}\n\n— Tower · H&H Logistics`;
  const html = `<p>${esc(n.body)}</p>${link ? `<p><a href="${esc(link)}">${esc(link)}</a></p>` : ''}<p style="color:#666">— Tower · H&amp;H Logistics</p>`;
  return { subject: n.subject, text, html };
}
