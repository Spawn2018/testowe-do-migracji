/**
 * I-2 — ZERO FASADY. Zasada: każda funkcja widoczna w buildzie produkcyjnym (VITE_AUTH_MODE=supabase)
 * działa na danych z bazy albo jest ukryta / oznaczona „brak źródła danych”. Nigdy nie udaje.
 *
 * Jedno miejsce z listą funkcji ukrytych w produkcji (z powodem) — test `tests/i2-facade.test.ts`
 * pilnuje, że każdy klucz jest użyty w kodzie, a `tests/i2-facade.local.spec.ts` sprawdza build produkcyjny.
 * Tryb demo (lokalnie, podglądy Vercel) bez zmian.
 */
import { getAuthProfile } from '../auth/profile';

export const PROD_BUILD: boolean = import.meta.env.VITE_AUTH_MODE === 'supabase';

/** Funkcje ukryte w produkcji 1.0 — powód (do POSTEP/SCOPE i do testu). */
export const HIDDEN_IN_PROD = {
  workflows: 'Automatyzacje (M9): „Uruchom” zapisywał przebieg bez sprawdzenia warunku; brak silnika reguł w bazie — moduł po 1.0',
  seaWeather: 'Pogoda morska (8.1): brak źródła danych i zadania — wartości fali/wiatru były statyczne',
  ferryAlternatives: 'Przeprawy alternatywne (8.4): lista statyczna, bez przeliczenia',
  roadSituationsSe: 'Zdarzenia drogowe SE (8.5): brak klucza Trafikverket — w produkcji nie pokazujemy danych przykładowych',
  seRouteAlternatives: 'Objazdy SE (8.4/D25): warianty statyczne',
  aisSeedPositions: 'Pozycje promów na mapie (8.3): w przeglądarce tylko pozycje przykładowe — AIS z bazy nie jest udostępniany mapie',
  delayCodes: 'Kody przyczyn opóźnień (8.10): nieuzgodnione z przewoźnikiem',
  detectTimeKpi: 'Kafelek „czas wykrycia odchylenia” (10.7): wartość wpisana na sztywno',
  factoringOffer: 'Oferta factoringu: zapis wyłącznie w przeglądarce, bez tabeli w bazie',
  demoMarksToggle: 'Przełącznik oznaczeń demonstracyjnych: w produkcji nie ma danych demonstracyjnych',
  policyExpiryNote: 'Przypomnienie o polisie OCP (6.6): brak odczytu polis i zadania przypomnień',
  permitNumber: 'Numer i zgodność zezwolenia w szufladzie (6.4/6.5): tabela zezwoleń bez polityki odczytu',
  clientEta: 'ETA liczona w przeglądarce ze statusu (M12): w produkcji ETA v1 z bazy (compute_load_eta)',
} as const;

export type FacadeKey = keyof typeof HIDDEN_IN_PROD;

/** `true` = funkcja widoczna (demo); w produkcji ukryta. */
export function shows(_key: FacadeKey, prod: boolean = PROD_BUILD): boolean {
  return !prod;
}

/**
 * I-2a — przełącznik „Widok HHL/KSH/SCX”: w produkcji wyłącznie dla konta organizacji HHL
 * (podgląd widoku innej strony). Konta KSH i przewoźnika nie widzą przełącznika — rola wynika z konta.
 * Demo (bez logowania) — przełącznik jest sposobem prezentacji.
 */
export function canSwitchView(prod: boolean = PROD_BUILD, orgCode: string | null | undefined = getAuthProfile()?.org_code): boolean {
  return !prod || orgCode === 'HHL';
}
