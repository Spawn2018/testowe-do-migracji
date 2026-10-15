/**
 * wyglad/P5-b — jedno miejsce danych ekranów Opcje › Pieniądze: Opłata paliwowa (E3, E39), Dopłaty (postój, E33),
 * Cennik i opłaty (procenty za anulowanie E33, próg marży E16) oraz Terminy płatności i adresy (E40, E12).
 * Każda funkcja: demo — przykład z `p5bDemo.ts`; produkcja — `null` = nie podłączone (zostaje dzisiejszy formularz
 * albo sekcji nie ma). Gałąź produkcyjną podłącza wykonawca w P5 (dopisek D-20261015-1805-01); warunek
 * `import.meta.env.VITE_AUTH_MODE` wpisany wprost (strażnik I-0, `tests/p5b-money.test.ts`). Bez zapytań i zapisów.
 */
import type { PackKey } from './p5Pack';
import type { CancelRulesView, DwellRulesView, FuelActions, FuelScreenView, FuelSource, PaymentTermsView } from './p5bFuel';
import { demoCancelRules, demoDwellRules, demoFuelScreen, demoPaymentTerms } from './p5bDemo';
import { demoMarginThreshold } from './p5Demo';

const ok = async (): Promise<boolean> => true;

/** E3 — ekran Opłaty paliwowej (tydzień bieżący i przyszły, pobieranie cen, ceny z 2 tygodni, tabela mnożników). */
export function fuelScreenOf(today: string): FuelScreenView | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoFuelScreen(today) : null;
}

/** E3 — „Uzupełnij z …” i „Nowa wersja umowy”; null przy akcji = przycisk ukryty. */
export function fuelActionsOf(): FuelActions | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase'
    ? { fill: async (_s: FuelSource, _d: string) => true, newVersion: () => undefined }
    : null;
}

/** E33 — postój (czas wolny, stawki, chwila startu); null = zostaje dzisiejszy formularz progów postoju. */
export function dwellRulesOf(): DwellRulesView | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoDwellRules() : null;
}
export type DwellPatch = Partial<Pick<DwellRulesView, 'freeLoadH' | 'freeUnloadH' | 'hourEur' | 'dayEur' | 'dayAfterH' | 'startFrom' | 'hourMode'>>;
/** Zapis zmiany postoju (Administrator HHL, z wpisem w Historii zmian „było → jest”). */
export function dwellSaverOf(): ((patch: DwellPatch) => Promise<boolean>) | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? ok : null;
}

/** E33 — procenty za anulowanie w cenniku (te same dla kosztu i przychodu, 12:35). */
export function cancelRulesOf(): CancelRulesView | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoCancelRules() : null;
}
export function cancelSaverOf(): ((days: number, pct: number) => Promise<boolean>) | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? ok : null;
}

/** E16 — próg marży w Opcjach: odczyt i zapis razem (null = pole ukryte; `pct: null` = próg nie ustawiony, flaga
 *  wyłączona; `save: null` = tylko odczyt). Ta sama wartość co `marginThresholdOf()` w `p5Source.ts` (Finanse). */
export interface MarginSetting { pct: number | null; save: ((pct: number | null) => Promise<boolean>) | null }
export function marginSettingOf(): MarginSetting | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? { pct: demoMarginThreshold(), save: ok } : null;
}

/** E40 — terminy płatności od daty wystawienia faktury. */
export function paymentTermsOf(): PaymentTermsView | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoPaymentTerms() : null;
}
export function paymentTermsSaverOf(): ((side: 'KSH' | 'SCX', days: number) => Promise<boolean>) | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? ok : null;
}

/** E40 — zapis listy adresów księgowości (lista: `accountingPackConfigOf(bills).addresses` w `p5Source.ts`). */
export function accountingAddressesSaverOf(): ((key: PackKey, list: string[]) => Promise<boolean>) | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? ok : null;
}
/** Wynik próbnego e-maila: BLOCKED — wysyłka poza HHL wyłączona przełącznikiem „Wiadomości na zewnątrz” (E12, G-14). */
export type TestMailResult = 'SENT' | 'BLOCKED' | 'ERROR';
/** E40 — „Wyślij próbny e-mail na ten adres” (według zasad wysyłki, G-14). */
export function accountingTestMailOf(): ((to: string) => Promise<TestMailResult>) | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase'
    ? async (to: string) => (/@example\.com$/i.test(to) ? 'SENT' : 'BLOCKED')
    : null;
}
