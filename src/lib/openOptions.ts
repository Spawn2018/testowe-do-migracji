/**
 * wyglad/P3 (E37 pkt 1, E11): przejście z menu konta do ekranu Opcji (HHL) albo Ustawień (KSH, SCX).
 * „Moje konto” → sekcja konta; „Dla mnie” → preferencje tej osoby.
 * Widok Opcji / Ustawień odbiera ekran przez `takeOptionsScreen()` przy wejściu albo przez zdarzenie,
 * gdy jest już otwarty. Bez zapisu i bez zmiany uprawnień.
 */
import { useTowerStore } from '../store/useTowerStore';
import { isPreviewReadOnly } from './prodFacade';

export type OptionsScreen = 'my-account' | 'for-me';
export const OPEN_OPTIONS_EVENT = 'wt-open-options';

let pending: OptionsScreen | null = null;

export function openOptionsScreen(screen: OptionsScreen): void {
  const s = useTowerStore.getState();
  /* Podgląd (E9-7): konto i preferencje są osoby z HHL — najpierw powrót do widoku HHL. */
  if (isPreviewReadOnly({ viewRole: s.role })) s.setRole('HHL');
  const cur = useTowerStore.getState();
  const target = cur.role === 'HHL' ? 'options' : 'settings';
  pending = screen;
  if (cur.view !== target) cur.setView(target);
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(OPEN_OPTIONS_EVENT, { detail: screen }));
}

/** Odbiera (i czyści) ekran wskazany z menu konta. */
export function takeOptionsScreen(): OptionsScreen | null {
  const p = pending;
  pending = null;
  return p;
}

/** Przewija do znacznika ekranu po wyrenderowaniu (sekcje Opcji ładują się leniwie). */
export function scrollToScreen(selector: string, tries = 20): void {
  if (typeof window === 'undefined') return;
  const el = document.querySelector(selector);
  if (el) {
    el.scrollIntoView({ block: 'start' });
    return;
  }
  if (tries > 0) window.setTimeout(() => scrollToScreen(selector, tries - 1), 100);
}
