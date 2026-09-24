import type { CorridorStage, LoadStatus, Locale } from '../../types';
import { statusTone } from '../../lib/status';
import { t } from '../../i18n/messages';
import { useTowerStore } from '../../store/useTowerStore';

/**
 * Status / stage labels via dictionary (D19). DELAYED / SILENT fall back to stage.
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
  IN_TRANSIT_SE: 's_road_se',
  APPROACHING_SITE: 's_on_site',
  UNLOADING: 's_unloaded',
  DELIVERED: 's_delivered',
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

const TONE_PILL: Record<ReturnType<typeof statusTone>, string> = {
  plan: 'p-plan',
  ok: 'p-go',
  warn: 'p-amber',
  crit: 'p-red',
  ferry: 'p-sea',
  done: 'p-go',
};

export function statusLabel(status: LoadStatus, stage?: CorridorStage, locale: Locale = 'pl'): string {
  if (status === 'DELAYED' || status === 'SILENT') {
    return stage ? t(locale, STAGE_KEYS[stage]) : t(locale, 's_road_pl');
  }
  const key = STATUS_KEYS[status];
  if (key) return t(locale, key);
  return stage ? t(locale, STAGE_KEYS[stage]) : status;
}

/** Claude table delay pill: +1h35 */
export function formatDelayPill(delayMin: number): string {
  const h = Math.floor(delayMin / 60);
  const m = delayMin % 60;
  return `+${h}h${String(m).padStart(2, '0')}`;
}

export function StatusPill({
  status,
  stage,
}: {
  status: LoadStatus;
  stage?: CorridorStage;
}) {
  const locale = useTowerStore((s) => s.locale);
  const tone =
    status === 'DELAYED' || status === 'SILENT'
      ? 'warn'
      : statusTone(status);
  return <span className={`pill ${TONE_PILL[tone]}`}>{statusLabel(status, stage, locale)}</span>;
}
