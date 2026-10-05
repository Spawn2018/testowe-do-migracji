import type { CorridorStage, LoadStatus } from '../../types';
import { statusLabel } from '../../lib/statusLabel';
import { statusTone } from '../../lib/status';
import { useTowerStore } from '../../store/useTowerStore';

export { statusLabel } from '../../lib/statusLabel';

const TONE_PILL: Record<ReturnType<typeof statusTone>, string> = {
  plan: 'p-plan',
  ok: 'p-go',
  warn: 'p-amber',
  crit: 'p-red',
  ferry: 'p-sea',
  done: 'p-go',
};

/** B-8.8 — opóźnienie ETA: ≥24 h → dni+godz+min; poniżej → godz+min */
export function formatDelayPill(delayMin: number): string {
  const abs = Math.abs(Math.trunc(delayMin));
  const sign = delayMin < 0 ? '-' : '+';
  const d = Math.floor(abs / (60 * 24));
  const h = Math.floor((abs % (60 * 24)) / 60);
  const m = abs % 60;
  const mm = String(m).padStart(2, '0');
  if (d > 0) return `${sign}${d}d ${h}h ${mm}m`;
  return `${sign}${h}h${mm}`;
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
