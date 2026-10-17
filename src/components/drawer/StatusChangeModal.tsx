/**
 * E25 — okno „Zmień status” (status, data/godzina PL, notatka).
 * Logika i uchwyty: wykonawca (PR #181). Wygląd: wyglad/P4-b według img/e25-after (komputer: okno; telefon: arkusz od dołu):
 * „Teraz: Na placu od 07.10, 08:35”, nowy status, data i godzina (czas polski), podpowiedź z GPS „Użyj”,
 * informacja o dacie realizacji usługi przy „Dostarczone”, notatka, zasady, „Anuluj” / „Zapisz status”.
 * Zapis bez zmian: `setLoadStatus(…, occurredAt)` z wartości `whenLocal` (data + godzina składane w jedno pole).
 * wyglad/A5 (E25 „Rozliczenie”, D-20261015-0300-01 A5): „Gotowe do fakturowania” od razu prosi o plik CMR
 * („Wgraj CMR” otwiera dzisiejsze okno „Wgraj dokument”), „Zafakturowano” pokazuje faktury SCX → HHL i HHL → KSH
 * z tym transportem i której brakuje. „Zapisz” zablokowany przy braku widocznym w danych firmy; baza sprawdza to samo.
 * audyt-B B-04 (E25, 07.10 17:46): SCX widzi tylko bieżący i późniejsze statusy; administrator HHL może cofnąć —
 * wtedy „Powód cofnięcia (wymagany)” i „Zapisz” nieaktywny bez powodu (lista i kierunek: `lib/statusManual.ts`).
 */
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useTowerStore } from '../../store/useTowerStore';
import { t, tp } from '../../i18n/messages';
import { statusLabel } from '../../lib/statusLabel';
import { formatCalendarDay, isoToDatetimeLocalValue, TZ_OPS, wallLocalToIso } from '../../lib/time';
import { getNowIso } from '../../lib/frozenNow';
import { buildStatusAxis, dateTimeFields, dayTime, gpsHint, isoMs } from '../../lib/statusAxis';
import { useIsPhone } from '../../lib/useIsPhone';
import { readyGapsOf } from '../../lib/p4cSource';
import { readyGapsText } from '../../lib/p4c';
import { settlementGate } from '../../lib/statusSettlement';
import { lazyRetry } from '../../lib/lazyRetry';
import { isStepBack, manualOptions, manualStatusOf } from '../../lib/statusManual';
import { viewedKind } from '../../lib/cockpitE9';
import type { LoadStatus } from '../../types';
import { accountRole } from '../../lib/accountRole';

const UploadDocModal = lazy(lazyRetry(() => import('../docs/UploadDocModal').then((m) => ({ default: m.UploadDocModal }))));
const dmy = (iso: string) => formatCalendarDay(iso.slice(0, 10));

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
  const load = useTowerStore((s) => s.loads.find((l) => l.id === loadId));
  const allEvents = useTowerStore((s) => s.events);
  const geofences = useTowerStore((s) => s.geofences);
  const documents = useTowerStore((s) => s.documents);
  const bills = useTowerStore((s) => s.bills);
  const phone = useIsPhone();
  const [upload, setUpload] = useState(false);
  /* E25: „Rozładowany” = „Dostarczone”; „Opóźniony” / „Brak GPS” — status z etapu (oznaczenia, nie statusy) */
  const [status, setStatus] = useState<LoadStatus>(() => manualStatusOf(current, load?.stage));
  /* data i godzina osobno — wyczyszczenie jednego pola nie zeruje drugiego; łączone w `whenLocal` przy zapisie */
  const [date, setDate] = useState(() => isoToDatetimeLocalValue(getNowIso(), TZ_OPS).slice(0, 10));
  const [time, setTime] = useState(() => isoToDatetimeLocalValue(getNowIso(), TZ_OPS).slice(11, 16));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  /* B10 / E25: anulowanie — tylko Administrator HHL z powodem */
  const canCancel = accountRole(role) === 'HHL_ADMIN';
  /* audyt-B B-04 (E25, 07.10 17:46): SCX tylko do przodu; cofnięcie — administrator HHL (w demo HHL bez profilu Operacji), z powodem */
  const hhlAdmin = role === 'HHL' && viewedKind(role, accountRole(role)) === 'HHL_ADMIN';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      /* otwarte okno „Wgraj dokument” zamyka się samo (useModal) — Esc nie zamyka wtedy okna statusu */
      if (e.key === 'Escape' && !upload) {
        e.preventDefault();
        e.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose, upload]);

  const options = useMemo(
    () => manualOptions(current, load?.stage, { hhlAdmin, canCancel }).map((s) => ({ s, label: statusLabel(s, undefined, locale) })),
    [locale, canCancel, hhlAdmin, current, load?.stage],
  );
  const back = isStepBack(status, current, load?.stage);
  /* powód wymagany przy cofnięciu i anulowaniu — pole obowiązkowe, „Zapisz” nieaktywny bez powodu */
  const reasonNeeded = back || status === 'CANCELLED';
  const reasonMissing = reasonNeeded && !note.trim();

  /* „Teraz: … od …” i podpowiedź z GPS — z dziennika zdarzeń transportu (bez zapytań) */
  const events = useMemo(() => allEvents.filter((e) => e.loadId === loadId), [allEvents, loadId]);
  const axis = useMemo(() => (load ? buildStatusAxis(load, events) : null), [load, events]);
  const since = axis?.currentSince ?? null;
  const hint = useMemo(() => gpsHint(status, events, geofences, since), [status, events, geofences, since]);
  /* wyglad/P4-c (L6, L9, L29): „Gotowy” tylko przy komplecie — przycisk zablokowany, obok zdanie, czego brakuje */
  const gaps = useMemo(
    () => (load ? readyGapsOf(load, documents.filter((d) => d.loadId === loadId)) : null),
    [load, documents, loadId],
  );
  const readyBlocked = status === 'READY' && !!gaps?.length;
  const gapText = gaps?.length ? readyGapsText(gaps, locale) : null;
  /* wyglad/A5: plik CMR przy „Gotowe do fakturowania”, obie faktury przy „Zafakturowano” */
  const settle = useMemo(() => settlementGate(status, loadId, role, documents, bills), [status, loadId, role, documents, bills]);
  const blocked = readyBlocked || !!settle?.blocked || reasonMissing || (back && !hhlAdmin);
  const canUpload = role === 'HHL' || role === 'SCX';

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (busy || blocked) return;
    if (back && !hhlAdmin) {
      pushToast(t(locale, 'p4b_m_rules_nodate'), 'HIGH', loadId);
      return;
    }
    if (status === 'CANCELLED') {
      if (!canCancel) {
        pushToast('Anulowanie — tylko Administrator HHL', 'HIGH', loadId);
        return;
      }
      if (!note.trim()) {
        pushToast('Anulowanie wymaga powodu', 'HIGH', loadId);
        return;
      }
    }
    setBusy(true);
    try {
      const whenLocal = `${date}T${time}`;
      const occurredAt = wallLocalToIso(whenLocal, TZ_OPS);
      if (!occurredAt) {
        pushToast('Podaj prawidłową datę i godzinę', 'HIGH', loadId);
        return;
      }
      if (Date.parse(occurredAt) > Date.now() + 60_000) {
        pushToast('Czas statusu nie może być w przyszłości', 'HIGH', loadId);
        return;
      }
      /* E25: nie wcześniej niż poprzedni status (tekst zasad w oknie); baza sprawdza to samo — dopisek wykonawcy */
      if (since && Date.parse(occurredAt) < isoMs(since) && status !== 'CANCELLED') {
        pushToast(tp(locale, 'p4b_m_err_before', { at: dayTime(since) }), 'HIGH', loadId);
        return;
      }
      setLoadStatus(loadId, status, role, note.trim() || undefined, occurredAt);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  const nowName = statusLabel(axis?.current ?? current, undefined, locale);

  return (
    <>
      <button type="button" className="scrim" style={{ zIndex: 52 }} aria-label={t(locale, 'a6_dr_close')} onClick={onClose} />
      <section
        className={`panel awiz-modal scm${phone ? ' sheet' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-change-title"
        data-status-change-modal
      >
        {phone ? <span className="scm-grab" aria-hidden /> : null}
        <header className="panel-hd">
          <h2 id="status-change-title">
            {phone ? t(locale, 'p4b_m_title_ph') : tp(locale, 'p4b_m_title', { code })}
          </h2>
          <div className="spacer" />
          <button type="button" className="iconbtn" aria-label={t(locale, 'close')} onClick={onClose}>
            ✕
          </button>
        </header>
        <form className="panel-bd awiz-modal-bd scm-bd" onSubmit={save}>
          <p className="scm-now" data-status-now>
            {t(locale, 'p4b_m_now')} <b>{nowName}</b>
            {since ? ` ${tp(locale, 'p4b_m_since', { at: dayTime(since) })}` : ''}
          </p>
          <label className="form-field">
            <span>{t(locale, 'p4b_m_new')}</span>
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
          {status === 'READY' && gaps ? (
            gapText ? (
              <div className="scm-info bad" id="scm-ready-gaps" data-status-ready-gaps role="status">
                <b>{t(locale, 'p4c_ready_title')}</b> {tp(locale, 'p4c_ready_missing', { list: gapText.list })}
                {gapText.who ? <span className="scm-who">{tp(locale, 'p4c_ready_who', { who: gapText.who })}</span> : null}
              </div>
            ) : (
              <div className="scm-info ok" data-status-ready-ok>{t(locale, 'p4c_ready_ok')}</div>
            )
          ) : null}
          {settle?.kind === 'cmr' ? (
            settle.cmr ? (
              <div className="scm-info ok" data-status-cmr="ok">
                <b>{t(locale, 'scm_cmr_ok')}</b> <span className="scm-file">{settle.cmr.name}</span>
                {settle.cmr.uploadedAt ? <span className="scm-who">{tp(locale, 'scm_cmr_at', { at: dayTime(settle.cmr.uploadedAt) })}</span> : null}
              </div>
            ) : (
              <div className="scm-info bad scm-cmr" id="scm-settle" data-status-cmr="missing" role="status">
                <span>{t(locale, 'scm_cmr_missing')}</span>
                {canUpload ? (
                  <button type="button" className="btn scm-up" data-status-cmr-upload onClick={() => setUpload(true)}>
                    {t(locale, 'scm_cmr_upload')}
                  </button>
                ) : null}
              </div>
            )
          ) : null}
          {settle?.kind === 'inv' ? (
            <>
              <span className="scm-lbl">{t(locale, 'scm_inv_title')}</span>
              <ul className="scm-inv" data-status-invoices>
                {settle.rows.map((r) => (
                  <li key={r.dir} className={r.hidden ? 'hid' : r.bill ? 'has' : 'miss'} data-status-invoice={r.dir}>
                    <span className="scm-inv-dir">{t(locale, `scm_inv_${r.dir}`)}</span>
                    <span className="scm-inv-v">
                      {r.hidden
                        ? t(locale, 'scm_inv_hidden')
                        : r.bill
                          ? <><span className="scm-file">{r.bill.number}</span> · {dmy(r.bill.issueDate)}</>
                          : t(locale, 'scm_inv_none')}
                    </span>
                  </li>
                ))}
              </ul>
              {settle.missing.length ? (
                <div className="scm-info bad" id="scm-settle" data-status-inv="missing" role="status">
                  {tp(locale, 'scm_inv_missing', { list: settle.missing.map((d) => t(locale, `scm_inv_${d}`)).join(', ') })}
                </div>
              ) : settle.rows.some((r) => r.hidden) ? (
                <div className="scm-info" data-status-inv="part">
                  {tp(locale, 'scm_inv_ok_part', { list: settle.rows.filter((r) => !r.hidden).map((r) => t(locale, `scm_inv_${r.dir}`)).join(', ') })}
                </div>
              ) : (
                <div className="scm-info ok" data-status-inv="ok">{t(locale, 'scm_inv_ok')}</div>
              )}
            </>
          ) : null}
          <div className="scm-when" data-status-when>
            <label className="form-field">
              <span>{t(locale, 'p4b_m_date')}</span>
              <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <label className="form-field">
              <span>{t(locale, phone ? 'p4b_m_time_ph' : 'p4b_m_time')}</span>
              <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} required />
            </label>
          </div>
          {hint ? (
            <div className="scm-gps" data-status-gps>
              <span>{tp(locale, 'p4b_m_gps', { what: t(locale, `p4b_gps_${hint.kind}`), at: dayTime(hint.at) })}</span>
              <button
                type="button"
                className="scm-use"
                onClick={() => {
                  const f = dateTimeFields(hint.at);
                  if (f) {
                    setDate(f.date);
                    setTime(f.time);
                  }
                }}
              >
                {t(locale, 'p4b_m_gps_use')}
              </button>
            </div>
          ) : null}
          {status === 'DELIVERED' ? (
            <div className="scm-info" data-status-info>
              {t(locale, phone ? 'p4b_m_delivered_info_ph' : 'p4b_m_delivered_info')}
            </div>
          ) : null}
          {back ? (
            <div className="scm-info bad" data-status-back role="status">
              {tp(locale, 'p4b_m_back_info', { from: nowName, to: statusLabel(status, undefined, locale) })}
            </div>
          ) : null}
          {/* notatka także na telefonie: cofnięcie i anulowanie wymagają powodu (E25) */}
          <label className="form-field">
            <span>{t(locale, back ? 'p4b_m_reason_back' : status === 'CANCELLED' ? 'p4b_m_reason_cancel' : 'p4b_m_note')}</span>
            <input
              className="input"
              id="scm-note"
              data-status-note
              data-status-reason={reasonNeeded ? 'required' : undefined}
              value={note}
              required={reasonNeeded}
              aria-required={reasonNeeded || undefined}
              placeholder={t(locale, reasonNeeded ? 'p4b_m_reason_ph' : 'p4b_m_note_ph')}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          {phone ? null : (
            <p className="scm-rules">
              {since ? tp(locale, 'p4b_m_rules', { at: dayTime(since) }) : t(locale, 'p4b_m_rules_nodate')}
            </p>
          )}
          <div className="scm-actions">
            <button type="button" className="btn ghost" onClick={onClose}>
              {t(locale, 'p4b_m_cancel')}
            </button>
            <button
              type="submit"
              className="btn"
              data-status-save
              disabled={busy || blocked}
              aria-describedby={readyBlocked ? 'scm-ready-gaps' : settle?.blocked ? 'scm-settle' : reasonMissing ? 'scm-note' : undefined}
            >
              {t(locale, phone ? 'p4b_m_save_ph' : 'p4b_m_save')}
            </button>
          </div>
        </form>
      </section>
      {upload && canUpload && load ? (
        <Suspense fallback={null}>
          <UploadDocModal
            locale={locale}
            role={role as 'HHL' | 'SCX'}
            phone={phone}
            loads={[load]}
            statusRows={[]}
            allowed={['CMR']}
            loadId={loadId}
            onClose={() => setUpload(false)}
          />
        </Suspense>
      ) : null}
    </>
  );
}
