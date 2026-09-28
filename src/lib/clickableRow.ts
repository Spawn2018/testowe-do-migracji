import type { KeyboardEvent } from 'react';

/**
 * III-12 / SCOPE 11.5 — wiersz tabeli otwierany kliknięciem jest też osiągalny klawiaturą:
 * Tab ustawia fokus (obrys tylko przy :focus-visible, więc kliknięcie myszą wygląda jak dotąd),
 * Enter / Spacja wywołuje tę samą akcję. Klawisze z pól wewnątrz wiersza są ignorowane.
 */
export function clickableRow(action: () => void) {
  return {
    tabIndex: 0,
    onClick: action,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        action();
      }
    },
  };
}
