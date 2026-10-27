/**
 * #594 pkt B2 (właściciel 27.10, 14:55): na telefonie przesunięcie powiadomienia w dzwonku w prawo = usunięcie z listy
 * tak, jakby było odczytane. Czysta logika gestu — komponent tylko przekazuje przesunięcia palca.
 */

/** Próg usunięcia: część szerokości wiersza, którą trzeba przesunąć w prawo. */
export const SWIPE_DISMISS_RATIO = 0.4;
/** Ruch poniżej tej wartości [px] to jeszcze dotknięcie (klik), nie gest. */
export const SWIPE_SLOP_PX = 8;

export type SwipeAxis = 'none' | 'x' | 'y';

/** Kierunek gestu ustalany raz, po przekroczeniu progu; w pionie przewija się lista, gest się nie włącza. */
export function swipeAxis(dx: number, dy: number): SwipeAxis {
  if (Math.abs(dx) < SWIPE_SLOP_PX && Math.abs(dy) < SWIPE_SLOP_PX) return 'none';
  return Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
}

/** Przesunięcie wiersza w trakcie gestu: tylko w prawo (w lewo nic się nie dzieje). */
export function swipeOffset(dx: number): number {
  return dx > 0 ? dx : 0;
}

/** Po puszczeniu: usunąć (próg osiągnięty) albo wrócić na miejsce. Szerokość 0 = nie usuwać. */
export function swipeRelease(dx: number, width: number): 'dismiss' | 'reset' {
  if (!(width > 0)) return 'reset';
  return dx >= width * SWIPE_DISMISS_RATIO ? 'dismiss' : 'reset';
}
