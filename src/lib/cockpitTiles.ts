/**
 * L-8 — liczby kafelków kokpitu.
 * KSH „Wymaga decyzji” liczy tylko ryzyka widoczne na liście Ryzyk
 * (ten sam filtr co RisksView), nigdy pozycji Centrum decyzji.
 * Przewoźnik: numer bieżącego tygodnia ISO, nie stałe 38.
 */
import type { OrgKind, RiskType } from '../types';
import { isoWeekKeyLocal } from './money/engine';

export interface TileRisk {
  type: RiskType | string;
  owner: OrgKind | string;
}

/** Ryzyka, które KSH widzi. OPS cudzej firmy odpada, tak jak na liście Ryzyk. */
export function risksVisibleToKsh<T extends TileRisk>(risks: readonly T[]): T[] {
  return risks.filter((x) => x.type !== 'OPS' || x.owner === 'HHL');
}

/**
 * Liczba na kafelku „Wymaga decyzji”.
 * HHL: cała kolejka ryzyk. KSH: tylko to, co KSH widzi.
 * Liczba decyzji z Centrum nie wchodzi do wyniku.
 */
export function needsDecisionCount(role: 'HHL' | 'KSH', risks: readonly TileRisk[]): number {
  return role === 'KSH' ? risksVisibleToKsh(risks).length : risks.length;
}

/** Numer tygodnia ISO (1–53) z chwili w strefie operacyjnej. */
export function isoWeekNumber(isoUtc: string): number {
  const key = isoWeekKeyLocal(isoUtc);
  const n = Number(key.slice(key.indexOf('W') + 1));
  if (!Number.isInteger(n) || n < 1 || n > 53) throw new Error('zły tydzień');
  return n;
}
