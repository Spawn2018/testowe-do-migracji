/**
 * DEC-6 — baner komunikatu dla firm (system_broadcast_current).
 * wyglad/P3 (E37 pkt 1, img/e37-after): pasek pod paskiem górnym, po „Podglądzie” i „Działasz jako”.
 * „Zamknij”, odświeżanie co minutę i wybór firm — E37 pkt 4 (P10b).
 */
import { useEffect, useState } from 'react';
import { SUPABASE_AUTH_ENABLED } from '../../auth/config';
import { useTowerStore } from '../../store/useTowerStore';
import { t } from '../../i18n/messages';
import { formatListDateTime } from '../../lib/format';

type Row = { id: number; body: string; expires_at: string };

export function SystemBroadcastBanner() {
  const locale = useTowerStore((s) => s.locale);
  const [row, setRow] = useState<Row | null>(null);

  useEffect(() => {
    if (!(import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED)) return;
    let cancelled = false;
    void (async () => {
      try {
        const { getSupabase } = await import('../../auth/client');
        const sb = await getSupabase();
        const { data, error } = await sb.rpc('system_broadcast_current');
        if (cancelled || error) return;
        const first = Array.isArray(data) ? data[0] : data;
        setRow((first as Row) ?? null);
      } catch {
        /* demo / brak sesji */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!row?.body) return null;
  return (
    <div className="subbar subbar-bcast" data-banner="system-broadcast" role="status">
      <p className="subbar-tx">
        <span className="subbar-tag">{t(locale, 'p3a_bcast_tag')}</span>
        <b className="subbar-tag-ph">{t(locale, 'p3a_bcast_phone')}</b>{' '}
        <b className="subbar-body">{row.body}</b>
        {row.expires_at ? <span className="subbar-until">{` · ${t(locale, 'p3a_bcast_until').replace('{when}', formatListDateTime(row.expires_at))}`}</span> : null}
      </p>
    </div>
  );
}
