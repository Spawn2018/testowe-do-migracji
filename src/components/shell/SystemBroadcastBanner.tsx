/**
 * DEC-6 — baner komunikatu dla firm (system_broadcast_current).
 * wyglad/P3 (E37 pkt 1, img/e37-after): pasek pod paskiem górnym, po „Podglądzie” i „Działasz jako”.
 * wyglad/P10b-a (E37 pkt 4): „Zamknij” (na telefonie „✕”, 44 px) — komunikat nie wraca; po dacie końca znika sam.
 * Odświeżanie w ciągu minuty i zapis zamknięcia „dla osoby” w bazie — Cursor, P10b (D-20261016-0530-01).
 */
import { useTowerStore } from '../../store/useTowerStore';
import { t } from '../../i18n/messages';
import { formatListDateTime } from '../../lib/format';
import { useBroadcast, useBroadcastClosed } from '../../lib/p10bSource';
import { getNowIso } from '../../lib/frozenNow';
import { p10b } from '../../i18n/p10b';

export function SystemBroadcastBanner() {
  const locale = useTowerStore((s) => s.locale);
  const row = useBroadcast();
  const [closed, close] = useBroadcastClosed(row?.id);

  if (!row?.body || closed) return null;
  if (row.expires_at && Date.parse(row.expires_at) <= Date.parse(getNowIso())) return null;
  return (
    <div className="subbar subbar-bcast" data-banner="system-broadcast" role="status">
      <p className="subbar-tx">
        <span className="subbar-tag">{t(locale, 'p3a_bcast_tag')}</span>
        <b className="subbar-tag-ph">{t(locale, 'p3a_bcast_phone')}</b>{' '}
        <b className="subbar-body">{row.body}</b>
        {row.expires_at ? <span className="subbar-until">{` · ${t(locale, 'p3a_bcast_until').replace('{when}', formatListDateTime(row.expires_at))}`}</span> : null}
      </p>
      <button type="button" className="subbar-btn subbar-close" data-bcast-close onClick={close} aria-label={p10b(locale, 'p10b_bcast_close_aria')}>
        <span className="subbar-close-tx">{p10b(locale, 'p10b_bcast_close')}</span>
        <span className="subbar-close-x" aria-hidden="true">✕</span>
      </button>
    </div>
  );
}
