/**
 * E16 „Jedno źródło… Kokpit, Finanse, Harmonogram, panel »Ceny« i Faktury… tym samym kodem”, „Stały kurs 4,39 znika
 * z aplikacji” (audyt-F F-04): kwota transportu w PLN liczona kursem NBP tego transportu — migawka z danych
 * (`pricing.money.<strona>.fx.mid`: przed rozładunkiem kurs bieżący, po rozładunku kurs z dnia roboczego przed nim).
 * Ta sama funkcja w panelu „Ceny” i w Harmonogramie. Bez kursu przy transporcie — kwota w walucie ceny (jak panel).
 */
import type { Load } from '../../types';
import { formatMoney, type DisplayCurrency } from './engine';

type Side = 'cost' | 'rev';
type MoneyOf = Pick<Load, 'pricing'>;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Kurs PLN/EUR transportu dla strony (koszt SCX, przychód KSH) albo `null`, gdy go nie ma. */
export function loadFxMid(load: MoneyOf, side: Side): number | null {
  const mid = load.pricing?.money?.[side]?.fx?.mid;
  return typeof mid === 'number' && mid > 0 ? mid : null;
}

const curOf = (load: MoneyOf): 'EUR' | 'PLN' => (load.pricing?.currency === 'PLN' ? 'PLN' : 'EUR');

/** Kwota jednej strony („Twoja cena”, „Moja stawka”, przychód, koszt) w walucie wybranej przez użytkownika. */
export function formatLoadMoney(eur: number, load: MoneyOf, side: Side, lang: 'pl' | 'en' | 'sv', display: DisplayCurrency): string {
  const mid = display === 'PLN' ? loadFxMid(load, side) : null;
  return mid != null ? formatMoney(round2(eur * mid), lang, 'PLN') : formatMoney(eur, lang, curOf(load));
}

/**
 * HHL: przychód i marża w PLN tylko, gdy są oba kursy (jak panel „Ceny”); marża PLN = przychód × kurs przychodu
 * − koszt × kurs kosztu. Inaczej obie kwoty w walucie ceny.
 */
export function formatLoadRevMargin(load: MoneyOf, lang: 'pl' | 'en' | 'sv', display: DisplayCurrency): { rev: string; margin: string } {
  const p = load.pricing;
  const cost = display === 'PLN' ? loadFxMid(load, 'cost') : null;
  const rev = display === 'PLN' ? loadFxMid(load, 'rev') : null;
  if (cost != null && rev != null) {
    return {
      rev: formatMoney(round2(p.revTotal * rev), lang, 'PLN'),
      margin: formatMoney(round2(p.revTotal * rev - p.costTotal * cost), lang, 'PLN'),
    };
  }
  return { rev: formatMoney(p.revTotal, lang, curOf(load)), margin: formatMoney(p.margin, lang, curOf(load)) };
}
