/**
 * I-18 (D-12) + B-KSH — daty i godziny planu: WSTĘPNA | POTWIERDZONA.
 * KSH potwierdza / zmienia daty i okna załadunku oraz rozładunku (RPC ksh_confirm_dates).
 */
import { useState } from 'react';
import { SUPABASE_AUTH_ENABLED } from '../../auth/config';
import { useTowerStore } from '../../store/useTowerStore';
import { t } from '../../i18n/messages';
import { isoToDatetimeLocalValue, wallLocalToIso, TZ_OPS } from '../../lib/time';
import type { Load } from '../../types';

function datePart(iso: string | null | undefined, fallback: string): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ_OPS, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function PlanDatesPanel({ load }: { load: Load }) {
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const [ld, setLd] = useState(load.plannedLoadDate);
  const [dd, setDd] = useState(load.plannedDeliverDate);
  const [loadFrom, setLoadFrom] = useState(
    load.awizacja?.loadWindowStart
      ? isoToDatetimeLocalValue(load.awizacja.loadWindowStart, TZ_OPS)
      : `${load.plannedLoadDate}T07:00`,
  );
  const [loadTo, setLoadTo] = useState(
    load.awizacja?.loadWindowEnd
      ? isoToDatetimeLocalValue(load.awizacja.loadWindowEnd, TZ_OPS)
      : `${load.plannedLoadDate}T15:00`,
  );
  const [delFrom, setDelFrom] = useState(
    load.awizacja?.unloadWindowStart
      ? isoToDatetimeLocalValue(load.awizacja.unloadWindowStart, TZ_OPS)
      : `${load.plannedDeliverDate}T07:00`,
  );
  const [delTo, setDelTo] = useState(
    load.awizacja?.unloadWindowEnd
      ? isoToDatetimeLocalValue(load.awizacja.unloadWindowEnd, TZ_OPS)
      : `${load.plannedDeliverDate}T15:00`,
  );
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const pd = load.planDates;
  if (!pd) return null;
  const confirmed = pd.status === 'POTWIERDZONA';
  const canConfirm = role === 'KSH' && pd.preLoading;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!(import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED)) return;
    setBusy(true); setNote(null);
    try {
      const { getSupabase } = await import('../../auth/client');
      const sb = await getSupabase();
      const lf = wallLocalToIso(loadFrom, TZ_OPS);
      const lt = wallLocalToIso(loadTo, TZ_OPS);
      const df = wallLocalToIso(delFrom, TZ_OPS);
      const dt = wallLocalToIso(delTo, TZ_OPS);
      const r = await sb.rpc('ksh_confirm_dates', {
        p_load: load.id,
        p_load_date: ld !== load.plannedLoadDate ? ld : null,
        p_delivery_date: dd !== load.plannedDeliverDate ? dd : null,
        p_load_from: lf,
        p_load_to: lt,
        p_delivery_from: df,
        p_delivery_to: dt,
      });
      if (r.error) throw new Error(r.error.message);
      setNote({ ok: true, text: t(locale, (r.data as { changed?: boolean })?.changed ? 'i18_saved_changed' : 'i18_saved') });
      setEditing(false);
      const { refreshFromServer } = await import('../../data/supabaseBridge');
      await refreshFromServer({ keepSelection: true });
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally { setBusy(false); }
  };

  return (
    <div data-plan-dates={pd.status} data-b-ksh>
      <h4 className="sec" style={{ marginTop: 18 }}>{t(locale, 'i18_h')}</h4>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className={`pill ${confirmed ? 'p-go' : ''}`} data-plan-dates-status>{t(locale, confirmed ? 'i18_confirmed' : 'i18_provisional')}</span>
        {confirmed && pd.confirmedAt
          ? <small data-plan-dates-by>{t(locale, 'i18_by_ksh').replace('{at}', new Date(pd.confirmedAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }))}</small>
          : <small>{t(locale, 'i18_waiting')}</small>}
      </div>
      {canConfirm && !editing ? (
        <button type="button" className="btn" style={{ marginTop: 10 }} data-ksh-edit onClick={() => setEditing(true)}>
          {t(locale, 'b_ksh_edit')}
        </button>
      ) : null}
      {canConfirm && editing ? (
        <form onSubmit={(e) => void submit(e)} data-plan-dates-form style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <label style={{ fontSize: 12 }}>{t(locale, 'i18_load')}<br />
              <input type="date" className="input" name="ld" value={ld} onChange={(e) => setLd(e.target.value)} required /></label>
            <label style={{ fontSize: 12 }}>{t(locale, 'i18_delivery')}<br />
              <input type="date" className="input" name="dd" value={dd} min={ld} onChange={(e) => setDd(e.target.value)} required /></label>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <label style={{ fontSize: 12 }}>{t(locale, 'b_ksh_load_from')}<br />
              <input type="datetime-local" className="input" value={loadFrom} onChange={(e) => { setLoadFrom(e.target.value); setLd(datePart(wallLocalToIso(e.target.value, TZ_OPS), ld)); }} required /></label>
            <label style={{ fontSize: 12 }}>{t(locale, 'b_ksh_load_to')}<br />
              <input type="datetime-local" className="input" value={loadTo} onChange={(e) => setLoadTo(e.target.value)} required /></label>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <label style={{ fontSize: 12 }}>{t(locale, 'b_ksh_del_from')}<br />
              <input type="datetime-local" className="input" value={delFrom} onChange={(e) => { setDelFrom(e.target.value); setDd(datePart(wallLocalToIso(e.target.value, TZ_OPS), dd)); }} required /></label>
            <label style={{ fontSize: 12 }}>{t(locale, 'b_ksh_del_to')}<br />
              <input type="datetime-local" className="input" value={delTo} onChange={(e) => setDelTo(e.target.value)} required /></label>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn ghost" onClick={() => setEditing(false)}>{t(locale, 'a6_dr_close')}</button>
            <button type="submit" className="btn" disabled={busy} data-plan-dates-confirm>{t(locale, 'i18_confirm_btn')}</button>
          </div>
        </form>
      ) : null}
      {role === 'SCX' && <div className="note" style={{ margin: '8px 0 0' }}>{t(locale, 'i18_carrier_note')}</div>}
      {note && <div className={`note ${note.ok ? '' : 'err'}`} role="status" style={{ margin: '8px 0 0' }}>{note.text}</div>}
    </div>
  );
}
