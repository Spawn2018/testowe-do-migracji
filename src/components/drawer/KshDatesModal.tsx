/**
 * AUD-03 — KSH — PANEL ZLECENIA (decyzja właściciela 05.10): „Edytuj” w Przeglądzie otwiera okno jak u przewoźnika.
 * Do edycji WYŁĄCZNIE: data i godzina załadunku oraz rozładunku (okna od–do). Zapis: RPC ksh_confirm_dates
 * (baza: tylko kolumny dat planu; Historia „imię nazwisko // KSH”, DEC-4, ETA, opłata paliwowa, I-10).
 */
import { useEffect, useState } from 'react';
import { SUPABASE_AUTH_ENABLED } from '../../auth/config';
import { useTowerStore } from '../../store/useTowerStore';
import { t } from '../../i18n/messages';
import { isoToDatetimeLocalValue, wallLocalToIso, TZ_OPS } from '../../lib/time';
import type { Load } from '../../types';

/* C12 / D-0300: status UI = DOC_MISSING (mapper), nie DOCS_PENDING z bazy */
const PRE_LOADING = ['PLANNED', 'RESOURCES_PENDING', 'DOC_MISSING', 'READY'];

function datePart(iso: string | null | undefined, fallback: string): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ_OPS, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function initial(iso: string | null | undefined, day: string, hour: string): string {
  return iso ? isoToDatetimeLocalValue(iso, TZ_OPS) : `${day}T${hour}`;
}

/** Czy KSH może jeszcze zmienić daty (jak w bazie: do wjazdu na załadunek). */
export function kshCanEditDates(load: Pick<Load, 'status'>): boolean {
  return PRE_LOADING.includes(load.status);
}

export function KshDatesModal({ load, onClose }: { load: Load; onClose: () => void }) {
  const locale = useTowerStore((s) => s.locale);
  const kshEditPlanDates = useTowerStore((s) => s.kshEditPlanDates);
  const pushToast = useTowerStore((s) => s.pushToast);
  const pd = load.planDates;
  const aw = load.awizacja;
  const [loadFrom, setLoadFrom] = useState(initial(pd?.loadFrom ?? aw?.loadWindowStart, load.plannedLoadDate, '07:00'));
  const [loadTo, setLoadTo] = useState(initial(pd?.loadTo ?? aw?.loadWindowEnd, load.plannedLoadDate, '15:00'));
  const [delFrom, setDelFrom] = useState(initial(pd?.deliveryFrom ?? aw?.unloadWindowStart, load.plannedDeliverDate, '07:00'));
  const [delTo, setDelTo] = useState(initial(pd?.deliveryTo ?? aw?.unloadWindowEnd, load.plannedDeliverDate, '15:00'));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const locked = !kshCanEditDates(load);

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

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) return;
    const lf = wallLocalToIso(loadFrom, TZ_OPS);
    const lt = wallLocalToIso(loadTo, TZ_OPS);
    const df = wallLocalToIso(delFrom, TZ_OPS);
    const dt = wallLocalToIso(delTo, TZ_OPS);
    if (!lf || !lt || !df || !dt) { setErr(t(locale, 'b_ksh_dates_row')); return; }
    const ld = datePart(lf, load.plannedLoadDate);
    const dd = datePart(df, load.plannedDeliverDate);
    setBusy(true); setErr(null);
    try {
      if (import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED) {
        const { getSupabase } = await import('../../auth/client');
        const sb = await getSupabase();
        if (!sb) throw new Error('Supabase');
        const r = await sb.rpc('ksh_confirm_dates', {
          p_load: load.id, p_load_date: ld, p_delivery_date: dd,
          p_load_from: lf, p_load_to: lt, p_delivery_from: df, p_delivery_to: dt,
        });
        if (r.error) throw new Error(r.error.message);
        pushToast(t(locale, 'b_ksh_saved'), 'MEDIUM', load.id);
        const { refreshFromServer } = await import('../../data/supabaseBridge');
        await refreshFromServer({ keepSelection: true });
        onClose();
      } else {
        const ok = kshEditPlanDates(load.id, { loadDate: ld, deliveryDate: dd, loadFrom: lf, loadTo: lt, deliveryFrom: df, deliveryTo: dt });
        if (!ok) throw new Error(t(locale, 'b_ksh_dates_row'));
        onClose();
      }
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : String(ex));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button type="button" className="scrim" style={{ zIndex: 52 }} aria-label={t(locale, 'a6_dr_close')} onClick={onClose} />
      <section className="panel awiz-modal" role="dialog" aria-modal="true" aria-labelledby="ksh-dates-title" data-ksh-dates-modal>
        <header className="panel-hd">
          <h2 id="ksh-dates-title" style={{ fontSize: 18 }}>
            {t(locale, 'b_ksh_modal_title')} · {load.code}
          </h2>
          <div className="spacer" />
          <button type="button" className="iconbtn" aria-label={t(locale, 'close')} onClick={onClose}>✕</button>
        </header>
        <form className="panel-bd awiz-modal-bd" onSubmit={(e) => void save(e)}>
          {locked ? <div className="banner amber" data-ksh-locked style={{ marginBottom: 12 }}>{t(locale, 'b_ksh_locked')}</div> : null}
          {err ? <div className="note" style={{ color: 'var(--red)', marginBottom: 10 }} role="status">{err}</div> : null}
          <label className="form-field">
            <span>{t(locale, 'b_ksh_load_from')}</span>
            <input type="datetime-local" className="input" name="ksh_load_from" value={loadFrom} disabled={locked}
              onChange={(e) => setLoadFrom(e.target.value)} required />
          </label>
          <label className="form-field">
            <span>{t(locale, 'b_ksh_load_to')}</span>
            <input type="datetime-local" className="input" name="ksh_load_to" value={loadTo} min={loadFrom} disabled={locked}
              onChange={(e) => setLoadTo(e.target.value)} required />
          </label>
          <label className="form-field">
            <span>{t(locale, 'b_ksh_del_from')}</span>
            <input type="datetime-local" className="input" name="ksh_del_from" value={delFrom} min={loadFrom} disabled={locked}
              onChange={(e) => setDelFrom(e.target.value)} required />
          </label>
          <label className="form-field">
            <span>{t(locale, 'b_ksh_del_to')}</span>
            <input type="datetime-local" className="input" name="ksh_del_to" value={delTo} min={delFrom} disabled={locked}
              onChange={(e) => setDelTo(e.target.value)} required />
          </label>
          <div className="creator-actions">
            <button type="button" className="btn ghost" onClick={onClose}>{t(locale, 'a6_dr_close')}</button>
            <button type="submit" className="btn" data-ksh-dates-save disabled={busy || locked}>{t(locale, 'a6_dr_save')}</button>
          </div>
        </form>
      </section>
    </>
  );
}
