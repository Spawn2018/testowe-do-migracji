/**
 * I-0 — logika wydzielona z `src/data/seed.ts` (bez danych demo), żeby build produkcyjny
 * (VITE_AUTH_MODE=supabase) mógł zamienić seed.ts na pusty moduł (`src/data/seed.prod.ts`).
 */
import type { ExceptionItem, Load, Risk } from '../types';

export function buildSeedExceptions(loads: Load[], risks: Risk[]): ExceptionItem[] {
  return risks.map((r) => ({
    id: `ex-${r.id}`,
    severity: r.severity,
    title: r.title,
    owner: r.owner,
    meta: r.meta,
    nextAction: r.nextAction,
    ageHours: r.ageHours,
    loadId: r.loadId,
    code: r.loadId ? loads.find((l) => l.id === r.loadId)?.code : undefined,
    titleKey: r.titleKey,
    titleParams: r.titleParams,
    metaKey: r.metaKey,
    metaParams: r.metaParams,
  }));
}

/** Mark loads linked to active FORCE_MAJEURE as delayed and bump ETA by impact hours. */
export function applyForceMajeureDelays(loads: Load[], risks: Risk[]): Load[] {
  const fm = risks.filter(
    (r) =>
      r.type === 'FORCE_MAJEURE' &&
      (r.severity === 'CRITICAL' || r.severity === 'HIGH') &&
      r.loadId,
  );
  if (!fm.length) return loads;
  const byLoad = new Map<string, number>();
  for (const r of fm) {
    if (!r.loadId) continue;
    const h = r.delayImpactHours ?? (r.severity === 'CRITICAL' ? 4 : 2);
    byLoad.set(r.loadId, Math.max(byLoad.get(r.loadId) ?? 0, h));
  }
  return loads.map((l) => {
    const hours = byLoad.get(l.id);
    if (!hours) return l;
    let etaBoden = l.etaBoden;
    if (etaBoden) {
      const t0 = Date.parse(etaBoden);
      if (!Number.isNaN(t0)) {
        etaBoden = new Date(t0 + hours * 3600 * 1000).toISOString();
      }
    }
    return {
      ...l,
      delayed: true,
      status: l.status === 'DELIVERED' ? l.status : l.status === 'SILENT' ? l.status : 'DELAYED',
      etaBoden,
      etaLatestHours: (l.etaLatestHours ?? 0) + hours,
      etaReasons: [...(l.etaReasons ?? []), `Siła wyższa · +${hours} h`].slice(-6),
    };
  });
}
