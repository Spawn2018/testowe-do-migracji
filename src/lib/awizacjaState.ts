/**
 * AWIZ-4 — stan awizacji i wybór rejsu (PO_SPOTKANIU §4).
 * „Zdąży na rejs” = odjazd po planowanym dojeździe do portu + odprawa.
 */
import type { Load, LoadResources, Sailing } from '../types';
import { effDeparture, hasDeparted, selectableSailings } from './sailings';

/** Armatorzy w UI (STENA-3). */
export const FERRY_OPERATORS = [
  { id: 'POLFERRIES', label: 'Polferries' },
  { id: 'STENA', label: 'Stena Line' },
] as const;

export type FerryOperatorId = (typeof FERRY_OPERATORS)[number]['id'];

/** Godziny: Śrem → port + odprawa (orientacyjnie, do II-7). */
export const PORT_CLEARANCE_H = 14;
export const STENA_PORT_CLEARANCE_H = 16;

/** Awizacja istnieje, gdy są kierowca + ciągnik (kryterium „Edytuj" zamiast „Dodaj"). */
export function hasAwizacja(
  load: Pick<Load, 'resources' | 'sailingId' | 'awizacja' | 'ferry'>,
): boolean {
  const r = load.resources;
  if (r.driverName?.trim() && r.tractorPlate?.trim()) return true;
  if (load.sailingId) return true;
  if (load.awizacja.confirmed) return true;
  if (load.ferry.bookingRef?.trim()) return true;
  return false;
}

function operatorMatches(s: Sailing, operator: FerryOperatorId): boolean {
  const op = (s.operator ?? '').toLowerCase();
  if (operator === 'STENA') return op.includes('stena') || s.route === 'GDY-KAA' || s.route === 'KAA-GDY';
  return !op.includes('stena') && (s.route === 'GDN-NYN' || s.route === 'NYN-GDN' || !s.route);
}

/** Najwcześniejszy sensowny odjazd promu względem planu załadunku. */
export function earliestFerryDepartureMs(
  load: Pick<Load, 'plannedLoadDate' | 'awizacja'>,
  operator: FerryOperatorId = 'POLFERRIES',
): number {
  const fromWindow = load.awizacja.loadWindowEnd ?? load.awizacja.loadWindowStart;
  const fromPlan = load.plannedLoadDate ? `${load.plannedLoadDate}T06:00:00+02:00` : null;
  /* W-naprawy-2 (F7): późniejsze z okna awizacji i dnia załadunku z planu KSH — po przesunięciu załadunku przez KSH
     stare okno awizacji nie podsuwa rejsów sprzed załadunku */
  const cands = [fromWindow, fromPlan].map((x) => (x ? Date.parse(x) : NaN)).filter(Number.isFinite);
  const t = cands.length ? Math.max(...cands) : NaN;
  if (!Number.isFinite(t)) return Date.now();
  const h = operator === 'STENA' ? STENA_PORT_CLEARANCE_H : PORT_CLEARANCE_H;
  return t + h * 36e5;
}

/** Rejsy armatora, na które auto zdąży (+ bieżący przypisany). */
export function reachableSailings(
  all: Sailing[],
  load: Pick<Load, 'plannedLoadDate' | 'awizacja' | 'sailingId'>,
  nowIso: string,
  operator: FerryOperatorId = 'POLFERRIES',
): Sailing[] {
  const minDep = earliestFerryDepartureMs(load, operator);
  return selectableSailings(all, nowIso, load.sailingId, operator).filter((s) => {
    if (s.id === load.sailingId) return true;
    if (hasDeparted(s, nowIso)) return false;
    if (!operatorMatches(s, operator)) return false;
    return Date.parse(effDeparture(s)) >= minDep;
  });
}

/** Unikalne wcześniej użyte wartości (podpowiedzi). */
export function resourceSuggestions(
  loads: Array<{ resources: LoadResources }>,
  field: keyof Pick<LoadResources, 'driverName' | 'driverPhone' | 'tractorPlate' | 'trailerPlate'>,
  limit = 8,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of loads) {
    const v = l.resources[field]?.trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
    if (out.length >= limit) break;
  }
  return out;
}

/** Ostrzeżenie o duplikacie kierowcy/auta na innym aktywnym transporcie. */
export function awizacjaDuplicateWarning(
  loads: Load[],
  selfId: string,
  draft: { driverName: string; tractorPlate: string },
): string | null {
  const driver = draft.driverName.trim().toLowerCase();
  const plate = draft.tractorPlate.trim().toUpperCase();
  if (!driver && !plate) return null;
  const hit = loads.find((l) => {
    if (l.id === selfId) return false;
    /* E25 / audyt-B B-03: „Rozładowany” = „Dostarczone” — kierowca i ciągnik są wolni */
    if (l.status === 'DELIVERED' || l.status === 'UNLOADING') return false;
    const sameDriver = driver && l.resources.driverName?.trim().toLowerCase() === driver;
    const samePlate = plate && l.resources.tractorPlate?.trim().toUpperCase() === plate;
    return Boolean(sameDriver || samePlate);
  });
  return hit ? hit.code : null;
}
