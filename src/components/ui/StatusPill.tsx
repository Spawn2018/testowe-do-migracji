import type { CorridorStage, LoadStatus } from '../../types';
import { statusTone } from '../../lib/status';

/**
 * Claude makieta I18N s_* only — no Opóźniony / Cichy as status labels.
 * DELAYED / SILENT fall back to stage-based Claude wording.
 */
const BY_STATUS: Partial<Record<LoadStatus, string>> = {
  PLANNED: 'Planowany',
  RESOURCES_PENDING: 'Brak auta',
  DOC_MISSING: 'Brak dokumentów',
  READY: 'Gotowy',
  LOADING: 'Załadunek',
  IN_TRANSIT_PL: 'W drodze PL',
  AT_PORT: 'Port Gdańsk',
  ON_FERRY: 'Na promie',
  IN_TRANSIT_SE: 'W drodze SE',
  APPROACHING_SITE: 'Na placu',
  UNLOADING: 'Rozładowany',
  DELIVERED: 'Dostarczony',
};

const BY_STAGE: Record<CorridorStage, string> = {
  PLAN: 'Planowany',
  LOADING: 'Załadunek',
  TO_PORT: 'W drodze PL',
  GDANSK: 'Port Gdańsk',
  FERRY: 'Na promie',
  APPROACH: 'Nynäshamn',
  SE_ROAD: 'W drodze SE',
  SITE: 'Na placu',
  DELIVERED: 'Dostarczony',
};

const TONE_PILL: Record<ReturnType<typeof statusTone>, string> = {
  plan: 'p-plan',
  ok: 'p-go',
  warn: 'p-amber',
  crit: 'p-red',
  ferry: 'p-sea',
  done: 'p-go',
};

export function statusLabel(status: LoadStatus, stage?: CorridorStage): string {
  if (status === 'DELAYED' || status === 'SILENT') {
    return stage ? BY_STAGE[stage] : 'W drodze PL';
  }
  return BY_STATUS[status] ?? (stage ? BY_STAGE[stage] : status);
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
  const tone =
    status === 'DELAYED' || status === 'SILENT'
      ? 'warn'
      : statusTone(status);
  return <span className={`pill ${TONE_PILL[tone]}`}>{statusLabel(status, stage)}</span>;
}
