/**
 * AWIZ-4 — stan awizacji i wybór rejsu (PO_SPOTKANIU §4).
 * „Zdąży na rejs” = odjazd po planowanym dojeździe do portu + odprawa.
 */
import type { Load, LoadResources, Sailing } from '../types';
import {
  clearanceHoursFor, FERRY_OPERATORS as CATALOG_OPERATORS, sailingOfOperator,
  type FerryOperator,
} from './ferryCatalog';
import { effDeparture, hasDeparted, selectableSailings } from './sailings';
import { isAfterDelivery } from './status';

/** Wszyscy armatorzy z katalogu promów (Polferries, Stena, potem nowi). */
export const FERRY_OPERATORS: readonly { id: FerryOperator; label: string }[] = CATALOG_OPERATORS.map((o) => ({ id: o.code, label: o.name }));

export type FerryOperatorId = FerryOperator;

/**
 * #666 decyzja 55: w awizacji zawsze wszyscy armatorzy ze słownika (Polferries…DFDS),
 * także gdy nie ma jeszcze rejsów w rozkładzie (komunikat w UI).
 * `sailings` / `current` zostają w sygnaturze (kompatybilność wywołań).
 */
export function awizacjaOperators(
  _sailings?: readonly Sailing[],
  _current?: FerryOperatorId | null,
): { id: FerryOperatorId; label: string }[] {
  return [...FERRY_OPERATORS];
}

/** Godziny: Śrem → port + odprawa (orientacyjnie, do II-7) — z katalogu promów (Gdańsk 14 h, Gdynia 16 h). */
export const PORT_CLEARANCE_H = clearanceHoursFor('POLFERRIES');
export const STENA_PORT_CLEARANCE_H = clearanceHoursFor('STENA');

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

/** Rejs armatora — reguła z katalogu promów (Polferries i Stena bez zmian, nowi po nazwie albo trasie). */
export function operatorMatches(s: Sailing, operator: FerryOperatorId): boolean {
  return sailingOfOperator(s, operator);
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
  /* BN9-a: odprawa portu wyjazdowego armatora z katalogu (Polferries i Stena — te same wartości co dotąd) */
  const h = clearanceHoursFor(operator);
  return t + h * 36e5;
}

/**
 * #666 decyzja 51: wszystkie przyszłe (jeszcze niewypłynięte) rejsy armatora ze wszystkich tras wyjazdowych,
 * bez odcinania po dniu załadunku (+ bieżący przypisany). Kolejność: od najbliższego.
 * Rejsy wcześniejsze niż załadunek+odprawa — do wyboru; oznaczenie w UI przez `isBeforePlannedLoad`.
 */
export function reachableSailings(
  all: Sailing[],
  load: Pick<Load, 'plannedLoadDate' | 'awizacja' | 'sailingId'>,
  nowIso: string,
  operator: FerryOperatorId = 'POLFERRIES',
): Sailing[] {
  return selectableSailings(all, nowIso, load.sailingId, operator).filter((s) => {
    if (s.id === load.sailingId) return true;
    if (hasDeparted(s, nowIso)) return false;
    return operatorMatches(s, operator);
  });
}

/** #666 decyzja 51: rejs przed planowanym załadunkiem + odprawą — do wyboru, z oznaczeniem w UI. */
export function isBeforePlannedLoad(
  s: Sailing,
  load: Pick<Load, 'plannedLoadDate' | 'awizacja'>,
  operator: FerryOperatorId = 'POLFERRIES',
): boolean {
  return Date.parse(effDeparture(s)) < earliestFerryDepartureMs(load, operator);
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
    if (isAfterDelivery(l.status) || l.status === 'UNLOADING') return false;
    const sameDriver = driver && l.resources.driverName?.trim().toLowerCase() === driver;
    const samePlate = plate && l.resources.tractorPlate?.trim().toUpperCase() === plate;
    return Boolean(sameDriver || samePlate);
  });
  return hit ? hit.code : null;
}
