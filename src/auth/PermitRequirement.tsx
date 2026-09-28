import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from './client';
import { authErrorPl } from './config';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import './auth.css';

/**
 * I-27 (0084) — przełącznik „brak zezwolenia blokuje Gotowy” dla transportów klasy innej niż STANDARD.
 * Stan widzi HHL; zmienia wyłącznie HHL_ADMIN (audit_log). Domyślnie wyłączony — włączyć przed pierwszym
 * prawdziwym transportem (PLAN D-21). Tylko build Supabase (chunk leniwy).
 */
export default function PermitRequirement() {
  const locale = useTowerStore((s) => s.locale);
  const role = useTowerStore((s) => s.role);
  const [on, setOn] = useState<boolean | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    const r = await sb.rpc('permit_requirement_state');
    setOn(typeof r.data === 'boolean' ? r.data : null);
  }, []);
  useEffect(() => { if (role === 'HHL') void refresh(); }, [refresh, role]);
  if (role !== 'HHL' || on === null) return null;
  const toggle = async () => {
    setBusy(true); setMsg(null);
    const sb = await getSupabase();
    const { error } = await sb.rpc('admin_set_permit_requirement', { p_enabled: !on });
    setBusy(false);
    setMsg(error ? { ok: false, text: authErrorPl(error.message) } : { ok: true, text: t(locale, !on ? 'i27_on_done' : 'i27_off_done') });
    if (!error) await refresh();
  };
  return (
    <section className="panel option-panel" data-permit-requirement={on ? 'on' : 'off'}>
      <header className="panel-hd"><h2>{t(locale, 'i27_h')}</h2>
        <span className={`pill ${on ? 'p-go' : 'p-amber'}`}>{t(locale, on ? 'i27_state_on' : 'i27_state_off')}</span>
      </header>
      {msg && <div className={`auth-msg ${msg.ok ? 'ok' : 'err'} auth-admin-row`} role="status">{msg.text}</div>}
      <div className="panel-bd">
        <div className="note option-note">{t(locale, 'i27_note')}</div>
        <button className="btn" type="button" disabled={busy} data-action="permit-requirement" onClick={() => void toggle()}>
          {t(locale, on ? 'i27_turn_off' : 'i27_turn_on')}
        </button>
      </div>
    </section>
  );
}
