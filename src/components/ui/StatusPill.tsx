import type { CorridorStage, Load, LoadStatus } from '../../types';
import { stageOnlyLabel, statusLabel } from '../../lib/statusLabel';
import { statusMarkers } from '../../lib/stageTiles';
import { t } from '../../i18n/messages';
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
  /* wyglad/P4 (E25, L7): „Opóźniony” i „Cichy” to oznaczenia obok statusu, nie status — w pigułce nazwa etapu */
  const flagOnly = (status === 'DELAYED' || status === 'SILENT') && !!stage;
  const tone = flagOnly ? 'ok' : statusTone(status);
  return <span className={`pill ${TONE_PILL[tone]}`}>{flagOnly ? stageOnlyLabel(stage!, locale) : statusLabel(status, stage, locale)}</span>;
}

/**
 * wyglad/P4 (E25, L7): oznaczenia obok statusu — Opóźniony (gdy brak liczby minut; inaczej „+2h05”), Brak GPS, Brak dokumentów.
 */
export function StatusMarkers({
  load,
  delayMin,
}: {
  load: Pick<Load, 'status' | 'stage' | 'delayed' | 'docMissing' | 'silentMinutes'>;
  delayMin: number | null;
}) {
  const locale = useTowerStore((s) => s.locale);
  const markers = statusMarkers(load, { hasDelayMinutes: delayMin != null });
  return (
    <>
      {delayMin != null ? <span className="pill p-red st-mk" data-marker="delay">{formatDelayPill(delayMin)}</span> : null}
      {markers.map((m) => (
        <span key={m} className={`pill ${m === 'nogps' ? 'p-amber' : 'p-red'} st-mk`} data-marker={m}>
          {t(locale, `p4_m_${m}`)}
        </span>
      ))}
    </>
  );
}
