/**
 * I-18 (D-12) — daty planu: WSTĘPNA | POTWIERDZONA. Ostateczne daty podaje KSH („Potwierdź daty”, z możliwością zmiany)
 * do wjazdu na załadunek; HHL i przewoźnik widzą status, autora (KSH) i czas. Tylko build Supabase (RPC ksh_confirm_dates).
 */
import { useState } from 'react';
import { SUPABASE_AUTH_ENABLED } from '../../auth/config';
import { useTowerStore } from '../../store/useTowerStore';
import { t } from '../../i18n/messages';
import type { Load } from '../../types';

export function PlanDatesPanel({ load }: { load: Load }) {
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const [ld, setLd] = useState(load.plannedLoadDate);
  const [dd, setDd] = useState(load.plannedDeliverDate);
  const [busy, setBusy] = useState(false);
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
      const r = await sb.rpc('ksh_confirm_dates', {
        p_load: load.id,
        p_load_date: ld !== load.plannedLoadDate ? ld : null,
        p_delivery_date: dd !== load.plannedDeliverDate ? dd : null,
      });
      if (r.error) throw new Error(r.error.message);
      setNote({ ok: true, text: t(locale, (r.data as { changed?: boolean })?.changed ? 'i18_saved_changed' : 'i18_saved') });
      const { refreshFromServer } = await import('../../data/supabaseBridge');
      await refreshFromServer({ keepSelection: true });
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : String(err) });
    } finally { setBusy(false); }
  };
  return (
    <div data-plan-dates={pd.status}>
      <h4 className="sec" style={{ marginTop: 18 }}>{t(locale, 'i18_h')}</h4>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span className={`pill ${confirmed ? 'p-go' : ''}`} data-plan-dates-status>{t(locale, confirmed ? 'i18_confirmed' : 'i18_provisional')}</span>
        {confirmed && pd.confirmedAt
          ? <small data-plan-dates-by>{t(locale, 'i18_by_ksh').replace('{at}', new Date(pd.confirmedAt).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }))}</small>
          : <small>{t(locale, 'i18_waiting')}</small>}
      </div>
      {canConfirm && (
        <form onSubmit={(e) => void submit(e)} data-plan-dates-form style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8, alignItems: 'flex-end' }}>
          <label style={{ fontSize: 12 }}>{t(locale, 'i18_load')}<br />
            <input type="date" className="input" name="ld" value={ld} onChange={(e) => setLd(e.target.value)} required /></label>
          <label style={{ fontSize: 12 }}>{t(locale, 'i18_delivery')}<br />
            <input type="date" className="input" name="dd" value={dd} min={ld} onChange={(e) => setDd(e.target.value)} required /></label>
          <button type="submit" className="btn" disabled={busy} data-plan-dates-confirm>{t(locale, 'i18_confirm_btn')}</button>
        </form>
      )}
      {role === 'SCX' && <div className="note" style={{ margin: '8px 0 0' }}>{t(locale, 'i18_carrier_note')}</div>}
      {note && <div className={`note ${note.ok ? '' : 'err'}`} role="status" style={{ margin: '8px 0 0' }}>{note.text}</div>}
    </div>
  );
}
