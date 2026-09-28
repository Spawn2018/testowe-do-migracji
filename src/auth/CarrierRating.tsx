import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from './client';
import { authErrorPl } from './config';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import './auth.css';

/**
 * III-9 (SCOPE 10.6, 0089) — ocena przewoźnika za transport (szuflada, przegląd): tylko HHL, dopiero po rozładunku
 * (UNLOADED/DELIVERED — pilnuje baza). Zmiana nadpisuje ocenę, stara wartość w audit_log. Tylko build Supabase.
 */
export default function CarrierRating({ loadId }: { loadId: string }) {
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const [ready, setReady] = useState<boolean | null>(null);
  const [score, setScore] = useState('');
  const [comment, setComment] = useState('');
  const [saved, setSaved] = useState<{ score: number; comment: string | null; rated_at: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    const [l, r] = await Promise.all([
      sb.from('loads').select('status,carrier_org_id').eq('id', loadId).maybeSingle(),
      sb.from('carrier_ratings').select('score,comment,rated_at').eq('load_id', loadId).maybeSingle(),
    ]);
    const ld = l.data as { status?: string; carrier_org_id?: string | null } | null;
    setReady(!!ld?.carrier_org_id && (ld.status === 'UNLOADED' || ld.status === 'DELIVERED'));
    const rt = r.data as { score: number; comment: string | null; rated_at: string } | null;
    setSaved(rt);
    if (rt) { setScore(String(rt.score)); setComment(rt.comment ?? ''); }
  }, [loadId]);
  useEffect(() => { if (role === 'HHL') void refresh(); }, [refresh, role]);
  if (role !== 'HHL' || !ready) return null;
  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const sb = await getSupabase();
    const { error } = await sb.rpc('carrier_rate_load', { p_load: loadId, p_score: Number(score), p_comment: comment || null });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: authErrorPl(error.message) }); return; }
    setMsg({ ok: true, text: t(locale, 'iii9_saved') });
    await refresh();
  };
  return (
    <div data-carrier-rating={saved?.score ?? 'none'} style={{ marginTop: 18 }}>
      <h4 className="sec">{t(locale, 'iii9_rate_h')}</h4>
      <form className="baf-form" onSubmit={(e) => void save(e)} data-carrier-rating-form>
        <label>{t(locale, 'iii9_score')}<select className="input" name="score" required value={score} onChange={(e) => setScore(e.target.value)}>
          <option value="">—</option>{[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}</option>)}
        </select></label>
        <label className="wide">{t(locale, 'iii9_comment')}<input className="input" name="comment" maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} /></label>
        <label><button type="submit" className="btn" disabled={busy || !score} data-carrier-rating-save>{t(locale, 'iii9_rate_btn')}</button></label>
      </form>
      <div className="note" style={{ margin: '4px 0 0' }}>{t(locale, 'iii9_rate_note')}</div>
      {msg && <div className={`note ${msg.ok ? '' : 'err'}`} role="status" style={{ margin: '8px 0 0' }} data-carrier-rating-msg={msg.ok ? 'ok' : 'err'}>{msg.text}</div>}
    </div>
  );
}
