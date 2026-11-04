import type { CorridorStage, LoadStatus, Locale } from '../types';
import { t, tp } from '../i18n/messages';
import { LEGACY_OPERATORS, operatorsForRoute, routeEnds } from './ferryCatalog';
import { portName } from './portName';

/**
 * Status / stage labels via dictionary (D19).
 * L-7: DELAYED and SILENT have their own names (not the stage).
 */
const STATUS_KEYS: Partial<Record<LoadStatus, string>> = {
  PLANNED: 's_planned',
  RESOURCES_PENDING: 's_no_vehicle',
  DOC_MISSING: 's_no_docs',
  READY: 's_ready',
  LOADING: 's_loading',
  IN_TRANSIT_PL: 's_road_pl',
  AT_PORT: 's_port_gdn',
  ON_FERRY: 's_on_ferry',
  AT_PORT_SE: 's_port_se',
  IN_TRANSIT_SE: 's_road_se',
  APPROACHING_SITE: 's_on_site',
  /* E25: „Rozładowany” scalony z „Dostarczone” (wyglad/P4-b — jeden słownik nazw) */
  UNLOADING: 's_delivered',
  DELIVERED: 's_delivered',
  READY_TO_INVOICE: 's_ready_to_invoice',
  INVOICED: 's_invoiced',
  CANCELLED: 'p4b_cancelled',
  DELAYED: 's_delayed',
  SILENT: 's_silent',
};

const STAGE_KEYS: Record<CorridorStage, string> = {
  PLAN: 's_planned',
  LOADING: 's_loading',
  /* DP-215 (#798): etapy neutralne (stage_*); statusy nadal s_road_pl / s_port_* */
  TO_PORT: 'stage_TO_PORT',
  GDANSK: 'stage_GDANSK',
  FERRY: 's_on_ferry',
  APPROACH: 'stage_APPROACH',
  SE_ROAD: 'stage_SE_ROAD',
  SITE: 's_on_site',
  DELIVERED: 's_delivered',
};

export function statusLabel(status: LoadStatus, stage?: CorridorStage, locale: Locale = 'pl'): string {
  const key = STATUS_KEYS[status];
  if (key) return t(locale, key);
  return stage ? t(locale, STAGE_KEYS[stage]) : status;
}

/** wyglad/P4 (E25, L7): nazwa etapu bez statusu — dla „Opóźniony” i „Cichy”, które w E25 są oznaczeniem obok statusu. */
export function stageOnlyLabel(stage: CorridorStage, locale: Locale = 'pl'): string {
  return t(locale, STAGE_KEYS[stage]);
}

/** DP-137 / 25A: trasa spoza Polferries/Stena → etykiety FI/EE na etapach (Opóźniony/Cichy). */
function balticNamedEnds(route: string | null | undefined) {
  const ends = routeEnds(route);
  if (!ends) return null;
  if (operatorsForRoute(route).some((o) => LEGACY_OPERATORS.includes(o))) return null;
  return ends;
}

function portEndLabel(locale: Locale, ends: NonNullable<ReturnType<typeof routeEnds>>, which: 'from' | 'to'): string {
  if (which === 'from') return portName(locale, ends.from) + (ends.fromTerminal ? ` ${ends.fromTerminal}` : '');
  return portName(locale, ends.to) + (ends.toTerminal ? ` ${ends.toTerminal}` : '');
}

/**
 * BN9-b / DP-215 (właściciel 04.11 21:10): te same statusy dla wszystkich tras (Polferries, Stena, EE/FI, bez rejsu):
 * „Port wypłynięcia — {port}”, „Port przypłynięcia — {port}”, „Droga do portu”, „Droga do placu”;
 * bez rejsu — bez nazwy portu. Port z `sailings.route` (`routeEnds`: GDN-NYN, GDY-KAA, TLL-HEL…).
 * Etapy/kafelki: Port wyjścia / Port docelowy (stage_*); FI na etapach — jak status (25A).
 * DP-137: enum `IN_TRANSIT_SE` / flaga `synthetic_port_se` zostają; UI pokazuje etykiety powyżej.
 */
export function routeStatusLabel(status: LoadStatus, stage: CorridorStage | undefined, locale: Locale, route: string | null | undefined): string {
  const ends = routeEnds(route);
  if (status === 'AT_PORT') {
    return ends ? tp(locale, 's_port_out_named', { port: portEndLabel(locale, ends, 'from') }) : t(locale, 's_port_gdn');
  }
  if (status === 'AT_PORT_SE') {
    return ends ? tp(locale, 's_port_in_named', { port: portEndLabel(locale, ends, 'to') }) : t(locale, 's_port_se');
  }
  if (status === 'IN_TRANSIT_PL') return t(locale, 's_road_to_port');
  if (status === 'IN_TRANSIT_SE') return t(locale, 's_road_to_site');
  return statusLabel(status, stage, locale);
}

/** DP-137: etap (Opóźniony/Cichy) — FI jak status (25A); Polferries/Stena: stage_* (Port wyjścia / Port docelowy). */
export function routeStageLabel(stage: CorridorStage, locale: Locale, route: string | null | undefined): string {
  const ends = balticNamedEnds(route);
  if (ends) {
    if (stage === 'GDANSK') return tp(locale, 's_port_out_named', { port: portEndLabel(locale, ends, 'from') });
    if (stage === 'APPROACH') return tp(locale, 's_port_in_named', { port: portEndLabel(locale, ends, 'to') });
    if (stage === 'TO_PORT') return t(locale, 's_road_to_port');
    if (stage === 'SE_ROAD') return t(locale, 's_road_to_site');
  }
  return stageOnlyLabel(stage, locale);
}
