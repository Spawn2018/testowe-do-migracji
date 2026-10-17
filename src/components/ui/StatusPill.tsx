import type { CorridorStage, Load, LoadStatus } from '../../types';
import { stageOnlyLabel, statusLabel } from '../../lib/statusLabel';
import { statusMarkers } from '../../lib/stageTiles';
import { t } from '../../i18n/messages';
import { statusTone } from '../../lib/status';
import { useTowerStore } from '../../store/useTowerStore';
import { etaDuration } from '../../lib/etaDuration';

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
  /* D-071 (audyt 17.10): „+1 h 35 min”, „+1 d 18 h” zamiast „+1h35”, „+1d 18h 00m” */
  const abs = Math.abs(Math.trunc(delayMin));
  return `${delayMin < 0 ? '−' : '+'}${etaDuration(abs)}`; /* minus U+2212 jak w Kalibracji ETA */
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
