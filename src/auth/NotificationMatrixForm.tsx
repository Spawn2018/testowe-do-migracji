/**
 * C3 / E11 — macierz powiadomień (zdarzenie × 5 ról × dzwonek / e-mail / telefon). Tylko HHL_ADMIN (RPC).
 */
import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import './auth.css';

type MatrixRole = 'HHL_ADMIN' | 'HHL_OPS' | 'CLIENT_USER' | 'CARRIER_DISPATCH' | 'CARRIER_USER';
type Row = {
  event_key: string;
  event_group: string;
  label_pl: string | null;
  role: MatrixRole;
  in_app: boolean;
  email: boolean;
  push: boolean;
  risks_only: boolean;
};
type MatrixField = 'in_app' | 'email' | 'push';

const ROLES: MatrixRole[] = ['HHL_ADMIN', 'HHL_OPS', 'CARRIER_DISPATCH', 'CARRIER_USER', 'CLIENT_USER'];

function locked(row: Row | undefined, role: MatrixRole): boolean {
  if (!row) return true;
  if (row.risks_only) return true;
  return row.event_group === 'SYSTEM' && role !== 'HHL_ADMIN' && role !== 'HHL_OPS';
}

function roleLabel(_locale: 'pl' | 'en' | 'sv', role: MatrixRole): string {
  return t('pl', `a6_role_${role}`); /* 8A (17.10), audyt N20 */
}

export default function NotificationMatrixForm() {
  const locale = useTowerStore((s) => s.locale);
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    const q = await sb.from('notification_matrix').select('event_key,event_group,label_pl,role,in_app,email,push,risks_only').order('event_key');
    if (q.error) {
      setMsg(q.error.message);
      return;
    }
    setRows((q.data ?? []) as Row[]);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  function cell(eventKey: string, role: MatrixRole): Row | undefined {
    return rows.find((r) => r.event_key === eventKey && r.role === role);
  }

  const eventKeys = [...new Set(rows.map((r) => r.event_key))];

  async function toggle(eventKey: string, role: MatrixRole, field: MatrixField) {
    const cur = cell(eventKey, role);
    if (locked(cur, role) || !cur) {
      setMsg(t(locale, 'dec_matrix_locked'));
      return;
    }
    const next = { ...cur, [field]: !cur[field] };
    setBusy(true);
    const sb = await getSupabase();
    const { error } = await sb.rpc('admin_notification_matrix_set', {
      p_event_group: eventKey,
      p_role: role,
      p_in_app: next.in_app,
      p_email: next.email,
      p_push: next.push,
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
              {eventKeys.map((g) => (
                <tr key={g}>
                  <td>{cell(g, 'HHL_ADMIN')?.label_pl ?? g}</td>
                  {ROLES.map((role) => {
                    const c = cell(g, role);
                    const lock = locked(c, role);
                    return (
                      <td key={role}>
                        <label className="switchline" style={{ opacity: lock ? 0.45 : 1 }}>
                          <input
                            type="checkbox"
                            disabled={busy || lock}
                            checked={!!c?.in_app}
                            onChange={() => void toggle(g, role, 'in_app')}
                          />
                          <span>{t(locale, 'dec_matrix_ch_app')}</span>
                        </label>
                        <label className="switchline" style={{ opacity: lock ? 0.45 : 1 }}>
                          <input
                            type="checkbox"
                            disabled={busy || lock}
                            checked={!!c?.email}
                            onChange={() => void toggle(g, role, 'email')}
                          />
                          <span>{t(locale, 'dec_matrix_ch_email')}</span>
                        </label>
                        <label className="switchline" style={{ opacity: lock ? 0.45 : 1 }}>
                          <input
                            type="checkbox"
                            disabled={busy || lock}
                            checked={!!c?.push}
                            onChange={() => void toggle(g, role, 'push')}
                          />
                          <span>{t(locale, 'dec_matrix_ch_push')}</span>
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
