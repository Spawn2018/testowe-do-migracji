/**
 * AIS-SRC — krótki odczyt aisstream.io (WebSocket), wyłącznie MMSI z allow.
 * Filtr jest po naszej stronie: ramka spoza listy nie staje się pozycją.
 * Jedno połączenie, jeden limit czasu, bez pętli ponowień.
 * Klucz nie wchodzi do błędów ani logów.
 */
import type { VesselFix } from './digitraffic.ts';

export const AISSTREAM_URL = 'wss://stream.aisstream.io/v0/stream';
/** Porty Gdańsk, Gdynia, Karlskrona, Nynäshamn i morze między nimi. */
export const BALTIC_BBOX: [[number, number], [number, number]] = [[54.0, 15.2], [59.3, 19.9]];

export async function collectAisstreamFixes(
  apiKey: string,
  allowMmsi: readonly string[],
  timeoutMs = 8000,
): Promise<VesselFix[]> {
  if (!apiKey) return [];
  const allow = new Set(allowMmsi);
  const by = new Map<number, VesselFix>();
  const ws = new WebSocket(AISSTREAM_URL);
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
      ws.send(JSON.stringify({
        APIKey: apiKey,
        BoundingBoxes: [BALTIC_BBOX],
        FilterMessageTypes: ['PositionReport'],
      }));
    };
    ws.onmessage = (ev: MessageEvent) => {
      let msg: unknown;
      try { msg = JSON.parse(String(ev.data)); } catch { return; }
      if (!msg || typeof msg !== 'object') return;
      const meta = (msg as { MetaData?: Record<string, unknown> }).MetaData ?? {};
      const mmsiStr = String(meta.MMSI ?? '');
      if (!allow.has(mmsiStr)) return;
      const report = (msg as { Message?: { PositionReport?: Record<string, unknown> } }).Message?.PositionReport;
      if (!report) return;
      const lat = Number(report.Latitude);
      const lon = Number(report.Longitude);
      const mmsi = Number(mmsiStr);
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(mmsi)) return;
      const timeRaw = meta.time_utc;
      const ts = typeof timeRaw === 'string' && Number.isFinite(Date.parse(timeRaw))
        ? new Date(timeRaw).toISOString()
        : new Date().toISOString();
      const sog = Number(report.Sog);
      const cog = Number(report.Cog);
      const nav = Number(report.NavigationalStatus);
      const fix: VesselFix = {
        mmsi, lat, lon,
        sogKn: Number.isFinite(sog) ? sog : null,
        cog: Number.isFinite(cog) ? cog : null,
        navStat: Number.isFinite(nav) ? nav : null,
        timestampUtc: ts,
        source: 'AISSTREAM',
      };
      const prev = by.get(mmsi);
      if (!prev || Date.parse(fix.timestampUtc) >= Date.parse(prev.timestampUtc)) by.set(mmsi, fix);
    };
    ws.onerror = () => finish(new Error('aisstream niedostępne'));
    ws.onclose = () => finish();
  });
  return [...by.values()];
}
