/**
 * Demo sea conditions keyed by GDN departure day — shared by voyage SoT + topbar wave.
 * Vessel/timetable remain in ferry-sailings.json (not duplicated here).
 */
import type { Locale } from '../types';
import { dictEntry, INTL_LOCALE, tp } from '../i18n/messages';

export type SeaRiskLabel = 'niskie' | 'podwyższone' | 'wysokie';

export interface VoyageSea {
  waveM: number;
  windMs: number;
  risk: SeaRiskLabel;
}

export const VOYAGE_SEA_BY_DAY: Record<string, VoyageSea> = {
  /* przegląd 18.10 (B4): rejs Nova Star 23.09, 18:00 — ta sama prognoza co Ryzyka › Sytuacja na trasie (fala 3,2 m, porywy 42 węzły) */
  '2026-09-23': { waveM: 3.2, windMs: 21.6, risk: 'wysokie' },
  '2026-09-24': { waveM: 2.9, windMs: 19, risk: 'podwyższone' },
  '2026-09-25': { waveM: 3.4, windMs: 22, risk: 'wysokie' },
  '2026-09-26': { waveM: 1.8, windMs: 13, risk: 'niskie' },
};

const DEFAULT_SEA: VoyageSea = { waveM: 1.1, windMs: 10, risk: 'niskie' };

export function seaForDay(dayKey: string): VoyageSea {
  return VOYAGE_SEA_BY_DAY[dayKey] ?? DEFAULT_SEA;
}

/** A6-T3 — liczba wg języka (PL bez zmian: 2,9 m). */
export function formatWaveM(waveM: number, locale: Locale = 'pl'): string {
  return `${new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 2 }).format(waveM)} m`;
}

export function formatWindMs(windMs: number, locale: Locale = 'pl'): string {
  return `${new Intl.NumberFormat(INTL_LOCALE[locale], { maximumFractionDigits: 1 }).format(windMs)} m/s`;
}

export function seaRiskPillClass(risk: SeaRiskLabel): string {
  if (risk === 'wysokie') return 'p-red';
  if (risk === 'podwyższone') return 'p-amber';
  return 'p-go';
}

export function voyageWaveLabelForDay(dayKey: string, locale: Locale = 'pl'): string {
  return tp(locale, 'a6_sea_wave', { wave: formatWaveM(seaForDay(dayKey).waveM, locale) });
}

const SEA_RISK_I18N: Record<SeaRiskLabel, Record<Locale, string>> = {
  niskie: dictEntry('a6_sea_risk_i18n_niskie'),
  podwyższone: dictEntry('a6_sea_risk_i18n_podwyzszone'),
  wysokie: dictEntry('a6_sea_risk_i18n_wysokie'),
};

export function formatSeaRiskLabel(risk: SeaRiskLabel, locale: Locale): string {
  return SEA_RISK_I18N[risk][locale];
}
