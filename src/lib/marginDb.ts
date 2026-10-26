/**
 * #412 E16 (0288): zapis progu marży (Opcje › Cennik i opłaty) — `margin_threshold_set`; baza przyjmuje tylko od
 * Administratora HHL (inni: 42501). Wynik z bazy trafia do pamięci (`setMarginFromServer`) — Finanse, Harmonogram,
 * panel Ceny liczą od nowej wartości. Tylko produkcja (wołane z `marginSettingOf`).
 */
import { marginFromDb, setMarginFromServer } from './p5Source';

export async function saveMarginDb(pct: number | null): Promise<boolean> {
  const { getSupabase } = await import('../auth/client');
  const sb = await getSupabase();
  const r = await sb.rpc('margin_threshold_set', { p_pct: pct });
  if (r.error) return false;
  const v = marginFromDb(r.data);
  if (v !== undefined) setMarginFromServer(v);
  return true;
}
