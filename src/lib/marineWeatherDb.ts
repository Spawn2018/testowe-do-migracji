/**
 * II-8 — odczyt `marine_conditions` z bazy (produkcja). Demo = null (statyczne voyageSea).
 */
import { getSupabase } from '../auth/client';
import { PROD_BUILD } from './prodFacade';

export type MarineRiskLevel = 'niskie' | 'podwyższone' | 'wysokie';

export interface MarineConditionRow {
  corridor: 'BALTIC_GDN_NYN';
  maxWaveM: number | null;
  maxGustKn: number | null;
  risk: MarineRiskLevel;
  waveThrM: number;
  gustThrKn: number;
  sources: string;
  attribution: string;
  observedAt: string;
  windowFrom: string | null;
  windowTo: string | null;
}

/** null = brak odczytu / nie produkcja / błąd. */
export async function fetchMarineCondition(): Promise<MarineConditionRow | null> {
  if (!PROD_BUILD) return null;
  try {
    const sb = await getSupabase();
    if (!sb) return null;
    const { data, error } = await sb
      .from('marine_conditions')
      .select(
        'corridor,max_wave_m,max_gust_kn,risk,wave_thr_m,gust_thr_kn,sources,attribution,observed_at,window_from,window_to',
      )
      .eq('corridor', 'BALTIC_GDN_NYN')
      .maybeSingle();
    if (error || !data) return null;
    const row = data as {
      corridor: 'BALTIC_GDN_NYN';
      max_wave_m: number | null;
      max_gust_kn: number | null;
      risk: MarineRiskLevel;
      wave_thr_m: number;
      gust_thr_kn: number;
      sources: string;
      attribution: string;
      observed_at: string;
      window_from: string | null;
      window_to: string | null;
    };
    if (row.max_wave_m == null && row.max_gust_kn == null && !row.sources) return null;
    return {
      corridor: row.corridor,
      maxWaveM: row.max_wave_m,
      maxGustKn: row.max_gust_kn,
      risk: row.risk,
      waveThrM: Number(row.wave_thr_m) || 3.8,
      gustThrKn: Number(row.gust_thr_kn) || 40,
      sources: row.sources,
      attribution: row.attribution || 'Dane: FMI / DMI / SMHI (CC BY 4.0)',
      observedAt: row.observed_at,
      windowFrom: row.window_from,
      windowTo: row.window_to,
    };
  } catch {
    return null;
  }
}
