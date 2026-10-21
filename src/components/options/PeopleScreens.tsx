/**
 * wyglad/P3-c — Ludzie i dostęp (E6 `img/e6-desk`, E37 `img/e37-after`: „Konta i zaproszenia”, „Zaproś osobę”),
 * Powiadomienia › Komunikat dla wszystkich (E37 „Opcje › Komunikat HHL”) i Dla mnie › Moje konto
 * (E37 menu konta: „imię, nazwisko, telefon, hasło, 2FA, urządzenia”; pola jak w kroku 3 „Twoje dane”).
 * Tylko wygląd. Dane i zapisy (konta, zaproszenia, komunikat, profil, 2FA, urządzenia) podłącza wykonawca.
 */
import { useState, type ReactNode } from 'react';
import type { Locale } from '../../types';
import { t, tp } from '../../i18n/messages';
import { m2 } from '../../i18n/mfa2';
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
  /** null = stan nieznany (produkcja: baza nie podaje 2FA innych kont) — „—”. */
  mfa: boolean | null;
  /** false = konto wyłączone (szare, „Włącz”). */
  active?: boolean;
  /** konto osoby, która ogląda (bez „Wyłącz”, „Działaj jako”). */
  self?: boolean;
};

/** Działania przy osobie (E14 zmiana rodzaju, E37 „Działaj jako”, dzisiejsze UsersAdmin). */
export type PersonAction = 'kind' | 'activate' | 'deactivate' | 'logout' | 'actas';

export type InviteStatus = 'sent' | 'unfinished' | 'expired' | 'nophone' | 'active';
export type InviteRow = {
  id: string;
  name: string;
  kind: AccountKind;
  /** domena adresu konta bez imienia (obraz E37: „Dyspozytor SCX · @…”) — wtedy zamiast rodzaju konta */
  domain?: string;
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

export function UsersScreen({ locale, counts, people, invites, readOnly, mark, onInvite, onAction, onPerson, kindsFor, busy }: {
  locale: Locale;
  /** `noPassword` — konta bez ustawionego hasła (podtytuł „Konta i zaproszenia”, obraz E37) */
  counts: { total: number; active: number; withPhone: number; named: number; noPassword?: number };
  people: PersonRow[];
  invites: InviteRow[];
  readOnly?: boolean;
  mark?: ReactNode;
  onInvite?: (v: { first: string; last: string; phone: string; mail: string; kind: AccountKind }) => void;
  onAction?: (id: string, action: string) => void;
  onPerson?: (id: string, action: PersonAction, kind?: AccountKind) => void;
  /** Rodzaje kont do wyboru przy osobie (produkcja: tylko rodzaje firmy tej osoby). Domyślnie wszystkie 5. */
  kindsFor?: (p: PersonRow) => readonly AccountKind[];
  /** Operacja w toku (produkcja): przyciski zmian wyłączone — bez podwójnego zaproszenia czy zapisu. */
  busy?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
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
        <thead><tr><th>{t(locale, 'p3c_u_person')}</th><th>{t(locale, 'p3c_u_kind')}</th><th>{t(locale, 'p3c_u_tel')}</th><th>{t(locale, 'p3c_u_last')}</th><th>{t(locale, 'p3c_u_2fa')}</th><th><span className="sronly">{t(locale, 'p3c_u_call').replace(/:?\s*\{name\}/, '')}</span></th></tr></thead>
        {firms.map(({ f, rows }) => (
          <tbody key={f}>
            <tr className="ox-firm-row"><th colSpan={6} scope="colgroup">{FIRM_NAME[f]}</th></tr>
            {rows.flatMap((p) => [
              <tr key={p.id} data-person={p.id} className={p.active === false ? 'is-off' : undefined}>
                <th scope="row" data-label={t(locale, 'p3c_u_person')}><b data-content>{p.name}</b><span className="ox-sub" data-content>{p.mail}</span></th>
                <td data-label={t(locale, 'p3c_u_kind')}>{t(locale, `p3c_kind_${p.kind}`)}</td>
                <td data-label={t(locale, 'p3c_u_tel')} className="ox-nowrap">{p.phone ? <span data-content>{p.phone}</span> : <span className="ox-alert">{t(locale, 'p3c_u_no_phone')}</span>}</td>
                <td data-label={t(locale, 'p3c_u_last')} data-content>{p.last ?? '—'}</td>
                <td data-label={t(locale, 'p3c_u_2fa')} className={p.mfa ? 'ox-go' : undefined}>{p.mfa == null ? '—' : t(locale, p.mfa ? 'p3c_yes' : 'p3c_no')}</td>
                <td className="ox-call-cell">
                  <span className="ox-row-act">
                    {p.phone ? <a className="ox-callbtn" href={telHref(p.phone)} aria-label={t(locale, 'p3c_u_call').replace('{name}', p.name)}><IcoCall /></a> : null}
                    {readOnly ? null : (
                      <button type="button" className="ox-morebtn" aria-expanded={open === p.id} aria-label={t(locale, 'p3c_u_more').replace('{name}', p.name)} onClick={() => setOpen(open === p.id ? null : p.id)}>⋯</button>
                    )}
                  </span>
                </td>
              </tr>,
              open === p.id && !readOnly ? (
                <tr key={`${p.id}-act`} className="ox-person-act">
                  <td colSpan={6}>
                    <PersonActions locale={locale} p={p} onPerson={onPerson} kinds={kindsFor?.(p) ?? ACCOUNT_KINDS} busy={busy} />
                  </td>
                </tr>
              ) : null,
            ])}
          </tbody>
        ))}
      </table>

      <div className="ox-users-split">
        {readOnly ? null : <InviteForm locale={locale} onInvite={onInvite} busy={busy} />}
        <section className="ox-panel">
          <header className="ox-panel-hd">
            <h3>{t(locale, 'p3c_u_list')}</h3>
            <span className="ox-panel-sub">{tp(locale, counts.noPassword != null ? 'p3c_u_list_hd_pw' : 'p3c_u_list_hd', { n: counts.total, a: counts.active, p: counts.noPassword ?? 0 })}</span>
          </header>
          <ul className="ox-list ox-invites">
            {invites.map((iv) => (
              <li key={iv.id} data-invite={iv.status}>
                <span className="ox-tile-copy">
                  <b><span data-content>{iv.name}</span> <span className="ox-sub-inline">· {iv.domain ? <span data-content>@{iv.domain}</span> : t(locale, `p3c_role_${iv.kind}`)}</span></b>
                  <span data-content>{iv.line}</span>
                </span>
                <span className="ox-invite-act">
                  <span className={`ox-tag ox-tag-${iv.status}`}>{t(locale, STATUS_KEY[iv.status])}</span>
                  {readOnly ? null : STATUS_ACTIONS[iv.status].map((a) => (
                    <button key={a} type="button" className="btn ghost ox-btn" disabled={busy} onClick={() => onAction?.(iv.id, a)}>{t(locale, a)}</button>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <p className="ox-panel-note">{t(locale, 'p3c_u_list_sub')}</p>
        </section>
      </div>
    </div>
  );
}

function PersonActions({ locale, p, onPerson, kinds, busy }: { locale: Locale; p: PersonRow; onPerson?: (id: string, action: PersonAction, kind?: AccountKind) => void; kinds: readonly AccountKind[]; busy?: boolean }) {
  const [kind, setKind] = useState<AccountKind>(p.kind);
  return (
    <div className="ox-person-panel" data-person-actions={p.id}>
      <label className="ox-field ox-field-inline">
        <span>{t(locale, 'p3c_u_kind')}</span>
        <select className="input" value={kind} disabled={p.self} onChange={(e) => setKind(e.target.value as AccountKind)}>
          {kinds.map((k) => <option key={k} value={k}>{t(locale, `p3c_role_${k}`)}</option>)}
        </select>
      </label>
      <div className="ox-actions ox-actions-start">
        <button type="button" className="btn ox-btn" disabled={busy || p.self || kind === p.kind} onClick={() => onPerson?.(p.id, 'kind', kind)}>{t(locale, 'p3c_u_kind_save')}</button>
        <button type="button" className="btn ghost ox-btn" disabled={busy || p.self} onClick={() => onPerson?.(p.id, p.active === false ? 'activate' : 'deactivate')}>{t(locale, p.active === false ? 'p3c_u_on' : 'p3c_u_off')}</button>
        <button type="button" className="btn ghost ox-btn" disabled={busy || p.self} onClick={() => onPerson?.(p.id, 'logout')}>{t(locale, 'p3c_u_logout')}</button>
        <button type="button" className="btn ghost ox-btn" disabled={busy || p.self || p.active === false} onClick={() => onPerson?.(p.id, 'actas')}>{t(locale, 'p3c_u_actas')}</button>
      </div>
    </div>
  );
}

function InviteForm({ locale, onInvite, busy }: { locale: Locale; onInvite?: (v: { first: string; last: string; phone: string; mail: string; kind: AccountKind }) => void; busy?: boolean }) {
  const [v, setV] = useState({ first: '', last: '', phone: '', mail: '', kind: 'CLIENT_USER' as AccountKind });
  return (
    <section className="ox-panel ox-invite" data-opt-invite>
      <header className="ox-panel-hd"><h3>{t(locale, 'p3c_inv_title')}</h3></header>
      <div className="ox-panel-bd">
        <div className="ox-grid2">
          <label className="ox-field"><span>{t(locale, 'p3c_inv_first')}</span><input className="input" autoComplete="off" value={v.first} onChange={(e) => setV({ ...v, first: e.target.value })} /></label>
          <label className="ox-field"><span>{t(locale, 'p3c_inv_last')}</span><input className="input" autoComplete="off" value={v.last} onChange={(e) => setV({ ...v, last: e.target.value })} /></label>
          <label className="ox-field"><span>{t(locale, 'p3c_inv_phone')}</span><input className="input" inputMode="tel" placeholder="+48" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></label>
          <label className="ox-field"><span>{t(locale, 'p3c_inv_mail')}</span><input className="input" type="email" autoComplete="off" value={v.mail} onChange={(e) => setV({ ...v, mail: e.target.value })} /></label>
        </div>
        <small className="ox-muted">{t(locale, 'p3c_inv_phone_fmt')}</small>
        <div className="ox-field">
          <span>{t(locale, 'p3c_inv_kind')}</span>
          <div className="ox-seg ox-seg-wrap" role="radiogroup" aria-label={t(locale, 'p3c_inv_kind')}>
            {ACCOUNT_KINDS.map((k) => (
              <button key={k} type="button" role="radio" aria-checked={v.kind === k} onClick={() => setV({ ...v, kind: k })}>{t(locale, `p3c_role_${k}`).replace(' · ', ' ')}</button>
            ))}
          </div>
        </div>
        <p className="ox-note-box">{t(locale, 'p3c_inv_note')}</p>
        <div className="ox-actions">
          <button type="button" className="btn ghost ox-btn" onClick={() => setV({ first: '', last: '', phone: '', mail: '', kind: 'CLIENT_USER' })}>{t(locale, 'p3c_cancel')}</button>
          <button type="button" className="btn ox-btn" disabled={busy} onClick={() => onInvite?.(v)}>{t(locale, 'p3c_inv_send')}</button>
        </div>
      </div>
    </section>
  );
}

/* ---------- Logowania ---------- */

export type LoginRow = { id: string; when: string; who: string; kind: AccountKind | null; ok: boolean; where: string };

export function LoginsScreen({ locale, rows, mark, onRefresh, busy, note }: {
  locale: Locale;
  rows: LoginRow[];
  mark?: ReactNode;
  /** Produkcja: „Odśwież” (jak dawny dziennik logowań). */
  onRefresh?: () => void;
  busy?: boolean;
  /** Zdanie pod tabelą (produkcja: skąd lista i ile ostatnich logowań). */
  note?: string;
}) {
  return (
    <div className="ox-logins">
      {mark || onRefresh ? (
        <div className="ox-count-line">
          {onRefresh ? <button type="button" className="btn ghost ox-btn" disabled={busy} onClick={onRefresh} data-logins-refresh>{t(locale, 'opt_acc_authlog_refresh')}</button> : <span />}
          {mark}
        </div>
      ) : null}
      <table className="ox-table ox-cards-phone" data-opt-table="logins">
        <thead><tr><th>{t(locale, 'p3c_l_when')}</th><th>{t(locale, 'p3c_l_who')}</th><th>{t(locale, 'p3c_l_result')}</th><th>{t(locale, 'p3c_l_where')}</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <th scope="row" data-label={t(locale, 'p3c_l_when')} className="ox-nowrap" data-content>{r.when}</th>
              <td data-label={t(locale, 'p3c_l_who')}><b data-content>{r.who}</b>{r.kind ? <span className="ox-sub">{t(locale, `p3c_role_${r.kind}`)}</span> : null}</td>
              <td data-label={t(locale, 'p3c_l_result')} className={r.ok ? 'ox-go' : 'ox-alert'}>{t(locale, r.ok ? 'p3c_l_ok' : 'p3c_l_fail')}</td>
              <td data-label={t(locale, 'p3c_l_where')} data-content>{r.where}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length ? null : <p className="ox-empty">{t(locale, 'opt_acc_authlog_empty')}</p>}
      {note ? <p className="ox-foot">{note}</p> : null}
    </div>
  );
}

/* ---------- Komunikat dla wszystkich ---------- */

/** `test` — komunikat próbny (obraz E37: „próbny” po prawej). */
export type BroadcastHistoryRow = { id: string; when: string; who: string; text: string; line: string; test?: boolean };

export function BroadcastScreen({ locale, draft, history, readOnly, mark, onPublish, active, onClear, busy }: {
  locale: Locale;
  draft: { text: string; firms: Array<'HHL' | 'KSH' | 'SCX'>; until: string };
  history: BroadcastHistoryRow[];
  readOnly?: boolean;
  mark?: ReactNode;
  onPublish?: (v: { text: string; firms: Array<'HHL' | 'KSH' | 'SCX'>; until: string }) => void;
  /** Produkcja: komunikat widoczny teraz (baner) i „Zdejmij komunikat”. */
  active?: { text: string; until: string; firms: string } | null;
  onClear?: () => void;
  busy?: boolean;
}) {
  const [v, setV] = useState(draft);
  const toggle = (f: 'HHL' | 'KSH' | 'SCX') => setV({ ...v, firms: v.firms.includes(f) ? v.firms.filter((x) => x !== f) : [...v.firms, f] });
  return (
    <div className="ox-bcast">
      {active !== undefined ? (
        <section className="ox-panel" data-bcast-active={active ? 'on' : 'off'}>
          <div className="ox-panel-bd">
            {active ? (
              <div className="ox-row-act" style={{ justifyContent: 'space-between', width: '100%' }}>
                <span className="ox-tile-copy"><b>{t(locale, 'opt_acc_bcast_active')}</b><span data-content>„{active.text}” · {active.until} · {active.firms}</span></span>
                {readOnly || !onClear ? null : <button type="button" className="btn ghost ox-btn" disabled={busy} onClick={onClear}>{t(locale, 'opt_acc_bcast_clear')}</button>}
              </div>
            ) : <span className="ox-muted">{t(locale, 'opt_acc_bcast_none')}</span>}
          </div>
        </section>
      ) : null}
      <section className="ox-panel">
        <div className="ox-panel-bd">
          <label className="ox-field"><span>{t(locale, 'p3c_b_text')}</span>
            <textarea className="input" maxLength={500} rows={3} value={v.text} readOnly={readOnly} onChange={(e) => setV({ ...v, text: e.target.value })} />
          </label>
          <div className="ox-count-line"><small className="ox-muted">{t(locale, 'p3c_b_chars').replace('{n}', String(v.text.length))}</small>{mark}</div>
          <div className="ox-grid2">
            <div className="ox-field">
              <span>{t(locale, 'p3c_b_for')}</span>
              <div className="ox-seg" role="group" aria-label={t(locale, 'p3c_b_for')}>
                {(['HHL', 'KSH', 'SCX'] as const).map((f) => (
                  <button key={f} type="button" aria-pressed={v.firms.includes(f)} disabled={readOnly} onClick={() => toggle(f)}>{f}</button>
                ))}
              </div>
            </div>
            <label className="ox-field"><span>{t(locale, 'p3c_b_until')}</span><input className="input" type="datetime-local" value={v.until} readOnly={readOnly} onChange={(e) => setV({ ...v, until: e.target.value })} /></label>
          </div>
          <div className="ox-field">
            <span>{t(locale, 'p3c_b_how')}</span>
            <div className="ox-seg"><button type="button" aria-pressed="true" disabled>{t(locale, 'p3c_b_banner')}</button></div>
          </div>
          {readOnly ? null : (
            <div className="ox-actions">
              <button type="button" className="btn ghost ox-btn">{t(locale, 'p3c_b_preview')}</button>
              <button type="button" className="btn ox-btn" disabled={busy || !v.text.trim() || !v.firms.length} onClick={() => onPublish?.(v)}>{t(locale, 'p3c_b_publish')}</button>
            </div>
          )}
        </div>
        <header className="ox-panel-hd ox-panel-hd-mid"><h3>{t(locale, 'p3c_b_hist')}</h3></header>
        <ul className="ox-list">
          {history.map((h) => (
            <li key={h.id}>
              <span className="ox-tile-copy"><b data-content>{h.when} · {h.who}</b><span data-content>„{h.text}” · {h.line}</span></span>
              {h.test ? <small className="ox-muted">{t(locale, 'p3c_b_test')}</small> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/* ---------- Moje konto ---------- */

export type MyDevice = { id: string; name: string; last: string; push: boolean; current: boolean };
/** wyglad/2fa: urządzenie z aplikacją kodów (TOTP, `status = verified`) — nazwa i data dodania („12.10.2026”). */
export type MfaDevice = { id: string; name: string; since: string };

export function AccountScreen({ locale, me, mfa, devices, mark, onSave, onPassword, onMfa, onRemoveDevice, mfaDevices, mfaCode, onMfaAdd, onMfaRemove, readOnly }: {
  locale: Locale;
  me: { first: string; last: string; phone: string; mail: string; kind: AccountKind; lastLogin: string | null };
  mfa: boolean;
  devices: MyDevice[];
  mark?: ReactNode;
  onSave?: (v: { first: string; last: string; phone: string }) => void;
  onPassword?: () => void;
  onMfa?: () => void;
  onRemoveDevice?: (id: string) => void;
  /** wyglad/2fa: urządzenia 2FA (tylko zweryfikowane); brak — lista niewidoczna */
  mfaDevices?: MfaDevice[];
  /** sesja potwierdzona kodem 2FA (aal2) — wtedy można dodawać i usuwać urządzenia */
  mfaCode?: boolean;
  onMfaAdd?: () => void;
  onMfaRemove?: (id: string) => void;
  /** Podgląd (W38): pola i przyciski nieaktywne */
  readOnly?: boolean;
}) {
  const [v, setV] = useState({ first: me.first, last: me.last, phone: me.phone });
  const [askRemove, setAskRemove] = useState<MfaDevice | null>(null);
  const ro = !!readOnly;
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
            <label className="ox-field"><span>{t(locale, 'p3c_m_first')}</span><input className="input" value={v.first} readOnly={ro} onChange={(e) => setV({ ...v, first: e.target.value })} /></label>
            <label className="ox-field"><span>{t(locale, 'p3c_m_last')}</span><input className="input" value={v.last} readOnly={ro} onChange={(e) => setV({ ...v, last: e.target.value })} /></label>
            <label className="ox-field"><span>{t(locale, 'p3c_m_phone')}</span><input className={`input${v.phone.trim() ? '' : ' is-invalid'}`} inputMode="tel" placeholder="+48" value={v.phone} readOnly={ro} onChange={(e) => setV({ ...v, phone: e.target.value })} /><small className="ox-muted">{t(locale, 'p3c_m_phone_note')}</small></label>
            <label className="ox-field"><span>{t(locale, 'p3c_m_mail')}</span><input className="input" value={me.mail} readOnly /><small className="ox-muted">{t(locale, 'p3c_m_mail_note')}</small></label>
          </div>
          <div className="ox-actions"><button type="button" className="btn ox-btn" disabled={ro} onClick={() => onSave?.(v)}>{t(locale, 'p3c_m_save')}</button></div>
          {ro ? <p className="ox-foot" data-acc-preview>{m2('m2_preview')}</p> : null}
        </div>
      </section>
      <div className="ox-users-split">
        <section className="ox-panel">
          <header className="ox-panel-hd"><h3>{t(locale, 'p3c_m_pw')}</h3></header>
          <div className="ox-panel-bd">
            <p className="ox-panel-note ox-flush">{t(locale, 'p3c_m_pw_note')}</p>
            <div className="ox-actions ox-actions-start"><button type="button" className="btn ghost ox-btn" disabled={ro} onClick={onPassword}>{t(locale, 'p3c_m_pw_change')}</button></div>
          </div>
        </section>
        <section className="ox-panel">
          <header className="ox-panel-hd"><h3>{t(locale, 'p3c_m_2fa')}</h3><span className={`ox-tag ${mfa ? 'ox-tag-active' : 'ox-tag-plain'}`}>{t(locale, mfa ? 'p3c_m_2fa_on' : 'p3c_m_2fa_off')}</span></header>
          <div className="ox-panel-bd">
            <p className="ox-panel-note ox-flush">{t(locale, 'p3c_m_2fa_note')}</p>
            {mfa ? null : <div className="ox-actions ox-actions-start"><button type="button" className="btn ghost ox-btn" disabled={ro} onClick={onMfa}>{t(locale, 'p3c_m_2fa_enable')}</button></div>}
            {mfa && mfaDevices ? (
              <div className="ox-mfa" data-mfa-devices={mfaDevices.length}>
                <span className="ox-eyebrow">{m2('m2_devices')}</span>
                <ul className="ox-mfa-list">
                  {mfaDevices.map((d) => (
                    <li key={d.id} data-mfa-device>
                      <span className="ox-tile-copy"><b data-content>{d.name}</b><span>{m2('m2_since', { d: d.since })}</span></span>
                      {mfaDevices.length > 1 ? (
                        <button type="button" className="btn ghost ox-btn" data-mfa-remove disabled={ro || !mfaCode || !onMfaRemove} onClick={() => setAskRemove(d)}>{m2('m2_remove')}</button>
                      ) : null}
                    </li>
                  ))}
                </ul>
                {mfaDevices.length < 2 ? (
                  <>
                    <p className="ox-foot">{m2('m2_second_hint')}</p>
                    <div className="ox-actions ox-actions-start">
                      <button type="button" className="btn ox-btn" data-mfa-add disabled={ro || !mfaCode || !onMfaAdd} onClick={onMfaAdd}>{m2('m2_add_second')}</button>
                    </div>
                  </>
                ) : null}
                {mfaDevices.length === 1 ? <p className="ox-foot">{m2('m2_remove_last')}</p> : null}
                {!mfaCode && !ro ? <p className="ox-foot" data-mfa-needs-code>{m2('m2_needs_code')}</p> : null}
              </div>
            ) : null}
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
              {d.current ? null : <button type="button" className="btn ghost ox-btn" disabled={ro} onClick={() => onRemoveDevice?.(d.id)}>{t(locale, 'p3c_m_dev_remove')}</button>}
            </li>
          ))}
        </ul>
      </section>
      {askRemove ? (
        <div className="ox-scrim" role="presentation" onClick={() => setAskRemove(null)}>
          <div className="ox-dialog" role="dialog" aria-modal="true" aria-labelledby="ox-mfa-q" onClick={(e) => e.stopPropagation()}>
            <h3 id="ox-mfa-q">{m2('m2_q_remove', { name: askRemove.name })}</h3>
            <p>{m2('m2_q_remove_fx')}</p>
            <div className="ox-actions">
              <button type="button" className="btn ghost ox-btn" onClick={() => setAskRemove(null)}>{m2('m2_cancel')}</button>
              <button type="button" className="btn ox-btn" data-mfa-remove-ok onClick={() => { onMfaRemove?.(askRemove.id); setAskRemove(null); }}>{m2('m2_remove')}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
