/**
 * wyglad/P5 — jedno miejsce danych Finansów (E16, E39). Dziś liczy z cen transportów w aplikacji (EUR z widoków cen);
 * próg marży i średnie cen paliwa z publikacjami podaje baza — podłącza wykonawca (D-20261014-2005-01).
 * Przykłady demo wyłącznie za warunkiem trybu demo wpisanym wprost (strażnik I-0, `tests/p5-finance.test.ts`).
 */
import type { Bill, Document, Load } from '../types';
import type { AccountingPack, PackConfig, PackKey, PackSent } from './p5Pack';
import { belowThreshold, financeSummary, fuelWeeks, type FinBelowRow, type FinSide, type FinSummary, type FuelWeekRow } from './p5Finance';
import { demoAccountingPack, demoDocRequirements, demoFactoringOffer, demoFactoringTasks, demoFeeRules, demoFeeSuggestions, demoFuelEnrich, demoMarginThreshold, demoPackActions, demoPermits, demoPolicies } from './p5Demo';
import { DEFAULT_DOC_REQUIREMENTS, type DocRequirement } from './docRequirements';
import type { FeeRules, FeeSuggestion } from './p5Fees';

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
  /** ZIP z tą samą zawartością co e-mail: faktury, CMR każdego transportu, zestawienie (4A). */
  zip: (pack: AccountingPack, cmrDocs: Document[], codeOf: (loadId: string) => string) => Promise<void>;
}
export function accountingPackActionsOf(): PackActions | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoPackActions() : null;
}

/** E31 — zezwolenia „Firma” (podpinane same według rodzaju ładunku) i „Trasa” (SCX przy transporcie). */
export interface PermitView {
  id: string;
  scope: 'FIRMA' | 'TRASA';
  country: 'PL' | 'SE' | 'PL+SE';
  number: string | null;
  validFrom: string | null;
  validTo: string | null;
  /** Limity zestawu w metrach: długość × szerokość × wysokość. */
  limits: { l: number; w: number; h: number } | null;
  pilot: string | null;
  appliesTo: string;
  loads: number;
}
/** null = nie podłączone (tabela „Zezwolenia” ukryta; zezwolenia dodaje się jak dziś w panelu transportu). */
export function permitsOf(loads: Load[]): PermitView[] | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoPermits(loads) : null;
}
/**
 * „+ Dodaj” przy „Inne pliki” i rodzaj „Inne” w oknie „Wgraj dokument” (E31 pkt 5; D-20261014-2005-01 S4 pkt 7).
 * Demo: włączone. Produkcja: po podłączeniu rodzaju `OTHER` (odczyt w `documentFromRow`, wiele plików bez wersji,
 * uprawnienia HHL i SCX) — wykonawca zmienia tylko ten warunek (D-20261016-2130-01 pkt 3.1).
 */
export function otherDocsOn(): boolean {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase';
}
/** Wybór „Firma / Trasa” w oknie „Wgraj dokument” — po podłączeniu rodzaju zezwolenia w bazie. */
export function permitScopeOf(): boolean {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase';
}

/**
 * Wymagania dokumentów przed odczytem z bazy (strona Dokumenty, panel, Harmonogram, Opcje › Terminy).
 * Demo: decyzja E31 (tylko CMR z podpisem odbiorcy po „Dostarczone”, bez rysunku) — audyt-C C-03, C-04.
 * Produkcja: wartości startowe jak w bazie, do odczytu `doc_requirements` (zmianę wymagania CMR robi wykonawca, P5).
 */
export function docRequirementsStart(): DocRequirement[] {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoDocRequirements() : DEFAULT_DOC_REQUIREMENTS;
}

/**
 * Dokumenty, które widzi firma. Produkcja: RLS w bazie (lista bez zmian). Demo: według `visibleTo`
 * (E31 pytanie 3 B: KSH widzi Polisę HHL, SCX swoją polisę, HHL obie) — audyt-C C-06.
 */
export function docsSeenOf<D extends Pick<Document, 'visibleTo'>>(docs: readonly D[], role: Document['visibleTo'][number]): D[] {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? docs.filter((d) => !d.visibleTo.length || d.visibleTo.includes(role)) : [...docs];
}

/** E31 — polisy dodawane raz (G-21): OCP przewoźnika (SCX, zatwierdza HHL) i polisa HHL. */
export interface PolicyView { org: 'SCX' | 'HHL'; name: string; number: string; validTo: string; approved: boolean }
/** null = nie podłączone: w uwagach liczba transportów z ważną polisą (jak dziś), bez numeru polisy. */
export function policiesOf(): PolicyView[] | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoPolicies() : null;
}

/** E33 — zasady cennika w panelu „Ceny” (czas wolny, stawki postoju, procenty anulowania). null = nie podłączone. */
export function feeRulesOf(): FeeRules | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoFeeRules() : null;
}

/**
 * E33 — podpowiedzi dopłat (pomiar postoju ze stref, anulowanie z cennika) i stan decyzji firm.
 * null = nie podłączone: w panelu zostaje dzisiejszy formularz dopłat (`AgreedFeeForm`).
 */
export function feeSuggestionsOf(load: Load): FeeSuggestion[] | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoFeeSuggestions(load) : null;
}
