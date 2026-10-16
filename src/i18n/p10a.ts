/**
 * wyglad/P10a-a — E22 (decyzja: „do akceptacji, bez pytań”; PLAN P10a): pasek nowej wersji, „na żywo · HH:MM”,
 * komunikat zamiast pustej strony. Tylko po polsku (E43). Mały słownik — pierwsze wczytanie.
 */
const pl = {
  a10_new_h: 'Jest nowa wersja Watch Tower.',
  a10_new_tx: 'Odśwież, kiedy skończysz to, co robisz. Nic się nie zgubi.',
  a10_new_btn: 'Odśwież teraz',
  a10_live: 'na żywo · {t}',
  a10_off: 'brak połączenia od {t}',
  a10_live_title: 'Godzina ostatniego odświeżenia danych',
  a10_part_h: 'Ta część aplikacji zmieniła się po aktualizacji',
  a10_part_tx: 'Odśwież stronę, żeby ją otworzyć. Twoje zapisane dane są bezpieczne.',
  a10_part_btn: 'Odśwież',
} as const;

export type A10Key = keyof typeof pl;
export function a10(key: A10Key, vars?: Record<string, string>): string {
  let s: string = pl[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
  return s;
}
export const A10_PL = pl;
