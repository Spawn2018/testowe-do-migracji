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

/** AUD-01b: funkcje Edge w regionie bazy (eu-west-1), nie w regionie najbliższym przeglądarce. */
export const FUNCTION_REGION = 'eu-west-1';

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

/** AUD-01c: region funkcji kafelków — Frankfurt (eu-central-1); Vercel `api/tiles` w fra1. */
export const TILE_REGION = 'eu-central-1';
export const HERE_STYLE = { light: 'logistics.day', dark: 'logistics.night' } as const;

/**
 * AUD-01c: kafelki HERE są publiczne (decyzja właściciela 06.10) — zwykły `<img>` bez nagłówków i bez sesji, z adresu
 * `/tiles/logistics.day|logistics.night/<z>/<x>/<y>` na domenie aplikacji (Vercel `api/tiles` → `here-raster`,
 * pamięć brzegu Vercel). Lokalnie (localhost, podgląd) albo na hostingu bez `/tiles` — wprost do funkcji.
 */
export function tileTemplate(
  theme: 'light' | 'dark',
  host: string = typeof location !== 'undefined' ? location.hostname : '',
): { url: string; viaEdge: boolean } {
  const style = HERE_STYLE[theme];
  const local = !host || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  if (!local && !edgeMissing) return { url: `/tiles/${style}/{z}/{x}/{y}`, viaEdge: true };
  return {
    url: `${SUPABASE_URL}/functions/v1/here-raster?style=${style}&z={z}&x={x}&y={y}&forceFunctionRegion=${TILE_REGION}`,
    viaEdge: false,
  };
}

/** Adres jednego kafelka (testy, sonda). */
export function tileUrl(
  coords: { z: number; x: number; y: number },
  theme: 'light' | 'dark',
  host?: string,
): { url: string; viaEdge: boolean } {
  const t = tileTemplate(theme, host);
  return { url: t.url.replace('{z}', String(coords.z)).replace('{x}', String(coords.x)).replace('{y}', String(coords.y)), viaEdge: t.viaEdge };
}

/**
 * Hosting zapasowy bez `/tiles` (PR8: Cloudflare Pages) odpowiada 404/HTML — wtedy do końca strony kafelki idą
 * wprost do funkcji.
 */
let edgeMissing = false;
export function __setEdgeMissing(v: boolean): void { edgeMissing = v; }

/**
 * Sonda po błędzie kafelka (najwyżej jedna naraz): 409 = budżet D-78 zamknięty → `onClosed` (zapas do końca sesji);
 * 404 bez obrazu z `/tiles` → hosting bez przepisania → wprost do funkcji.
 */
export async function probeTileError(
  url: string,
  viaEdge: boolean,
  fetcher: typeof fetch = fetch,
): Promise<'closed' | 'edge-missing' | 'other'> {
  try {
    const res = await fetcher(url, { cache: 'no-store' });
    if (res.status === 409) return 'closed';
    const type = res.headers.get('content-type') ?? '';
    if (viaEdge && res.status === 404 && !type.startsWith('application/json') && !type.startsWith('image/')) return 'edge-missing';
    return 'other';
  } catch {
    return 'other';
  }
}

/** Leaflet TileLayer z kafelkiem HERE przez funkcję, bez klucza i bez sesji w przeglądarce. */
export function hereRasterLayer(choice: BasemapChoice, onClosed: () => void): L.TileLayer {
  const theme = choice.theme === 'dark' ? 'dark' : 'light';
  const first = tileTemplate(theme);
  const layer = L.tileLayer(first.url, { attribution: choice.attribution, maxZoom: choice.maxZoom, tileSize: 256 });
  let probing = false;
  let closed = false;
  layer.on('tileerror', (e: L.TileErrorEvent) => {
    if (probing || closed) return;
    probing = true;
    const t = tileTemplate(theme);
    const url = tileUrl(e.coords, theme).url;
    void probeTileError(url, t.viaEdge).then((r) => {
      probing = false;
      if (r === 'closed') {
        closed = true;
        rememberTilesOff();
        onClosed();
      } else if (r === 'edge-missing') {
        edgeMissing = true;
        layer.setUrl(tileTemplate(theme).url);
      }
    });
  });
  return layer;
}

/** Podkład zapasowy (bez HERE, bez klucza). AUD-01c: ciemny = Esri World_Street_Map z filtrem ciemnym (CARTO wymaga dziś klucza). */
export function fallbackTileLayer(choice: BasemapChoice): L.TileLayer {
  return L.tileLayer(choice.url ?? '', {
    attribution: choice.attribution,
    maxZoom: choice.maxZoom,
    ...(choice.maxNativeZoom ? { maxNativeZoom: choice.maxNativeZoom } : {}),
    ...(choice.className ? { className: choice.className } : {}),
  });
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
    : fallbackTileLayer(choice);
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
    await fetch(`${SUPABASE_URL}/functions/v1/here-roads?forceFunctionRegion=${FUNCTION_REGION}`, {
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

