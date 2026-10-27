/**
 * wyglad/P6 — które ryzyko jest sprawą „Do zrobienia” (E7, decyzja 07.10 15:55, E7-3, E7-4).
 * Wspólne dla liczby w menu, Kokpicie i dzwonku (`cockpitE9.todoQueue`) i dla listy na stronie Ryzyka (`p6Todo.ts`).
 * - komunikaty techniczne drogi — nigdzie;
 * - zakaz ruchu w dniu przejazdu — tylko informacja przy transporcie, bez liczenia;
 * - sytuacja na trasie bez transportu (prom, drogi, siła wyższa) — tylko w „Sytuacji na trasie”;
 * - sprawa techniczna bez transportu (SMS, kopie, źródła danych) — Opcje › System › Stan systemu.
 * Samozamykanie, „przed pojazdem” i decyzje w liczbie — wykonawca (P6, dopisek).
 */
import type { Load, LoadStatus, Risk } from '../types';
import { isTechnicalRoadNotice } from './format';

const ROUTE_TYPES: ReadonlySet<Risk['type']> = new Set<Risk['type']>(['FERRY', 'ROAD_SE', 'FORCE_MAJEURE']);
/** Rodzaje z bazy, które są sprawą techniczną (E7 pkt 7). */
export const SYSTEM_KINDS: ReadonlySet<string> = new Set(['JOB_FAILURE', 'USAGE_LIMIT']);
/* awaria źródła danych; rejsy „do weryfikacji” i AIS zostają przy promach (Sytuacja na trasie) */
const SYSTEM_CODES: ReadonlySet<string> = new Set(['SOURCE_DOWN']);

type R = Pick<Risk, 'title'> & Partial<Pick<Risk, 'type' | 'loadId' | 'kind' | 'code'>>;

export function isTimeBan(r: R): boolean {
  if (r.kind && r.kind !== 'ROAD_PL' && r.kind !== 'ROAD_SE') return false;
  return /zakaz (ruchu|czasowy)|time.?ban/i.test(r.title);
}

export function isSystemRisk(r: R): boolean {
  return !r.loadId && ((!!r.kind && SYSTEM_KINDS.has(r.kind)) || (!!r.code && SYSTEM_CODES.has(r.code)));
}

export function isRouteOnly(r: R): boolean {
  return !r.loadId && ((!!r.type && ROUTE_TYPES.has(r.type)) || r.kind === 'ROAD_PL');
}

/** Sprawa do zrobienia (liczy się i jest na liście). */
export function isTodoRisk(r: R): boolean {
  return !isTechnicalRoadNotice(r.title) && !isTimeBan(r) && !isRouteOnly(r) && !isSystemRisk(r);
}

/** Transport po dostawie albo anulowany — alarmy „przed załadunkiem” przy nim są już nieaktualne. */
const LOAD_CLOSED: ReadonlySet<LoadStatus> = new Set<LoadStatus>(['DELIVERED', 'READY_TO_INVOICE', 'INVOICED', 'CANCELLED', 'REMOVED']);
const filled = (v: string | null | undefined): boolean => !!(v ?? '').trim();

/** Alarmy przed załadunkiem i w drodze — po dostawie albo anulowaniu transportu nieaktualne (zamknięcie w bazie — D-20261018-1215-01 §2). */
const BEFORE_DELIVERY_KEYS: ReadonlySet<string> = new Set([
  'rk_res_driver', 'rk_res_vehicle', 'rk_res_docs', 'rk_res_escort', 'rk_order_no_hhl', 'rk_order_no_carrier', 'rk_seed_res',
  'rk_auto_status_blocked', 'rk_silent_vehicle', 'rk_eta_breach', 'rk_off_corridor',
]);

/**
 * Sprawa już zrobiona według danych transportu w aplikacji (właściciel 18.10.2026, 11:35 i 11:46: sekcja „Do zrobienia”
 * w panelu transportu › Przegląd pokazuje tylko aktualny stan). Ta sama zasada co w bazie (0143 `l3_*`, 0012 numery zleceń):
 * - „brak awizacji” (`rk_res_driver`) — kierowca, telefon, ciągnik i naczepa wpisane;
 * - „brak tablic” (`rk_res_vehicle`) — ciągnik i naczepa wpisane;
 * - „brak numeru zlecenia HHL / przewoźnika” — numer wpisany;
 * - alarmy przed załadunkiem i w drodze przy transporcie dostarczonym, zafakturowanym albo anulowanym.
 * Sprawa znika od razu po wpisaniu danych w panelu, bez czekania na zamknięcie w bazie i odświeżenie strony.
 */
export function todoDoneOnLoad(r: Partial<Pick<Risk, 'titleKey'>>, load: Load | undefined): boolean {
  if (!load || !r.titleKey) return false;
  if (LOAD_CLOSED.has(load.status) && BEFORE_DELIVERY_KEYS.has(r.titleKey)) return true;
  const res = load.resources;
  switch (r.titleKey) {
    case 'rk_res_driver':
      return filled(res.driverName) && filled(res.driverPhone) && filled(res.tractorPlate) && filled(res.trailerPlate);
    case 'rk_res_vehicle':
      return filled(res.tractorPlate) && filled(res.trailerPlate);
    /* demo: „Brak kierowcy i numerów rejestracyjnych” — kierowca, ciągnik i naczepa (jak `clearResourceGapRisks` w store) */
    case 'rk_seed_res':
      return filled(res.driverName) && filled(res.tractorPlate) && filled(res.trailerPlate);
    case 'rk_order_no_hhl':
      return filled(load.hhlOrderNo);
    case 'rk_order_no_carrier':
      return filled(load.carrierOrderNo);
    default:
      return false;
  }
}

/** Ryzyka bez spraw już zrobionych (`todoDoneOnLoad`) — wejście sekcji „Do zrobienia” w panelu transportu › Przegląd (właściciel 18.10, 11:46: tylko ta sekcja). */
export function openTodoRisks<T extends Partial<Pick<Risk, 'loadId' | 'titleKey'>>>(risks: readonly T[], loads: readonly Load[]): T[] {
  const byId = new Map(loads.map((l) => [l.id, l]));
  return risks.filter((r) => !(r.loadId && todoDoneOnLoad(r, byId.get(r.loadId))));
}

/**
 * Klucz karty: transport albo jednakowe sprawy bez transportu (E7 pkt 3 — „12 SEFS → 1”).
 * „Jednakowe” = ten sam tekst (nie sam klucz słownika: `rk_generic` i polisy mają różne treści pod jednym kluczem).
 */
export function todoCardKey(r: Pick<Risk, 'loadId' | 'title'>): string {
  return r.loadId ? `L:${r.loadId}` : `R:${r.title}`;
}

/** Sytuacja na trasie bez transportu w podziale na miejsca strony (E7 pkt 4, 6, 7). */
export interface RouteRisks { ferry: Risk[]; weather: Risk[]; roadPl: Risk[]; bans: Risk[]; system: Risk[] }
export function routeRisks(risks: readonly Risk[]): RouteRisks {
  const out: RouteRisks = { ferry: [], weather: [], roadPl: [], bans: [], system: [] };
  for (const r of risks) {
    if (isTechnicalRoadNotice(r.title)) continue;
    if (isTimeBan(r)) { if (!r.loadId) out.bans.push(r); continue; }
    if (isSystemRisk(r)) { out.system.push(r); continue; }
    if (r.loadId) continue;
    /* U-100 (makieta E7): „statek w porcie” (AIS, informacja) trafia do historii rejsu, nie na listę ostrzeżeń */
    if (r.type === 'FERRY' && /^rk_ais_arrived/.test(r.titleKey ?? '')) continue;
    if (r.type === 'FERRY') out.ferry.push(r);
    else if (r.type === 'FORCE_MAJEURE') out.weather.push(r);
    else if (r.kind === 'ROAD_PL') out.roadPl.push(r);
    /* ROAD_SE bez transportu = te same sytuacje Trafikverket co lista „Drogi SE” (corridor_conditions) */
  }
  return out;
}
