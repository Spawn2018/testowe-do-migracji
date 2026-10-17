/**
 * wyglad/W-faktura-termin — A4 (D-20261017-0730-01 §2 A4: „Po terminie płatności → ryzyko `INVOICE_OVERDUE` dla HHL,
 * raz na fakturę (dzwonek i e-mail według macierzy)”).
 * Sprawa w „Do zrobienia” HHL: „Faktura HHL/FV/2026/0902 (HHL → KSH) nieopłacona po terminie 22.10.2026”,
 * przycisk „Otwórz fakturę”. Produkcja: wiersze `risk_signals` od wykonawcy (kontrakt w D-20261017-2130-01);
 * demo: te same sprawy liczone z faktur (lustro reguły bazy). Czyste funkcje widoku — bez zapytań i zapisów.
 */
import type { Bill, Risk } from '../types';
import { addDaysIso, billPaymentToday } from './invoices3';
import { fmtDate } from './time';

export const INVOICE_OVERDUE_KIND = 'INVOICE_OVERDUE';
export const INVOICE_OVERDUE_KEY = 'rk_invoice_overdue';

/** Id sprawy demo (w bazie: klucz `INVOICE_OVERDUE:<invoice_id>`, jedna sprawa na fakturę). */
export const invoiceOverdueId = (billId: string): string => `${INVOICE_OVERDUE_KIND}:${billId}`;

/**
 * Faktura jest sprawą „po terminie”, gdy: nie ma „Opłacona”, dziś (czas polski) jest po dniu terminu i faktura nie jest
 * sporna (spór wstrzymuje płatność — jak kafelek „Po terminie” w Fakturach, `invoiceKpis`).
 */
export function isInvoiceOverdue(b: Pick<Bill, 'dueDate' | 'paidAt' | 'payment' | 'verification'>, todayLocal: string): boolean {
  return billPaymentToday(b, todayLocal) === 'PO_TERMINIE' && b.verification !== 'SPORNA';
}

/** Parametry tekstu sprawy — te same, które zapisuje baza w `detail.params`. */
export function invoiceOverdueParams(b: Pick<Bill, 'number' | 'issuer' | 'recipient' | 'dueDate'>): Record<string, string> {
  return { number: b.number, from: b.issuer, to: b.recipient, due: fmtDate(b.dueDate) };
}

/** Sprawa jednej faktury (kształt jak `riskFromRow` z wiersza bazy). */
export function invoiceOverdueRisk(b: Bill, nowIso: string): Risk {
  const params = invoiceOverdueParams(b);
  const since = Date.parse(`${addDaysIso(b.dueDate, 1)}T00:00:00Z`);
  return {
    id: invoiceOverdueId(b.id),
    type: 'OPS',
    severity: 'HIGH',
    title: `Faktura ${params.number} (${params.from}\u00a0→\u00a0${params.to}) nieopłacona po terminie ${params.due}`,
    detail: '',
    owner: 'HHL',
    meta: '',
    nextAction: '',
    ageHours: Math.max(0, Math.round((Date.parse(nowIso) - since) / 36e5)),
    kind: INVOICE_OVERDUE_KIND,
    titleKey: INVOICE_OVERDUE_KEY,
    titleParams: params,
    invoiceId: b.id,
  };
}

/** Demo: wszystkie sprawy „po terminie” z faktur na dziś. */
export function invoiceOverdueRisks(bills: readonly Bill[], todayLocal: string, nowIso: string): Risk[] {
  return bills.filter((b) => isInvoiceOverdue(b, todayLocal)).map((b) => invoiceOverdueRisk(b, nowIso));
}

/**
 * Po zmianie faktury (opłacona, cofnięcie opłaty, spór): sprawa znika, gdy faktura przestała być „po terminie”
 * (jak samozamykanie w bazie); w demo wraca, gdy znów jest po terminie. Na produkcji sprawę zakłada baza — tu tylko znika.
 */
export function syncInvoiceOverdue(risks: Risk[], b: Bill | undefined, todayLocal: string, nowIso: string, demo: boolean): Risk[] {
  if (!b) return risks;
  const mine = (r: Risk) => r.kind === INVOICE_OVERDUE_KIND && r.invoiceId === b.id;
  if (!isInvoiceOverdue(b, todayLocal)) return risks.some(mine) ? risks.filter((r) => !mine(r)) : risks;
  if (!demo || risks.some(mine)) return risks;
  return [...risks, invoiceOverdueRisk(b, nowIso)];
}

/**
 * Demo (F7): sprawy „po terminie” przeliczane z faktur przy każdym wczytaniu zapisanego stanu — faktura, która dziś przeszła
 * termin, dostaje sprawę bez czyszczenia danych przeglądarki; opłacona albo sporna ją traci.
 */
export function refreshInvoiceOverdue(risks: Risk[], bills: readonly Bill[], todayLocal: string, nowIso: string): Risk[] {
  const fresh = invoiceOverdueRisks(bills, todayLocal, nowIso);
  const rest = risks.filter((r) => r.kind !== INVOICE_OVERDUE_KIND);
  const same = fresh.length === risks.length - rest.length
    && fresh.every((f) => risks.some((r) => r.id === f.id));
  return same ? risks : [...rest, ...fresh];
}
