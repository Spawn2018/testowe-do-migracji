/**
 * wyglad/P10b-d — mały moduł w pierwszym wczytaniu: „Jak pracuję” otwarty raz po pierwszym wejściu (E37 pkt 9)
 * i podgląd pierwszego wejścia w demo (`pierwsze-wejscie=1` — cała ścieżka, `pierwsze-wejscie=telefon` — sam krok 3,
 * jak `komunikat-hhl=1` w P10b-a). Bez zapisów.
 */
const HELP_ONCE_KEY = 'wt-help-once';
export const OPEN_HELP_EVENT = 'wt-open-help';

/** Po pierwszym wejściu: Pomoc otwiera się na „Jak pracuję” jeden raz (także gdy pasek górny jeszcze się ładuje). */
export function requestHelpOnce(): void {
  try { sessionStorage.setItem(HELP_ONCE_KEY, '1'); } catch { /* tryb prywatny — zostaje samo zdarzenie */ }
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(OPEN_HELP_EVENT));
}

/** Pasek górny przy starcie: czy otworzyć Pomoc (prośba zostaje do `clearHelpOnce`, wywoływanego po montażu). */
export function peekHelpOnce(): boolean {
  try { return sessionStorage.getItem(HELP_ONCE_KEY) === '1'; } catch { return false; }
}

export function clearHelpOnce(): void {
  try { sessionStorage.removeItem(HELP_ONCE_KEY); } catch { /* nic */ }
}

export type FirstEntryDemoMode = 'invite' | 'phone';

/** Demo: podgląd pierwszego wejścia z adresu. Produkcja: zawsze `null` (warunek trybu wpisany wprost — I-0). */
export function firstEntryDemoMode(): FirstEntryDemoMode | null {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') {
    if (typeof window === 'undefined') return null;
    const src = `${window.location.hash}&${window.location.search}`;
    const m = /[?&]pierwsze-wejscie=(1|telefon)\b/.exec(src);
    return m ? (m[1] === 'telefon' ? 'phone' : 'invite') : null;
  }
  return null;
}
