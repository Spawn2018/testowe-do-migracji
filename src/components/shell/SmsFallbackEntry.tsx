import { Link } from 'react-router-dom';
import { useTowerStore } from '../../store/useTowerStore';
import { t } from '../../i18n/messages';

/** L-4 — wpis SMS_FALLBACK: status, odbiorca, e-mail zastępczy, link do transportu. */
export function SmsFallbackEntry() {
  const locale = useTowerStore((s) => s.locale);
  const entry = useTowerStore((s) => s.smsEntry);
  if (!entry) return null;
  const email = entry.email || t(locale, 'sms_entry_email_sent');
  return (
    <section className="note option-note" data-sms-entry={entry.id}>
      <b>{t(locale, 'sms_entry_h')}</b>
      <div>{t(locale, 'sms_entry_status')}: {entry.status || '—'}</div>
      <div>{t(locale, 'sms_entry_recipient')}: {entry.recipient ? `…${entry.recipient}` : '—'}</div>
      <div>{t(locale, 'sms_entry_email')}: {email}</div>
      {entry.transport ? (
        <div>
          {t(locale, 'sms_entry_transport')}:{' '}
          <Link to={`/transport/${encodeURIComponent(entry.transport)}?zakladka=status`}>{entry.transport}</Link>
        </div>
      ) : null}
    </section>
  );
}
