/**
 * wyglad/C — „Dla mnie › Ten telefon / komputer” (E5 img/e5-desk, prawa część: „Twoje urządzenia”).
 * Skąd ekran bierze listę urządzeń z powiadomieniami na telefon i przyciski „Wyślij powiadomienie testowe” /
 * „Usuń urządzenie”. Produkcja: lista z `push_subscriptions` tego konta (C2). Demo: przykład.
 * Warunek `import.meta.env.VITE_AUTH_MODE` wpisany wprost (strażnik I-0).
 */
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../auth/config';
import { getSupabase } from '../auth/client';

export interface PushDevice {
  id: string;
  /** „Android · Chrome” */
  label: string;
  /** dzień zapisania urządzenia (ISO) */
  since: string;
  active: boolean;
  /** to urządzenie, na którym otwarty jest ekran */
  current?: boolean;
  /** endpoint — do usunięcia / porównania bieżącego */
  endpoint?: string;
}

export interface PushDeviceSource {
  devices: PushDevice[];
  /** null = przycisk ukryty */
  sendTest: ((id: string) => Promise<boolean>) | null;
  remove: ((id: string) => Promise<boolean>) | null;
  /** odśwież listę z bazy (produkcja) */
  refresh?: () => Promise<PushDevice[]>;
}

function demoDevices(): PushDeviceSource {
  return {
    devices: [{ id: 'dev-1', label: 'Android · Chrome', since: '2026-10-05T09:12:00+02:00', active: true, current: true }],
    sendTest: async () => true,
    remove: async () => true,
  };
}

function labelFromUa(ua: string | null | undefined): string {
  const s = ua ?? '';
  const android = /Android/i.test(s);
  const ios = /iPhone|iPad|iPod/i.test(s);
  const chrome = /Chrome|CriOS/i.test(s) && !/Edg/i.test(s);
  const firefox = /Firefox|FxiOS/i.test(s);
  const safari = /Safari/i.test(s) && !chrome && !firefox;
  const edge = /Edg/i.test(s);
  const os = android ? 'Android' : ios ? 'iOS' : /Windows/i.test(s) ? 'Windows' : /Mac/i.test(s) ? 'macOS' : 'Urządzenie';
  const br = edge ? 'Edge' : chrome ? 'Chrome' : firefox ? 'Firefox' : safari ? 'Safari' : 'Przeglądarka';
  return `${os} · ${br}`;
}

async function currentEndpoint(): Promise<string | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return sub?.endpoint ?? null;
  } catch {
    return null;
  }
}

async function loadDevices(): Promise<PushDevice[]> {
  const sb = await getSupabase();
  const { data, error } = await sb
    .from('push_subscriptions')
    .select('id, endpoint, user_agent, created_at')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  const cur = await currentEndpoint();
  return data.map((r) => ({
    id: r.id as string,
    label: labelFromUa(r.user_agent as string | null),
    since: (r.created_at as string) ?? new Date().toISOString(),
    active: true,
    current: cur != null && r.endpoint === cur,
    endpoint: r.endpoint as string,
  }));
}

async function sendTestPush(id: string): Promise<boolean> {
  const sb = await getSupabase();
  const { data: sess } = await sb.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return false;
  const edge = ['functions', 'v1', 'web-push-test'].join('/');
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/${edge}`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ subscription_id: id }),
  });
  if (!res.ok) return false;
  const j = await res.json() as { ok?: boolean };
  return j.ok === true;
}

async function removeDevice(id: string): Promise<boolean> {
  const sb = await getSupabase();
  const { data } = await sb.from('push_subscriptions').select('endpoint').eq('id', id).maybeSingle();
  const endpoint = data?.endpoint as string | undefined;
  if (!endpoint) return false;
  const { error } = await sb.rpc('push_unsubscribe', { p_endpoint: endpoint });
  if (error) return false;
  try {
    const cur = await currentEndpoint();
    if (cur === endpoint && 'serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      await sub?.unsubscribe();
      await sb.rpc('set_web_push_enabled', { p_on: false });
    }
  } catch { /* lokalne wypięcie nie blokuje usunięcia w bazie */ }
  return true;
}

export function pushDevicesOf(): PushDeviceSource | null {
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') return demoDevices();
  return {
    devices: [],
    sendTest: sendTestPush,
    remove: removeDevice,
    refresh: loadDevices,
  };
}
