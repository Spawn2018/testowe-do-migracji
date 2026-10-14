/**
 * wyglad/P3 (E37 pkt 1, E11): przejście z menu konta do ekranu Opcji (HHL) albo Ustawień (KSH, SCX).
 * „Moje konto” → sekcja konta; „Dla mnie” → preferencje tej osoby.
 * Widok Opcji / Ustawień odbiera ekran przez `takeOptionsScreen()` przy wejściu albo przez zdarzenie,
 * gdy jest już otwarty. Tylko przejście między ekranami: bez zapisu, bez zmiany roli i uprawnień.
 */
import { useTowerStore } from '../store/useTowerStore';
import type { OptScreenId } from '../components/options/types';

/** wyglad/P4-c: także ekran Opcji wprost (np. „Opcje › Progi” z listy „Działa samo”, E35 pkt 1). */
export type OptionsScreen = 'my-account' | 'for-me' | OptScreenId;

/** Ekran menu Opcji / Ustawień dla wskazania z menu konta albo z odnośnika. */
export function optScreenOf(screen: OptionsScreen): OptScreenId {
  return screen === 'my-account' ? 'account' : screen === 'for-me' ? 'forme' : screen;
}
export const OPEN_OPTIONS_EVENT = 'wt-open-options';

let pending: OptionsScreen | null = null;

export function openOptionsScreen(screen: OptionsScreen): void {
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
    /* po rozwinięciu sekcji (następna klatka), żeby jej treść była pod nagłówkiem, a nie pod krawędzią */
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => el.scrollIntoView({ block: 'start' })));
    return;
  }
  if (tries > 0) window.setTimeout(() => scrollToScreen(selector, tries - 1), 100);
}
