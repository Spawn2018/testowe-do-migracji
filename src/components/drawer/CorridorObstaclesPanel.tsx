/**
 * H-3 — w podglądzie transportu tylko przeszkody dla wymiarów tego zestawu.
 * Flaga wyłączona: nie ma listy. Brak wymiarów albo pusta odpowiedź = „Brak danych”.
 * Paczka demo nie woła bazy i nie pokazuje danych przykładowych.
 */
import { useEffect, useState } from 'react';
import { SUPABASE_AUTH_ENABLED } from '../../auth/config';
import { t, tp } from '../../i18n/messages';
import type { Locale } from '../../types';

type Item = { kind?: string; place?: string; limitText?: string; setText?: string; lat?: number | null; lng?: number | null };
type Payload = { status?: string; total?: number; items?: Item[] };

const LIVE = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED;

export function CorridorObstaclesPanel({ loadId, locale }: { loadId: string; locale: Locale }) {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [off, setOff] = useState(true);

  useEffect(() => {
    if (!LIVE) return;
    let cancel = false;
    (async () => {
      try {
        const { getSupabase } = await import('../../auth/client');
        const sb = await getSupabase();
        const flag = await sb.rpc('h3_corridor_state');
        if (cancel) return;
        if (flag.error || flag.data !== true) {
          setOff(true);
          setPayload(null);
          return;
        }
        const q = await sb.rpc('h3_highlighted', { p_load: loadId });
        if (cancel) return;
        if (q.error || !q.data || typeof q.data !== 'object') {
          setOff(false);
          setPayload({ status: 'brak_danych', total: 0, items: [] });
          return;
        }
        const data = q.data as Payload;
        if (data.status === 'wylaczone') {
          setOff(true);
          setPayload(null);
          return;
        }
        setOff(false);
        setPayload(data);
      } catch {
        if (!cancel) {
          setOff(true);
          setPayload(null);
        }
      }
    })();
    return () => { cancel = true; };
  }, [loadId]);

  if (!LIVE || off || !payload) {
    return <span data-corridor="off">{t(locale, 'h3_off')}</span>;
  }
  if (payload.status === 'brak_danych') {
    return <span data-corridor="brak">{t(locale, 'h3_none')}</span>;
  }
  if (payload.status !== 'podswietlone' || !payload.items?.length) {
    return <span data-corridor="pusto">{t(locale, 'h3_clear')}</span>;
  }
  const total = payload.total ?? payload.items.length;
  return (
    <div data-corridor="lista">
      {payload.items.map((o, i) => (
        <div key={`${o.place ?? ''}-${i}`}>
          {t(locale, 'h3_obstacle')}: {o.kind} {o.place}
          {o.lat != null && o.lng != null ? ` (${Number(o.lat).toFixed(5)}, ${Number(o.lng).toFixed(5)})` : ''}.
          {' '}{t(locale, 'h1_limit')}: {o.limitText}. {t(locale, 'h1_set')}: {o.setText}.
        </div>
      ))}
      {total > payload.items.length ? (
        <div>{tp(locale, 'h3_more', { n: String(total) })}</div>
      ) : null}
    </div>
  );
}
