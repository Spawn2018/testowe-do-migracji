/**
 * Opcje › Ludzie i dostęp › Użytkownicy — produkcja w wyglądzie z audytu (E6 `img/e6-desk`, E37 „Zaproś osobę”, „Konta i zaproszenia”).
 * Ekran = `UsersScreen` (ten sam co w demo), dane z `app_users`, `user_invites`, `organizations` i dziennika logowań
 * (`admin_auth_login_log` — ostatnie logowanie osoby). Zapisy jak w dawnym `UsersAdmin`: `admin_invite_user` + e-mail z linkiem,
 * `admin_set_user_role`, `admin_set_user_active`, `revoke_user_sessions`, `admin_impersonate_start`, `admin_revoke_invite`.
 * Tylko Administrator HHL (E12-1A: Operacje nie widzą Użytkowników).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getSupabase } from './client';
import { getAuthProfile } from './profile';
import { authErrorPl, ROLES_FOR_ORG } from './config';
import { sendInviteMagicLink } from './sendAuthEmail';
import { isE164 } from '../lib/phoneNational';
import { groupPhone } from '../lib/phoneDisplay';
import { formatListDateTime } from '../lib/format';
import { useTowerStore } from '../store/useTowerStore';
import { t, tp } from '../i18n/messages';
import { UsersScreen, type InviteRow, type PersonAction, type PersonRow } from '../components/options/PeopleScreens';
import { ACCOUNT_KINDS, type AccountKind } from '../components/options/types';
import { announceOptionsChanged, kindOf, personName, type PersonDb } from './liveOpts';

type InviteDb = { id: string; email: string; role: string; org_id: string; created_at: string; first_name: string | null; last_name: string | null; full_name: string | null };
type OrgDb = { id: string; code: string };
type LoginDb = { created_at: string; email: string | null; log_type: string; action: string };

const ORG_OF: Record<AccountKind, 'HHL' | 'KSH' | 'SCX'> = {
  HHL_ADMIN: 'HHL', HHL_OPS: 'HHL', CLIENT_USER: 'KSH', CARRIER_DISPATCH: 'SCX', CARRIER_USER: 'SCX',
};

/** Ostatnie udane logowanie każdego adresu (dziennik jest od najnowszych). */
export function lastLoginByEmail(rows: readonly LoginDb[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const r of rows) {
    const e = (r.email ?? '').toLowerCase();
    if (!e || /fail|error|unauthor/i.test(`${r.action} ${r.log_type}`)) continue;
    const cur = m.get(e);
    if (!cur || cur < r.created_at) m.set(e, r.created_at);
  }
  return m;
}

/** Liczniki nad tabelą (E6): wszystkie konta, aktywne, z telefonem E.164, z imieniem i nazwiskiem, bez hasła. */
export function userCounts(users: readonly PersonDb[]) {
  return {
    total: users.length,
    active: users.filter((u) => u.active).length,
    withPhone: users.filter((u) => !!u.phone && isE164(u.phone)).length,
    named: users.filter((u) => !!u.first_name?.trim() && !!u.last_name?.trim()).length,
    noPassword: users.filter((u) => u.must_set_password === true).length,
  };
}

export default function LiveUsers() {
  const me = getAuthProfile();
  const locale = useTowerStore((s) => s.locale);
  const [users, setUsers] = useState<PersonDb[] | null>(null);
  const [invites, setInvites] = useState<InviteDb[]>([]);
  const [orgs, setOrgs] = useState<OrgDb[]>([]);
  const [logins, setLogins] = useState<Map<string, string>>(new Map());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState(0);

  const refresh = useCallback(async () => {
    const sb = await getSupabase();
    const [u, i, o, l] = await Promise.all([
      sb.from('app_users').select('id,email,full_name,first_name,last_name,phone,role,active,org_id,must_set_password').order('created_at'),
      sb.from('user_invites').select('id,email,role,org_id,created_at,first_name,last_name,full_name').is('accepted_at', null).order('created_at'),
      sb.from('organizations').select('id,code').order('code'),
      sb.rpc('admin_auth_login_log', { p_limit: 200 }),
    ]);
    if (u.error) setMsg({ ok: false, text: authErrorPl(u.error.message) });
    setUsers((u.data ?? []) as PersonDb[]);
    setInvites((i.data ?? []) as InviteDb[]);
    setOrgs(((o.data ?? []) as OrgDb[]).filter((x) => x.code in ROLES_FOR_ORG));
    setLogins(lastLoginByEmail((l.error ? [] : l.data ?? []) as LoginDb[]));
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const orgCode = useCallback((id: string) => orgs.find((x) => x.id === id)?.code ?? '', [orgs]);
  const byId = useMemo(() => new Map((users ?? []).map((u) => [u.id, u])), [users]);

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>, ok: string): Promise<boolean> => {
    setMsg(null);
    const { error } = await fn();
    setMsg(error ? { ok: false, text: authErrorPl(error.message) } : { ok: true, text: ok });
    await refresh();
    if (!error) announceOptionsChanged();
    return !error;
  };

  if (me?.role !== 'HHL_ADMIN') return null;
  if (!users) return <div className="note" role="status">{msg?.text ?? t(locale, 'p3l_loading')}</div>;

  const people: PersonRow[] = users.map((u) => {
    const last = u.email ? logins.get(u.email.toLowerCase()) : undefined;
    return {
      id: u.id,
      name: personName(u),
      mail: u.email ?? '—',
      kind: kindOf(u.role),
      phone: u.phone && isE164(u.phone) ? groupPhone(u.phone) : null,
      last: last ? formatListDateTime(last) : null,
      /* 2FA innych kont: baza nie podaje (auth.mfa_factors) — „—” zamiast zgadywania */
      mfa: null,
      active: u.active,
      self: u.id === me.user_id,
    };
  });
  const inviteRows: InviteRow[] = invites.map((i) => ({
    id: i.id,
    name: (i.full_name?.trim() || [i.first_name, i.last_name].filter(Boolean).join(' ').trim()) || i.email,
    kind: kindOf(i.role),
    line: tp(locale, 'p3l_inv_line', { at: formatListDateTime(i.created_at), mail: i.email }),
    status: 'sent',
  }));

  const sendMail = async (addr: string) => {
    const mail = await sendInviteMagicLink(addr, window.location.origin + window.location.pathname);
    setMsg(mail.error
      ? { ok: false, text: t(locale, 'a6_ua_mail_fail').replace('{err}', authErrorPl(mail.error)) }
      : { ok: true, text: t(locale, 'a6_ua_sent').replace('{addr}', addr) });
  };

  const onInvite = (v: { first: string; last: string; phone: string; mail: string; kind: AccountKind }) => {
    const first = v.first.trim();
    const last = v.last.trim();
    const phone = v.phone.trim();
    const addr = v.mail.trim().toLowerCase();
    if (!first || !last) { setMsg({ ok: false, text: t(locale, 'a6_ua_name_required') }); return; }
    if (!isE164(phone)) { setMsg({ ok: false, text: t(locale, 'a6_ua_phone_e164') }); return; }
    if (!addr) { setMsg({ ok: false, text: t(locale, 'p3l_inv_mail') }); return; }
    void getSupabase().then(async (sb) => {
      const done = await run(() => sb.rpc('admin_invite_user', {
        p_email: addr, p_org_code: ORG_OF[v.kind], p_role: v.kind, p_first_name: first, p_last_name: last, p_phone: phone,
      }), t(locale, 'a6_ua_saved'));
      if (!done) return;
      await sendMail(addr);
      setForm((n) => n + 1);
    });
  };

  const onAction = (id: string, action: string) => {
    const inv = invites.find((i) => i.id === id);
    if (!inv) return;
    if (action === 'p3c_a_revoke') {
      void getSupabase().then((sb) => run(() => sb.rpc('admin_revoke_invite', { p_invite: id }), t(locale, 'a6_ua_revoked')));
    } else if (action === 'p3c_a_resend') {
      void sendMail(inv.email);
    }
  };

  const onPerson = (id: string, action: PersonAction, kind?: AccountKind) => {
    const u = byId.get(id);
    if (!u || u.id === me.user_id) return;
    void getSupabase().then(async (sb) => {
      if (action === 'kind' && kind) await run(() => sb.rpc('admin_set_user_role', { p_user: id, p_role: kind }), t(locale, 'a6_ua_role_changed'));
      if (action === 'activate' || action === 'deactivate') {
        await run(() => sb.rpc('admin_set_user_active', { p_user: id, p_active: action === 'activate' }), t(locale, action === 'activate' ? 'a6_ua_act_done' : 'a6_ua_deact_done'));
      }
      if (action === 'logout') await run(() => sb.rpc('revoke_user_sessions', { p_user: id }), t(locale, 'a6_ua_logged_out').replace('{email}', u.email ?? ''));
      if (action === 'actas') {
        const ok = await run(() => sb.rpc('admin_impersonate_start', { p_user: id }), t(locale, 'a6_ua_act_as_done').replace('{email}', u.email ?? ''));
        if (ok) {
          const { requestAuthReload } = await import('./profile');
          requestAuthReload();
        }
      }
    });
  };

  /* przy osobie tylko rodzaje kont jej firmy (jak dawny formularz: ROLES_FOR_ORG) */
  const kindsFor = (p: PersonRow): readonly AccountKind[] => {
    const code = orgCode(byId.get(p.id)?.org_id ?? '');
    const list = (ROLES_FOR_ORG[code] ?? []).filter((r): r is AccountKind => (ACCOUNT_KINDS as readonly string[]).includes(r));
    return list.length ? list : [p.kind];
  };

  return (
    <div data-panel="users-admin" data-live="users">
      {msg ? <div className={`note${msg.ok ? '' : ' ox-alert'}`} role="status">{msg.text}</div> : null}
      <UsersScreen
        key={form}
        locale={locale}
        counts={userCounts(users)}
        people={people}
        invites={inviteRows}
        onInvite={onInvite}
        onAction={onAction}
        onPerson={onPerson}
        kindsFor={kindsFor}
      />
      {inviteRows.length ? null : <p className="ox-empty">{t(locale, 'p3l_inv_none')}</p>}
    </div>
  );
}
