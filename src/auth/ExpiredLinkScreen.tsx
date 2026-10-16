/**
 * wyglad/P10b-a (E37 pkt 7, makieta `makiety_html/E37/pasek.html` „Link wygasł”) — zamiast „Link wygasł lub został
 * już użyty. Poproś o nowy.” w czerwonej ramce: ekran z tytułem, ważnością linku i zaproszenia oraz przyciskiem
 * „Wyślij nowy link na …”, gdy konto albo zaproszenie jest ważne. Bez informacji o linku (produkcja do podłączenia,
 * D-20261016-0530-01) — wersja ogólna: „Nie pamiętam hasła” i „Wróć do logowania”.
 */
import { useState, type ReactNode } from 'react';
import type { Locale } from '../types';
import { p10b, p10bp } from '../i18n/p10b';
import { formatListDateTime } from '../lib/format';
import type { ExpiredLinkInfo } from '../lib/p10bSource';

export function ExpiredLinkScreen({
  brand,
  locale,
  info,
  onResend,
  onForgot,
  onLogin,
}: {
  brand: ReactNode;
  locale: Locale;
  info: ExpiredLinkInfo | null;
  onResend: () => Promise<boolean>;
  onForgot: () => void;
  onLogin: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<boolean | null>(null);
  const canResend = !!info?.canResend;

  let body: string;
  if (!info) body = p10b(locale, 'p10b_expired_general');
  else if (info.kind === 'invite' && !info.canResend) body = p10b(locale, 'p10b_expired_invite_gone');
  else if (info.kind === 'invite' && info.inviteValidUntil) {
    body = p10bp(locale, 'p10b_expired_invite', { ttl: info.linkTtl, date: formatListDateTime(info.inviteValidUntil) });
  } else body = p10bp(locale, 'p10b_expired_recovery', { ttl: info.linkTtl });

  const resend = async () => {
    setBusy(true);
    let ok = false;
    try { ok = await onResend(); } catch { ok = false; }
    setBusy(false);
    setSent(ok);
  };

  return (
    <div className="auth-screen" data-auth="expired">
      <section className="panel auth-card">
        <header className="panel-hd">{brand}</header>
        <div className="panel-bd auth-form">
          <b className="auth-title" data-expired-title>{p10b(locale, 'p10b_expired_title')}</b>
          <p className="auth-msg" data-expired-body>{body}</p>
          {canResend && info ? (
            <>
              <button className="btn" type="button" data-expired-resend disabled={busy || sent === true} onClick={() => { void resend(); }}>
                {busy ? p10b(locale, 'p10b_expired_sending') : p10bp(locale, 'p10b_expired_resend', { email: info.email })}
              </button>
              {sent === true ? <div className="auth-msg ok" role="status">{p10bp(locale, 'p10b_expired_sent', { email: info.email })}</div> : null}
              {sent === false ? <div className="auth-msg err" role="status">{p10b(locale, 'p10b_expired_send_fail')}</div> : null}
              <p className="auth-msg auth-note">{p10b(locale, 'p10b_expired_note')}</p>
              <button className="btn ghost" type="button" data-expired-login onClick={onLogin}>{p10b(locale, 'p10b_expired_login')}</button>
            </>
          ) : (
            <>
              {info ? null : <button className="btn" type="button" data-expired-forgot onClick={onForgot}>{p10b(locale, 'p10b_expired_forgot')}</button>}
              <button className={`btn${info ? '' : ' ghost'}`} type="button" data-expired-login onClick={onLogin}>{p10b(locale, 'p10b_expired_login')}</button>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
