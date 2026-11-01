/** AISStream — browser talks ONLY to local proxy. Never put AISSTREAM_API_KEY in client. */
import { FERRY_VESSELS, type FerryVesselId } from './ferry';
import type { FerryVoyage } from './bn9c2Ferry';

export interface AisPosition {
  mmsi: string;
  /** Demo: WAW/NS. Produkcja (aisDb): `vessels.id` (uuid) — bez podstawiania FERRY_VESSELS[0]. */
  vesselId: string;
  name: string;
  lng: number;
  lat: number;
  sog?: number;
  cog?: number;
  ts: string;
  source: 'live' | 'seed' | 'db';
  /** #429 C: pozycja szacowana z rozkładu (AIS starszy niż 30 min); `lastAisTs` = ostatni sygnał AIS albo null. */
  estimated?: { lastAisTs: string | null };
  /** BN9-c2: trwający albo najbliższy rejs statku z `ferry_sailings_map` (trasa w dymku, kierunek bez COG). */
  voyage?: FerryVoyage;
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

export type AisMode = 'live' | 'seed' | 'db' | 'none';

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

const PROD_HUB: {
  subs: Set<(positions: AisPosition[], mode: AisMode) => void>;
  last: AisPosition[] | null;
  stop: (() => void) | null;
  started: boolean;
  gen: number;
} = { subs: new Set(), last: null, stop: null, started: false, gen: 0 };

/**
 * I-2j — jedno wejście dla mapy: produkcja → pozycje z bazy (`vessel_positions`, tryb 'db' albo 'none'),
 * demo → proxy AISStream / pozycje przykładowe (bez zmian). Moduł bazy ładowany leniwie tylko w produkcji.
 */
export function subscribeFerryPositions(opts: {
  prod: boolean;
  onUpdate: (positions: AisPosition[], mode: AisMode) => void;
}): () => void {
  // warunek kompilacji (VITE_AUTH_MODE) — paczka demo nie zawiera modułu bazy ani klienta Supabase
  if (import.meta.env.VITE_AUTH_MODE === 'supabase' && opts.prod) {
    /* BN9-c2: jedno odpytywanie bazy na wszystkich odbiorców (mapa, widok mapy, pasek „Na promie” w karcie) —
       kolejny odbiorca dostaje ostatni wynik od razu, bez dodatkowego zapytania. */
    const hub = PROD_HUB;
    hub.subs.add(opts.onUpdate);
    if (hub.last) opts.onUpdate(hub.last, hub.last.length ? 'db' : 'none');
    else opts.onUpdate([], 'none');
    if (!hub.started) {
      hub.started = true;
      const gen = ++hub.gen;
      void import('./aisDb').then(({ subscribeAisDb }) => {
        if (gen !== hub.gen || !hub.subs.size) return;
        hub.stop = subscribeAisDb((pos) => {
          hub.last = pos;
          /* błąd jednego odbiorcy nie odbiera danych pozostałym */
          for (const cb of [...hub.subs]) {
            try { cb(pos, pos.length ? 'db' : 'none'); } catch { /* odbiorca sam obsługuje swoje błędy */ }
          }
        });
      }).catch(() => {
        /* moduł bazy się nie wczytał (np. sieć) — kolejny odbiorca spróbuje ponownie */
        if (gen === hub.gen) hub.started = false;
      });
    }
    return () => {
      hub.subs.delete(opts.onUpdate);
      if (hub.subs.size) return;
      hub.stop?.();
      hub.stop = null;
      hub.last = null;
      hub.started = false;
      hub.gen += 1;
    };
  }
  return subscribeAis({ onUpdate: opts.onUpdate });
}

/** Najnowszy czas sygnału spośród pozycji (null = brak). */
export function latestReadAt(pos: readonly AisPosition[]): string | null {
  let best: string | null = null;
  for (const p of pos) if (!best || Date.parse(p.ts) > Date.parse(best)) best = p.ts;
  return best;
}
