/**
 * wyglad/P8-d — czy Automatyzacje mają źródło własnych reguł (E35). Osobny plik bez danych demo (budżet pierwszego
 * wczytania). Warunek musi być ten sam co w `rulesOf()` (`p8dSource.ts`) — pilnuje tego test `p8d-rules`;
 * po podłączeniu w P8 zmieniasz oba miejsca.
 */
export function rulesReady(): boolean {
  return import.meta.env.VITE_AUTH_MODE !== 'supabase';
}
