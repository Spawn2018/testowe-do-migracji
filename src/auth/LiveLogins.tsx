/**
 * Opcje › Ludzie i dostęp › Logowania — produkcja w wyglądzie z audytu (E37). Ekran = `LoginsScreen` (ten sam co w demo).
 * Dane jak w dawnym `AuthLoginLog`: `admin_auth_login_log(50)` (tabela `auth_login_events`), osoba i rodzaj konta z `app_users`,
 * urządzenie z nagłówka przeglądarki (`uaLabel`), adres IP, „Odśwież”. Tylko Administrator HHL.
 */
import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from './client';
import { useTowerStore } from '../store/useTowerStore';
import { t, tp } from '../i18n/messages';
import { formatListDateTime } from '../lib/format';
import { uaLabel } from '../lib/userAgent';
import { LoginsScreen, type LoginRow } from '../components/options/PeopleScreens';
import { kindOf, personName, type PersonDb } from './liveOpts';

const LIMIT = 50;

type Row = { created_at: string; ip_address: string | null; action: string; actor: string; log_type: string; email: string; user_agent?: string | null };

/** Wynik jak w dawnym dzienniku: SESSION / LAST_SIGN_IN = udane; „fail/error/unauthor” = nieudane. */
export function loginOk(r: Pick<Row, 'action' | 'log_type'>): boolean {
  if (r.log_type === 'SESSION' || r.log_type === 'LAST_SIGN_IN') return true;
  return !/fail|error|unauthor/i.test(`${r.action} ${r.log_type}`);
}

export function loginRows(rows: readonly Row[], people: readonly PersonDb[], lastSignIn: string): LoginRow[] {
  const by = new Map(people.filter((p) => p.email).map((p) => [p.email!.toLowerCase(), p]));
  return rows.map((r, i) => {
    const p = by.get((r.email || r.actor || '').toLowerCase());
    const where = [uaLabel(r.user_agent ?? null), r.ip_address ?? '', r.log_type === 'LAST_SIGN_IN' ? lastSignIn : ''].filter(Boolean).join(' · ');
    return {
      id: `${r.created_at}-${i}`,
      when: formatListDateTime(r.created_at),
      who: p ? personName(p) : (r.email || r.actor || '—'),
      kind: p ? kindOf(p.role) : null,
      ok: loginOk(r),
      where: where || '—',
    };
  });
}

export default function LiveLogins() {
  const locale = useTowerStore((s) => s.locale);
  const [rows, setRows] = useState<Row[]>([]);
  const [people, setPeople] = useState<PersonDb[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setBusy(true);
    const sb = await getSupabase();
    const [l, u] = await Promise.all([
      sb.rpc('admin_auth_login_log', { p_limit: LIMIT }),
      sb.from('app_users').select('id,email,full_name,first_name,last_name,phone,role,active,org_id'),
    ]);
    setBusy(false);
    if (l.error) { setMsg(l.error.message); setRows([]); return; }
    setMsg(null);
    setRows((l.data ?? []) as Row[]);
    setPeople((u.data ?? []) as PersonDb[]);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  return (
    <div data-panel="auth-login-log" data-live="logins">
      {msg ? <div className="note ox-alert" role="status">{msg}</div> : null}
      <LoginsScreen
        locale={locale}
        rows={loginRows(rows, people, t(locale, 'b6_authlog_last_sign_in'))}
        onRefresh={() => void refresh()}
        busy={busy}
        note={`${tp(locale, 'p3l_login_note', { n: LIMIT })} ${t(locale, 'b6_authlog_note')}`}
      />
    </div>
  );
}
