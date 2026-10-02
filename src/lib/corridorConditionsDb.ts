/**
 * II-6 — odczyt `corridor_conditions` z bazy (produkcja). Demo = null (seed Trafikverket w UI).
 */
import { getSupabase } from '../auth/client';
import { PROD_BUILD } from './prodFacade';

export interface CorridorConditionRow {
  corridor: 'SE_E4';
  slowdownMult: number;
  reason: string | null;
  source: string;
  observedAt: string;
  conditions: number | null;
  weather: number | null;
  adverseConditions: number | null;
  adverseWeather: number | null;
  zrodlo: string | null;
}

/** null = brak odczytu / nie produkcja / błąd / brak żywego źródła. */
export async function fetchCorridorCondition(): Promise<CorridorConditionRow | null> {
  if (!PROD_BUILD) return null;
  try {
    const sb = await getSupabase();
    if (!sb) return null;
    const { data, error } = await sb
      .from('corridor_conditions')
      .select('corridor,slowdown_mult,reason,source,observed_at,detail')
      .eq('corridor', 'SE_E4')
      .maybeSingle();
    if (error || !data) return null;
    const row = data as {
      corridor: 'SE_E4';
      slowdown_mult: number | string;
      reason: string | null;
      source: string;
      observed_at: string;
      detail: Record<string, unknown> | null;
    };
    const detail = row.detail ?? {};
    const zrodlo = typeof detail.zrodlo === 'string' ? detail.zrodlo : null;
    // Wiersz startowy migracji 0121 nie ma zrodlo — to nie jest żywe źródło.
    if (!zrodlo && !detail.conditions && !detail.weather) return null;
    const num = (v: unknown): number | null =>
      typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v !== '' ? Number(v) : null;
    return {
      corridor: row.corridor,
      slowdownMult: Number(row.slowdown_mult) || 1,
      reason: row.reason,
      source: row.source || 'TRAFIKVERKET',
      observedAt: row.observed_at,
      conditions: num(detail.conditions),
      weather: num(detail.weather),
      adverseConditions: num(detail.adverseConditions),
      adverseWeather: num(detail.adverseWeather),
      zrodlo,
    };
  } catch {
    return null;
  }
}
