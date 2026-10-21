/**
 * Właściciel 21.10.2026 20:14 (pkt 5 i 7): kliknięcie powiadomienia na telefonie „nic nie robi” — prowadziło na stronę główną,
 * bo wpis push nie ma adresu. Service worker otwiera teraz `/?pn=<id wpisu>`; tu aplikacja czyta ten wpis
 * z bazy (RLS: tylko własne), liczy cel tak samo jak dzwonek (`notificationFromRow` → `clickTarget`) i otwiera to miejsce.
 * Wpis zostaje oznaczony jako przeczytany. Warunek `import.meta.env.VITE_AUTH_MODE` wpisany wprost (strażnik I-0).
 */
import { useEffect } from 'react';
import { useTowerStore } from '../store/useTowerStore';

/** `?pn=123` z adresu (parametr zapytania — routing aplikacji działa na `#/…` i go nie rusza). */
export function pushNidFromSearch(search: string): number | null {
  const v = new URLSearchParams(search).get('pn');
  return v && /^\d+$/.test(v) ? Number(v) : null;
}

/* odczyt raz, przy starcie strony (kliknięcie powiadomienia otwiera albo przeładowuje kartę) */
let pending: number | null = typeof window !== 'undefined' && window.location ? pushNidFromSearch(window.location.search) : null;
if (pending != null && typeof window !== 'undefined' && window.location) {
  const u = new URL(window.location.href);
  u.searchParams.delete('pn');
  try { window.history.replaceState(window.history.state, '', u.pathname + u.search + u.hash); } catch { /* adres zostaje */ }
}

async function openFromPush(nid: number): Promise<void> {
  const [{ getSupabase }, { notificationFromRow }] = await Promise.all([import('../auth/client'), import('../data/mappers')]);
  const sb = await getSupabase();
  const q = await sb.from('notifications').select('id,template,payload,load_id,created_at,read_at').eq('id', nid).maybeSingle();
  const st = useTowerStore.getState();
  if (q.error || !q.data) { window.location.hash = '#/kokpit'; return; }
  const n = notificationFromRow(q.data as never, st.locale);
  if (!st.notifications.some((x) => x.id === n.id)) useTowerStore.setState((s) => ({ notifications: [n, ...s.notifications] }));
  useTowerStore.getState().openNotification(n.id);
  void sb.rpc('mark_notifications_read', { p_ids: [nid] }).then(() => undefined, () => undefined);
}

/** Po wczytaniu danych (lista transportów w store) — otwiera cel powiadomienia z adresu `?pn=<id>`. */
export function usePushOpen(): void {
  const ready = useTowerStore((s) => s.loads.length > 0);
  useEffect(() => {
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase' || !ready || pending == null) return;
    const nid = pending;
    pending = null;
    void openFromPush(nid).catch(() => { window.location.hash = '#/kokpit'; });
  }, [ready]);
}
