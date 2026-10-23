/**
 * wyglad/P8-c — czy strona Stref (E34) ma źródło danych. Osobny plik bez danych demo, żeby pierwsze wczytanie (budżet
 * 400 kB gzip) nie niosło przykładowych stref. Warunek musi być ten sam co w `zonesOf()` (`p8cSource.ts`) — pilnuje
 * tego test `p8c-zones`; #413: demo i produkcja mają źródło (`zonesOf()` zawsze ≠ null).
 */
export function zonesReady(): boolean {
  return true;
}
