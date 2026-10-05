import { clickFromPayload, emailUrl } from './clickTargets.ts';
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

function digestLine(p: Record<string, unknown>, locale: NotifyLocale): RenderedNotice | null {
  const events = Array.isArray(p.events) ? p.events as { order_no?: string }[] : [];
  const orders = events.map((r) => r?.order_no).filter((x): x is string => Boolean(x));
  if (orders.length === 0) return null;
  const list = orders.join(', ');
  const subject = locale === 'en' ? 'Watch Tower digest' : locale === 'sv' ? 'Watch Tower — sammanfattning' : 'Watch Tower — skrót';
  const lead = locale === 'en'
    ? 'Non-critical events from today, in one e-mail.'
    : locale === 'sv' ? 'Icke-kritiska händelser från idag, i ett e-postmeddelande.'
    : 'Zdarzenia niekrytyczne z dzisiaj, w jednym e-mailu.';
  return { subject, body: `${lead}\n${list}`, severity: 'LOW', view: 'risk' };
}

export function renderNotice(row: NotifyRow, localeOverride?: NotifyLocale): RenderedNotice {
  const p = row.payload ?? {};
  const locale = localeOverride ?? asLocale(p.locale);
  const folded = digestLine(p, locale);
  if (folded) return folded;
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
    case 'INVOICE_DISPUTED':
    case 'INVOICE_DISPUTE_REPLY':
    case 'INVOICE_DISPUTE_RESOLVED': {
      // III-7 (0079): ścieżka sporu faktury — druga strona dostaje zgłoszenie, odpowiedź wystawcy i rozstrzygnięcie
      const note = String(p.note ?? '').trim();
      const T = {
        INVOICE_DISPUTED: { pl: `Faktura ${num} w sporze`, en: `Invoice ${num} disputed`, sv: `Faktura ${num} bestridd` },
        INVOICE_DISPUTE_REPLY: { pl: `Odpowiedź wystawcy w sporze o fakturę ${num}`, en: `Issuer replied to the dispute on invoice ${num}`, sv: `Utfärdaren svarade på tvisten om faktura ${num}` },
        INVOICE_DISPUTE_RESOLVED: { pl: `Spór o fakturę ${num} zamknięty`, en: `Dispute on invoice ${num} closed`, sv: `Tvisten om faktura ${num} avslutad` },
      }[row.template as 'INVOICE_DISPUTED' | 'INVOICE_DISPUTE_REPLY' | 'INVOICE_DISPUTE_RESOLVED'];
      const lead = row.template === 'INVOICE_DISPUTE_RESOLVED'
        ? { pl: 'Odbiorca rozstrzygnął spór.', en: 'The recipient resolved the dispute.', sv: 'Mottagaren avgjorde tvisten.' }[locale]
        : row.template === 'INVOICE_DISPUTED'
          ? { pl: 'Uzasadnienie odbiorcy:', en: "Recipient's reason:", sv: 'Mottagarens motivering:' }[locale]
          : { pl: 'Treść odpowiedzi:', en: 'Reply:', sv: 'Svar:' }[locale];
      return { subject: T[locale], body: note ? `${lead} ${note}` : lead, severity: row.template === 'INVOICE_DISPUTED' ? 'HIGH' : 'MEDIUM', view: 'inv' };
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
    case 'RESOURCE_DEADLINE': {
      // I-21 (0073): brak zasobu przed załadunkiem (kierowca / pojazd / dokumenty)
      const code = String(p.code ?? '');
      const res = String(p.resource ?? '');
      const what = locale === 'en'
        ? (res === 'DRIVER' ? 'driver details' : res === 'VEHICLE' ? 'tractor or trailer plates' : res === 'ESCORT' ? 'escort vehicles required by the permit' : 'documents')
        : locale === 'sv'
          ? (res === 'DRIVER' ? 'föraruppgifter' : res === 'VEHICLE' ? 'registreringsnummer för dragbil eller trailer' : res === 'ESCORT' ? 'följebilar enligt tillståndet' : 'dokument')
          : (res === 'DRIVER' ? 'dane kierowcy' : res === 'VEHICLE' ? 'tablice ciągnika lub naczepy' : res === 'ESCORT' ? 'pojazdy pilotujące wymagane zezwoleniem' : 'dokumenty');
      const subject = locale === 'en' ? `${code}: missing ${what}` : locale === 'sv' ? `${code}: ${what} saknas` : `${code}: brak — ${what}`;
      const body = locale === 'en'
        ? `Complete before loading on ${formatDay(p.due)}.`
        : locale === 'sv' ? `Komplettera före lastning ${formatDay(p.due)}.` : `Uzupełnij przed załadunkiem ${formatDay(p.due)}.`;
      return { subject, body, severity: p.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH', view: 'risk' };
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
    case 'WORKFLOW_ALERT': {
      // 9.1 (0094): akcja „notify” reguły automatyzacji — nazwa reguły (tekst administratora), transport, opcjonalny tekst
      const code = String(p.code ?? '');
      const rule = String(p.rule ?? '');
      const text = String(p.text ?? '');
      const subject = locale === 'en'
        ? `${code}: automation rule „${rule}”`
        : locale === 'sv' ? `${code}: automatiseringsregel „${rule}”` : `${code}: reguła automatyzacji „${rule}”`;
      const body = text || (locale === 'en'
        ? `The rule „${rule}” was triggered for transport ${code}.`
        : locale === 'sv' ? `Regeln „${rule}” utlöstes för transport ${code}.` : `Reguła „${rule}” zadziałała dla transportu ${code}.`);
      return { subject, body, severity: 'MEDIUM', view: null };
    }
    case 'INSURANCE_EXPIRY': {
      // 6.6 (0097): polisa przewoźnika kończy się w ciągu 14 dni albo już wygasła
      const carrier = String(p.carrier ?? '');
      const policy = String(p.policy_no ?? '');
      const due = formatDay(p.due);
      const expired = p.severity === 'CRITICAL';
      const subject = locale === 'en'
        ? `Policy ${policy} (${carrier}) ${expired ? 'expired' : 'expires'} ${due}`
        : locale === 'sv' ? `Försäkring ${policy} (${carrier}) ${expired ? 'gick ut' : 'går ut'} ${due}` : `Polisa ${policy} (${carrier}) ${expired ? 'wygasła' : 'wygasa'} ${due}`;
      const body = locale === 'en'
        ? 'Upload the current carrier policy in Documents.'
        : locale === 'sv' ? 'Ladda upp transportörens gällande försäkring under Dokument.' : 'Wgraj aktualną polisę przewoźnika w widoku Dokumenty.';
      return { subject, body, severity: expired ? 'CRITICAL' : 'HIGH', view: 'risk' };
    }
    case 'SMS_FALLBACK': {
      // I-3 (0067): SMS niewysłany w 10 min albo FAILED — treść do przekazania kierowcy telefonicznie/komunikatorem
      const code = String(p.code ?? '');
      const tail = String(p.to_tail ?? '');
      const text = String(p.text ?? '');
      const subject = locale === 'en'
        ? `${code}: SMS to driver not sent (…${tail}) — pass it on`
        : locale === 'sv' ? `${code}: SMS till föraren ej skickat (…${tail}) — vidarebefordra` : `${code}: SMS do kierowcy niewysłany (…${tail}) — przekaż treść`;
      const body = (locale === 'en'
        ? `The SMS gateway did not send this message within 10 minutes. Call the driver or forward the text:\n\n${text}`
        : locale === 'sv' ? `SMS-gatewayen skickade inte meddelandet inom 10 minuter. Ring föraren eller vidarebefordra texten:\n\n${text}`
        : `Bramka SMS nie wysłała tej wiadomości w ciągu 10 minut. Zadzwoń do kierowcy albo przekaż treść:\n\n${text}`);
      return { subject, body, severity: 'HIGH', view: null };
    }
    case 'SMS_GATEWAY_SILENT': {
      // I-3 (0067): telefon-bramka bez sygnału > 30 min
      const since = String(p.since ?? '—');
      const q = String(p.queued ?? 0);
      const subject = locale === 'en' ? 'SMS gateway silent' : locale === 'sv' ? 'SMS-gatewayen är tyst' : 'Bramka SMS milczy';
      const body = locale === 'en'
        ? `No signal from the gateway phone since ${since} (threshold 30 min). SMS in queue: ${q}. Check power, Wi-Fi and the Watch Tower SMS app.`
        : locale === 'sv' ? `Ingen signal från gateway-telefonen sedan ${since} (gräns 30 min). SMS i kö: ${q}. Kontrollera ström, Wi-Fi och appen Watch Tower SMS.`
        : `Brak sygnału telefonu-bramki od ${since} (próg 30 min). SMS w kolejce: ${q}. Sprawdź zasilanie, Wi-Fi i aplikację Watch Tower SMS.`;
      return { subject, body, severity: 'HIGH', view: 'risk' };
    }
    case 'SMS_UNDELIVERED': {
      const code = String(p.code ?? '');
      const tail = String(p.to_tail ?? '');
      const text = String(p.text ?? '');
      const subject = locale === 'en'
        ? `${code}: SMS sent, no delivery receipt (…${tail})`
        : locale === 'sv' ? `${code}: SMS skickat, ingen leveranskvittens (…${tail})` : `${code}: SMS wysłany, brak potwierdzenia doręczenia (…${tail})`;
      const body = locale === 'en'
        ? `The message was sent but not confirmed as delivered within 10 minutes. Call the driver or forward the text:\n\n${text}`
        : locale === 'sv' ? `Meddelandet skickades men bekräftades inte som levererat inom 10 minuter. Ring föraren eller vidarebefordra texten:\n\n${text}`
        : `Wiadomość wyszła, ale w ciągu 10 minut nie ma potwierdzenia doręczenia. Zadzwoń do kierowcy albo przekaż treść:\n\n${text}`;
      return { subject, body, severity: 'HIGH', view: null };
    }
    case 'ZONE_LIMIT': {
      const subject = locale === 'en'
        ? 'Zone SMS daily limit reached'
        : locale === 'sv' ? 'Dagsgränsen för zon-SMS är nådd' : 'Dzienny limit SMS stref wyczerpany';
      const body = locale === 'en'
        ? 'The 150 zone SMS limit for today is used up. Further zone messages wait until the next day.'
        : locale === 'sv' ? 'Dagens gräns på 150 zon-SMS är förbrukad. Fler zonmeddelanden väntar till nästa dag.'
        : 'Limit 150 SMS stref na dobę jest wyczerpany. Kolejne wiadomości stref poczekają do następnego dnia.';
      return { subject, body, severity: 'HIGH', view: null };
    }
    case 'CLIENT': {
      const subject = locale === 'en'
        ? 'Client organisation notice'
        : locale === 'sv' ? 'Meddelande för kundorganisation' : 'Powiadomienie dla organizacji klienta';
      const body = locale === 'en'
        ? 'This notice is addressed to a client organisation.'
        : locale === 'sv' ? 'Det här meddelandet gäller en kundorganisation.' : 'To powiadomienie dotyczy organizacji klienta.';
      return { subject, body, severity: 'LOW', view: null };
    }
    case 'ROAD_RISK': {
      const event = String(p.event ?? 'zdarzenie drogowe');
      const road = String(p.road ?? 'E4');
      const subject = `Warunki drogowe ${road}: ${event}`;
      const body = `Zdarzenie drogowe w Szwecji: ${event}. Treść jest po polsku. Oryginał tylko w panelu, pod przyciskiem „Pokaż oryginał”.`;
      return { subject, body, severity: 'MEDIUM', view: 'risk' };
    }
    case 'DECISION_ESCALATED':
    case 'DECISION_OPEN': {
      const title = String(p.title ?? '');
      if (title.startsWith('Warunki drogowe') || p.title_key === 'rk_road_se' || p.title_key === 'rk_tv_unknown_code') {
        const subject = title || 'Warunki drogowe';
        const body = 'Zdarzenie drogowe w Szwecji. Treść jest po polsku. Oryginał tylko w panelu, pod przyciskiem „Pokaż oryginał”.';
        return { subject, body, severity: row.template === 'DECISION_ESCALATED' ? 'HIGH' : 'MEDIUM', view: 'risk' };
      }
      const rows = Array.isArray(p.transports) ? p.transports as { order_no?: string }[] : [];
      const orders = rows.map((r) => r?.order_no).filter((x): x is string => Boolean(x));
      const list = orders.length
        ? (locale === 'en' ? `Transports: ${orders.join(', ')}`
          : locale === 'sv' ? `Transporter: ${orders.join(', ')}`
          : `Transporty: ${orders.join(', ')}`)
        : '';
      const subject = row.template === 'DECISION_ESCALATED'
        ? (locale === 'en' ? `Decision is now critical: ${title}` : locale === 'sv' ? `Beslutet är nu kritiskt: ${title}` : `Decyzja jest teraz krytyczna: ${title}`)
        : (locale === 'en' ? `Decision needed: ${title}` : locale === 'sv' ? `Beslut krävs: ${title}` : `Do decyzji: ${title}`);
      const lead = locale === 'en'
        ? 'One event, one e-mail. The list is every affected transport.'
        : locale === 'sv' ? 'En händelse, ett e-postmeddelande. Listan är alla berörda transporter.'
        : 'Jedno zdarzenie, jeden e-mail. Lista to wszystkie dotknięte transporty.';
      const body = list ? `${lead}\n${list}` : lead;
      return { subject, body, severity: row.template === 'DECISION_ESCALATED' ? 'HIGH' : 'MEDIUM', view: 'risk' };
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
  const link = emailUrl(appUrl, clickFromPayload(row.template, row.payload, 'email'));
  const text = `${n.body}${link ? `\n\n${link}` : ''}\n\n— Tower · H&H Logistics`;
  const html = `<p>${esc(n.body)}</p>${link ? `<p><a href="${esc(link)}">${esc(link)}</a></p>` : ''}<p style="color:#666">— Tower · H&amp;H Logistics</p>`;
  return { subject: n.subject, text, html };
}
