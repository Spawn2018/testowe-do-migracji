/** wyglad/W-opcje-live-1 — po zapisie w ekranie Opcji: menu i kafelki odświeżają stany z bazy. */
export const OPTIONS_CHANGED_EVENT = 'wt-options-changed';
export function announceOptionsChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(OPTIONS_CHANGED_EVENT));
}
