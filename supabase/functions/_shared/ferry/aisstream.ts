/**
 * AIS-SRC — odczyt aisstream.io (WebSocket), wyłącznie MMSI z allow.
 * Subskrypcja: bbox Bałtyku + FiltersShipMMSI (MMSI jako tekst) + typy pozycji.
 * Filtr jest też po naszej stronie: ramka spoza listy nie staje się pozycją.
 * Jedno połączenie, jeden limit czasu, bez pętli ponowień. Klucz nie wchodzi do błędów ani logów.
 *
 * AIS-POLF (05.10): aisstream wysyła ramki BINARNE. W Deno (funkcja Edge) `ev.data` to wtedy Blob,
 * a `String(Blob)` = "[object Blob]" — każda ramka ginęła w JSON.parse. Teraz binaryType = arraybuffer
 * i dekodowanie UTF-8. Czas `time_utc` ("2026-10-05 05:19:10.554119198 +0000 UTC") parsowany jawnie, bez zależności od Date.parse.
 */
import type { VesselFix } from './digitraffic.ts';

export const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream';
/** Porty Gdańsk, Gdynia, Karlskrona, Nynäshamn i morze między nimi. */
export const BALTIC_BBOX: [[number, number], [number, number]] = [[54.0, 15.2], [59.3, 19.9]];
export const AIS_POSITION_TYPES = ['PositionReport', 'StandardClassBPositionReport', 'ExtendedClassBPositionReport'] as const;

/** "2026-10-05 05:19:10.554119198 +0000 UTC" albo ISO → ISO UTC (ms). Nieczytelny → null. */
export function parseAisTimeUtc(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const m = raw.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d+))?\s*(?:([+-]\d{2}):?(\d{2}))?/);
  if (m) {
    const ms = (m[3] ?? '').padEnd(3, '0').slice(0, 3);
    const off = m[4] != null ? `${m[4]}:${m[5]}` : 'Z';
    const t = Date.parse(`${m[1]}T${m[2]}.${ms}${off}`);
    if (Number.isFinite(t)) return new Date(t).toISOString();
  }
  const t = Date.parse(raw);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** Ramka WebSocket → tekst. Obsługuje tekst, ArrayBuffer, widok bajtów i Blob. */
export async function decodeAisFrame(data: unknown): Promise<string | null> {
  if (typeof data === 'string') return data;
  const dec = new TextDecoder('utf-8');
  if (data instanceof ArrayBuffer) return dec.decode(new Uint8Array(data));
  if (ArrayBuffer.isView(data)) return dec.decode(data as ArrayBufferView);
  if (data && typeof (data as Blob).arrayBuffer === 'function') {
    return dec.decode(new Uint8Array(await (data as Blob).arrayBuffer()));
  }
  return null;
}

/** Jedna wiadomość aisstream → pozycja (albo null: obcy MMSI, nie pozycja, błąd). */
export function parseAisstreamMessage(text: string, allow: ReadonlySet<string>, nowIso: string): VesselFix | null {
  let msg: unknown;
  try { msg = JSON.parse(text); } catch { return null; }
  if (!msg || typeof msg !== 'object') return null;
  const meta = (msg as { MetaData?: Record<string, unknown> }).MetaData ?? {};
  const mmsiStr = String(meta.MMSI ?? '').trim();
  if (!allow.has(mmsiStr)) return null;
  const type = String((msg as { MessageType?: unknown }).MessageType ?? '');
  const body = (msg as { Message?: Record<string, Record<string, unknown> | undefined> }).Message ?? {};
  const report = (AIS_POSITION_TYPES as readonly string[]).includes(type)
    ? body[type]
    : body.PositionReport ?? body.StandardClassBPositionReport ?? body.ExtendedClassBPositionReport;
  if (!report) return null;
  const lat = Number(report.Latitude);
  const lon = Number(report.Longitude);
  const mmsi = Number(mmsiStr);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(mmsi)) return null;
  // AIS: 91 / 181 = brak pozycji
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const sog = Number(report.Sog);
  const cog = Number(report.Cog);
  const nav = Number(report.NavigationalStatus);
  return {
    mmsi, lat, lon,
    sogKn: Number.isFinite(sog) && sog < 102.3 ? sog : null,
    cog: Number.isFinite(cog) && cog < 360 ? cog : null,
    navStat: Number.isFinite(nav) ? nav : null,
    timestampUtc: parseAisTimeUtc(meta.time_utc) ?? nowIso,
    source: 'AISSTREAM',
  };
}

export interface AisstreamStats {
  opened: boolean;
  frames: number;
  firstFrameMs: number | null;
  error: string | null;
}

export async function collectAisstreamFixes(
  apiKey: string,
  allowMmsi: readonly string[],
  timeoutMs = 8000,
  opts: { stopWhenAllSeen?: boolean; stats?: AisstreamStats; WebSocketImpl?: typeof WebSocket } = {},
): Promise<VesselFix[]> {
  if (!apiKey) return [];
  const allow = new Set(allowMmsi.map((m) => String(m).trim()));
  const by = new Map<number, VesselFix>();
  const stats = opts.stats ?? { opened: false, frames: 0, firstFrameMs: null, error: null };
  const t0 = Date.now();
  const Impl = opts.WebSocketImpl ?? WebSocket;
  const ws = new Impl(AISSTREAM_URL);
  try { (ws as { binaryType: string }).binaryType = 'arraybuffer'; } catch { /* starsze środowiska */ }
  let settled = false;
  await new Promise<void>((resolve, reject) => {
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch { /* już zamknięty */ }
      if (err) reject(err); else resolve();
    };
    const timer = setTimeout(() => finish(), timeoutMs);
    ws.onopen = () => {
      stats.opened = true;
      ws.send(JSON.stringify({
        APIKey: apiKey,
        BoundingBoxes: [BALTIC_BBOX],
        FiltersShipMMSI: [...allow],
        FilterMessageTypes: [...AIS_POSITION_TYPES],
      }));
    };
    ws.onmessage = async (ev: MessageEvent) => {
      stats.frames++;
      if (stats.firstFrameMs == null) stats.firstFrameMs = Date.now() - t0;
      const text = await decodeAisFrame(ev.data);
      if (!text) return;
      if (text.includes('"error"')) {
        try {
          const e = JSON.parse(text) as { error?: unknown };
          if (e.error) { stats.error = 'aisstream odrzucił subskrypcję'; finish(new Error(stats.error)); return; }
        } catch { /* nie błąd */ }
      }
      const fix = parseAisstreamMessage(text, allow, new Date().toISOString());
      if (!fix) return;
      const prev = by.get(fix.mmsi);
      if (!prev || Date.parse(fix.timestampUtc) >= Date.parse(prev.timestampUtc)) by.set(fix.mmsi, fix);
      if (opts.stopWhenAllSeen && by.size >= allow.size) finish();
    };
    ws.onerror = () => { stats.error = 'aisstream niedostępne'; finish(new Error('aisstream niedostępne')); };
    ws.onclose = () => finish();
  });
  return [...by.values()];
}
