/** Q-11b A / C16 N6 — subskrypcja Web Push (VAPID). Tylko build supabase. */
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

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve('timeout'), ms);
    void p.then((v) => { clearTimeout(t); resolve(v); }, () => { clearTimeout(t); resolve('timeout'); });
  });
}

async function tellSwPushCfg(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const resubUrl = `${SUPABASE_URL.replace(/\/$/, '')}/functions/v1/web-push-resub`;
    reg.active?.postMessage({ type: 'WT_PUSH_CFG', resubUrl });
  } catch { /* SW jeszcze nieaktywny */ }
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

async function saveSubscription(sub: PushSubscription): Promise<{ ok: boolean; reason?: string }> {
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
  await tellSwPushCfg();
  return { ok: true };
}

/**
 * C16 N6 — prośba o zgodę jest pierwszym wywołaniem (iPhone).
 * `navigator.serviceWorker.ready` z limitem 10 s → reason: 'no_sw'.
 */
export async function enableWebPush(): Promise<{ ok: boolean; reason?: string }> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, reason: 'unsupported' };
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false, reason: 'denied' };
  const key = await fetchVapidPublicKey();
  if (!key) return { ok: false, reason: 'no_vapid' };
  const ready = await withTimeout(navigator.serviceWorker.ready, 10_000);
  if (ready === 'timeout') return { ok: false, reason: 'no_sw' };
  const sub = await ready.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
  });
  return saveSubscription(sub);
}

/**
 * C16 N6 — przy starcie po zalogowaniu: gdy zgoda = granted, odśwież zapis (upsert last_seen_at).
 */
export async function syncWebPush(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const ready = await withTimeout(navigator.serviceWorker.ready, 10_000);
    if (ready === 'timeout') return;
    let sub = await ready.pushManager.getSubscription();
    if (!sub) {
      const key = await fetchVapidPublicKey();
      if (!key) return;
      sub = await ready.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
      });
    }
    await saveSubscription(sub);
  } catch { /* cichy odśwież — nie blokuje startu */ }
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

let resyncListening = false;

/** Nasłuch WT_PUSH_RESYNC z service workera (pushsubscriptionchange) — raz na sesję. */
export function listenWebPushResync(): void {
  if (resyncListening || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  resyncListening = true;
  navigator.serviceWorker.addEventListener('message', (ev: MessageEvent) => {
    if (ev.data && ev.data.type === 'WT_PUSH_RESYNC') void syncWebPush();
  });
}
