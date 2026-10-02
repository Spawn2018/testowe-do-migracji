/** OPL-8 — ręczna dopłata uzgodniona (HHL). Podpowiedzi cennika ≠ automat. */
import { useEffect, useState } from 'react';
import { t } from '../../i18n/messages';
import type { Locale } from '../../types';

type Hint = { code: string; label_pl: string; hint_text: string; amount_eur: number; unit: string };
type Dwell = {
  zone_kind: string;
  dwell_minutes: number | null;
  free_minutes: number | null;
  over_free_minutes: number | null;
};

export function AgreedFeeForm({ loadId, locale }: { loadId: string; locale: Locale }) {
  const [kind, setKind] = useState<'POSTOJOWE' | 'ANULOWANIE' | 'INNE'>('POSTOJOWE');
  const [amount, setAmount] = useState('');
  const [side, setSide] = useState<'COST' | 'REVENUE' | 'BOTH'>('COST');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [hints, setHints] = useState<Hint[]>([]);
  const [dwell, setDwell] = useState<Dwell[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return;
    void (async () => {
      const { getSupabase } = await import('../../auth/client');
      const sb = await getSupabase();
      const [h, d] = await Promise.all([
        sb.rpc('fee_catalog_hints'),
        sb.rpc('load_dwell_info', { p_load: loadId }),
      ]);
      if (cancelled) return;
      if (!h.error && Array.isArray(h.data)) setHints(h.data as Hint[]);
      if (!d.error && Array.isArray(d.data)) setDwell(d.data as Dwell[]);
    })();
    return () => { cancelled = true; };
  }, [loadId]);

  async function submit() {
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return;
    setBusy(true);
    setMsg(null);
    try {
      const eur = Number(amount.replace(',', '.'));
      const { getSupabase } = await import('../../auth/client');
      const sb = await getSupabase();
      const { error } = await sb.rpc('load_agreed_fee_add', {
        p_load: loadId,
        p_kind: kind,
        p_amount_eur: eur,
        p_side: side,
        p_note: note,
      });
      if (error) setMsg(error.message);
      else {
        setMsg(t(locale, 'opl8_saved'));
        setAmount('');
        setNote('');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div data-opl8-fee style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--line)' }}>
      <h4 className="sec">{t(locale, 'opl8_title')}</h4>
      <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: '0 0 10px' }}>{t(locale, 'opl8_manual_only')}</p>
      {dwell.some((x) => x.over_free_minutes != null && Number(x.over_free_minutes) > 0) ? (
        <div className="note" style={{ marginBottom: 10, fontSize: 12 }}>
          {t(locale, 'opl8_dwell_info')}:{' '}
          {dwell
            .filter((x) => x.over_free_minutes != null && Number(x.over_free_minutes) > 0)
            .map((x) => `${x.zone_kind} +${x.over_free_minutes} min`)
            .join(' · ')}
        </div>
      ) : null}
      <div style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
        <label>
          <span className="lbl">{t(locale, 'opl8_kind')}</span>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} disabled={busy}>
            <option value="POSTOJOWE">{t(locale, 'opl8_kind_dwell')}</option>
            <option value="ANULOWANIE">{t(locale, 'opl8_kind_cancel')}</option>
            <option value="INNE">{t(locale, 'opl8_kind_other')}</option>
          </select>
        </label>
        <label>
          <span className="lbl">{t(locale, 'opl8_amount')}</span>
          <input className="input mono" type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={busy} placeholder="75.00" />
        </label>
        <label>
          <span className="lbl">{t(locale, 'opl8_side')}</span>
          <select className="input" value={side} onChange={(e) => setSide(e.target.value as typeof side)} disabled={busy}>
            <option value="COST">{t(locale, 'opl8_side_cost')}</option>
            <option value="REVENUE">{t(locale, 'opl8_side_rev')}</option>
            <option value="BOTH">{t(locale, 'opl8_side_both')}</option>
          </select>
        </label>
        <label>
          <span className="lbl">{t(locale, 'opl8_note')}</span>
          <input className="input" value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} maxLength={1000} />
        </label>
        <button className="chipbtn" type="button" disabled={busy || !amount || note.trim().length < 3} onClick={() => void submit()}>
          {t(locale, 'opl8_add')}
        </button>
        {msg ? <div className="note" style={{ fontSize: 12 }}>{msg}</div> : null}
      </div>
      {hints.length > 0 ? (
        <details style={{ marginTop: 12, fontSize: 12, color: 'var(--ink-3)' }}>
          <summary>{t(locale, 'opl8_hints')}</summary>
          <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
            {hints.map((h) => (
              <li key={h.code}>{h.label_pl}: {h.hint_text}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
