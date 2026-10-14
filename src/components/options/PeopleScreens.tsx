/**
 * wyglad/P3-c — Ludzie i dostęp (E6 `img/e6-desk`, E37 `img/e37-after`: „Konta i zaproszenia”, „Zaproś osobę”),
 * Powiadomienia › Komunikat dla wszystkich (E37 „Opcje › Komunikat HHL”) i Dla mnie › Moje konto
 * (E37 menu konta: „imię, nazwisko, telefon, hasło, 2FA, urządzenia”; pola jak w kroku 3 „Twoje dane”).
 * Tylko wygląd. Dane i zapisy (konta, zaproszenia, komunikat, profil, 2FA, urządzenia) podłącza wykonawca.
 */
import { useState, type ReactNode } from 'react';
import type { Locale } from '../../types';
import { t, tp } from '../../i18n/messages';
import { up } from './up';
import { ACCOUNT_KINDS, type AccountKind } from './types';
import { IcoCall } from './icons';

const FIRM_OF: Record<AccountKind, 'HHL' | 'KSH' | 'SCX'> = {
  HHL_ADMIN: 'HHL', HHL_OPS: 'HHL', CLIENT_USER: 'KSH', CARRIER_DISPATCH: 'SCX', CARRIER_USER: 'SCX',
};
const FIRM_NAME: Record<'HHL' | 'KSH' | 'SCX', string> = { HHL: 'H&H Logistics', KSH: 'KSH', SCX: 'Scandinavian Express' };

/* ---------- Użytkownicy ---------- */

export type PersonRow = {
  id: string;
  name: string;
  /** skrócony adres: „a.wisniewska@…” */
  mail: string;
  kind: AccountKind;
  /** „+48 600 000 010”; null = brak */
  phone: string | null;
  /** „dziś, 08:12” */
  last: string | null;
  mfa: boolean;
};

export type InviteStatus = 'sent' | 'unfinished' | 'expired' | 'nophone' | 'active';
export type InviteRow = {
  id: string;
  name: string;
  kind: AccountKind;
  /** zdanie o stanie: „zaproszenie wysłane 09.10, 10:15 · ważne do 16.10 · e-mail doręczony” */
  line: string;
  status: InviteStatus;
};

const STATUS_KEY: Record<InviteStatus, string> = {
  sent: 'p3c_st_sent', unfinished: 'p3c_st_unfinished', expired: 'p3c_st_expired', nophone: 'p3c_st_nophone', active: 'p3c_st_active',
};
const STATUS_ACTIONS: Record<InviteStatus, string[]> = {
  sent: ['p3c_a_resend', 'p3c_a_revoke'],
  unfinished: ['p3c_a_pwlink'],
  expired: ['p3c_a_reinvite'],
  nophone: ['p3c_a_change'],
  active: [],
};

function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function UsersScreen({ locale, counts, people, invites, readOnly, mark, onInvite, onAction }: {
  locale: Locale;
  counts: { total: number; active: number; withPhone: number; named: number };
  people: PersonRow[];
  invites: InviteRow[];
  readOnly?: boolean;
  mark?: ReactNode;
  onInvite?: (v: { first: string; last: string; phone: string; mail: string; kind: AccountKind }) => void;
  onAction?: (id: string, action: string) => void;
}) {
  const firms = (['HHL', 'KSH', 'SCX'] as const).map((f) => ({ f, rows: people.filter((p) => FIRM_OF[p.kind] === f) })).filter((x) => x.rows.length);
  return (
    <div className="ox-users">
      <div className="ox-counters">
        <span className="ox-counter"><b>{counts.total}</b> {tp(locale, 'p3c_u_total', { n: counts.total }).replace(/^\S+\s/, '')}</span>
        <span className="ox-counter"><b>{counts.active}</b> {tp(locale, 'p3c_u_active', { n: counts.active }).replace(/^\S+\s/, '')}</span>
        <span className={`ox-counter${counts.withPhone === 0 ? ' is-alert' : ''}`}><b>{counts.withPhone}</b> {t(locale, 'p3c_u_phone')}</span>
        <span className="ox-counter"><b>{counts.named}</b> {t(locale, 'p3c_u_named')}</span>
        {mark}
      </div>

      <table className="ox-table ox-cards-phone ox-people" data-opt-table="people">
        <thead><tr><th>{up(t(locale, 'p3c_u_person'))}</th><th>{up(t(locale, 'p3c_u_kind'))}</th><th>{up(t(locale, 'p3c_u_tel'))}</th><th>{up(t(locale, 'p3c_u_last'))}</th><th>{up(t(locale, 'p3c_u_2fa'))}</th><th><span className="sronly">{t(locale, 'p3c_u_call').replace('{name}', '')}</span></th></tr></thead>
        {firms.map(({ f, rows }) => (
          <tbody key={f}>
            <tr className="ox-firm-row"><th colSpan={6} scope="colgroup">{up(FIRM_NAME[f])}</th></tr>
            {rows.map((p) => (
              <tr key={p.id} data-person={p.id}>
                <th scope="row" data-label={up(t(locale, 'p3c_u_person'))}><b data-content>{p.name}</b><span className="ox-sub" data-content>{p.mail}</span></th>
                <td data-label={up(t(locale, 'p3c_u_kind'))}>{t(locale, `p3c_kind_${p.kind}`)}</td>
                <td data-label={up(t(locale, 'p3c_u_tel'))} className="ox-nowrap">{p.phone ? <span data-content>{p.phone}</span> : <span className="ox-alert">{t(locale, 'p3c_u_no_phone')}</span>}</td>
                <td data-label={up(t(locale, 'p3c_u_last'))} data-content>{p.last ?? '—'}</td>
                <td data-label={up(t(locale, 'p3c_u_2fa'))} className={p.mfa ? 'ox-go' : undefined}>{t(locale, p.mfa ? 'p3c_yes' : 'p3c_no')}</td>
                <td className="ox-call-cell">{p.phone ? <a className="ox-callbtn" href={telHref(p.phone)} aria-label={t(locale, 'p3c_u_call').replace('{name}', p.name)}><IcoCall /></a> : null}</td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>

      <div className="ox-users-split">
        <section className="ox-panel">
          <header className="ox-panel-hd"><h3>{t(locale, 'p3c_u_list')}</h3></header>
          <ul className="ox-list ox-invites">
            {invites.map((iv) => (
              <li key={iv.id} data-invite={iv.status}>
                <span className="ox-tile-copy">
                  <b><span data-content>{iv.name}</span> <span className="ox-sub-inline">· {t(locale, `p3c_role_${iv.kind}`)}</span></b>
                  <span data-content>{iv.line}</span>
                </span>
                <span className="ox-invite-act">
                  <span className={`ox-tag ox-tag-${iv.status}`}>{up(t(locale, STATUS_KEY[iv.status]))}</span>
                  {readOnly ? null : STATUS_ACTIONS[iv.status].map((a) => (
                    <button key={a} type="button" className="btn ghost ox-btn" onClick={() => onAction?.(iv.id, a)}>{t(locale, a)}</button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <p className="ox-panel-note">{t(locale, 'p3c_u_list_sub')}</p>
        </section>
        {readOnly ? null : <InviteForm locale={locale} onInvite={onInvite} />}
      </div>
    </div>
  );
}

function InviteForm({ locale, onInvite }: { locale: Locale; onInvite?: (v: { first: string; last: string; phone: string; mail: string; kind: AccountKind }) => void }) {
  const [v, setV] = useState({ first: '', last: '', phone: '', mail: '', kind: 'CLIENT_USER' as AccountKind });
  return (
    <section className="ox-panel ox-invite" data-opt-invite>
      <header className="ox-panel-hd"><h3>{t(locale, 'p3c_inv_title')}</h3></header>
      <div className="ox-panel-bd">
        <div className="ox-grid2">
          <label className="ox-field"><span>{up(t(locale, 'p3c_inv_first'))}</span><input className="input" autoComplete="off" value={v.first} onChange={(e) => setV({ ...v, first: e.target.value })} /></label>
          <label className="ox-field"><span>{up(t(locale, 'p3c_inv_last'))}</span><input className="input" autoComplete="off" value={v.last} onChange={(e) => setV({ ...v, last: e.target.value })} /></label>
          <label className="ox-field"><span>{up(t(locale, 'p3c_inv_phone'))}</span><input className="input" inputMode="tel" placeholder="+48" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></label>
          <label className="ox-field"><span>{up(t(locale, 'p3c_inv_mail'))}</span><input className="input" type="email" autoComplete="off" value={v.mail} onChange={(e) => setV({ ...v, mail: e.target.value })} /></label>
        </div>
        <small className="ox-muted">{t(locale, 'p3c_inv_phone_fmt')}</small>
        <div className="ox-field">
          <span>{up(t(locale, 'p3c_inv_kind'))}</span>
          <div className="ox-seg ox-seg-wrap" role="radiogroup" aria-label={t(locale, 'p3c_inv_kind')}>
            {ACCOUNT_KINDS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={v.kind === k} onClick={() => setV({ ...v, kind: k })}>{t(locale, `p3c_role_${k}`).replace(' · ', ' ')}</button>
            ))}
          </div>
        </div>
        <p className="ox-note-box">{t(locale, 'p3c_inv_note')}</p>
        <div className="ox-actions">
          <button type="button" className="btn ghost ox-btn" onClick={() => setV({ first: '', last: '', phone: '', mail: '', kind: 'CLIENT_USER' })}>{t(locale, 'p3c_cancel')}</button>
          <button type="button" className="btn ox-btn" onClick={() => onInvite?.(v)}>{t(locale, 'p3c_inv_send')}</button>
        </div>
      </div>
    </section>
  );
}

/* ---------- Logowania ---------- */

export type LoginRow = { id: string; when: string; who: string; kind: AccountKind | null; ok: boolean; where: string };

export function LoginsScreen({ locale, rows, mark }: { locale: Locale; rows: LoginRow[]; mark?: ReactNode }) {
  return (
    <div className="ox-logins">
      {mark ? <div className="ox-count-line"><span />{mark}</div> : null}
      <table className="ox-table ox-cards-phone" data-opt-table="logins">
        <thead><tr><th>{up(t(locale, 'p3c_l_when'))}</th><th>{up(t(locale, 'p3c_l_who'))}</th><th>{up(t(locale, 'p3c_l_result'))}</th><th>{up(t(locale, 'p3c_l_where'))}</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <th scope="row" data-label={up(t(locale, 'p3c_l_when'))} className="ox-nowrap" data-content>{r.when}</th>
              <td data-label={up(t(locale, 'p3c_l_who'))}><b data-content>{r.who}</b>{r.kind ? <span className="ox-sub">{t(locale, `p3c_role_${r.kind}`)}</span> : null}</td>
              <td data-label={up(t(locale, 'p3c_l_result'))} className={r.ok ? 'ox-go' : 'ox-alert'}>{t(locale, r.ok ? 'p3c_l_ok' : 'p3c_l_fail')}</td>
              <td data-label={up(t(locale, 'p3c_l_where'))} data-content>{r.where}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- Komunikat dla wszystkich ---------- */

export type BroadcastHistoryRow = { id: string; when: string; who: string; text: string; line: string };

export function BroadcastScreen({ locale, draft, history, readOnly, mark, onPublish }: {
  locale: Locale;
  draft: { text: string; firms: Array<'HHL' | 'KSH' | 'SCX'>; until: string };
  history: BroadcastHistoryRow[];
  readOnly?: boolean;
  mark?: ReactNode;
  onPublish?: (v: { text: string; firms: Array<'HHL' | 'KSH' | 'SCX'>; until: string }) => void;
}) {
  const [v, setV] = useState(draft);
  const toggle = (f: 'HHL' | 'KSH' | 'SCX') => setV({ ...v, firms: v.firms.includes(f) ? v.firms.filter((x) => x !== f) : [...v.firms, f] });
  return (
    <div className="ox-bcast">
      <section className="ox-panel">
        <div className="ox-panel-bd">
          <label className="ox-field"><span>{up(t(locale, 'p3c_b_text'))}</span>
            <textarea className="input" maxLength={500} rows={3} value={v.text} readOnly={readOnly} onChange={(e) => setV({ ...v, text: e.target.value })} />
          </label>
          <div className="ox-count-line"><small className="ox-muted">{t(locale, 'p3c_b_chars').replace('{n}', String(v.text.length))}</small>{mark}</div>
          <div className="ox-grid2">
            <div className="ox-field">
              <span>{up(t(locale, 'p3c_b_for'))}</span>
              <div className="ox-seg" role="group" aria-label={t(locale, 'p3c_b_for')}>
                {(['HHL', 'KSH', 'SCX'] as const).map((f) => (
                  <button key={f} type="button" aria-pressed={v.firms.includes(f)} disabled={readOnly} onClick={() => toggle(f)}>{f}</button>
                ))}
              </div>
            </div>
            <label className="ox-field"><span>{up(t(locale, 'p3c_b_until'))}</span><input className="input" type="datetime-local" value={v.until} readOnly={readOnly} onChange={(e) => setV({ ...v, until: e.target.value })} /></label>
          </div>
          <div className="ox-field">
            <span>{up(t(locale, 'p3c_b_how'))}</span>
            <div className="ox-seg"><button type="button" aria-pressed="true" disabled>{t(locale, 'p3c_b_banner')}</button></div>
          </div>
          {readOnly ? null : (
            <div className="ox-actions">
              <button type="button" className="btn ghost ox-btn">{t(locale, 'p3c_b_preview')}</button>
              <button type="button" className="btn ox-btn" onClick={() => onPublish?.(v)}>{t(locale, 'p3c_b_publish')}</button>
            </div>
          )}
        </div>
        <header className="ox-panel-hd ox-panel-hd-mid"><h3>{t(locale, 'p3c_b_hist')}</h3></header>
        <ul className="ox-list">
          {history.map((h) => (
            <li key={h.id}>
              <span className="ox-tile-copy"><b data-content>{h.when} · {h.who}</b><span data-content>„{h.text}” · {h.line}</span></span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ---------- Moje konto ---------- */

export type MyDevice = { id: string; name: string; last: string; push: boolean; current: boolean };

export function AccountScreen({ locale, me, mfa, devices, mark, onSave, onPassword, onMfa, onRemoveDevice }: {
  locale: Locale;
  me: { first: string; last: string; phone: string; mail: string; kind: AccountKind; lastLogin: string | null };
  mfa: boolean;
  devices: MyDevice[];
  mark?: ReactNode;
  onSave?: (v: { first: string; last: string; phone: string }) => void;
  onPassword?: () => void;
  onMfa?: () => void;
  onRemoveDevice?: (id: string) => void;
}) {
  const [v, setV] = useState({ first: me.first, last: me.last, phone: me.phone });
  const initials = `${me.first.slice(0, 1)}${me.last.slice(0, 1)}`.toUpperCase();
  return (
    <div className="ox-account">
      <section className="ox-panel ox-me">
        <div className="ox-me-hd">
          <span className="ox-avatar" aria-hidden="true">{initials}</span>
          <span className="ox-tile-copy">
            <b data-content>{me.first} {me.last}</b>
            <span>{FIRM_NAME[FIRM_OF[me.kind]]} · {t(locale, `p3c_kind_${me.kind}`)}</span>
            {me.lastLogin ? <span data-content>{t(locale, 'p3c_m_last_login').replace('{when}', me.lastLogin)}</span> : null}
          </span>
          {mark}
        </div>
      </section>
      <section className="ox-panel" data-auth="my-account">
        <header className="ox-panel-hd"><h3>{t(locale, 'p3c_m_data')}</h3></header>
        <div className="ox-panel-bd">
          <div className="ox-grid2">
            <label className="ox-field"><span>{up(t(locale, 'p3c_m_first'))}</span><input className="input" value={v.first} onChange={(e) => setV({ ...v, first: e.target.value })} /></label>
            <label className="ox-field"><span>{up(t(locale, 'p3c_m_last'))}</span><input className="input" value={v.last} onChange={(e) => setV({ ...v, last: e.target.value })} /></label>
            <label className="ox-field"><span>{up(t(locale, 'p3c_m_phone'))}</span><input className={`input${v.phone.trim() ? '' : ' is-invalid'}`} inputMode="tel" placeholder="+48" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /><small className="ox-muted">{t(locale, 'p3c_m_phone_note')}</small></label>
            <label className="ox-field"><span>{up(t(locale, 'p3c_m_mail'))}</span><input className="input" value={me.mail} readOnly /><small className="ox-muted">{t(locale, 'p3c_m_mail_note')}</small></label>
          </div>
          <div className="ox-actions"><button type="button" className="btn ox-btn" onClick={() => onSave?.(v)}>{t(locale, 'p3c_m_save')}</button></div>
        </div>
      </section>
      <div className="ox-users-split">
        <section className="ox-panel">
          <header className="ox-panel-hd"><h3>{t(locale, 'p3c_m_pw')}</h3></header>
          <div className="ox-panel-bd">
            <p className="ox-panel-note ox-flush">{t(locale, 'p3c_m_pw_note')}</p>
            <div className="ox-actions ox-actions-start"><button type="button" className="btn ghost ox-btn" onClick={onPassword}>{t(locale, 'p3c_m_pw_change')}</button></div>
          </div>
        </section>
        <section className="ox-panel">
          <header className="ox-panel-hd"><h3>{t(locale, 'p3c_m_2fa')}</h3><span className={`ox-tag ${mfa ? 'ox-tag-active' : 'ox-tag-plain'}`}>{up(t(locale, mfa ? 'p3c_m_2fa_on' : 'p3c_m_2fa_off'))}</span></header>
          <div className="ox-panel-bd">
            <p className="ox-panel-note ox-flush">{t(locale, 'p3c_m_2fa_note')}</p>
            {mfa ? null : <div className="ox-actions ox-actions-start"><button type="button" className="btn ghost ox-btn" onClick={onMfa}>{t(locale, 'p3c_m_2fa_enable')}</button></div>}
          </div>
        </section>
      </div>
      <section className="ox-panel">
        <header className="ox-panel-hd"><h3>{t(locale, 'p3c_m_dev')}</h3></header>
        <ul className="ox-list">
          {devices.map((d) => (
            <li key={d.id}>
              <span className="ox-tile-copy">
                <b data-content>{d.name}{d.current ? ` · ${t(locale, 'p3c_m_dev_this')}` : ''}</b>
                <span>{[t(locale, 'p3c_m_dev_last').replace('{when}', d.last), d.push ? t(locale, 'p3c_m_dev_push') : null].filter(Boolean).join(' · ')}</span>
              </span>
              {d.current ? null : <button type="button" className="btn ghost ox-btn" onClick={() => onRemoveDevice?.(d.id)}>{t(locale, 'p3c_m_dev_remove')}</button>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
