/**
 * E25 — okno „Zmień status” (status, data/godzina PL, notatka).
 * Wygląd dopracuje koordynator na wyglad/*; tu logika i uchwyty.
 */
import { useEffect, useMemo, useState } from 'react';
import { useTowerStore } from '../../store/useTowerStore';
import { t } from '../../i18n/messages';
import { statusLabel } from '../../lib/statusLabel';
import { TZ_OPS, isoToDatetimeLocalValue, wallLocalToIso } from '../../lib/time';
import { getNowIso } from '../../lib/frozenNow';
import type { LoadStatus } from '../../types';

const MANUAL_STATUSES: LoadStatus[] = [
  'PLANNED',
  'RESOURCES_PENDING',
  'DOC_MISSING',
  'READY',
  'LOADING',
  'IN_TRANSIT_PL',
  'AT_PORT',
  'ON_FERRY',
  'AT_PORT_SE',
  'IN_TRANSIT_SE',
  'APPROACHING_SITE',
  'DELIVERED',
  'READY_TO_INVOICE',
  'INVOICED',
];

export function StatusChangeModal({
  loadId,
  code,
  current,
  onClose,
}: {
  loadId: string;
  code: string;
  current: LoadStatus;
  onClose: () => void;
}) {
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const setLoadStatus = useTowerStore((s) => s.setLoadStatus);
  const pushToast = useTowerStore((s) => s.pushToast);
  const [status, setStatus] = useState<LoadStatus>(current === 'UNLOADING' ? 'DELIVERED' : current);
  const [whenLocal, setWhenLocal] = useState(() => isoToDatetimeLocalValue(getNowIso(), TZ_OPS));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const options = useMemo(
    () => MANUAL_STATUSES.map((s) => ({ s, label: statusLabel(s, undefined, locale) })),
    [locale],
  );

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const occurredAt = wallLocalToIso(whenLocal, TZ_OPS);
      if (!occurredAt) {
        pushToast('Podaj prawidłową datę i godzinę', 'HIGH', loadId);
        return;
      }
      if (Date.parse(occurredAt) > Date.now() + 60_000) {
        pushToast('Czas statusu nie może być w przyszłości', 'HIGH', loadId);
        return;
      }
      setLoadStatus(loadId, status, role, note.trim() || undefined, occurredAt);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="scrim" style={{ zIndex: 52 }} aria-label={t(locale, 'a6_dr_close')} onClick={onClose} />
      <section
        className="panel awiz-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-change-title"
        data-status-change-modal
      >
        <header className="panel-hd">
          <h2 id="status-change-title" style={{ fontSize: 18 }}>
            {t(locale, 'a6_dr_change_status')} · {code}
          </h2>
          <div className="spacer" />
          <button type="button" className="iconbtn" aria-label={t(locale, 'close')} onClick={onClose}>
            ✕
          </button>
        </header>
        <form className="panel-bd awiz-modal-bd" onSubmit={save}>
          <label className="form-field">
            <span>Status</span>
            <select
              className="input"
              data-status-select
              value={status}
              onChange={(e) => setStatus(e.target.value as LoadStatus)}
            >
              {options.map(({ s, label }) => (
                <option key={s} value={s}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>{t(locale, 'a6_dr_status_when')}</span>
            <input
              type="datetime-local"
              className="input"
              data-status-when
              value={whenLocal}
              onChange={(e) => setWhenLocal(e.target.value)}
              required
            />
          </label>
          <label className="form-field">
            <span>{t(locale, 'a6_dr_status_note')}</span>
            <textarea
              className="input"
              data-status-note
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="creator-actions">
            <button type="button" className="btn ghost" onClick={onClose}>
              {t(locale, 'a6_dr_close')}
            </button>
            <button type="submit" className="btn" data-status-save disabled={busy}>
              {t(locale, 'a6_dr_status_save')}
            </button>
          </div>
        </form>
      </section>
    </>
  );
}
