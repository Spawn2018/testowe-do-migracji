/**
 * wyglad/P5 — Faktury (E4, img/e4-faktury-desk / -phone) i faktoring (E4b): czyste funkcje widoku.
 * Jeden status faktury (E4 „Porządek”) z dzisiejszych pól weryfikacji i płatności, tygodnie „Do wystawienia”
 * z dostarczonych, jeszcze niezafakturowanych transportów, liczby kafelków. Bez zapisu i bez nowych zapytań.
 */
import type { Bill, BillDirection, Load, RoleId } from '../types';
import { addDaysIso, BILL_VAT_RATE, billCandidates, canVerifyBill, expectedNetFor, invoicedLoadIds, isoWeekMonday } from './invoices3';
import { isoWeekKeyLocal } from './money/engine';
import { unloadedAtOf } from './money/loadMoney';

export type InvStatus = 'DO_WYSTAWIENIA' | 'DO_WERYFIKACJI' | 'ZGODNA' | 'SPORNA' | 'ZAAKCEPTOWANA' | 'OPLACONA' | 'PO_TERMINIE';
export const VAT_RATE = BILL_VAT_RATE;

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Jeden status: Opłacona > Sporna > Po terminie > weryfikacja (Do weryfikacji, Zaakceptowana; „Zgodna” z dawnych zapisów). */
export function billStatus(b: Pick<Bill, 'payment' | 'verification'>): InvStatus {
  if (b.payment === 'OPLACONA') return 'OPLACONA';
  if (b.verification === 'SPORNA') return 'SPORNA';
  if (b.payment === 'PO_TERMINIE') return 'PO_TERMINIE';
  return b.verification;
}

export const ISSUER: Record<BillDirection, 'SCX' | 'HHL'> = { KOSZT: 'SCX', PRZYCHOD: 'HHL' };
export const RECIPIENT: Record<BillDirection, 'HHL' | 'KSH'> = { KOSZT: 'HHL', PRZYCHOD: 'KSH' };

export interface PendingWeek {
  weekKey: string;
  no: number;
  from: string;
  to: string;
  loads: Load[];
  /** Netto według cennika i opłaty paliwowej (EUR). */
  netEur: number;
}

/**
 * Tygodnie zamknięte (niedziela minęła) z dostarczonymi, niezafakturowanymi transportami — „Do wystawienia” (E4),
 * bez kwot. Jedno źródło dla kafla „Czeka na wystawienie” i liczby przy „Faktury” w menu (audyt-C C-10).
 */
export function pendingWeekLoads(loads: readonly Load[], bills: readonly Bill[], direction: BillDirection, today: string): { weekKey: string; loads: Load[] }[] {
  const done = invoicedLoadIds([...bills], direction);
  const keys = new Set<string>();
  for (const l of loads) {
    const at = unloadedAtOf(l);
    if (at && !done.has(l.id)) keys.add(isoWeekKeyLocal(at));
  }
  const out: { weekKey: string; loads: Load[] }[] = [];
  for (const k of [...keys].sort()) {
    if (addDaysIso(isoWeekMonday(k), 6) >= today) continue;
    const list = billCandidates([...loads], [...bills], direction, k);
    if (list.length) out.push({ weekKey: k, loads: list });
  }
  return out;
}

/** „Do wystawienia” (E4) z kwotą netto według cennika i opłaty paliwowej. */
export function pendingWeeks(loads: Load[], bills: Bill[], direction: BillDirection, today: string): PendingWeek[] {
  return pendingWeekLoads(loads, bills, direction, today).map(({ weekKey: k, loads: list }) => {
    const from = isoWeekMonday(k);
    const net = list.reduce((s, l) => s + (expectedNetFor(l, direction, 'EUR', today) ?? 0), 0);
    return { weekKey: k, no: Number(k.slice(-2)), from, to: addDaysIso(from, 6), loads: list, netEur: r2(net) };
  });
}

/** Różnica faktura − wyliczenie (netto, w walucie faktury). */
export const billDiff = (b: Pick<Bill, 'lines'>): number =>
  r2(b.lines.reduce((s, l) => s + (l.invoicedNet ?? 0) - (l.expectedNet ?? 0), 0));

export interface InvKpis {
  pending: PendingWeek[];
  toVerify: Bill[];
  /** Czy weryfikuje bieżąca firma (kafel „Do Twojej weryfikacji”), czy czeka na drugą stronę. */
  verifyMine: boolean;
  dueSoon: Bill[];
  nextDue: string | null;
  overdue: Bill[];
}

export function invoiceKpis(role: RoleId, bills: Bill[], pending: PendingWeek[], direction: BillDirection, today: string): InvKpis {
  const list = bills.filter((b) => b.direction === direction);
  const verifyMine = role === RECIPIENT[direction];
  const toVerify = list.filter((b) => b.verification === 'DO_WERYFIKACJI' && (verifyMine ? canVerifyBill(role, b) : true));
  const open = list.filter((b) => b.payment !== 'OPLACONA' && b.verification !== 'SPORNA');
  const week = addDaysIso(today, 7);
  const dueSoon = open.filter((b) => b.payment !== 'PO_TERMINIE' && b.dueDate >= today && b.dueDate <= week);
  const upcoming = open.filter((b) => b.dueDate >= today).map((b) => b.dueDate).sort();
  return {
    pending,
    toVerify,
    verifyMine,
    dueSoon,
    nextDue: upcoming[0] ?? null,
    overdue: list.filter((b) => b.payment === 'PO_TERMINIE' && b.verification !== 'SPORNA'),
  };
}

/** Faktoring HHL (E4b, 07.10): prowizja % od netto, wypłata = brutto − prowizja. */
export function factoringPayout(net: number, gross: number, feePct: number): { fee: number; payout: number } {
  const fee = r2((net * feePct) / 100);
  return { fee, payout: r2(gross - fee) };
}

/**
 * audyt-C C-16 (E31/E40; decyzja 16.10, 13:58 · 4 — data z rokiem): „t42 · 12.10.2026–18.10.2026” — tydzień w oknie
 * nowej faktury, z kluczem „2026-W42” tylko w wartości pola.
 */
export function weekOptionLabel(weekKey: string): string {
  const m = /^\d{4}-W(\d{2})$/.exec(weekKey);
  if (!m) return weekKey;
  const from = isoWeekMonday(weekKey);
  const dmy = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
  return `t${Number(m[1])} · ${dmy(from)}–${dmy(addDaysIso(from, 6))}`;
}

/** „41 · 05.10–11.10” z klucza tygodnia „2026-W41” (bez „t” — kolumna „Tydzień” w Fakturach; Dokumenty dodają „t”). */
export function weekKeyLabel(weekKey: string): string {
  const m = /^\d{4}-W(\d{2})$/.exec(weekKey);
  if (!m) return weekKey;
  const from = isoWeekMonday(weekKey);
  const to = addDaysIso(from, 6);
  const dm = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}`;
  return `${Number(m[1])} · ${dm(from)}–${dm(to)}`;
}
