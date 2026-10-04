/**
 * I-2b — kokpit w produkcji wyłącznie z danych z bazy (risk_signals, documents, loads).
 * Demo korzysta z dotychczasowych pól (baner rejsu z prognozą fali, kolejka `exceptions` z danych demo).
 */
import type { Document, ExceptionItem, Load, Risk } from '../types';

const SEV = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 } as const;

/** Otwarte ryzyko z bazy → wiersz kolejki „Wymaga decyzji” (ten sam kształt co w widoku Ryzyka). */
export function riskAsException(r: Risk, loads: readonly Load[]): ExceptionItem {
  return {
    id: r.id, severity: r.severity, title: r.title, owner: r.owner, meta: r.meta, nextAction: r.nextAction,
    ageHours: r.ageHours, loadId: r.loadId, code: r.loadId ? loads.find((l) => l.id === r.loadId)?.code : undefined,
    titleKey: r.titleKey, titleParams: r.titleParams, metaKey: r.metaKey, metaParams: r.metaParams,
  };
}

export function sortExceptions<T extends { severity: keyof typeof SEV; ageHours: number }>(xs: readonly T[]): T[] {
  return [...xs].sort((a, b) => SEV[a.severity] - SEV[b.severity] || b.ageHours - a.ageHours);
}

/**
 * Baner kokpitu w produkcji: najpoważniejsze otwarte ryzyko CRITICAL/HIGH z `risk_signals` + liczba takich ryzyk.
 * Brak takiego ryzyka → brak banera (żadnej treści zastępczej).
 */
export function prodBannerRisk(risks: readonly Risk[]): { top: Risk; count: number } | null {
  const hot = sortExceptions(risks.filter((r) => r.severity === 'CRITICAL' || r.severity === 'HIGH'));
  return hot.length ? { top: hot[0], count: hot.length } : null;
}

/**
 * Kafelek „komplet dokumentów przed załadunkiem” w produkcji: transport ma komplet, gdy ma wgrane
 * zezwolenie PL (dokument w `documents`, kategoria PERMIT_PL). STD-CLEAN: klasa STANDARD nie zwalnia.
 */
export function docsCompleteBeforeLoad(loads: readonly Load[], documents: readonly Document[]): number {
  return loads.filter((l) => documents.some((d) => d.loadId === l.id && d.category === 'PERMIT_PL' && d.status === 'UPLOADED')).length;
}

/** OTIF bez dostarczonych transportów nie istnieje — „—” zamiast 0% (ani 100%). */
export function otifShown(delivered: number): boolean {
  return delivered > 0;
}

/** I-2d: minuty opóźnienia do pigułki. Produkcja: wyłącznie `loads.delay_minutes` (ETA v1 w bazie),
 *  bez zastępczych 95 min; demo: jak dotąd (ETA vs plan, awaryjnie 95). */
export function delayPillMinutes(
  load: Pick<Load, 'delayed' | 'delayMinutesDb'>, vsPlan: number | null, prod: boolean,
): number | null {
  if (!load.delayed) return null;
  if (prod) return load.delayMinutesDb ?? null;
  return vsPlan ?? 95;
}

export type PermitBannerState =
  | { kind: 'not_required' }
  | { kind: 'uploaded_unchecked'; fileName: string }
  | { kind: 'missing' };

/** I-2 (zero fasady): stan zezwolenia wyłącznie z dokumentów — bez fikcyjnego numeru PL/2026/14xx.
 *  Odczytu treści zezwoleń nie ma, więc zgodności wymiarów NIE deklarujemy. */
export function permitBannerState(load: Pick<Load, 'id' | 'dims'>, documents: readonly Document[]): PermitBannerState {
  const d = documents.find((x) => x.loadId === load.id && x.category === 'PERMIT_PL' && x.status === 'UPLOADED');
  return d ? { kind: 'uploaded_unchecked', fileName: d.name } : { kind: 'missing' };
}
