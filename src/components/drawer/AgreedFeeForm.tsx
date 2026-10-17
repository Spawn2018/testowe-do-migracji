/** B-10 / OPL-8 — dopłaty uzgodnione z akceptacją (HHL↔KSH / SCX→HHL). */
import { useCallback, useEffect, useState } from 'react';
import { t } from '../../i18n/messages';
import type { Locale, RoleId } from '../../types';
import { formatPlMoney } from '../../lib/format';

type Hint = { code: string; label_pl: string; hint_text: string; amount_eur: number; unit: string };
type Dwell = {
  zone_kind: string;
  dwell_minutes: number | null;
  free_minutes: number | null;
  over_free_minutes: number | null;
};
type FeeRow = {
  id: string;
  kind: string;
  amount_eur: number;
  side: 'COST' | 'REVENUE' | 'BOTH';
  note: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  proposed_by_kind: string | null;
  created_at: string;
};

export function AgreedFeeForm({
  loadId,
  locale,
  role,
}: {
  loadId: string;
  locale: Locale;
  role: RoleId;
}) {
  const [kind, setKind] = useState<'POSTOJOWE' | 'ANULOWANIE' | 'INNE'>('POSTOJOWE');
  const [amount, setAmount] = useState('');
  const [side, setSide] = useState<'COST' | 'REVENUE' | 'BOTH'>('COST');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [hints, setHints] = useState<Hint[]>([]);
  const [dwell, setDwell] = useState<Dwell[]>([]);
  const [fees, setFees] = useState<FeeRow[]>([]);

  const canAdd = role === 'HHL' || role === 'SCX';
  const reload = useCallback(async () => {
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return;
    const { getSupabase } = await import('../../auth/client');
    const sb = await getSupabase();
    const [h, d, f] = await Promise.all([
      sb.rpc('fee_catalog_hints'),
      sb.rpc('load_dwell_info', { p_load: loadId }),
      sb.from('load_agreed_fees').select('id,kind,amount_eur,side,note,status,proposed_by_kind,created_at')
        .eq('load_id', loadId).is('voided_at', null).order('created_at', { ascending: false }),
    ]);
    if (!h.error && Array.isArray(h.data)) setHints(h.data as Hint[]);
    if (!d.error && Array.isArray(d.data)) setDwell(d.data as Dwell[]);
    if (!f.error && Array.isArray(f.data)) setFees(f.data as FeeRow[]);
  }, [loadId]);

  useEffect(() => {
    let cancelled = false;
    void reload().then(() => { if (cancelled) return; });
    return () => { cancelled = true; };
  }, [reload]);

  async function submit() {
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return;
    setBusy(true);
    setMsg(null);
    try {
      const eur = Number(amount.replace(',', '.'));
      const { getSupabase } = await import('../../auth/client');
      const sb = await getSupabase();
      const addSide = role === 'SCX' ? 'COST' : side;
      const { error } = await sb.rpc('load_agreed_fee_add', {
        p_load: loadId,
        p_kind: kind,
        p_amount_eur: eur,
        p_side: addSide,
        p_note: note,
      });
      if (error) setMsg(error.message);
      else {
        setMsg(t(locale, role === 'SCX' || (role === 'HHL' && addSide !== 'COST') ? 'opl8_pending' : 'opl8_saved'));
        setAmount('');
        setNote('');
        await reload();
      }
    } finally {
      setBusy(false);
    }
  }

  async function decide(feeId: string, accept: boolean) {
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return;
    setBusy(true);
    setMsg(null);
    try {
      const { getSupabase } = await import('../../auth/client');
      const sb = await getSupabase();
      const { error } = accept
        ? await sb.rpc('load_agreed_fee_accept', { p_fee: feeId })
        : await sb.rpc('load_agreed_fee_reject', { p_fee: feeId, p_reason: 'odrzucone' });
      if (error) setMsg(error.message);
      else {
        setMsg(t(locale, accept ? 'opl8_accepted' : 'opl8_rejected'));
        await reload();
      }
    } finally {
      setBusy(false);
    }
  }

  function canDecide(f: FeeRow): boolean {
    if (f.status !== 'PENDING') return false;
    if (role === 'KSH' && (f.side === 'REVENUE' || f.side === 'BOTH') && (f.proposed_by_kind ?? 'FORWARDER') === 'FORWARDER') return true;
    if (role === 'HHL' && f.side === 'COST' && f.proposed_by_kind === 'CARRIER') return true;
    return false;
  }

  const statusLabel = (s: FeeRow['status']) =>
    s === 'PENDING' ? t(locale, 'opl8_st_pending')
      : s === 'ACCEPTED' ? t(locale, 'opl8_st_accepted')
        : t(locale, 'opl8_st_rejected');

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

      {fees.length > 0 ? (
        <ul data-opl8-list style={{ listStyle: 'none', margin: '0 0 12px', padding: 0, fontSize: 12 }}>
          {fees.map((f) => (
            <li key={f.id} data-fee-status={f.status} style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <span>
                  <strong>{f.kind}</strong> · {formatPlMoney(Number(f.amount_eur), 'EUR')} · {f.side}
                  {' · '}
                  <span className={`pill ${f.status === 'PENDING' ? 'p-amber' : f.status === 'ACCEPTED' ? 'p-go' : 'p-red'}`}>
                    {statusLabel(f.status)}
                  </span>
                </span>
                {canDecide(f) ? (
                  <span style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="chipbtn" disabled={busy} onClick={() => void decide(f.id, true)}>
                      {t(locale, 'opl8_accept')}
                    </button>
                    <button type="button" className="btn ghost" disabled={busy} onClick={() => void decide(f.id, false)}>
                      {t(locale, 'opl8_reject')}
                    </button>
                  </span>
                ) : null}
              </div>
              <div style={{ color: 'var(--ink-3)', marginTop: 2 }}>{f.note}</div>
            </li>
          ))}
        </ul>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>{t(locale, 'opl8_empty')}</p>
      )}

      {canAdd ? (
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
          {role === 'HHL' ? (
            <label>
              <span className="lbl">{t(locale, 'opl8_side')}</span>
              <select className="input" value={side} onChange={(e) => setSide(e.target.value as typeof side)} disabled={busy}>
                <option value="COST">{t(locale, 'opl8_side_cost')}</option>
                <option value="REVENUE">{t(locale, 'opl8_side_rev')}</option>
                <option value="BOTH">{t(locale, 'opl8_side_both')}</option>
              </select>
            </label>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--ink-3)', margin: 0 }}>{t(locale, 'opl8_scx_only_cost')}</p>
          )}
          <label>
            <span className="lbl">{t(locale, 'opl8_note')}</span>
            <input className="input" value={note} onChange={(e) => setNote(e.target.value)} disabled={busy} maxLength={1000} />
          </label>
          <button className="chipbtn" type="button" disabled={busy || !amount || note.trim().length < 3} onClick={() => void submit()}>
            {t(locale, role === 'SCX' ? 'opl8_propose' : 'opl8_add')}
          </button>
          {msg ? <div className="note" style={{ fontSize: 12 }}>{msg}</div> : null}
        </div>
      ) : null}

      {hints.length > 0 && role === 'HHL' ? (
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
