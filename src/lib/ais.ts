/** AISStream — browser talks ONLY to local proxy. Never put AISSTREAM_API_KEY in client. */
import { FERRY_VESSELS, type FerryVesselId } from './ferry';

export interface AisPosition {
  mmsi: string;
  vesselId: FerryVesselId;
  name: string;
  lng: number;
  lat: number;
  sog?: number;
  cog?: number;
  ts: string;
  source: 'live' | 'seed';
}

const MMSI_TO_ID: Record<string, FerryVesselId> = {
  '311852000': 'WAW',
  '311000787': 'NS',
};

export function seedAisPositions(): AisPosition[] {
  return FERRY_VESSELS.map((v) => ({
    mmsi: v.mmsi,
    vesselId: v.id,
    name: v.name,
    lng: v.seedPosition.lng,
    lat: v.seedPosition.lat,
    sog: v.id === 'WAW' ? 16.2 : 0,
    cog: v.id === 'WAW' ? 8 : 180,
    ts: new Date().toISOString(),
    source: 'seed' as const,
  }));
}

export type AisMode = 'live' | 'seed';

/**
 * Connect to local AIS proxy (`ws://host:4175/ais` or Vite-proxied `/ais-ws`).
 * On failure → seed positions.
 */
export function subscribeAis(opts: {
  onUpdate: (positions: AisPosition[], mode: AisMode) => void;
  url?: string;
}): () => void {
  const seed = seedAisPositions();
  opts.onUpdate(seed, 'seed');

  const proto = typeof location !== 'undefined' && location.protocol === 'https:' ? 'wss' : 'ws';
  const host = typeof location !== 'undefined' ? location.hostname : 'localhost';
  const url =
    opts.url ??
    (import.meta.env.VITE_AIS_WS_URL as string | undefined) ??
    `${proto}://${host}:4175/ais`;

  let ws: WebSocket | null = null;
  let closed = false;
  const byMmsi: Record<string, AisPosition> = Object.fromEntries(seed.map((p) => [p.mmsi, p]));

  try {
    ws = new WebSocket(url);
  } catch {
    return () => {
      closed = true;
    };
  }

  ws.onopen = () => {
    // proxy injects API key; client only sends interest filter ack
    ws?.send(JSON.stringify({ type: 'hello', client: 'watch-tower' }));
  };

  ws.onmessage = (ev) => {
    try {
      const msg = JSON.parse(String(ev.data));
      if (msg.type === 'status' && msg.mode === 'seed') {
        opts.onUpdate(Object.values(byMmsi), 'seed');
        return;
      }
      // AISStream PositionReport shape (proxied)
      const meta = msg.MetaData ?? msg.meta ?? {};
      const mmsi = String(meta.MMSI ?? meta.mmsi ?? msg.mmsi ?? '');
      const report = msg.Message?.PositionReport ?? msg.PositionReport ?? msg.position;
      if (!mmsi || !report) return;
      const lat = Number(report.Latitude ?? report.lat);
      const lng = Number(report.Longitude ?? report.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const vesselId = MMSI_TO_ID[mmsi];
      if (!vesselId) return;
      const v = FERRY_VESSELS.find((x) => x.id === vesselId)!;
      byMmsi[mmsi] = {
        mmsi,
        vesselId,
        name: v.name,
        lng,
        lat,
        sog: report.Sog ?? report.sog,
        cog: report.Cog ?? report.cog,
        ts: new Date().toISOString(),
        source: 'live',
      };
      opts.onUpdate(Object.values(byMmsi), 'live');
    } catch {
      /* ignore malformed */
    }
  };

  ws.onerror = () => {
    opts.onUpdate(Object.values(byMmsi), 'seed');
  };
  ws.onclose = () => {
    if (!closed) opts.onUpdate(Object.values(byMmsi), 'seed');
  };

  return () => {
    closed = true;
    ws?.close();
  };
}
