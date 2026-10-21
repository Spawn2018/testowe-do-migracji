/**
 * Właściciel 21.10.2026 20:14 (pkt 5 i 7): kliknięcie powiadomienia na telefonie „nic nie robi” — prowadziło na stronę główną,
 * bo wpis push nie ma adresu. Service worker otwiera teraz `/?pn=<id wpisu>`; tu aplikacja czyta ten wpis
 * z bazy (RLS: tylko własne), liczy cel tak samo jak dzwonek (`notificationFromRow` → `clickTarget`) i otwiera to miejsce.
 * Wpis zostaje oznaczony jako przeczytany. Warunek `import.meta.env.VITE_AUTH_MODE` wpisany wprost (strażnik I-0).
 */
import { useEffect, useState } from 'react';
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

/** Klucz wpisu w dzwonku dla wpisu push: `X:WP:<osoba>` → `X:IN:<osoba>` (ten sam wpis w innym kanale). */
export function inAppTwinKey(dedupKey: string | null | undefined): string | null {
  return dedupKey && dedupKey.includes(':WP:') ? dedupKey.replace(':WP:', ':IN:') : null;
}

const COLS = 'id,channel,dedup_key,user_id,template,payload,load_id,created_at,read_at';

async function openFromPush(nid: number): Promise<void> {
  const [{ getSupabase }, { notificationFromRow }] = await Promise.all([import('../auth/client'), import('../data/mappers')]);
  const sb = await getSupabase();
  const q = await sb.from('notifications').select(COLS).eq('id', nid).maybeSingle();
  if (q.error || !q.data) { window.location.hash = '#/kokpit'; return; }
  /* push wskazuje wiersz WEB_PUSH; dzwonek pokazuje bliźniaczy IN_APP — ten otwieramy i oznaczamy (bez duplikatu w dzwonku) */
  let row = q.data as { id: number; channel?: string; dedup_key?: string | null; user_id?: string | null };
  const twin = row.channel === 'WEB_PUSH' ? inAppTwinKey(row.dedup_key) : null;
  if (twin) {
    let tq = sb.from('notifications').select(COLS).eq('channel', 'IN_APP').eq('dedup_key', twin);
    if (row.user_id) tq = tq.eq('user_id', row.user_id);
    const t = await tq.maybeSingle();
    if (!t.error && t.data) row = t.data as typeof row;
  }
  const st = useTowerStore.getState();
  const n = notificationFromRow(row as never, st.locale);
  const isBell = row.channel == null || row.channel === 'IN_APP';
  /* openNotification szuka wpisu w store (także „Szczegóły wpisu”) — push bez bliźniaka w dzwonku dodajemy jako przeczytany */
  if (!st.notifications.some((x) => x.id === n.id)) {
    const add = isBell ? n : { ...n, read: true };
    useTowerStore.setState((s) => ({ notifications: [add, ...s.notifications] }));
  }
  useTowerStore.getState().openNotification(n.id);
  const ids = Array.from(new Set([row.id, nid]));
  void sb.rpc('mark_notifications_read', { p_ids: ids }).then(() => undefined, () => undefined);
}

/** Po wczytaniu danych (lista transportów w store) — otwiera cel powiadomienia z adresu `?pn=<id>`. */
export function usePushOpen(): void {
  const loaded = useTowerStore((s) => s.loads.length > 0);
  /* konto bez transportów (np. nowe SCX) — nie czekamy w nieskończoność */
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (pending == null) return;
    const t = setTimeout(() => setLate(true), 8000);
    return () => clearTimeout(t);
  }, []);
  const ready = loaded || late;
  useEffect(() => {
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase' || !ready || pending == null) return;
    const nid = pending;
    pending = null;
    void openFromPush(nid).catch(() => { window.location.hash = '#/kokpit'; });
  }, [ready]);
}
