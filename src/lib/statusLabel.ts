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
  TO_PORT: 's_road_pl',
  GDANSK: 's_port_gdn',
  FERRY: 's_on_ferry',
  /* E25 / E28 (wyglad/P4-b): etap portu SE nazywa się „Port SE” (Nynäshamn albo Karlskrona) */
  APPROACH: 's_port_se',
  SE_ROAD: 's_road_se',
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

/** DP-137 / 25A: trasa spoza Polferries/Stena → etykiety FI/EE zamiast „Port SE” / „Droga SE”. */
function balticNamedEnds(route: string | null | undefined) {
  const ends = routeEnds(route);
  if (!ends) return null;
  if (operatorsForRoute(route).some((o) => LEGACY_OPERATORS.includes(o))) return null;
  return ends;
}

/**
 * BN9-b, decyzja 25A — przeprawy z Estonii (Tallinn, Muuga, Paldiski): te same statusy, w nazwie port z rejsu:
 * „Port wypłynięcia — Muuga”, „Port przypłynięcia — Vuosaari”, „Droga do portu”, „Droga do placu”.
 * Polferries i Stena (i transport bez rejsu) — nazwy bez zmian („Port PL”, „Port SE”, „Droga PL”, „Droga SE”).
 * DP-137: enum `IN_TRANSIT_SE` / flaga `synthetic_port_se` zostają (jak SE); UI i ETA pokazują etykiety FI.
 */
export function routeStatusLabel(status: LoadStatus, stage: CorridorStage | undefined, locale: Locale, route: string | null | undefined): string {
  const ends = balticNamedEnds(route);
  if (ends) {
    if (status === 'AT_PORT') return tp(locale, 's_port_out_named', { port: portName(locale, ends.from) + (ends.fromTerminal ? ` ${ends.fromTerminal}` : '') });
    if (status === 'AT_PORT_SE') return tp(locale, 's_port_in_named', { port: portName(locale, ends.to) + (ends.toTerminal ? ` ${ends.toTerminal}` : '') });
    if (status === 'IN_TRANSIT_PL') return t(locale, 's_road_to_port');
    if (status === 'IN_TRANSIT_SE') return t(locale, 's_road_to_site');
  }
  return statusLabel(status, stage, locale);
}

/** DP-137: etap (Opóźniony/Cichy) — te same nazwy FI co status (25A). */
export function routeStageLabel(stage: CorridorStage, locale: Locale, route: string | null | undefined): string {
  const ends = balticNamedEnds(route);
  if (ends) {
    if (stage === 'GDANSK') return tp(locale, 's_port_out_named', { port: portName(locale, ends.from) + (ends.fromTerminal ? ` ${ends.fromTerminal}` : '') });
    if (stage === 'APPROACH') return tp(locale, 's_port_in_named', { port: portName(locale, ends.to) + (ends.toTerminal ? ` ${ends.toTerminal}` : '') });
    if (stage === 'TO_PORT') return t(locale, 's_road_to_port');
    if (stage === 'SE_ROAD') return t(locale, 's_road_to_site');
  }
  return stageOnlyLabel(stage, locale);
}
