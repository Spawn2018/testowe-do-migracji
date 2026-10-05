/**
 * TELM-EMTRACK-WEB — protokół web emtrack.eu/app (tylko odczyt).
 * Źródło: RAPORT_TELM_EMTRACK_WEB_05_10.md (publiczny klient v6.32.0).
 * Nigdy nie logować username/password/sessionId.
 */
export const EMTRACK_WS_URL = 'wss://emtrack.eu:443/ws/';
export const EMTRACK_APP_URL = 'https://emtrack.eu/app/';
export const EMTRACK_EXPECTED_VERSION = '6.32.0';
export const EMTRACK_UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export type EmtrackAuthType = 'DIRECT' | 'INTERNAL' | 'TOKEN' | 'DRIVER_PIN';

export interface EmtrackObjectFix {
  trackingObjectId: number;
  name: string;
  textId: string | null;
  type: string;
  lat: number | null;
  lon: number | null;
  speedKmh: number | null;
  headingDeg: number | null;
  ignition: boolean | null;
  observedAt: string | null; // ISO
  producer: string | null;
}

export interface EmtrackSentFrameLog {
  t: string;
  type: string;
  id: number;
  dataKeys: string[];
}

export function normalizePlate(s: string | null | undefined): string {
  return String(s ?? '').toUpperCase().replace(/[\s\-]/g, '');
}

/** Wyciąga lat/lng/speed z currentSnapshot (format skrócony d.C.v). */
export function parseCurrentSnapshot(obj: {
  trackingObjectId?: number;
  name?: string;
  textId?: string | null;
  type?: string | number;
  producer?: string | null;
  currentSnapshot?: { ts?: number; d?: Record<string, { ts?: number; v?: unknown }> };
}): EmtrackObjectFix {
  const snap = obj.currentSnapshot;
  const d = snap?.d ?? {};
  const c = d.C?.v as { lat?: number; lng?: number } | undefined;
  const lat = c && Number.isFinite(Number(c.lat)) ? Number(c.lat) : null;
  const lon = c && Number.isFinite(Number(c.lng)) ? Number(c.lng) : null;
  const speed = d.S?.v != null && Number.isFinite(Number(d.S.v)) ? Number(d.S.v) : null;
  const heading = d.AZ?.v != null && Number.isFinite(Number(d.AZ.v)) ? Number(d.AZ.v) : null;
  const ign = d.I?.v == null ? null : Boolean(d.I.v);
  const ts = snap?.ts;
  return {
    trackingObjectId: Number(obj.trackingObjectId),
    name: String(obj.name ?? ''),
    textId: obj.textId ?? null,
    type: String(obj.type ?? ''),
    lat,
    lon,
    speedKmh: speed,
    headingDeg: heading,
    ignition: ign,
    observedAt: ts && Number.isFinite(ts) ? new Date(ts).toISOString() : null,
    producer: obj.producer ?? null,
  };
}

export function isMoving(fix: EmtrackObjectFix, stopSpeedKmh = 1): boolean {
  if (fix.speedKmh != null && fix.speedKmh > stopSpeedKmh) return true;
  if (fix.ignition === true && (fix.speedKmh == null || fix.speedKmh > 0)) return true;
  return false;
}

/** PR5: interwał odświeżenia wg ruchu (sekundy). */
export function pollIntervalSec(fix: EmtrackObjectFix, moveSec = 120, stopSec = 900): number {
  return isMoving(fix) ? moveSec : stopSec;
}

export function parseMetaVersion(html: string): string | null {
  const m = html.match(/<meta\s+name=["']version["']\s+content=["']([^"']+)["']/i);
  return m?.[1] ?? null;
}

type Pending = {
  resolve: (v: { id: number; type: string; data: Record<string, unknown> }) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
  type: string;
};

export interface EmtrackSessionOptions {
  login: string;
  password: string;
  auth?: EmtrackAuthType;
  lang?: string;
  wsUrl?: string;
  userAgent?: string;
  timeoutMs?: number;
  WebSocketImpl?: typeof WebSocket;
}

/**
 * Jedna sesja WS: SELECT_PROTOCOL → LOGIN → GET_TRACKING_OBJECTS → LOGOUT.
 * Zwraca listę obiektów + log typów wysłanych ramek (bez sekretów).
 */
export async function fetchTrackingObjectsReadOnly(
  opts: EmtrackSessionOptions,
): Promise<{ objects: EmtrackObjectFix[]; sentLog: EmtrackSentFrameLog[]; loginOk: boolean }> {
  const WS = opts.WebSocketImpl ?? WebSocket;
  const url = opts.wsUrl ?? EMTRACK_WS_URL;
  const ua = opts.userAgent ?? EMTRACK_UA;
  const timeoutMs = opts.timeoutMs ?? 25000;
  const auth = opts.auth ?? 'INTERNAL';
  const sentLog: EmtrackSentFrameLog[] = [];
  let frameId = 1;
  const pending = new Map<number, Pending>();

  const ws = new WS(url, { headers: { 'User-Agent': ua, Origin: 'https://emtrack.eu' } } as unknown as string);

  const close = () => {
    try { ws.close(); } catch { /* ignore */ }
  };

  const send = (type: string, data: Record<string, unknown>) =>
    new Promise<{ id: number; type: string; data: Record<string, unknown> }>((resolve, reject) => {
      const id = frameId++;
      sentLog.push({ t: new Date().toISOString(), type, id, dataKeys: Object.keys(data) });
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`timeout ${type}`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer, type });
      ws.send(JSON.stringify({ id, type, data }));
    });

  const onMessage = (raw: MessageEvent | string | ArrayBuffer) => {
    const text = typeof raw === 'string'
      ? raw
      : raw instanceof MessageEvent
        ? String(raw.data)
        : new TextDecoder().decode(raw as ArrayBuffer);
    let msg: { id?: number; type: string; data?: Record<string, unknown> };
    try { msg = JSON.parse(text); } catch { return; }
    if (msg.id != null && pending.has(msg.id)) {
      const p = pending.get(msg.id)!;
      clearTimeout(p.timer);
      pending.delete(msg.id);
      p.resolve({ id: msg.id, type: msg.type, data: msg.data ?? {} });
      return;
    }
    for (const [id, p] of pending) {
      const t = String(msg.type || '');
      if (
        (p.type === 'SELECT_PROTOCOL' && t.includes('PROTOCOL')) ||
        (p.type === 'LOGIN' && (t.includes('LOGIN') || t.includes('ERROR'))) ||
        (p.type === 'GET_TRACKING_OBJECTS' && (t.includes('TRACKING') || t.includes('ERROR') || t === 'ACK')) ||
        (p.type === 'LOGOUT' && (t.includes('LOGOUT') || t === 'ACK' || t.includes('ERROR')))
      ) {
        clearTimeout(p.timer);
        pending.delete(id);
        p.resolve({ id: msg.id ?? id, type: msg.type, data: msg.data ?? {} });
        break;
      }
    }
  };

  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('ws open timeout')), timeoutMs);
    ws.onopen = () => { clearTimeout(t); resolve(); };
    ws.onerror = () => { clearTimeout(t); reject(new Error('ws error')); };
    // Deno / browser
    (ws as unknown as { addEventListener?: (e: string, fn: (ev: MessageEvent) => void) => void }).addEventListener?.(
      'message',
      onMessage as (ev: MessageEvent) => void,
    );
    (ws as unknown as { onmessage?: (ev: MessageEvent) => void }).onmessage = onMessage as (ev: MessageEvent) => void;
  });

  try {
    const proto = await send('SELECT_PROTOCOL', { version: 'MTRACK_WWW', compression: null });
    if (String((proto.data as { protocol?: string }).protocol) !== 'accepted') {
      throw new Error('protocol not accepted');
    }
    const login = await send('LOGIN', {
      auth,
      username: opts.login,
      password: opts.password,
      lang: opts.lang ?? 'pl',
    });
    const loginOk = login.type === 'LOGIN_RESPONSE' && !!(login.data as { sessionId?: string }).sessionId;
    if (!loginOk) {
      return { objects: [], sentLog, loginOk: false };
    }
    const objs = await send('GET_TRACKING_OBJECTS', { trackingObjectIds: [] });
    const list = (objs.data as { trackingObjects?: unknown[] }).trackingObjects;
    const objects = Array.isArray(list)
      ? list.map((o) => parseCurrentSnapshot(o as Parameters<typeof parseCurrentSnapshot>[0]))
      : [];
    try { await send('LOGOUT', {}); } catch { /* ignore */ }
    return { objects, sentLog, loginOk: true };
  } finally {
    close();
  }
}
