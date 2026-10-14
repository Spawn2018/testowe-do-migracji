/**
 * wyglad/P5 — jedno miejsce danych Finansów (E16, E39). Dziś liczy z cen transportów w aplikacji (EUR z widoków cen);
 * próg marży i średnie cen paliwa z publikacjami podaje baza — podłącza wykonawca (dopisek do PR wyglad/P5).
 * Przykłady demo wyłącznie za warunkiem trybu demo wpisanym wprost (strażnik I-0, `tests/p5-finance.test.ts`).
 */
import type { Bill, Document, Load } from '../types';
import type { PackConfig, PackKey, PackSent } from './p5Pack';
import { belowThreshold, financeSummary, fuelWeeks, type FinBelowRow, type FinSide, type FinSummary, type FuelWeekRow } from './p5Finance';
import { demoAccountingPack, demoFactoringOffer, demoFactoringTasks, demoFuelEnrich, demoMarginThreshold, demoPackActions } from './p5Demo';

/** Próg marży w % (Opcje › Cennik i opłaty, E16); null = nie ustawiony, flaga wyłączona. */
export function marginThresholdOf(): number | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoMarginThreshold() : null;
}

export function financeOf(loads: Load[], side: FinSide): FinSummary {
  return financeSummary(loads, side);
}

export function belowOf(loads: Load[], thresholdPct: number | null): FinBelowRow[] {
  return belowThreshold(loads, thresholdPct);
}

/** E39 — tabela tygodni. Średnie cen i publikacje: w produkcji z bazy (`fuel_basis`), dziś „—”. */
export function fuelWeeksOf(loads: Load[], side: FinSide, today: string): FuelWeekRow[] {
  const rows = fuelWeeks(loads, side, today);
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoFuelEnrich(rows, today) : rows;
}

/** E4b — oferta faktoringu HHL (Opcje › Pieniądze › Faktoring, wersja z datą). W produkcji z bazy — wykonawca. */
export interface FactoringOfferView { feePct: number; hours: number; version: number; from: string }
export function factoringOfferOf(): FactoringOfferView | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoFactoringOffer() : null;
}

/** E4b — zadania „Wypłata faktoringu” dla HHL (akceptacja faktury z faktoringiem → 48 h). W produkcji z bazy — wykonawca. */
export interface FactoringTask {
  billId: string; number: string; issuer: string; currency: 'EUR' | 'PLN';
  net: number; gross: number; fee: number; payout: number; feePct: number; hours: number;
  issuedAt: string; acceptedAt: string; dueAt: string; paidAt: string | null;
}
export function factoringTasksOf(bills: Bill[], nowIso: string): FactoringTask[] {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoFactoringTasks(bills, nowIso) : [];
}

/**
 * E40 — adresy księgowości (Opcje, zmienia Administrator HHL) i dziennik wysyłek paczek.
 * null = nie podłączone: sekcji „Paczka tygodnia dla księgowości” nie ma. W produkcji z bazy — wykonawca.
 */
export function accountingPackConfigOf(bills: Bill[]): PackConfig | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoAccountingPack(bills) : null;
}

/** E40 — „Wyślij” (e-mail z załącznikami po stronie serwera, wpis w Historii zmian) i „Pobierz paczkę (ZIP)”. */
export interface PackActions {
  send: (key: PackKey, weekKey: string, to: string[], nowIso: string) => Promise<PackSent | null>;
  zip: (docs: Document[], filename: string, codeOf: (loadId: string) => string) => Promise<void>;
}
export function accountingPackActionsOf(): PackActions | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoPackActions() : null;
}
