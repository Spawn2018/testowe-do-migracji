/**
 * DEC-2 — centrum decyzji: lista otwartych + okno rozstrzygnięcia (opcje z decision_types).
 * Zapis wyłącznie przez RPC (decision_resolve / assign / snooze).
 */
import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '../auth/client';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import { decText } from '../i18n/decisions';
import { getAuthProfile } from '../auth/profile';
import { mayResolveDecision } from '../lib/decisionAccess';

type Opt = { code: string; label_key: string; requires_comment: boolean; effect: string };
type DecRow = {
  id: string;
  type_code: string;
  status: string;
  title: string;
  due_at: string | null;
  escalated_at: string | null;
  load_id: string | null;
  decision_types: { title_key: string; options: Opt[]; decider_role: string } | null;
};

export function DecisionCentre() {
  const locale = useTowerStore((s) => s.locale);
  const selectLoad = useTowerStore((s) => s.selectLoad);
  const setDrawerTab = useTowerStore((s) => s.setDrawerTab);
  const [rows, setRows] = useState<DecRow[]>([]);
  const [active, setActive] = useState<DecRow | null>(null);
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    const q = await sb
      .from('decisions')
      .select('id,type_code,status,title,due_at,escalated_at,load_id,decision_types(title_key,options,decider_role)')
      .in('status', ['NEW', 'ASSIGNED', 'SNOOZED'])
      .order('due_at', { ascending: true, nullsFirst: false })
      .limit(50);
    if (q.error) {
      setMsg(q.error.message);
      return;
    }
    setRows((q.data ?? []) as unknown as DecRow[]);
    setMsg(null);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function resolve(opt: Opt) {
    if (!active) return;
    if (opt.requires_comment && note.trim().length < 3) {
      setMsg(t(locale, 'dec_need_comment'));
      return;
    }
    setBusy(true);
    const loadId = active.load_id;
    const sb = await getSupabase();
    const { data, error } = await sb.rpc('decision_resolve', {
      p_decision: active.id,
      p_option: opt.code,
      p_note: note.trim() || null,
    });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    const hint = (data as { ui_hint?: string } | null)?.ui_hint;
    if (loadId && hint) {
      selectLoad(loadId);
      if (hint === 'OPEN_AWIZACJA' || hint === 'PICK_SAILING') setDrawerTab('overview');
      else if (hint === 'OPEN_DOC') setDrawerTab('docs');
      else if (hint === 'ADD_FEE') setDrawerTab('pricing');
    }
    setActive(null);
    setNote('');
    await refresh();
  }

  async function snoozeHours(h: number) {
    if (!active) return;
    setBusy(true);
    const until = new Date(Date.now() + h * 3600_000).toISOString();
    const sb = await getSupabase();
    const { error } = await sb.rpc('decision_snooze', { p_decision: active.id, p_until: until });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setActive(null);
    await refresh();
  }

  const mayResolve = mayResolveDecision(active?.decision_types?.decider_role, getAuthProfile()?.role);

  return (
    <div className="panel section-card" style={{ margin: 12 }} data-panel="decisions">
      <header className="panel-hd">
        <h2>{t(locale, 'dec_centre')}</h2>
        <span className="sub">{rows.length}</span>
      </header>
      {msg ? <div className="note" style={{ margin: 8 }}>{msg}</div> : null}
      <ul className="exq">
        {rows.map((r) => (
          <li
            key={r.id}
            data-sev={r.escalated_at ? 'CRITICAL' : 'HIGH'}
            onClick={() => setActive(r)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setActive(r);
              }
            }}
            tabIndex={0}
          >
            <span className="gut" />
            <span className="txt">
              <span className="t">{r.title}</span>
              <span className="m">
                {r.type_code}
                {r.due_at ? ` · ${new Date(r.due_at).toLocaleString()}` : ''}
                {r.escalated_at ? ` · ${t(locale, 'dec_escalated')}` : ''}
              </span>
            </span>
          </li>
        ))}
      </ul>
      {rows.length === 0 ? <div className="note" style={{ margin: 8 }}>{t(locale, 'dec_empty')}</div> : null}

      {active ? (
        <div className="panel-bd" style={{ borderTop: '1px solid var(--line)', padding: 12 }}>
          <h3 style={{ marginTop: 0 }}>{active.title}</h3>
          <p className="sub">{active.type_code} · {active.status}</p>
          {active.load_id ? (
            <button type="button" className="btn" onClick={() => selectLoad(active.load_id!)}>
              {t(locale, 'dec_open_load')}
            </button>
          ) : null}
          {mayResolve ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
              {(active.decision_types?.options ?? []).map((o) => (
                <button
                  key={o.code}
                  type="button"
                  className="btn primary"
                  disabled={busy}
                  onClick={() => void resolve(o)}
                >
                  {decText(locale, o.label_key, o.code)}
                  {o.requires_comment ? ' *' : ''}
                </button>
              ))}
            </div>
          ) : (
            <p className="note">{t(locale, 'dec_wrong_firm')}</p>
          )}
          {mayResolve ? (
            <label style={{ display: 'block', marginTop: 12 }}>
              {t(locale, 'dec_comment')}
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} style={{ width: '100%' }} />
            </label>
          ) : null}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {mayResolve ? (
              <button type="button" className="btn" disabled={busy} onClick={() => void snoozeHours(2)}>
                {t(locale, 'dec_snooze_2h')}
              </button>
            ) : null}
            <button type="button" className="btn" onClick={() => setActive(null)}>
              {t(locale, 'dec_close')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
