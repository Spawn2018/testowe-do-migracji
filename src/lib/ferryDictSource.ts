/**
 * BN1 — słownik promów z bazy (`ferry_dict_snapshot`) zamiast samego kodu frontu.
 * Demo / brak RPC: zostaje seed z `ferryCatalog.ts`. Produkcja: po zrzucie danych
 * `applyFerryDictSnapshot` rozszerza znane kody (np. TLLA-HEL) i armatorów tras.
 * Warunek `import.meta.env.VITE_AUTH_MODE` wpisany wprost (strażnik I-0).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { applyFerryDictSnapshot, type FerryDictSnapshot } from './ferryCatalog';

export type { FerryDictSnapshot };

/** Odczyt RPC; błąd / brak funkcji → null (front zostaje na seedzie). */
export async function fetchFerryDictSnapshot(
  sb: SupabaseClient,
): Promise<FerryDictSnapshot | null> {
  const { data, error } = await sb.rpc('ferry_dict_snapshot');
  if (error || data == null) return null;
  if (typeof data !== 'object') return null;
  const snap = data as FerryDictSnapshot;
  if (!Array.isArray(snap.routes) || !Array.isArray(snap.operators) || !Array.isArray(snap.ports)) {
    return null;
  }
  return snap;
}

/** Produkcja: wgraj snapshot do katalogu. Demo: no-op. */
export async function loadFerryDictIntoCatalog(sb: SupabaseClient): Promise<boolean> {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return false;
  const snap = await fetchFerryDictSnapshot(sb);
  if (!snap) return false;
  applyFerryDictSnapshot(snap);
  return true;
}
