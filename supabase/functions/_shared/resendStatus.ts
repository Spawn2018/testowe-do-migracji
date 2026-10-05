/**
 * Status wysyłki wyłącznie z odpowiedzi Resend.
 * Sam kod HTTP 200 nie oznacza, że e-mail wyszedł (Resend potrafi zwrócić 200 i last_event=failed).
 */
export type MailOutcome = 'SENT' | 'ERROR' | 'PENDING';

const SENT = new Set(['sent', 'delivered', 'delivery_delayed', 'opened', 'clicked', 'queued', 'scheduled']);
const FAILED = new Set(['failed', 'bounced', 'complained', 'canceled', 'cancelled', 'suppressed']);

export interface ResendBody {
  id?: unknown;
  name?: unknown;
  message?: unknown;
  status?: unknown;
  last_event?: unknown;
}

export function asResendBody(value: unknown): ResendBody {
  if (!value || typeof value !== 'object') return {};
  return value as ResendBody;
}

function text(v: unknown): string {
  return typeof v === 'string' ? v.trim().toLowerCase() : '';
}

/** SENT tylko gdy odpowiedź Resend niesie status wysłania. Brak statusu przy id = PENDING, nie SENT.
 *  Uwaga: odpowiedź GET z name=restricted_api_key (klucz tylko do wysyłki) obsługuje send-notifications
 *  osobno — nie oznacza ERROR przy przyjętym POST. */
export function emailOutcome(httpStatus: number, body: ResendBody): MailOutcome {
  const event = text(body.last_event) || text(body.status);
  if (FAILED.has(event) || text(body.name)) return 'ERROR';
  if (httpStatus < 200 || httpStatus >= 300) return 'ERROR';
  if (SENT.has(event)) return 'SENT';
  if (typeof body.id === 'string' && body.id.length > 0) return 'PENDING';
  return 'ERROR';
}

export function resendErrorText(httpStatus: number, body: ResendBody): string {
  const event = text(body.last_event) || text(body.status);
  const name = typeof body.name === 'string' ? body.name : '';
  const message = typeof body.message === 'string' ? body.message.slice(0, 240) : '';
  return `Resend ${httpStatus}${event ? ' ' + event : ''}${name ? ' ' + name : ''}${message ? ': ' + message : ''}`.slice(0, 300);
}
