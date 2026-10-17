/**
 * I-0 — build produkcyjny: zamiennik `src/data/demoEta.ts` bez danych demo (wtyczka `i0-demo-swap`).
 * Produkcja bierze ETA z `eta_basis` (serwer) — transport i sprawy bez zmian.
 */
import type { EtaDetail, Load, Risk } from '../types';

export const DEMO_ETA_AT = '';

export const DEMO_ETA: Readonly<Record<string, { etaBoden: string; etaConfidence: 'HIGH' | 'MED' | 'LOW'; etaConfMin: number; detail: EtaDetail }>> = {};

export function withDemoEta(load: Load): Load {
  return load;
}

export function alignDemoRisks(risks: readonly Risk[], _loads: readonly Load[]): Risk[] {
  return [...risks];
}
