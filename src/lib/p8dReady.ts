/**
 * wyglad/P8-d — czy Automatyzacje mają źródło własnych reguł (E35). Osobny plik bez danych demo (budżet pierwszego
 * wczytania). Warunek musi być ten sam co w `rulesOf()` (`p8dSource.ts`) — pilnuje tego test `p8d-rules`;
 * #413: demo i produkcja mają źródło (rulesOf() !== null).
 */
export function rulesReady(): boolean {
  return import.meta.env.VITE_AUTH_MODE === 'supabase'
    || import.meta.env.VITE_AUTH_MODE !== 'supabase';
}
