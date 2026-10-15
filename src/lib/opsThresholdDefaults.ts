/**
 * B7 / E15 — domyślne progi jak w `ops_thresholds` (migracja 0216).
 * Mapper i UI używają tych wartości, gdy brak odczytu z bazy.
 */
export const OPS_THRESHOLD_DEFAULTS = {
  ETA_CONF_HIGH_MIN: 30,
  ETA_CONF_MED_MIN: 120,
  GEOFENCE_EDGE_M: 300,
  SILENT_MIN: 30,
  SILENT_STOP_H: 3,
} as const;

export type OpsThresholdKey = keyof typeof OPS_THRESHOLD_DEFAULTS;

let cache: Partial<Record<OpsThresholdKey, number>> = {};

export function setOpsThresholdCache(rows: ReadonlyArray<{ key: string; value_num: number }>): void {
  const next: Partial<Record<OpsThresholdKey, number>> = {};
  for (const r of rows) {
    if (r.key in OPS_THRESHOLD_DEFAULTS && Number.isFinite(Number(r.value_num))) {
      next[r.key as OpsThresholdKey] = Number(r.value_num);
    }
  }
  cache = next;
}

export function opsThreshold(key: OpsThresholdKey): number {
  const v = cache[key];
  return v != null && Number.isFinite(v) ? v : OPS_THRESHOLD_DEFAULTS[key];
}
