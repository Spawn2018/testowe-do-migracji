/**
 * wyglad/audyt-E (E-05, W47 — właściciel 16.10, 13:58 i 14:09; D-20261016-1410-01 pkt 7) — jedno miejsce,
 * skąd „Dla mnie › Co dostaję” bierze i dokąd zapisuje ustawienia osoby: zdarzenie × kanał (dzwonek, telefon, e-mail).
 * Wartości startowe i to, które zdarzenia trafiają do rodzaju konta, daje „Kto co dostaje” (Administrator HHL);
 * ustawienie osoby obowiązuje tylko dla niej.
 *
 * Demo — magazyn strony (`forMeDemo.ts`). Produkcja — `null` = nie podłączone (ekran bez przełączników).
 * Gałąź produkcyjną podmienia wykonawca (C3): odczyt i zapis osoba × zdarzenie × kanał w bazie z „było → jest”
 * (C4), RLS — osoba zmienia tylko swoje; Podgląd HHL — `save: null` (tylko odczyt). Warunek
 * `import.meta.env.VITE_AUTH_MODE` wpisany wprost (strażnik I-0). Bez zapytań.
 */
import { demoMyNotify, demoSaveMyNotify } from './forMeDemo';

export type MyChannel = 'bell' | 'push' | 'mail';
/** rowId zdarzenia z „Kto co dostaje” → kanały, które osoba zmieniła (brak kanału = wartość startowa rodzaju konta). */
export type MyNotifyPrefs = Record<string, Partial<Record<MyChannel, boolean>>>;

export interface MyNotifySource {
  /** ustawienia osoby zapisane do tej pory */
  prefs: MyNotifyPrefs;
  /** zapis jednego kanału jednego zdarzenia; `true` = zapisane. `null` = tylko podgląd. */
  save: ((rowId: string, ch: MyChannel, on: boolean) => Promise<boolean>) | null;
}

/** `person` — kto ogląda (demo: rodzaj konta w Podglądzie; produkcja: id konta). */
export function myNotifyOf(person: string): MyNotifySource | null {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase'
    ? { prefs: demoMyNotify(person), save: (rowId, ch, on) => demoSaveMyNotify(person, rowId, ch, on) }
    : null;
}
