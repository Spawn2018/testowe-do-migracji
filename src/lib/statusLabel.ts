import type { CorridorStage, LoadStatus, Locale } from '../types';
import { t } from '../i18n/messages';

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
  UNLOADING: 's_unloaded',
  DELIVERED: 's_delivered',
  READY_TO_INVOICE: 's_ready_to_invoice',
  INVOICED: 's_invoiced',
  DELAYED: 's_delayed',
  SILENT: 's_silent',
};

const STAGE_KEYS: Record<CorridorStage, string> = {
  PLAN: 's_planned',
  LOADING: 's_loading',
  TO_PORT: 's_road_pl',
  GDANSK: 's_port_gdn',
  FERRY: 's_on_ferry',
  APPROACH: 's_nynashamn',
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
