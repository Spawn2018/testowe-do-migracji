/**
 * I-2l — czas wykrycia odchylenia z bazy: mediana (wykrycie − zdarzenie) z `risk_signals` z 30 dni
 * (RPC `kpi_detection_lag`, SECURITY INVOKER — zakres wg RLS). Tylko build produkcyjny (ładowany leniwie).
 */
import { getSupabase } from '../auth/client';

export interface DetectionLag { samples: number; medianMin: number | null }

export function detectionLagFromRow(row: { samples?: number | null; median_min?: number | null } | null | undefined): DetectionLag {
  const samples = Number(row?.samples ?? 0) || 0;
  const m = row?.median_min;
  return { samples, medianMin: samples > 0 && typeof m === 'number' && Number.isFinite(m) ? m : null };
}

/** Wartość kafelka: „N min” albo „—” (brak próbek). */
export function detectionLagLabel(lag: DetectionLag | null): string {
  return lag && lag.medianMin != null ? `${lag.medianMin} min` : '—';
}

export async function fetchDetectionLag(days = 30): Promise<DetectionLag> {
  const sb = await getSupabase();
  const res = await sb.rpc('kpi_detection_lag', { p_project: null, p_days: days });
  if (res.error) throw new Error(res.error.message);
  const rows = (res.data ?? []) as { samples: number; median_min: number | null }[];
  return detectionLagFromRow(rows[0]);
}
