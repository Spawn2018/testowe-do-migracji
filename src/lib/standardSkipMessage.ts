/**
 * B-8-IMP + wyglad/W-naprawy-2 (A6): informacja po imporcie, nie ostrzeżenie — to samo zdanie co w podglądzie:
 * „Zaimportowano 2 transporty. Pominięte: inny przewoźnik — 43 · puste wiersze — 15.” Części tylko przy liczbie > 0.
 */
import { tp } from '../i18n/messages';

export type ImportSkips = { carrier?: number | null; empty?: number | null; standard?: number | null };

/** „Pominięte: …” albo null, gdy nic nie pominięto (liczby 0 i brak pól nie dają zdania). */
export function importSkipText(s: ImportSkips): string | null {
  const parts = [
    s.carrier ? tp('pl', 'p7_imp_skip_carrier', { n: s.carrier }) : null,
    s.empty ? tp('pl', 'p7_imp_skip_empty', { n: s.empty }) : null,
    s.standard ? tp('pl', 'p7_imp_skip_standard', { n: s.standard }) : null,
  ].filter(Boolean);
  return parts.length ? tp('pl', 'p7_imp_skip', { list: parts.join(' · ') }) : null;
}

/** X = przyjęte transporty, Y = pominięte „Standard”; `more` — pozostałe pominięte z parsera (A6). */
export function standardSkipMessage(imported: number, skipped: number, more: Omit<ImportSkips, 'standard'> = {}): string {
  const skip = importSkipText({ ...more, standard: skipped });
  return [tp('pl', 'p7_imp_done', { n: imported }), skip].filter(Boolean).join(' ');
}
