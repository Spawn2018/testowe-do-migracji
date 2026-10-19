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
  /** C16 N3/N7: ostatnie potwierdzenie odbioru z telefonu (ISO); null = jeszcze żadnego */
  lastAck?: string | null;
  /** C16 N7: baza zapisuje potwierdzenia (kolumna `last_ack_at` istnieje) */
  ackSupported?: boolean;
}

/** C16 N1: powód z odpowiedzi `web-push-test`; `network` = prośba nie doszła do serwera (np. CORS). */
export type PushReason = 'gone' | 'auth' | 'payload' | 'service' | 'no_sub' | 'network' | 'unknown';

export interface PushTestResult {
  ok: boolean;
  reason?: PushReason;
  /** chwila wysłania (ISO) — od niej liczymy „doszło po … s” */
  sentAt: string;
}

const REASONS: readonly PushReason[] = ['gone', 'auth', 'payload', 'service', 'no_sub', 'network', 'unknown'];

/** Odpowiedź `web-push-test` → wynik dla ekranu. Stara funkcja (bez `reason`) daje `unknown`. */
export function pushTestResultOf(httpOk: boolean, body: unknown, now: string): PushTestResult {
  const b = (body && typeof body === 'object' ? body : {}) as { ok?: unknown; reason?: unknown; sent_at?: unknown };
  const sentAt = typeof b.sent_at === 'string' && Number.isFinite(Date.parse(b.sent_at)) ? b.sent_at : now;
  if (httpOk && b.ok === true) return { ok: true, sentAt };
  const r = typeof b.reason === 'string' && (REASONS as readonly string[]).includes(b.reason) ? (b.reason as PushReason) : 'unknown';
  return { ok: false, reason: r, sentAt };
}

export interface PushDeviceSource {
  devices: PushDevice[];
  /** null = przycisk ukryty */
  sendTest: ((id: string) => Promise<PushTestResult>) | null;
  remove: ((id: string) => Promise<boolean>) | null;
  /** odśwież listę z bazy (produkcja) */
  refresh?: () => Promise<PushDevice[]>;
}

function demoDevices(): PushDeviceSource {
  return {
    devices: [{
      id: 'dev-1', label: 'Android · Chrome', since: '2026-09-18T09:12:00+02:00', active: true, current: true,
      lastAck: '2026-09-18T09:14:03+02:00', ackSupported: true,
    }],
    sendTest: async () => ({ ok: true, sentAt: new Date().toISOString() }),
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

type DeviceRow = { id: string; endpoint: string; user_agent: string | null; created_at: string | null; last_ack_at?: string | null };

/** Kolumny `last_ack_at` jeszcze nie ma — zapamiętane na sesję, żeby nie pytać bazy za każdym odświeżeniem. */
let ackColumnMissing = false;

/** C16 N7: najpierw z `last_ack_at`; gdy kolumny jeszcze nie ma (przed migracją wykonawcy) — ten sam odczyt bez niej. */
async function readDeviceRows(): Promise<{ rows: DeviceRow[]; ack: boolean }> {
  const sb = await getSupabase();
  if (!ackColumnMissing) {
    const withAck = await sb
      .from('push_subscriptions')
      .select('id, endpoint, user_agent, created_at, last_ack_at')
      .order('created_at', { ascending: false });
    if (!withAck.error && withAck.data) return { rows: withAck.data as DeviceRow[], ack: true };
    const code = (withAck.error as { code?: string } | null)?.code;
    if (code === '42703' || code === 'PGRST204') ackColumnMissing = true;
  }
  const plain = await sb
    .from('push_subscriptions')
    .select('id, endpoint, user_agent, created_at')
    .order('created_at', { ascending: false });
  return { rows: (plain.data ?? []) as DeviceRow[], ack: false };
}

async function loadDevices(): Promise<PushDevice[]> {
  const { rows, ack } = await readDeviceRows();
  const cur = await currentEndpoint();
  return rows.map((r) => ({
    id: r.id,
    label: labelFromUa(r.user_agent),
    since: r.created_at ?? new Date().toISOString(),
    active: true,
    current: cur != null && r.endpoint === cur,
    endpoint: r.endpoint,
    lastAck: ack ? (r.last_ack_at ?? null) : undefined,
    ackSupported: ack,
  }));
}

async function sendTestPush(id: string): Promise<PushTestResult> {
  const now = new Date().toISOString();
  const sb = await getSupabase();
  const { data: sess } = await sb.auth.getSession();
  const token = sess.session?.access_token;
  if (!token) return { ok: false, reason: 'unknown', sentAt: now };
  const edge = ['functions', 'v1', 'web-push-test'].join('/');
  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/${edge}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subscription_id: id }),
    });
  } catch {
    /* prośba nie doszła do serwera (sieć albo CORS — F1 w D-20261015-1955-01) */
    return { ok: false, reason: 'network', sentAt: now };
  }
  let body: unknown = null;
  try { body = await res.json(); } catch { /* odpowiedź bez JSON */ }
  return pushTestResultOf(res.ok, body, now);
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
