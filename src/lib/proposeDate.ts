/**
 * #384 pkt 5 (właściciel 21.10.2026, 11:30): „Proponuję inny termin” z datą, nie samym komentarzem.
 * Baza (0251): decision_resolve(p_decision, p_option, p_note, p_payload) — dla efektu PROPOSE wymagana
 * `load_date`; opcjonalnie `load_from` (ISO z przesunięciem), `delivery_date`, `delivery_from`.
 * Godziny: załadunek po czasie polskim, dostawa po szwedzkim (plac w Boden).
 */
import { TZ_LOAD_PL, TZ_UNLOAD_SE, wallLocalToIso } from './time';

export interface ProposalForm {
  loadDate: string;
  loadTime: string;
  deliveryDate: string;
  deliveryTime: string;
}

export const EMPTY_PROPOSAL: ProposalForm = { loadDate: '', loadTime: '', deliveryDate: '', deliveryTime: '' };

export type ProposalError = 'NO_LOAD_DATE' | 'PAST' | 'DELIVERY_BEFORE_LOAD' | 'BAD_FORMAT';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^\d{2}:\d{2}$/;

/** Dzień kalendarzowy w Warszawie (YYYY-MM-DD) dla chwili `now`. */
export function warsawDay(now: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ_LOAD_PL, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Payload dla bazy albo błąd do pokazania. */
export function proposalPayload(f: ProposalForm, now: Date): { payload: Record<string, string> } | { error: ProposalError } {
  const ld = f.loadDate.trim();
  if (!ld) return { error: 'NO_LOAD_DATE' };
  if (!DAY.test(ld) || (f.loadTime && !HM.test(f.loadTime)) || (f.deliveryDate && !DAY.test(f.deliveryDate)) || (f.deliveryTime && !HM.test(f.deliveryTime))) {
    return { error: 'BAD_FORMAT' };
  }
  /* jak baza (0251: load_date > dziś) — propozycja na dziś nie ma sensu */
  if (ld <= warsawDay(now)) return { error: 'PAST' };
  const dd = f.deliveryDate.trim();
  if (dd && dd < ld) return { error: 'DELIVERY_BEFORE_LOAD' };
  const payload: Record<string, string> = { load_date: ld };
  if (f.loadTime) {
    const iso = wallLocalToIso(`${ld}T${f.loadTime}`, TZ_LOAD_PL);
    if (iso) payload.load_from = iso;
  }
  if (dd) {
    payload.delivery_date = dd;
    if (f.deliveryTime) {
      const iso = wallLocalToIso(`${dd}T${f.deliveryTime}`, TZ_UNLOAD_SE);
      if (iso) payload.delivery_from = iso;
    }
  }
  return { payload };
}

/** Krótki opis propozycji do komentarza, gdy użytkownik nic nie wpisał: „Proponowany załadunek 24.10.2026, 08:00”. */
export function proposalSummary(f: ProposalForm): string {
  const pl = (d: string) => d.split('-').reverse().join('.');
  const load = `załadunek ${pl(f.loadDate)}${f.loadTime ? `, ${f.loadTime}` : ''}`;
  const del = f.deliveryDate ? ` · dostawa ${pl(f.deliveryDate)}${f.deliveryTime ? `, ${f.deliveryTime}` : ''}` : '';
  return `Proponowany ${load}${del}`;
}

/** Propozycja zapisana w decyzji (`detail.proposal`, 0251) → opis po polsku; brak — null. */
export function proposalOfDetail(detail: Record<string, unknown> | null | undefined): string | null {
  const p = detail && typeof detail.proposal === 'object' && detail.proposal ? detail.proposal as Record<string, unknown> : null;
  const ld = p && typeof p.load_date === 'string' ? p.load_date : '';
  if (!ld) return null;
  const hm = (v: unknown, tz: string) => {
    if (typeof v !== 'string' || !v) return '';
    const t = Date.parse(v);
    return Number.isFinite(t) ? new Intl.DateTimeFormat('pl-PL', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(t)) : '';
  };
  return proposalSummary({
    loadDate: ld, loadTime: hm(p?.load_from, TZ_LOAD_PL),
    deliveryDate: typeof p?.delivery_date === 'string' ? p.delivery_date : '', deliveryTime: hm(p?.delivery_from, TZ_UNLOAD_SE),
  });
}
