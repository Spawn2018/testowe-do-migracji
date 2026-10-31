import L from 'leaflet';
import { SUPABASE_ANON_KEY, SUPABASE_AUTH_ENABLED, SUPABASE_URL } from '../../auth/config';
import {
  ROAD_PL,
  ROAD_SE,
  ROAD_KAA,
  ROAD_KAA_E22,
  basemapFor,
  looseRoadOk,
  roadGeometryOk,
  warsawMonth,
  type BasemapChoice,
  type LatLng,
  type RoadSpec,
  type ThemeName,
} from '../../lib/map/draw';
import { HERE_BROWSER_KEY, directTileTemplate, servedFromCache, sharedTileMeter } from './hereTileMeter';
import { checkFerries, ferrySummary, type FerryLeg } from '../../lib/map/ferryLines';
import { TILE_LANG } from '../../../supabase/functions/_shared/map/tilePolicy';

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
type DisplayState = { tiles_open?: boolean; month?: string; roads?: unknown; ferries?: unknown } | null;
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
 * AUD-01c/01d (ZAPAS, gdy brak klucza przeglądarkowego): zwykły `<img>` bez nagłówków i bez sesji, z adresu
 * `/tiles/logistics.day|logistics.night/<z>/<x>/<y>` na domenie aplikacji (Vercel `api/tiles` → `here-raster`,
 * bez wspólnej pamięci brzegu — `private`). Lokalnie (localhost, podgląd) albo na hostingu bez `/tiles` — wprost do funkcji.
 */
export function tileTemplate(
  theme: 'light' | 'dark',
  host: string = typeof location !== 'undefined' ? location.hostname : '',
): { url: string; viaEdge: boolean } {
  const style = HERE_STYLE[theme];
  const local = !host || host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
  /* AUD-04: `lang=pl` także w adresie zapasu — nowy klucz pamięci przeglądarki (stare kafelki bez polskiego nie wracają) */
  if (!local && !edgeMissing) return { url: `/tiles/${style}/{z}/{x}/{y}?lang=${TILE_LANG}`, viaEdge: true };
  return {
    url: `${SUPABASE_URL}/functions/v1/here-raster?style=${style}&z={z}&x={x}&y={y}&lang=${TILE_LANG}&forceFunctionRegion=${TILE_REGION}`,
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

/** AUD-01d: po 3 błędach kafelków HERE wprost (np. zła domena klucza) — do końca strony pośrednik `/tiles`. */
let directFailed = false;
export function __setDirectFailed(v: boolean): void { directFailed = v; }
export function directTilesOn(key: string = HERE_BROWSER_KEY): boolean { return !!key && !directFailed; }

/**
 * Leaflet TileLayer HERE. AUD-01d: z kluczem przeglądarkowym (`VITE_HERE_BROWSER_KEY`) — wprost z maps.hereapi.com,
 * licznik D-78 w przeglądarce; bez klucza — pośrednik `/tiles` (zapas, licznik po stronie `here-raster`).
 * Bez pobierania kafelków z wyprzedzeniem (HERE §1.3): Leaflet pobiera tylko kafelki widoku.
 */
export function hereRasterLayer(choice: BasemapChoice, onClosed: () => void, key: string = HERE_BROWSER_KEY): L.TileLayer {
  const theme = choice.theme === 'dark' ? 'dark' : 'light';
  let direct = directTilesOn(key);
  const first = direct ? directTileTemplate(theme, key) : tileTemplate(theme).url;
  const layer = L.tileLayer(first, { attribution: choice.attribution, maxZoom: choice.maxZoom, tileSize: 256 });
  let probing = false;
  let closed = false;
  const closeHere = () => {
    if (closed) return;
    closed = true;
    rememberTilesOff();
    onClosed();
  };
  if (direct) {
    const meter = sharedTileMeter();
    const off = meter.onClosed(closeHere);
    let errors = 0;
    layer.on('tileload', (e: L.TileEvent) => {
      if (!direct) return;
      const src = (e.tile as HTMLImageElement).src;
      if (servedFromCache(src) !== true) meter.add(1);
    });
    layer.on('tileerror', () => {
      if (!direct || ++errors < 3) return;
      direct = false;
      directFailed = true;
      layer.setUrl(tileTemplate(theme).url);
    });
    layer.on('remove', () => { off(); });
  }
  layer.on('tileerror', (e: L.TileErrorEvent) => {
    if (direct || probing || closed) return;
    probing = true;
    const t = tileTemplate(theme);
    const url = tileUrl(e.coords, theme).url;
    void probeTileError(url, t.viaEdge).then((r) => {
      probing = false;
      if (r === 'closed') {
        closeHere();
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
  el.dataset.tilePath = choice.hereRequests ? (directTilesOn() ? 'here-direct' : 'proxy') : 'fallback';
  return layer;
}

/**
 * #667 E / DP-23: spec ze słownika w `map_display_state` (nie hardcodowany SPEC).
 * Zapas po leg — tylko gdy wiersz bez `spec` (stary cache).
 */
const SPEC_FALLBACK: Record<string, RoadSpec | 'loose'> = {
  'PL-GDN': ROAD_PL,
  'SE-NYN': ROAD_SE,
  'PL-GDY': 'loose',
  'SE-KAA': ROAD_KAA_E22,
  'SE-KAA-INLAND': ROAD_KAA,
};

function roadSpecFromRow(row: {
  leg?: string;
  spec?: string;
  corridor_code?: string | null;
}): RoadSpec | 'loose' | null {
  const kind = String(row.spec ?? '');
  const corridor = String(row.corridor_code ?? '');
  if (kind === 'pl') return ROAD_PL;
  if (kind === 'se') return ROAD_SE;
  if (kind === 'loose') return 'loose';
  if (kind === 'kaa') return corridor === 'SE_E22' ? ROAD_KAA_E22 : ROAD_KAA;
  const leg = String(row.leg ?? '');
  return SPEC_FALLBACK[leg] ?? null;
}

function roadLineWhy(leg: string, spec: RoadSpec | 'loose', line: LatLng[]): string | null {
  if (line.length < 2) return 'brak punktów';
  if (spec === 'loose') return looseRoadOk(line) ? null : 'geometria (luźna)';
  return roadGeometryOk(line, spec) ? null : 'geometria (via/długość)';
}

/**
 * #667 F7 r1 N5/N7: przyjęte linie + powody odrzuceń (jak checkFerries).
 * #667 F7 r2 / DP-22: przy braku punktów — `summary` z bazy (odchyłka / HTTP / oczekuje).
 * #667 E / DP-23: spec z wiersza (słownik), nie SPEC w kodzie.
 * Pełne ostrzeżenie w Stanie systemu → DP-22 (UI).
 */
export function checkRoads(rows: unknown): {
  accepted: LatLng[][];
  rejected: { leg: string; why: string }[];
} {
  const rejected: { leg: string; why: string }[] = [];
  if (!Array.isArray(rows)) return { accepted: [], rejected };
  const out: LatLng[][] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const r = row as {
      leg?: string;
      points?: unknown;
      summary?: string;
      spec?: string;
      corridor_code?: string | null;
      map_group?: string;
      browser_fetch?: boolean;
    };
    const leg = String(r.leg ?? '');
    const spec = roadSpecFromRow(r);
    const points = r.points;
    const summary = String(r.summary ?? '').trim();
    if (!spec) continue;
    if (!Array.isArray(points) || points.length < 2) {
      rejected.push({ leg, why: summary || 'brak punktów' });
      continue;
    }
    const line: LatLng[] = [];
    for (const p of points) {
      if (!Array.isArray(p) || p.length < 2) continue;
      const lat = Number(p[0]);
      const lng = Number(p[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) line.push([lat, lng]);
    }
    if (line.length < 2) {
      rejected.push({ leg, why: summary || 'brak punktów' });
      continue;
    }
    const why = roadLineWhy(leg, spec, line);
    if (why) rejected.push({ leg, why: summary && /odchyłka|odrzucon|HTTP/i.test(summary) ? summary : why });
    else out.push(line);
  }
  return { accepted: out, rejected };
}

export function acceptedRoads(rows: unknown): LatLng[][] {
  return checkRoads(rows).accepted;
}

/** Skrót odrzuceń do `data-roads` (TEST) — pełny Stan systemu = DP-22. */
export function roadsRejectSummary(rejected: { leg: string; why: string }[]): string {
  if (rejected.length === 0) return '';
  return rejected.map((r) => `${r.leg}: ${r.why}`).join(' · ');
}

/** #667 E: ile legów z browser_fetch (core) — BN7 nie wymusza POST z przeglądarki. */
function browserFetchLegCount(roads: unknown): number {
  if (!Array.isArray(roads)) return 5;
  let n = 0;
  for (const row of roads) {
    if (!row || typeof row !== 'object') continue;
    const r = row as { browser_fetch?: boolean; map_group?: string };
    if (r.browser_fetch === false) continue;
    if (r.map_group === 'bn7') continue;
    n += 1;
  }
  return n > 0 ? n : 5;
}

/** #667: re-export — helper bez auth w `orangeRoads.ts` (paczka demo nie ciągnie applyBasemap). */
export { ORANGE_ROAD_STYLE, paintOrangeRoads } from './orangeRoads';

/** F7 #585: jedno wołanie here-roads na sesję + limit czasu (brakujący leg nie spamuje Edge). */
let hereRoadsSessionAt = 0;
/** #667 F7 r2: równoległe mapPool+CorridorMap dzielą jedną obietnicę POST (bez dwóch płatnych tras). */
let hereRoadsInFlight: Promise<LatLng[][]> | null = null;
let HERE_ROADS_SESSION_MS = 5 * 60_000;
const HERE_ROADS_TIMEOUT_MS = 15_000;

/** #667 F7 r4: reset cache/in-flight w testach jednostkowych `loadRoadLines`. */
export function __resetRoadLinesCacheForTests(): void {
  displayState = null;
  hereRoadsSessionAt = 0;
  hereRoadsInFlight = null;
}

/** #667 F7 r6 B6: okno sesji 0 w teście in-flight (żeby drugi call nie odpadał po finally). */
export function __setHereRoadsSessionMsForTests(ms: number): void {
  HERE_ROADS_SESSION_MS = ms;
}

/** #667 F7 r1 N4: loadRoadLines + loadFerryLines dzielą cache `readMapDisplayState` (TTL 60 s). */
export async function loadRoadLines(): Promise<LatLng[][]> {
  if (!SUPABASE_AUTH_ENABLED) return [];
  // F7 r5 B6: in-flight synchronicznie przed pierwszym await (read/getSession),
  // żeby równoległe wołania dzieliły jedną obietnicę / 1× POST.
  if (hereRoadsInFlight) return hereRoadsInFlight;
  hereRoadsInFlight = (async () => {
    try {
      const { getSupabase } = await import('../../auth/client');
      const sb = await getSupabase();
      const read = async (force = false) => {
        const state = await readMapDisplayState(force);
        return { lines: acceptedRoads(state?.roads), roads: state?.roads };
      };
      let { lines, roads } = await read();
      // #667 E: próg = legi browser_fetch (core), nie wszystkie BN7.
      if (lines.length >= browserFetchLegCount(roads)) return lines;
      if (hereRoadsSessionAt > 0 && Date.now() - hereRoadsSessionAt < HERE_ROADS_SESSION_MS) return lines;
      const started = lines;
      const { data } = await sb.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return started;
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), HERE_ROADS_TIMEOUT_MS);
      try {
        await fetch(`${SUPABASE_URL}/functions/v1/here-roads?forceFunctionRegion=${FUNCTION_REGION}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            apikey: SUPABASE_ANON_KEY,
            'Content-Type': 'application/json',
          },
          body: '{}',
          signal: ac.signal,
        });
      } catch {
        // F7 N6: timeout/sieć — zostaw już wczytane legi (nie [] z zewnętrznego catch).
      } finally {
        clearTimeout(timer);
        hereRoadsSessionAt = Date.now();
      }
      try {
        return (await read(true)).lines;
      } catch {
        return started;
      }
    } catch {
      return [];
    } finally {
      hereRoadsInFlight = null;
    }
  })();
  return hereRoadsInFlight;
}


/**
 * E45 pkt 1 (L56): odcinki promowe z HERE z tego samego odczytu `map_display_state` (pole `ferries`, P9).
 * Bez pola albo przy złej geometrii — pusta lista i mapa rysuje stałe tory wodne.
 */
export async function loadFerryLines(): Promise<{ lines: { leg: FerryLeg; line: LatLng[] }[]; summary: string | null }> {
  if (!SUPABASE_AUTH_ENABLED) return { lines: [], summary: null };
  try {
    const rows = (await readMapDisplayState())?.ferries;
    if (rows === undefined || rows === null) return { lines: [], summary: null };
    const r = checkFerries(rows);
    return { lines: r.accepted, summary: ferrySummary(r) };
  } catch {
    return { lines: [], summary: null };
  }
}
