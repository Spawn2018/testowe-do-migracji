/**
 * wyglad/P7-a — skąd Przegląd i okno Awizacja (E32) biorą dane, których aplikacja jeszcze nie ma.
 * Produkcja: `null` / `false` = nie podłączone (sekcje i przyciski ukryte; zestaw — z pól transportu; piloci — dzisiejsza
 * lista pilotów z bazy w Przeglądzie); demo: przykłady z `p7Demo.ts`. Warunek `import.meta.env.VITE_AUTH_MODE`
 * wpisany wprost (strażnik I-0). Bez zapytań i zapisów do bazy. Co podłącza wykonawca — dopisek do PR wyglad/P7-a.
 */
import type { Load, OrgKind } from '../types';
import type { Pilots } from './p7Awiz';
import { demoPilots, demoSavePilots, demoSymbolSpec } from './p7Demo';

/** Wiersz tabeli właściciela według symbolu (E32 pkt 7): zestaw z ładunkiem, wymóg pilotów, rodzaj zezwolenia. */
export interface SymbolSpec {
  symbol: string;
  kind: string;
  set: { l: number; w: number; h: number };
  /** „PL + SE” — pilot PL i pilot SE wymagani; „BRAK” — piloci nie pojawiają się w transporcie */
  pilots: boolean;
  permit: 'FIRMA' | 'TRASA';
}

/** Tabela symboli (E32 pkt 7, D-83). Produkcja — po wpisaniu tabeli do bazy (wykonawca). */
export function symbolSpecOf(load: Load): SymbolSpec | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoSymbolSpec(load) : null;
}

/** Piloci z awizacji (D-20261009-1233-01: numer rejestracyjny, imię i nazwisko). Produkcja — po nowych polach (wykonawca). */
export function pilotsOf(load: Load): Pilots | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoPilots(load) : null;
}

/** Zapis pilotów z okna Awizacja — w demo w pamięci strony; w produkcji brak (sekcja pilotów ukryta do podłączenia). */
export function savePilotsOf(): ((codes: readonly string[], p: Pilots) => void) | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoSavePilots : null;
}

/** E32 pkt 6: HHL Administrator może poprawić awizację. Produkcja — po sprawdzeniu praw zapisu w bazie (wykonawca). */
export function canFixAwizOf(role: OrgKind): boolean {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? role === 'HHL' : false;
}
