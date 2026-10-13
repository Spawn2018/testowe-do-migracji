import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { getSupabase } from './client';
import { getAuthProfile } from './profile';
import { authErrorPl, ROLES_FOR_ORG, type UserRole } from './config';
import { sendInviteMagicLink } from './sendAuthEmail';
import { isE164 } from '../lib/phoneNational';
import { useTowerStore } from '../store/useTowerStore';
import { t } from '../i18n/messages';
import './auth.css';

interface Row {
  id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  role: UserRole;
  active: boolean;
  org_id: string;
  auth_id: string;
}
interface Invite { id: string; email: string; role: UserRole; org_id: string; created_at: string; accepted_at: string | null; first_name: string | null; last_name: string | null; phone: string | null }
interface Org { id: string; code: string }

/** BK2 / E6 — HHL_ADMIN: zapraszanie (imię, nazwisko, telefon) i nadawanie ról. */
export default function UsersAdmin() {
  const me = getAuthProfile();
  const locale = useTowerStore((s) => s.locale);
  const [users, setUsers] = useState<Row[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [org, setOrg] = useState('KSH');
  const [role, setRole] = useState<UserRole>('CLIENT_USER');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    const [u, i, o] = await Promise.all([
      sb.from('app_users').select('id,email,full_name,first_name,last_name,phone,role,active,org_id,auth_id').order('created_at'),
      sb.from('user_invites').select('id,email,role,org_id,created_at,accepted_at,first_name,last_name,phone').is('accepted_at', null).order('created_at'),
      sb.from('organizations').select('id,code').order('code'),
    ]);
    setUsers((u.data ?? []) as Row[]);
    setInvites((i.data ?? []) as Invite[]);
    setOrgs(((o.data ?? []) as Org[]).filter((x) => x.code in ROLES_FOR_ORG));
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  if (me?.role !== 'HHL_ADMIN') return null;

  const orgCode = (id: string) => orgs.find((o) => o.id === id)?.code ?? '—';
  const displayName = (u: { full_name: string | null; first_name: string | null; last_name: string | null; email: string | null }) =>
    (u.full_name ?? [u.first_name, u.last_name].filter(Boolean).join(' ').trim()) || u.email || '—';
  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string) => {
    setBusy(true); setMsg(null);
    const { error } = await fn();
    setBusy(false);
    setMsg(error ? { ok: false, text: authErrorPl(error.message) } : { ok: true, text: ok });
    await refresh();
    return !error;
  };

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    const fn = firstName.trim();
    const ln = lastName.trim();
    const ph = phone.trim();
    if (!fn || !ln) {
      setMsg({ ok: false, text: t(locale, 'a6_ua_name_required') });
      return;
    }
    if (!isE164(ph)) {
      setMsg({ ok: false, text: t(locale, 'a6_ua_phone_e164') });
      return;
    }
    const sb = await getSupabase();
    const addr = email.trim().toLowerCase();
    const done = await run(
      () => sb.rpc('admin_invite_user', {
        p_email: addr,
        p_org_code: org,
        p_role: role,
        p_first_name: fn,
        p_last_name: ln,
        p_phone: ph,
      }),
      t(locale, 'a6_ua_saved'),
    );
    if (!done) return;
    const mail = await sendInviteMagicLink(addr, window.location.origin + window.location.pathname);
    setMsg(mail.error
      ? { ok: false, text: t(locale, 'a6_ua_mail_fail').replace('{err}', authErrorPl(mail.error)) }
      : { ok: true, text: t(locale, 'a6_ua_sent').replace('{addr}', addr) });
    setEmail('');
    setFirstName('');
    setLastName('');
    setPhone('');
  };

  return (
    <section className="panel option-panel option-wide" data-auth="users-admin">
      <header className="panel-hd"><h2>{t(locale, 'a6_ua_h')}</h2><span className="sub">{t(locale, 'a6_ua_sub').replace('{u}', String(users.length)).replace('{i}', String(invites.length))}</span></header>
      <form className="auth-form" onSubmit={(e) => void invite(e)}>
        <label>{t(locale, 'a6_ua_email')}<input className="input full" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label>{t(locale, 'a6_ua_first')}<input className="input full" required value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" /></label>
        <label>{t(locale, 'a6_ua_last')}<input className="input full" required value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" /></label>
        <label>{t(locale, 'a6_ua_phone')}<input className="input full" required value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="+48…" /></label>
        <label>{t(locale, 'a6_ua_org')}<select className="input" value={org} onChange={(e) => { setOrg(e.target.value); setRole(ROLES_FOR_ORG[e.target.value][0]); }}>{Object.keys(ROLES_FOR_ORG).map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
        <label>{t(locale, 'a6_ua_role')}<select className="input" value={role} onChange={(e) => setRole(e.target.value as UserRole)}>{ROLES_FOR_ORG[org].map((r) => <option key={r} value={r}>{t(locale, `a6_role_${r}`)}</option>)}</select></label>
        <button className="btn" type="submit" disabled={busy || !email.trim()}>{t(locale, 'a6_ua_invite')}</button>
      </form>
      {msg && <div className={`auth-msg ${msg.ok ? 'ok' : 'err'} auth-admin-row`} role="status">{msg.text}</div>}
      <div className="panel-bd flush">
        {users.map((u) => {
          const code = orgCode(u.org_id);
          const self = u.id === me.user_id;
          const noPhone = !u.phone || !isE164(u.phone);
          return (
            <div className={`auth-admin-row${u.active ? '' : ' inactive'}`} key={u.id}>
              <span className="grow">
                <b>{displayName(u)}</b>
                {' '}
                <small>{u.email} · {code}</small>
                {noPhone ? <small className="auth-msg err"> · {t(locale, 'a6_ua_phone_missing')}</small> : null}
              </span>
              {u.phone && isE164(u.phone) ? (
                <a className="chipbtn" href={`tel:${u.phone}`} title={u.phone}>{t(locale, 'a6_ua_call')}</a>
              ) : null}
              <select
                className="input"
                aria-label={t(locale, 'a6_ua_role_of').replace('{email}', u.email ?? '')}
                value={u.role}
                disabled={busy || self}
                onChange={(e) => {
                  /* E14: wartość od razu z onChange — po await React przywraca kontrolowaną starą rolę */
                  const next = e.target.value as UserRole;
                  void getSupabase().then((sb) =>
                    run(() => sb.rpc('admin_set_user_role', { p_user: u.id, p_role: next }), t(locale, 'a6_ua_role_changed')),
                  );
                }}
              >
                {Array.from(new Set([...(ROLES_FOR_ORG[code] ?? []), u.role])).map((r) => (
                  <option key={r} value={r}>{t(locale, `a6_role_${r}`)}</option>
                ))}
              </select>
              <button className="chipbtn" type="button" disabled={busy || self} onClick={() => void getSupabase().then((sb) => run(() => sb.rpc('admin_set_user_active', { p_user: u.id, p_active: !u.active }), t(locale, u.active ? 'a6_ua_deact_done' : 'a6_ua_act_done')))}>{t(locale, u.active ? 'a6_ua_deact' : 'a6_ua_act')}</button>
              <button className="chipbtn" type="button" disabled={busy || self || !u.active} title={t(locale, 'a6_ua_lost')} onClick={() => void getSupabase().then((sb) => run(() => sb.rpc('revoke_user_sessions', { p_user: u.id }), t(locale, 'a6_ua_logged_out').replace('{email}', u.email ?? '')))}>{t(locale, 'a6_ua_logout_all')}</button>
              <button
                className="chipbtn"
                type="button"
                disabled={busy || self || !u.active}
                onClick={() => void getSupabase().then(async (sb) => {
                  const ok = await run(() => sb.rpc('admin_impersonate_start', { p_user: u.id }), t(locale, 'a6_ua_act_as_done').replace('{email}', u.email ?? ''));
                  if (ok) {
                    const { requestAuthReload } = await import('./profile');
                    requestAuthReload();
                  }
                })}
              >{t(locale, 'a6_ua_act_as')}</button>
            </div>
          );
        })}
        {invites.map((i) => (
          <div className="auth-admin-row" key={i.id}>
            <span className="grow">{[i.first_name, i.last_name].filter(Boolean).join(' ') || i.email} <small>{i.email} · {orgCode(i.org_id)} · {t(locale, `a6_role_${i.role}`)} · {t(locale, 'a6_ua_pending')}</small></span>
            <button className="chipbtn" type="button" disabled={busy} onClick={() => void getSupabase().then((sb) => run(() => sb.rpc('admin_revoke_invite', { p_invite: i.id }), t(locale, 'a6_ua_revoked')))}>{t(locale, 'a6_ua_revoke')}</button>
          </div>
        ))}
      </div>
    </section>
  );
}
