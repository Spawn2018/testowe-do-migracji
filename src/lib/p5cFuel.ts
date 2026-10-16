/**
 * wyglad/P5-c — opłata paliwowa przy pozycji faktury (E39: „Opłata paliwowa t41 · ×1,13” i kwota z wyliczenia).
 * Czysta funkcja widoku: z migawki opłaty na transporcie (strona kosztu dla faktury SCX → HHL, przychodu dla HHL → KSH).
 * Bez zapytań i zapisów.
 */
import type { BillDirection, BillLineFx, Load } from '../types';
import { addDays, isoWeek, mondayOf, stateOfSnap } from './p5Finance';

export interface BillLineFuel {
  /** Numer tygodnia obowiązywania (tydzień załadunku). */
  week: number;
  /** Stosowany mnożnik (niższy z dwóch). */
  mult: number;
  /** Kwota opłaty w walucie faktury; null — nie da się przeliczyć (brak kursu przy innej walucie). */
  amount: number | null;
  currency: 'EUR' | 'PLN';
  /** Mnożnik jeszcze prognozowany (tydzień wskaźników niezamknięty). */
  forecast: boolean;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function billLineFuel(load: Load | undefined, direction: BillDirection, billCurrency: 'EUR' | 'PLN', fx: BillLineFx | null | undefined, today: string): BillLineFuel | null {
  const pr = load?.pricing;
  const side = pr?.money ? (direction === 'KOSZT' ? pr.money.cost : pr.money.rev) : null;
  if (!pr || !side) return null;
  const ref = side.fuel.refDate;
  if (!/^\d{4}-\d{2}-\d{2}/.test(ref) || !(side.fuel.applied > 0)) return null;
  /* stan jak w Finansach (E39): ostateczna / prognoza; „bez ceny” — bez linii (nie pokazujemy ×1,00) */
  const state = stateOfSnap(side.fuel.status, addDays(mondayOf(ref.slice(0, 10)), -1), today);
  if (state === 'BRAK') return null;
  const raw = direction === 'KOSZT' ? pr.costSefs : pr.revSefs;
  let amount: number | null = Number.isFinite(raw) ? raw : null;
  if (amount != null && pr.currency !== billCurrency) {
    amount = pr.currency === 'EUR' && billCurrency === 'PLN' && fx && fx.mid > 0 ? round2(amount * fx.mid) : null;
  }
  return { week: isoWeek(ref.slice(0, 10)), mult: side.fuel.applied, amount, currency: billCurrency, forecast: state === 'PROGNOZA' };
}
