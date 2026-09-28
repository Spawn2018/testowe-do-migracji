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
