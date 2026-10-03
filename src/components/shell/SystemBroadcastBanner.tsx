/**
 * DEC-6 — baner komunikatu dla firm (system_broadcast_current).
 */
import { useEffect, useState } from 'react';
import { SUPABASE_AUTH_ENABLED } from '../../auth/config';

type Row = { id: number; body: string; expires_at: string };

export function SystemBroadcastBanner() {
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
    <div className="banner" data-banner="system-broadcast" role="status">
      <div>
        <b>WATCH TOWER</b> {row.body}
      </div>
    </div>
  );
}
