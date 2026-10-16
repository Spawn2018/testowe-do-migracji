/**
 * wyglad/P7-a — skąd Przegląd i okno Awizacja (E32) biorą dane, których aplikacja jeszcze nie ma.
 * Produkcja: `null` / `false` = nie podłączone (sekcje i przyciski ukryte; zestaw — z pól transportu; piloci — dzisiejsza
 * lista pilotów z bazy w Przeglądzie); demo: przykłady z `p7Demo.ts`. Warunek `import.meta.env.VITE_AUTH_MODE`
 * wpisany wprost (strażnik I-0). Bez zapytań i zapisów do bazy. Co podłącza wykonawca — dopisek do PR wyglad/P7-a.
 */
import type { Load, OrgKind } from '../types';
import type { Pilots } from './p7Awiz';
import { demoPilots, demoSavePilots, demoSaveSet, demoSymbolSpec } from './p7Demo';
import { getAuthProfile } from '../auth/profile';

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

/**
 * E32 pkt 6: HHL Administrator może poprawić awizację; Operacje HHL i KSH tylko oglądają (E9; 09.10 12:33).
 * Demo: według rodzaju konta, nie samej firmy (audyt-F F-07) — konto HHL Operacje bez „Popraw awizację”, okno tylko
 * do odczytu. Produkcja — po sprawdzeniu praw zapisu w bazie (wykonawca).
 */
export function canFixAwizOf(role: OrgKind): boolean {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? role === 'HHL' && getAuthProfile()?.role !== 'HHL_OPS' : false;
}

/** Wymiary zestawu z ładunkiem w metrach. */
export interface SetDims { l: number; w: number; h: number }

/**
 * wyglad/P7-b — E32 pkt 7, E9 (D-83; „Kto co widzi i zmienia”: HHL Administrator i HHL Operacje zmieniają zestaw):
 * zapis „Zestaw z ładunkiem” przy transporcie; `null` = przywróć z tabeli symboli. Produkcja — po funkcji bazy
 * z wpisem w Historii (wykonawca, P7; dopisek do PR wyglad/P7-b); do tego czasu przycisk „Zmień” ukryty.
 */
export function saveSetOf(role: OrgKind): ((loadId: string, set: SetDims | null) => Promise<{ ok: boolean; error?: string }>) | null {
  if (role !== 'HHL') return null;
  return import.meta.env.VITE_AUTH_MODE !== 'supabase' ? demoSaveSet : null;
}
