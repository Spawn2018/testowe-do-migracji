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
  /** H-2: sytuacje drogowe z Situation 1.6. Pusta lista = API nic nie zwróciło. */
  situations: { id: string; kind: string; severity: string; title: string; road: string; original: string | null; note: string | null }[];
  situationsStatus: 'ok' | 'blad' | null;
}


function parseSituations(v: unknown): { id: string; kind: string; severity: string; title: string; road: string; original: string | null; note: string | null }[] {
  if (!Array.isArray(v)) return [];
  const out = [];
  for (const item of v) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const id = typeof row.id === 'string' ? row.id : '';
    const title = typeof row.title === 'string' ? row.title : '';
    if (!id || !title) continue;
    out.push({
      id,
      kind: typeof row.kind === 'string' ? row.kind : 'roboty',
      severity: typeof row.severity === 'string' ? row.severity : 'LOW',
      title,
      road: typeof row.road === 'string' ? row.road : 'E4',
      original: typeof row.original === 'string' && row.original ? row.original : null,
      note: typeof row.note === 'string' && row.note ? row.note : null,
    });
  }
  return out;
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
      situations: parseSituations(detail.situations),
      situationsStatus: detail.situationsStatus === 'ok' || detail.situationsStatus === 'blad' ? detail.situationsStatus : null,
    };
  } catch {
    return null;
  }
}
