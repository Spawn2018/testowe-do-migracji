import L from 'leaflet';
import { SUPABASE_ANON_KEY, SUPABASE_AUTH_ENABLED, SUPABASE_URL } from '../../auth/config';
import {
  ROAD_PL,
  ROAD_SE,
  basemapFor,
  looseRoadOk,
  roadGeometryOk,
  warsawMonth,
  type BasemapChoice,
  type LatLng,
  type ThemeName,
} from '../../lib/map/draw';

const offKey = () => `wt-here-tiles-off-${warsawMonth(new Date())}`;

function rememberTilesOff(): void {
  try { sessionStorage.setItem(offKey(), '1'); } catch { /* prywatny tryb */ }
}

function tilesForcedOff(): boolean {
  try { return sessionStorage.getItem(offKey()) === '1'; } catch { return false; }
}

export async function resolveBasemap(theme: ThemeName): Promise<BasemapChoice> {
  const now = new Date();
  const closed = basemapFor({
    theme,
    spentUsd: 80,
    spentMonth: `${warsawMonth(now)}-01`,
    now,
    allowHere: false,
  });
  if (!SUPABASE_AUTH_ENABLED || tilesForcedOff()) return closed;
  try {
    const { getSupabase } = await import('../../auth/client');
    const sb = await getSupabase();
    const { data, error } = await sb.rpc('map_display_state');
    const row = data as { tiles_open?: boolean; month?: string } | null;
    if (error || !row || row.tiles_open !== true) return closed;
    return basemapFor({
      theme,
      spentUsd: 0,
      spentMonth: String(row.month ?? ''),
      now,
      allowHere: true,
    });
  } catch {
    return closed;
  }
}

/** Leaflet GridLayer z kafelkiem HERE przez funkcję, bez klucza w przeglądarce. */
export function hereRasterLayer(choice: BasemapChoice, onClosed: () => void): L.GridLayer {
  const Grid = L.GridLayer.extend({
    createTile(coords: L.Coords, done: (err: Error | undefined, tile: HTMLElement) => void) {
      const img = document.createElement('img');
      img.alt = '';
      img.width = 256;
      img.height = 256;
      const url = `${SUPABASE_URL}/functions/v1/here-raster?z=${coords.z}&x=${coords.x}&y=${coords.y}&theme=${choice.theme}`;
      void (async () => {
        try {
          const { getSupabase } = await import('../../auth/client');
          const sb = await getSupabase();
          const { data } = await sb.auth.getSession();
          const token = data.session?.access_token;
          if (!token) {
            rememberTilesOff();
            onClosed();
            done(new Error('brak sesji'), img);
            return;
          }
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY },
          });
          if (res.status === 409) {
            rememberTilesOff();
            onClosed();
            done(new Error('budzet'), img);
            return;
          }
          if (!res.ok) {
            done(new Error('kafel'), img);
            return;
          }
          const blob = await res.blob();
          img.onload = () => done(undefined, img);
          img.onerror = () => done(new Error('obraz'), img);
          img.src = URL.createObjectURL(blob);
        } catch {
          done(new Error('siec'), img);
        }
      })();
      return img;
    },
  });
  const Ctor = Grid as new (opts: L.GridLayerOptions) => L.GridLayer;
  return new Ctor({ attribution: choice.attribution, maxZoom: choice.maxZoom, tileSize: 256 });
}

export async function applyBasemap(
  map: L.Map,
  prev: L.Layer | null,
  theme: ThemeName,
  onClosed: () => void,
): Promise<L.Layer> {
  const choice = await resolveBasemap(theme);
  if (prev && map.hasLayer(prev)) map.removeLayer(prev);
  map.setMaxZoom(choice.maxZoom);
  const layer = choice.hereRequests
    ? hereRasterLayer(choice, onClosed)
    : L.tileLayer(choice.url ?? '', {
        attribution: choice.attribution,
        maxZoom: choice.maxZoom,
        subdomains: 'abcd',
      });
  layer.addTo(map);
  const el = map.getContainer();
  el.dataset.basemap = choice.provider;
  el.dataset.hereRequests = choice.hereRequests ? '1' : '0';
  el.dataset.h6 = 'off';
  return layer;
}

const SPEC: Record<string, typeof ROAD_PL | 'loose'> = {
  'PL-GDN': ROAD_PL,
  'SE-NYN': ROAD_SE,
  'PL-GDY': 'loose',
  'SE-KAA': 'loose',
};

export function acceptedRoads(rows: unknown): LatLng[][] {
  if (!Array.isArray(rows)) return [];
  const out: LatLng[][] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const leg = String((row as { leg?: string }).leg ?? '');
    const spec = SPEC[leg];
    const points = (row as { points?: unknown }).points;
    if (!spec || !Array.isArray(points)) continue;
    const line: LatLng[] = [];
    for (const p of points) {
      if (!Array.isArray(p) || p.length < 2) continue;
      const lat = Number(p[0]);
      const lng = Number(p[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) line.push([lat, lng]);
    }
    const ok = spec === 'loose' ? looseRoadOk(line) : roadGeometryOk(line, spec);
    if (ok) out.push(line);
  }
  return out;
}

export async function loadRoadLines(): Promise<LatLng[][]> {
  if (!SUPABASE_AUTH_ENABLED) return [];
  try {
    const { getSupabase } = await import('../../auth/client');
    const sb = await getSupabase();
    const read = async () => {
      const res = await sb.rpc('map_display_state');
      const data = res.data as { roads?: unknown; tiles_open?: boolean } | null;
      return acceptedRoads(data?.roads);
    };
    let lines = await read();
    if (lines.length >= 2) return lines;
    const { data } = await sb.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return lines;
    await fetch(`${SUPABASE_URL}/functions/v1/here-roads`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: '{}',
    });
    lines = await read();
    return lines;
  } catch {
    return [];
  }
}

