/**
 * E11 / DEC-4 — macierz powiadomień (grupa × 5 ról × IN_APP/e-mail). Tylko HHL_ADMIN (RPC).
 */
import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import './auth.css';

type MatrixRole = 'HHL_ADMIN' | 'HHL_OPS' | 'CLIENT_USER' | 'CARRIER_DISPATCH' | 'CARRIER_USER';
type Row = { event_group: string; role: MatrixRole; in_app: boolean; email: boolean };

const GROUPS = ['LOAD_STATUS', 'RISK_FERRY_WEATHER', 'DECISION', 'MONEY', 'SYSTEM'] as const;
const ROLES: MatrixRole[] = ['HHL_ADMIN', 'HHL_OPS', 'CARRIER_DISPATCH', 'CARRIER_USER', 'CLIENT_USER'];

function locked(group: string, role: MatrixRole): boolean {
  return group === 'SYSTEM' && role !== 'HHL_ADMIN' && role !== 'HHL_OPS';
}

function roleLabel(locale: 'pl' | 'en' | 'sv', role: MatrixRole): string {
  return t(locale, `a6_role_${role}`);
}

export default function NotificationMatrixForm() {
  const locale = useTowerStore((s) => s.locale);
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    const q = await sb.from('notification_matrix').select('event_group,role,in_app,email').order('event_group');
    if (q.error) {
      setMsg(q.error.message);
      return;
    }
    setRows((q.data ?? []) as Row[]);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function cell(group: string, role: MatrixRole): Row | undefined {
    return rows.find((r) => r.event_group === group && r.role === role);
  }

  async function toggle(group: string, role: MatrixRole, field: 'in_app' | 'email') {
    if (locked(group, role)) {
      setMsg(t(locale, 'dec_matrix_locked'));
      return;
    }
    const cur = cell(group, role) ?? { event_group: group, role, in_app: false, email: false };
    const next = { ...cur, [field]: !cur[field] };
    setBusy(true);
    const sb = await getSupabase();
    const { error } = await sb.rpc('admin_notification_matrix_set', {
      p_event_group: group,
      p_role: role,
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
        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>{t(locale, 'dec_matrix_group')}</th>
                {ROLES.map((r) => (
                  <th key={r}>{roleLabel(locale, r)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {GROUPS.map((g) => (
                <tr key={g}>
                  <td>{t(locale, `dec_matrix_${g}`)}</td>
                  {ROLES.map((role) => {
                    const c = cell(g, role);
                    const lock = locked(g, role);
                    return (
                      <td key={role}>
                        <label className="switchline" style={{ opacity: lock ? 0.45 : 1 }}>
                          <input
                            type="checkbox"
                            disabled={busy || lock}
                            checked={!!c?.in_app}
                            onChange={() => void toggle(g, role, 'in_app')}
                          />
                          <span>app</span>
                        </label>
                        <label className="switchline" style={{ opacity: lock ? 0.45 : 1 }}>
                          <input
                            type="checkbox"
                            disabled={busy || lock}
                            checked={!!c?.email}
                            onChange={() => void toggle(g, role, 'email')}
                          />
                          <span>e-mail</span>
                        </label>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="note option-note">{t(locale, 'dec_matrix_note')}</div>
        <div className="note option-note">{t(locale, 'dec_matrix_plan_dates_locked')}</div>
      </div>
    </section>
  );
}
