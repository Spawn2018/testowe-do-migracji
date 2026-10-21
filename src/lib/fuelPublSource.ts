/**
 * Rozliczenia › opłata paliwowa — lista publikacji cen z tygodnia wskaźników (E39).
 * Właściciel 21.10.2026 20:14: „Brak listy publikacji dla tego tygodnia” mimo notowań w bazie.
 * Produkcja: `fuel_index_readings` (SEK = OKQ8, PLN = Orlen), po korektach (`corrects_id`) — najnowsza wartość na dzień.
 * Dziś tabela jest czytelna dla HHL (RLS `is_hhl()`); dla KSH i SCX — funkcja odczytu z bazy (wykonawca — zgłoszenie osobne).
 * Demo — bez zmian (`demoFuelEnrich`). Warunek `import.meta.env.VITE_AUTH_MODE` wpisany wprost (strażnik I-0).
 */
import { useEffect, useState } from 'react';
import type { FuelPubl } from './p5Finance';

type Reading = { id: string; index_code: string; reading_date: string; value: number | string; corrects_id: string | null; entered_at: string };

let cache: FuelPubl[] | null = null;
let loading: Promise<void> | null = null;
const subs = new Set<() => void>();

/** Notowania → publikacje: bez wierszy poprawionych korektą, jedna (najnowsza) wartość na źródło i dzień. */
export function publicationsFromReadings(rows: readonly Reading[]): FuelPubl[] {
  const corrected = new Set(rows.map((r) => r.corrects_id).filter((x): x is string => !!x));
  const best = new Map<string, Reading>();
  for (const r of rows) {
    if (corrected.has(r.id)) continue;
    const src = r.index_code === 'SEK' ? 'OKQ8' : r.index_code === 'PLN' ? 'ORLEN' : null;
    if (!src) continue;
    const k = `${src}|${r.reading_date}`;
    const prev = best.get(k);
    if (!prev || prev.entered_at < r.entered_at) best.set(k, r);
  }
  return [...best.values()]
    .map((r) => ({ date: r.reading_date, source: (r.index_code === 'SEK' ? 'OKQ8' : 'ORLEN') as FuelPubl['source'], price: Number(r.value) }))
    .filter((p) => Number.isFinite(p.price))
    .sort((a, b) => a.date.localeCompare(b.date) || a.source.localeCompare(b.source));
}

/** Publikacje z zakresu dni [from, to] (YYYY-MM-DD); null = brak danych z bazy (jeszcze nie wczytane albo brak dostępu). */
export function fuelPublicationsIn(from: string, to: string): FuelPubl[] | null {
  if (!cache) return null;
  return cache.filter((p) => p.date >= from && p.date <= to);
}

async function load(): Promise<void> {
  try {
    const { getSupabase } = await import('../auth/client');
    const sb = await getSupabase();
    const q = await sb.from('fuel_index_readings').select('id,index_code,reading_date,value,corrects_id,entered_at');
    if (q.error) return;
    cache = publicationsFromReadings((q.data ?? []) as Reading[]);
    subs.forEach((f) => f());
  } catch {
    /* brak sesji — lista zostaje pusta */
  }
}

/** Wczytuje publikacje raz na sesję; zwraca licznik zmian (do `useMemo`). */
export function useFuelPublications(): number {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return undefined;
    const f = () => setV((x) => x + 1);
    subs.add(f);
    if (!cache && !loading) loading = load().finally(() => { loading = null; });
    return () => { subs.delete(f); };
  }, []);
  return v;
}
