/**
 * BN9-c4 — pola `risk_signals.detail` ryzyka drogowego LT/LV/EE/FI (BN6, `roadBaltic.ts`) dla Ryzyka › Drogi.
 * DP-162: `road` wypełnia `riskFromRow` w `mappers.ts`; `withBalticRoad` zostaje dla testów / kompatybilności.
 */
import type { Risk, RoadRiskInfo } from '../types';

export const BALTIC_ROAD_KINDS: ReadonlySet<string> = new Set(['ROAD_LT', 'ROAD_LV', 'ROAD_EE', 'ROAD_FI']);

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/* #716 / DP-172: stare ryzyka z kodami w `detail.oryginal` — to nie tekst do tłumaczenia; nowe mają `detail.kody`. */
const CODE_LIST = /^[A-Z0-9_]{1,8}(?:\s*,\s*[A-Z0-9_]{1,8})*$/;

/**
 * BN9-c4b (decyzja 89) / DP-172: oryginał i „tłumaczenie w toku” w tym samym kształcie co Drogi SE:
 * `detail.oryginal` — tekst w języku kraju, `detail.opis` — opis po polsku; brak opisu albo opis równy oryginałowi
 * (albo `detail.pending === true`) → tłumaczenie w toku. Bez oryginału — oba pola puste (nic nie pokazujemy).
 * Kody restrictionType (`detail.kody` / stary CODE_LIST w oryginal) nie oznaczają „w toku”.
 */
export function roadTranslationOf(d: Record<string, unknown>): { original: string | null; pending: boolean } {
  const raw = str(d.oryginal) ?? str(d.original);
  const original = raw && !CODE_LIST.test(raw) ? raw : null;
  if (!original) return { original: null, pending: false };
  const opis = str(d.opis);
  return { original, pending: d.pending === true || !opis || opis === original };
}

/** Pola `detail` ryzyka drogowego BN6 (źródło, od/do, współrzędne, limity, oryginał) — bez interpretacji. */
export function roadInfoFromDetail(detail: Record<string, unknown> | null | undefined): RoadRiskInfo {
  const d = detail ?? {};
  return {
    source: str(d.zrodlo), from: str(d.od), to: str(d.do), lat: num(d.lat), lon: num(d.lon),
    weightLimitT: num(d.weight_limit_t), heightLimitM: num(d.height_limit_m), widthLimitM: num(d.width_limit_m),
    ...roadTranslationOf(d),
  };
}

/** Ryzyko z wiersza bazy + pola drogowe z `detail` — tylko dla rodzajów LT/LV/EE/FI (pozostałe bez zmian). */
export function withBalticRoad<T extends Risk>(risk: T, row: { kind: string; detail: Record<string, unknown> | null }): T {
  return BALTIC_ROAD_KINDS.has(row.kind) ? { ...risk, road: roadInfoFromDetail(row.detail) } : risk;
}
