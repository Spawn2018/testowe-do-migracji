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

/**
 * AUD-01: jeden odczyt `map_display_state` na stronę (TTL 60 s) — wspólny dla podkładu i geometrii trasy.
 * Wcześniej dwa osobne wywołania przy każdym zamontowaniu mapy.
 */
type DisplayState = { tiles_open?: boolean; month?: string; roads?: unknown } | null;
let displayState: { at: number; p: Promise<DisplayState> } | null = null;
export function readMapDisplayState(force = false): Promise<DisplayState> {
  const now = Date.now();
  if (!force && displayState && now - displayState.at < 60_000) return displayState.p;
  const p = (async (): Promise<DisplayState> => {
    try {
      const { getSupabase } = await import('../../auth/client');
      const sb = await getSupabase();
      const { data, error } = await sb.rpc('map_display_state');
      return error ? null : (data as DisplayState);
    } catch {
      return null;
    }
  })();
  displayState = { at: now, p };
  return p;
}

/**
 * AUD-01: podkład bez czekania na bazę. Budżet D-78 sprawdza funkcja `here-raster` przy każdym pobraniu z HERE
 * (409 = zamknięty → `onClosed` przełącza na podkład zapasowy i zapamiętuje to do końca sesji), więc przeglądarka
 * nie odpytuje `map_display_state` przed pierwszym kafelkiem.
 */
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
  return basemapFor({ theme, spentUsd: 0, spentMonth: `${warsawMonth(now)}-01`, now, allowHere: true });
}

/**
 * AUD-01: kafelki HERE przez `/tiles/<motyw>/<z>/<x>/<y>` na domenie aplikacji (Vercel) — przepisanie do funkcji
 * `here-raster` z pamięcią podręczną na brzegu Vercel. Kafelek trafia na inne połączenie niż dane (Supabase) i po
 * pierwszym pobraniu jest serwowany z brzegu bez wywołania HERE. Token sesji idzie w `x-wt-token`, nie w
 * `Authorization` (żądanie z `Authorization` Vercel zawsze pomija pamięć). Lokalnie (localhost, podgląd) — wprost
 * do funkcji.
 */
export function tileUrl(
  coords: { z: number; x: number; y: number },
  theme: 'light' | 'dark',
  host: string = typeof location !== 'undefined' ? location.hostname : '',
): { url: string; viaEdge: boolean } {
  const local = !host || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  if (!local) return { url: `/tiles/${theme}/${coords.z}/${coords.x}/${coords.y}`, viaEdge: true };
  return {
    url: `${SUPABASE_URL}/functions/v1/here-raster?z=${coords.z}&x=${coords.x}&y=${coords.y}&theme=${theme}`,
    viaEdge: false,
  };
}

let tokenCache: { at: number; token: string | null } | null = null;
async function sessionToken(): Promise<string | null> {
  const now = Date.now();
  if (tokenCache && now - tokenCache.at < 30_000) return tokenCache.token;
  const { getSupabase } = await import('../../auth/client');
  const sb = await getSupabase();
  const { data } = await sb.auth.getSession();
  tokenCache = { at: now, token: data.session?.access_token ?? null };
  return tokenCache.token;
}

/** Leaflet GridLayer z kafelkiem HERE przez funkcję, bez klucza w przeglądarce. */
export function hereRasterLayer(choice: BasemapChoice, onClosed: () => void): L.GridLayer {
  const Grid = L.GridLayer.extend({
    createTile(coords: L.Coords, done: (err: Error | undefined, tile: HTMLElement) => void) {
      const img = document.createElement('img');
      img.alt = '';
      img.width = 256;
      img.height = 256;
      const { url, viaEdge } = tileUrl(coords, choice.theme === 'dark' ? 'dark' : 'light');
      void (async () => {
        try {
          const token = await sessionToken();
          if (!token) {
            rememberTilesOff();
            onClosed();
            done(new Error('brak sesji'), img);
            return;
          }
          const headers: Record<string, string> = viaEdge
            ? { 'x-wt-token': token }
            : { Authorization: `Bearer ${token}`, apikey: SUPABASE_ANON_KEY, 'x-wt-token': token };
          const res = await fetch(url, { headers });
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
    const read = async (force = false) => acceptedRoads((await readMapDisplayState(force))?.roads);
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
    lines = await read(true);
    return lines;
  } catch {
    return [];
  }
}

