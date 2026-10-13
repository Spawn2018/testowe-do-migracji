/**
 * DEC-4 — macierz powiadomień (grupa × firma × IN_APP/e-mail). Tylko HHL_ADMIN (RPC).
 */
import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import './auth.css';

type Row = { event_group: string; org_kind: string; in_app: boolean; email: boolean };

const GROUPS = ['LOAD_STATUS', 'RISK_FERRY_WEATHER', 'DECISION', 'MONEY', 'SYSTEM'] as const;
const KINDS = ['FORWARDER', 'CARRIER', 'CLIENT'] as const;

function locked(group: string, kind: string): boolean {
  return group === 'SYSTEM' && kind !== 'FORWARDER';
}

export default function NotificationMatrixForm() {
  const locale = useTowerStore((s) => s.locale);
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    const q = await sb.from('notification_matrix').select('event_group,org_kind,in_app,email').order('event_group');
    if (q.error) {
      setMsg(q.error.message);
      return;
    }
    setRows((q.data ?? []) as Row[]);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function cell(group: string, kind: string): Row | undefined {
    return rows.find((r) => r.event_group === group && r.org_kind === kind);
  }

  async function toggle(group: string, kind: string, field: 'in_app' | 'email') {
    if (locked(group, kind)) {
      setMsg(t(locale, 'dec_matrix_locked'));
      return;
    }
    const cur = cell(group, kind) ?? { event_group: group, org_kind: kind, in_app: false, email: false };
    const next = { ...cur, [field]: !cur[field] };
    setBusy(true);
    const sb = await getSupabase();
    const { error } = await sb.rpc('admin_notification_matrix_set', {
      p_event_group: group,
      p_org_kind: kind,
      p_in_app: next.in_app,
      p_email: next.email,
    });
    setBusy(false);
    if (error) {
      setMsg(error.message);
      return;
    }
    setMsg(null);
    await refresh();
  }

  return (
    <section className="panel option-panel option-wide" data-panel="notification-matrix">
      <header className="panel-hd">
        <h2>{t(locale, 'dec_matrix_title')}</h2>
        <span className="sub">{t(locale, 'dec_matrix_sub')}</span>
      </header>
      <div className="panel-bd">
        {msg ? <div className="note">{msg}</div> : null}
        <table style={{ width: '100%', fontSize: 13 }}>
          <thead>
            <tr>
              <th>{t(locale, 'dec_matrix_group')}</th>
              {KINDS.map((k) => (
                <th key={k}>{k === 'FORWARDER' ? 'HHL' : k === 'CARRIER' ? t(locale, 'dec_matrix_carrier') : 'KSH'}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {GROUPS.map((g) => (
              <tr key={g}>
                <td>{t(locale, `dec_matrix_${g}`)}</td>
                {KINDS.map((k) => {
                  const c = cell(g, k);
                  const lock = locked(g, k);
                  return (
                    <td key={k}>
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center', opacity: lock ? 0.45 : 1 }}>
                        <input
                          type="checkbox"
                          disabled={busy || lock}
                          checked={!!c?.in_app}
                          onChange={() => void toggle(g, k, 'in_app')}
                        />
                        app
                      </label>
                      <label style={{ display: 'flex', gap: 6, alignItems: 'center', opacity: lock ? 0.45 : 1 }}>
                        <input
                          type="checkbox"
                          disabled={busy || lock}
                          checked={!!c?.email}
                          onChange={() => void toggle(g, k, 'email')}
                        />
                        e-mail
                      </label>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="note option-note">{t(locale, 'dec_matrix_note')}</div>
        {/* G-18 / E11: dzwonek PLAN_DATES_CHANGED zawsze dla HHL Admin/Ops i SCX Dyspozytor/Użytkownik — w bazie (0199) */}
        <div className="note option-note">{t(locale, 'dec_matrix_plan_dates_locked')}</div>
      </div>
    </section>
  );
}
