/**
 * Demo sea conditions keyed by GDN departure day — shared by voyage SoT + topbar wave.
 * Vessel/timetable remain in ferry-sailings.json (not duplicated here).
 */
export type SeaRiskLabel = 'niskie' | 'podwyższone' | 'wysokie';

export interface VoyageSea {
  waveM: number;
  windMs: number;
  risk: SeaRiskLabel;
}

export const VOYAGE_SEA_BY_DAY: Record<string, VoyageSea> = {
  '2026-09-23': { waveM: 1.4, windMs: 11, risk: 'niskie' },
  '2026-09-24': { waveM: 2.9, windMs: 19, risk: 'podwyższone' },
  '2026-09-25': { waveM: 3.4, windMs: 22, risk: 'wysokie' },
  '2026-09-26': { waveM: 1.8, windMs: 13, risk: 'niskie' },
};

const DEFAULT_SEA: VoyageSea = { waveM: 1.1, windMs: 10, risk: 'niskie' };

export function seaForDay(dayKey: string): VoyageSea {
  return VOYAGE_SEA_BY_DAY[dayKey] ?? DEFAULT_SEA;
}

export function formatWaveM(waveM: number): string {
  return `${String(waveM).replace('.', ',')} m`;
}

export function formatWindMs(windMs: number): string {
  return `${windMs} m/s`;
}

export function seaRiskPillClass(risk: SeaRiskLabel): string {
  if (risk === 'wysokie') return 'p-red';
  if (risk === 'podwyższone') return 'p-amber';
  return 'p-go';
}

export function voyageWaveLabelForDay(dayKey: string): string {
  return `fala ${formatWaveM(seaForDay(dayKey).waveM)}`;
}
