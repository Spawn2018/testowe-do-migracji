import { useCallback, useEffect, useState } from 'react';
import { getSupabase } from './client';
import { getAuthProfile } from './profile';
import { authErrorPl, ROLES_FOR_ORG, type UserRole } from './config';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import './auth.css';

interface Row { id: string; email: string | null; full_name: string | null; role: UserRole; active: boolean; org_id: string; auth_id: string }
interface Invite { id: string; email: string; role: UserRole; org_id: string; created_at: string; accepted_at: string | null }
interface Org { id: string; code: string }

/** BK2 — HHL_ADMIN: zapraszanie użytkowników i nadawanie ról (RLS/RPC z 0005). */
export default function UsersAdmin() {
  const me = getAuthProfile();
  const locale = useTowerStore((s) => s.locale);
  const [users, setUsers] = useState<Row[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [email, setEmail] = useState('');
  const [org, setOrg] = useState('KSH');
  const [role, setRole] = useState<UserRole>('CLIENT_USER');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    const [u, i, o] = await Promise.all([
      sb.from('app_users').select('id,email,full_name,role,active,org_id,auth_id').order('created_at'),
      sb.from('user_invites').select('id,email,role,org_id,created_at,accepted_at').is('accepted_at', null).order('created_at'),
      sb.from('organizations').select('id,code').order('code'),
    ]);
    setUsers((u.data ?? []) as Row[]);
    setInvites((i.data ?? []) as Invite[]);
    setOrgs(((o.data ?? []) as Org[]).filter((x) => x.code in ROLES_FOR_ORG));
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  if (me?.role !== 'HHL_ADMIN') return null;

  const orgCode = (id: string) => orgs.find((o) => o.id === id)?.code ?? '—';
  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setBusy(true); setMsg(null);
    const { error } = await fn();
    setBusy(false);
    setMsg(error ? { ok: false, text: authErrorPl(error.message) } : { ok: true, text: ok });
    await refresh();
    return !error;
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = await getSupabase();
    const addr = email.trim().toLowerCase();
    const done = await run(() => sb.rpc('admin_invite_user', { p_email: addr, p_org_code: org, p_role: role }), t(locale, 'a6_ua_saved'));
    if (!done) return;
    // Zaproszenie: e-mail z linkiem do ustawienia hasła (OTP/invite → strona „Dalej” → ustaw hasło).
    // Bez zaproszenia w bazie GoTrue i tak odrzuci przy pierwszym logowaniu (TOWER_NO_INVITE).
    const { error } = await sb.auth.signInWithOtp({
      email: addr,
      options: { shouldCreateUser: true, emailRedirectTo: window.location.origin + window.location.pathname },
    });
    setMsg(error
      ? { ok: false, text: t(locale, 'a6_ua_mail_fail').replace('{err}', authErrorPl(error.message)) }
      : { ok: true, text: t(locale, 'a6_ua_sent').replace('{addr}', addr) });
    setEmail('');
  };

  return (
    <section className="panel option-panel option-wide" data-auth="users-admin">
      <header className="panel-hd"><h2>{t(locale, 'a6_ua_h')}</h2><span className="sub">{t(locale, 'a6_ua_sub').replace('{u}', String(users.length)).replace('{i}', String(invites.length))}</span></header>
      <form className="auth-admin-form" onSubmit={invite}>
        <label>{t(locale, 'a6_ua_email')}<input className="input full" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>{t(locale, 'a6_ua_org')}<select className="input" value={org} onChange={(e) => { setOrg(e.target.value); setRole(ROLES_FOR_ORG[e.target.value][0]); }}>{Object.keys(ROLES_FOR_ORG).map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
        <label>{t(locale, 'a6_ua_role')}<select className="input" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>{ROLES_FOR_ORG[org].map((r) => <option key={r} value={r}>{t(locale, `a6_role_${r}`)}</option>)}</select></label>
        <button className="btn" type="submit" disabled={busy || !email.trim()}>{t(locale, 'a6_ua_invite')}</button>
      </form>
      {msg && <div className={`auth-msg ${msg.ok ? 'ok' : 'err'} auth-admin-row`} role="status">{msg.text}</div>}
      <div className="panel-bd flush">
        {users.map((u) => {
          const code = orgCode(u.org_id);
          const self = u.id === me.user_id;
          return (
            <div className={`auth-admin-row${u.active ? '' : ' inactive'}`} key={u.id}>
              <span className="grow"><b>{u.email}</b> <small>{code}</small></span>
              <select className="input" aria-label={t(locale, 'a6_ua_role_of').replace('{email}', u.email ?? '')} value={u.role} disabled={busy || self} onChange={(e) => void getSupabase().then((sb) => run(() => sb.rpc('admin_set_user_role', { p_user: u.id, p_role: e.target.value }), t(locale, 'a6_ua_role_changed')))}>
                {(ROLES_FOR_ORG[code] ?? [u.role]).map((r) => <option key={r} value={r}>{t(locale, `a6_role_${r}`)}</option>)}
              </select>
              <button className="chipbtn" type="button" disabled={busy || self} onClick={() => void getSupabase().then((sb) => run(() => sb.rpc('admin_set_user_active', { p_user: u.id, p_active: !u.active }), t(locale, u.active ? 'a6_ua_deact_done' : 'a6_ua_act_done')))}>{t(locale, u.active ? 'a6_ua_deact' : 'a6_ua_act')}</button>
              <button className="chipbtn" type="button" disabled={busy || self || !u.active} title={t(locale, 'a6_ua_lost')} onClick={() => void getSupabase().then((sb) => run(() => sb.rpc('revoke_user_sessions', { p_user: u.id }), t(locale, 'a6_ua_logged_out').replace('{email}', u.email ?? '')))}>{t(locale, 'a6_ua_logout_all')}</button>
            </div>
          );
        })}
        {invites.map((i) => (
          <div className="auth-admin-row" key={i.id}>
            <span className="grow">{i.email} <small>{orgCode(i.org_id)} · {t(locale, `a6_role_${i.role}`)} · {t(locale, 'a6_ua_pending')}</small></span>
            <button className="chipbtn" type="button" disabled={busy} onClick={() => void getSupabase().then((sb) => run(() => sb.rpc('admin_revoke_invite', { p_invite: i.id }), t(locale, 'a6_ua_revoked')))}>{t(locale, 'a6_ua_revoke')}</button>
          </div>
        ))}
      </div>
    </section>
  );
}
