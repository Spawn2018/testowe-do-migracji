/**
 * P6 — one-shot PLN→EUR conversion of makieta demo rates.
 * Table 186/A/NBP/2026 @ 2026-09-24, mid 4.3900 (ZLECENIE_FINAL / MECHANIZM P6).
 * Live NBP remains behind NBP_LIVE=1 / M3; this fixture is for display FX only.
 */
import type { DisplayCurrency, NbpRate } from './engine';
import { eurToPln, formatForUser, formatMoney } from './engine';

export const DEMO_FX: NbpRate = {
  table: 'A',
  no: '186/A/NBP/2026',
  effectiveDate: '2026-09-24',
  mid: 4.39,
};

export const DEMO_FX_META = {
  ...DEMO_FX,
  /** Source currency before P6 conversion */
  convertedFrom: 'PLN' as const,
  /** Canonical storage currency after P6 */
  storedAs: 'EUR' as const,
  tableLabel: '186/A/NBP/2026',
  publishedNote: '2026-09-24 · kurs średni 4,3900',
};

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** PLN → EUR at demo mid (divide). */
export function plnToEurDemo(pln: number): number {
  return round2(pln / DEMO_FX.mid);
}

/** EUR → PLN at demo mid (for display). */
export function eurToPlnDemo(eur: number): number {
  return eurToPln(eur, DEMO_FX);
}

/**
 * Format an amount stored in EUR for the user's display currency.
 * Prefer this over formatMoney(..., displayCurrency) so PLN preference uses DEMO_FX.
 */
export function formatAppMoney(
  amountEur: number,
  lang: 'pl' | 'en' | 'sv',
  display: DisplayCurrency,
): string {
  return formatForUser(amountEur, DEMO_FX, lang, display);
}

/** Explicit EUR/SEK/PLN source amounts (fuel index etc.) — no DEMO_FX. */
export function formatSourceMoney(
  amount: number,
  lang: 'pl' | 'en' | 'sv',
  currency: 'EUR' | 'PLN' | 'SEK',
): string {
  return formatMoney(amount, lang, currency);
}
