/**
 * H-1 — lista przeszkód w podglądzie transportu.
 * Przy wyłączonej kontroli nie pokazuje liczb zestawu ani danych przykładowych.
 * Klient bazy tylko w buildzie z logowaniem — paczka demo go nie zawiera.
 */
import { useEffect, useState } from 'react';
import { SUPABASE_AUTH_ENABLED } from '../../auth/config';
import { t } from '../../i18n/messages';
import type { Locale } from '../../types';

type Permit = { kind?: string; area?: string; limitText?: string; setText?: string };
type Obstacle = { kind?: string; place?: string; limitText?: string; setText?: string; lat?: number | null; lng?: number | null; critical?: boolean };
type Row = { id: string; leg: string; summary: string; permits: Permit[]; obstacles: Obstacle[]; status: string };

const LIVE = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED;

export function RouteCheckPanel({ loadId, locale }: { loadId: string; locale: Locale }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [off, setOff] = useState(true);

  useEffect(() => {
    if (!LIVE) return;
    let cancel = false;
    (async () => {
      try {
        const { getSupabase } = await import('../../auth/client');
        const sb = await getSupabase();
        const flag = await sb.rpc('h1_route_check_state');
        if (cancel) return;
        if (flag.error || flag.data !== true) {
          setOff(true);
          setRows(null);
          return;
        }
        const q = await sb
          .from('route_checks')
          .select('id, leg, summary, permits, obstacles, status, checked_at')
          .eq('load_id', loadId)
          .order('checked_at', { ascending: false })
          .limit(4);
        if (cancel) return;
        if (q.error || !q.data?.length) {
          setOff(true);
          setRows(null);
          return;
        }
        setOff(false);
        setRows(q.data as Row[]);
      } catch {
        if (!cancel) {
          setOff(true);
          setRows(null);
        }
      }
    })();
    return () => { cancel = true; };
  }, [loadId]);

  if (off || !rows) {
    return <span data-route-check="off">{t(locale, 'h1_off')}</span>;
  }
  return (
    <div data-route-check="on">
      {rows.map((row) => (
        <div key={row.id}>
          <div>{row.summary}</div>
          {(row.permits ?? []).map((p, i) => (
            <div key={`p${i}`}>{t(locale, 'h1_permit')}: {p.area}. {t(locale, 'h1_limit')}: {p.limitText}. {t(locale, 'h1_set')}: {p.setText}.</div>
          ))}
          {(row.obstacles ?? []).map((o, i) => (
            <div key={`o${i}`}>
              {t(locale, 'h1_obstacle')}: {o.kind} {o.place}
              {o.lat != null && o.lng != null ? ` (${o.lat.toFixed(5)}, ${o.lng.toFixed(5)})` : ''}.
              {' '}{t(locale, 'h1_limit')}: {o.limitText}. {t(locale, 'h1_set')}: {o.setText}.
            </div>
          ))}
          {row.status !== 'ok' ? <div>{t(locale, 'h1_no_here')}</div> : null}
        </div>
      ))}
    </div>
  );
}
