/**
 * BN9-c4 (F7 r1, decyzja A) — odczyt stanu źródeł dróg LT/LV/EE/FI z `corridor_conditions` (wiersze `ROAD_LT` … `ROAD_FI`,
 * zapisuje job BN6). Tym samym wzorcem co `corridorConditionsDb.ts`, tylko kolumny corridor, observed_at, slowdown_mult, reason;
 * bez zmian w bazie. Produkcja; w demo — null (przykład z `p6Source.sampleBalticCorridorsOf`).
 */
import { getSupabase } from '../auth/client';
import { PROD_BUILD } from './prodFacade';
import type { BalticCorridorRow } from './bn9c4Roads';

const CODES = ['ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI'] as const;

/** Lista wierszy (brak wiersza = źródło niepodłączone); null = błąd odczytu / nie produkcja. */
export async function fetchBalticCorridors(): Promise<BalticCorridorRow[] | null> {
  if (!PROD_BUILD) return null;
  try {
    const sb = await getSupabase();
    if (!sb) return null;
    const { data, error } = await sb
      .from('corridor_conditions')
      .select('corridor,observed_at,slowdown_mult,reason')
      .in('corridor', CODES as unknown as string[]);
    if (error || !data) return null;
    return (data as { corridor: string; observed_at: string | null; slowdown_mult: number | string | null; reason: string | null }[])
      .filter((r) => (CODES as readonly string[]).includes(r.corridor))
      .map((r) => ({
        corridor: r.corridor as BalticCorridorRow['corridor'],
        observedAt: r.observed_at,
        slowdownMult: Number(r.slowdown_mult) || 1,
        reason: r.reason,
      }));
  } catch {
    return null;
  }
}
