/**
 * wyglad/P6-e — skąd Czat i dzwonek biorą zachowanie, którego aplikacja jeszcze nie ma (D-20261016-0310-01 Cz22).
 * Otwarcie Czatu transportu oznacza jego wiadomości w dzwonku jako przeczytane: demo — w stanie aplikacji;
 * produkcja — wyłączone do podłączenia (wykonawca: zapis odczytu wpisów dzwonka razem z odczytem wiadomości, Cz4).
 * Warunek `import.meta.env.VITE_AUTH_MODE` wpisany wprost (strażnik I-0). Bez zapytań.
 */
export function chatBellAutoReadOn(): boolean {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase';
}
