/**
 * BN9-c4 — pola `risk_signals.detail` ryzyka drogowego LT/LV/EE/FI (BN6, `roadBaltic.ts`) dla Ryzyka › Drogi.
 * Osobny mały moduł (tylko typy): wołany z `supabaseProvider.ts` po `riskFromRow` — to samo zapytanie, bez zmian w `mappers.ts`.
 */
import type { Risk, RoadRiskInfo } from '../types';

export const BALTIC_ROAD_KINDS: ReadonlySet<string> = new Set(['ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI']);

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Pola `detail` ryzyka drogowego BN6 (źródło, od/do, współrzędne, limity) — bez interpretacji. */
export function roadInfoFromDetail(detail: Record<string, unknown> | null | undefined): RoadRiskInfo {
  const d = detail ?? {};
  return {
    source: str(d.zrodlo), from: str(d.od), to: str(d.do), lat: num(d.lat), lon: num(d.lon),
    weightLimitT: num(d.weight_limit_t), heightLimitM: num(d.height_limit_m), widthLimitM: num(d.width_limit_m),
  };
}

/** Ryzyko z wiersza bazy + pola drogowe z `detail` — tylko dla rodzajów LT/LV/EE/FI (pozostałe bez zmian). */
export function withBalticRoad<T extends Risk>(risk: T, row: { kind: string; detail: Record<string, unknown> | null }): T {
  return BALTIC_ROAD_KINDS.has(row.kind) ? { ...risk, road: roadInfoFromDetail(row.detail) } : risk;
}
