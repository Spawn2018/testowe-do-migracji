/** Q-11b A — subskrypcja Web Push (VAPID). Tylko build supabase. */
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../auth/config';
import { getSupabase } from '../auth/client';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function fetchVapidPublicKey(): Promise<string | null> {
  const edge = ['functions', 'v1', 'web-push-vapid-public'].join('/');
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/${edge}`, {
    headers: { apikey: SUPABASE_ANON_KEY },
  });
  if (!res.ok) return null;
  const j = await res.json() as { publicKey?: string };
  return j.publicKey ?? null;
}

export async function enableWebPush(): Promise<{ ok: boolean; reason?: string }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'unsupported' };
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: 'denied' };
  const key = await fetchVapidPublicKey();
  if (!key) return { ok: false, reason: 'no_vapid' };
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
  });
  const json = sub.toJSON();
  const sb = await getSupabase();
  const { error } = await sb.rpc('push_subscribe', {
    p_endpoint: json.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
    p_ua: navigator.userAgent,
  });
  if (error) return { ok: false, reason: error.message };
  await sb.rpc('set_web_push_enabled', { p_on: true });
  return { ok: true };
}

export async function disableWebPush(): Promise<void> {
  const sb = await getSupabase();
  await sb.rpc('set_web_push_enabled', { p_on: false });
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await sb.rpc('push_unsubscribe', { p_endpoint: sub.endpoint });
    await sub.unsubscribe();
  }
}

export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return iOS;
}

export function isStandalonePwa(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && Boolean((navigator as { standalone?: boolean }).standalone));
}
