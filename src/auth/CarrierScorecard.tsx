import { useEffect, useState } from 'react';
import { getSupabase } from './client';
import { authErrorPl } from './config';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import './auth.css';

/**
 * III-9 (SCOPE 10.6, 0089) — karta przewoźników dla HHL (Opcje): transporty zrealizowane, na czas (do końca okna/dnia
 * dostawy), z winy przewoźnika, średnie spóźnienie, średnia ocena HHL. Dane z carrier_scorecard (tylko HHL — baza
 * odmawia innym). Ocena wewnętrzna HHL (D-23). Tylko build Supabase (chunk leniwy).
 */
type Row = { carrier_org_id: string; carrier_name: string; delivered: number; on_time: number; late_carrier: number; avg_late_min: number | null; avg_score: number | null; ratings: number };

export default function CarrierScorecard() {
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  useEffect(() => {
    if (role !== 'HHL') return;
    let cancelled = false;
    void (async () => {
      const sb = await getSupabase();
      const r = await sb.rpc('carrier_scorecard', { p_from: from || null, p_to: to || null });
      if (cancelled) return;
      if (r.error) { setErr(authErrorPl(r.error.message)); setRows([]); } else { setErr(null); setRows((r.data ?? []) as Row[]); }
    })();
    return () => { cancelled = true; };
  }, [role, from, to]);
  if (role !== 'HHL' || rows === null) return null;
  const pct = (a: number, b: number) => (b > 0 ? `${Math.round((100 * a) / b)}%` : '—');
  return (
    <section className="panel option-panel" data-carrier-scorecard={rows.length}>
      <header className="panel-hd"><h2>{t(locale, 'iii9_h')}</h2><span className="sub">{t(locale, 'iii9_sub')}</span></header>
      <div className="panel-bd">
        <form className="baf-form" onSubmit={(e) => e.preventDefault()}>
          <label>{t(locale, 'iii9_from')}<input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} data-scorecard-from /></label>
          <label>{t(locale, 'iii9_to')}<input type="date" className="input" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
        </form>
        {err && <div className="auth-msg err" role="status">{err}</div>}
        {rows.length === 0 ? <div className="note option-note" data-scorecard-empty>{t(locale, 'iii9_empty')}</div> : (
          <table className="rate-table">
            <thead><tr>
              <th>{t(locale, 'iii9_carrier')}</th><th>{t(locale, 'iii9_delivered')}</th><th>{t(locale, 'iii9_on_time')}</th>
              <th>{t(locale, 'iii9_late_carrier')}</th><th>{t(locale, 'iii9_avg_late')}</th><th>{t(locale, 'iii9_score')}</th>
            </tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.carrier_org_id} data-scorecard-row={r.carrier_name}>
                  <td>{r.carrier_name}</td>
                  <td className="mono">{r.delivered}</td>
                  <td className="mono" data-scorecard-ontime>{r.on_time} ({pct(r.on_time, r.delivered)})</td>
                  <td className="mono">{r.late_carrier}</td>
                  <td className="mono">{r.avg_late_min == null ? '—' : `${r.avg_late_min} min`}</td>
                  <td className="mono" data-scorecard-score>{r.avg_score == null ? '—' : `${Number(r.avg_score).toFixed(2).replace('.', locale === 'en' ? '.' : ',')} / 5 (${r.ratings})`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="note option-note">{t(locale, 'iii9_note')}</div>
      </div>
    </section>
  );
}
