/**
 * wyglad/P6 — które ryzyko jest sprawą „Do zrobienia” (E7, decyzja 07.10 15:55, E7-3, E7-4).
 * Wspólne dla liczby w menu, Kokpicie i dzwonku (`cockpitE9.todoQueue`) i dla listy na stronie Ryzyka (`p6Todo.ts`).
 * - komunikaty techniczne drogi — nigdzie;
 * - zakaz ruchu w dniu przejazdu — tylko informacja przy transporcie, bez liczenia;
 * - sytuacja na trasie bez transportu (prom, drogi, siła wyższa) — tylko w „Sytuacji na trasie”;
 * - sprawa techniczna bez transportu (SMS, kopie, źródła danych) — Opcje › System › Stan systemu.
 * Samozamykanie, „przed pojazdem” i decyzje w liczbie — wykonawca (P6, dopisek).
 */
import type { Risk } from '../types';
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
    if (r.type === 'FERRY') out.ferry.push(r);
    else if (r.type === 'FORCE_MAJEURE') out.weather.push(r);
    else if (r.kind === 'ROAD_PL') out.roadPl.push(r);
    /* ROAD_SE bez transportu = te same sytuacje Trafikverket co lista „Drogi SE” (corridor_conditions) */
  }
  return out;
}
