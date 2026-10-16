/**
 * AUD-01e (decyzja koordynatora z polecenia właściciela AUD-01d 06.10: „jedna instancja mapy na całą sesję”;
 * cel: kolejne otwarcia i przejścia między widokami ≤ 0,3 s). Jedna mapa Leaflet na kartę przeglądarki, wspólna dla
 * widoku Mapa, mini-mapy kokpitu i panelu zlecenia: przy zamknięciu widoku element mapy NIE jest niszczony, tylko
 * przenoszony do ukrytego schowka (ten sam rozmiar — Leaflet nie przycina kafelków), a przy otwarciu następnego widoku
 * przenoszony do jego kontenera. Zmieniają się tylko warstwy danych i widok (środek/zoom zapamiętany per miejsce).
 * Podkład zostaje (ten sam motyw → zero nowych kafelków przy powrocie do tego samego widoku). Bez pobierania kafelków
 * z wyprzedzeniem (HERE §1.3). Gdy mapa jest już zajęta (np. panel zlecenia otwarty nad widokiem Mapa), drugi widok
 * dostaje mapę jednorazową, niszczoną przy zamknięciu (jak przed AUD-01e).
 */
import L from 'leaflet';
import { CORRIDOR_REF_COORDS } from '../../lib/corridor';
import { SITES } from '../../lib/status';
import { PROD_BUILD } from '../../lib/prodFacade';
import { WATER_GDN_NYN, WATER_GDY_KAA, type ThemeName } from '../../lib/map/draw';
import { useTowerStore } from '../../store/useTowerStore';
import { reportBasemapFailure } from '../../lib/p9aSource';
import { TILE_RETRY_MS, TILE_TRIES, tileVia, watchTiles, type TileHealth, type TileVia } from './tileHealth';

export type MapSlot = 'map' | 'kokpit' | 'drawer';

export type LayerBag = {
  tiles: L.Layer;
  route: L.LayerGroup;
  ferryLeg: L.LayerGroup;
  geofences: L.LayerGroup;
  poi: L.LayerGroup;
  fleet: L.LayerGroup;
  situations: L.LayerGroup;
  ais: L.LayerGroup;
};

export type PoolEntry = {
  map: L.Map;
  el: HTMLDivElement;
  layers: LayerBag;
  pooled: boolean;
  /** Motyw, dla którego podkład jest założony (null = brak / do przełożenia). */
  tilesTheme: ThemeName | null;
  tilesLoaded: boolean;
  basemapSeq: number;
  views: Map<MapSlot, { center: L.LatLng; zoom: number; w: number; h: number }>;
  /** wyglad/P9-a (E24-1): stan podkładu — „failed” = komunikat zamiast szarej mapy. */
  health: BasemapHealth;
  healthSubs: Set<(h: BasemapHealth) => void>;
  unwatch: (() => void) | null;
  /** Nieudane pobrania pliku aplikacji z podkładem (E22: karta sprzed wdrożenia). */
  chunkFails: number;
  /** Miejsce, które ostatnio wzięło mapę (do zgłoszenia awarii). */
  slot: MapSlot;
};

/** wyglad/P9-a (E24-1): stan podkładu na mapie z puli. `reported` = zgłoszenie zapisane dla HHL (p9aSource). */
export type BasemapHealth = TileHealth & { via: TileVia; reported: boolean; cause: 'tiles' | 'chunk' };

export const DEFAULT_CENTER: L.LatLngTuple = [58.5, 18.5];
export const DEFAULT_ZOOM = 4.2;

/** Liczniki do testów i pomiaru (`window.__wtMapPool`). */
export const poolStats = { created: 0, reused: 0, oneOff: 0, destroyed: 0 };

let entry: PoolEntry | null = null;
let inUse = false;
let holder: HTMLDivElement | null = null;

const POINTS = [SITES.loading, SITES.portOut, SITES.portIn, SITES.site];

/**
 * wyglad/P9-d (E1, zdecydowane 07.10): Kokpit i Mapa — kadr całej trasy (droga, promy, Śrem i Boden), margines 24 px,
 * krok przybliżenia 0,25; przy każdym wejściu i zmianie rozmiaru, bez zapamiętywania przesunięcia, bez „Cała trasa”.
 */
let corridorBounds: L.LatLngBounds | null = null;
export function corridorBoundsOf(): L.LatLngBounds {
  if (corridorBounds) return corridorBounds;
  const pts: L.LatLngExpression[] = [
    ...CORRIDOR_REF_COORDS.map(([lng, lat]) => [lat, lng] as L.LatLngTuple),
    ...[...WATER_GDN_NYN, ...WATER_GDY_KAA].map(([lng, lat]) => [lat, lng] as L.LatLngTuple),
    ...POINTS.map((p) => [p.lat, p.lng] as L.LatLngTuple),
  ];
  corridorBounds = L.latLngBounds(pts);
  return corridorBounds;
}
export const CORRIDOR_PADDING = 24;
/**
 * Margines kadru (E1: 24 px). Na stronie Mapa legenda leży na dole mapy — margines dolny liczony od jej górnej krawędzi,
 * żeby legenda nie zasłaniała początku trasy (Śrem). To samo dla dopisku na mapie Przeglądu (P9-f). Kokpit i telefon
 * (legenda w arkuszu) — bez nakładki na mapie.
 */
export function corridorPadding(map: L.Map): { paddingTopLeft: L.PointTuple; paddingBottomRight: L.PointTuple } {
  let extra = 0;
  try {
    /* legenda Mapy i dopisek Przeglądu (wyglad/P9-f) leżą na dole mapy */
    const over = map.getContainer().closest('.corridor-map-root')?.querySelectorAll<HTMLElement>('.mapkey, [data-map-bottom]') ?? [];
    for (const key of over) {
      if (!(key.offsetHeight > 0)) continue;
      const root = key.offsetParent as HTMLElement | null;
      const fromBottom = root ? root.clientHeight - key.offsetTop : key.offsetHeight;
      extra = Math.max(extra, Math.round(fromBottom));
    }
  } catch {
    /* mapa bez kontenera */
  }
  return { paddingTopLeft: [CORRIDOR_PADDING, CORRIDOR_PADDING], paddingBottomRight: [CORRIDOR_PADDING, CORRIDOR_PADDING + extra] };
}
/** Widok całej trasy dla bieżącego rozmiaru mapy (bez ruszania mapy). */
export function corridorView(map: L.Map): { center: L.LatLng; zoom: number } {
  const b = corridorBoundsOf();
  /* ten sam rachunek co `fitBounds` (środek w rzucie mapy, nie średnia stopni) — powrót bez zmiany widoku = zero kafelków */
  const m = map as unknown as { _getBoundsCenterZoom?: (bb: L.LatLngBounds, o: L.FitBoundsOptions) => { center: L.LatLng; zoom: number } };
  if (typeof m._getBoundsCenterZoom === 'function') {
    return m._getBoundsCenterZoom(b, corridorPadding(map));
  }
  const pad = corridorPadding(map);
  const zoom = map.getBoundsZoom(b, false, L.point(pad.paddingTopLeft).add(pad.paddingBottomRight));
  return { center: b.getCenter(), zoom };
}
/** Kadr całej trasy (E1). */
export function fitCorridor(map: L.Map): void {
  try {
    if (!map.getPane('mapPane')) return;
    map.fitBounds(corridorBoundsOf(), { ...corridorPadding(map), animate: false });
  } catch {
    /* mapa usunięta albo bez rozmiaru */
  }
}

/** Mapa tworzona już w kontenerze widoku (rozmiar od początku) — piksel w piksel jak przed AUD-01e. */
function build(pooled: boolean, root: HTMLElement): PoolEntry {
  const el = document.createElement('div');
  el.className = 'corridor-map-el';
  Object.assign(el.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', zIndex: '0' });
  root.appendChild(el);
  const map = L.map(el, { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, zoomSnap: 0.25, zoomControl: false, attributionControl: true });
  L.control.zoom({ position: 'topright' }).addTo(map);
  const tiles = L.layerGroup().addTo(map);
  const route = L.layerGroup().addTo(map);
  if (!PROD_BUILD) {
    L.polyline(CORRIDOR_REF_COORDS.map(([lng, lat]) => L.latLng(lat, lng)), {
      color: '#E5A544', weight: 3, opacity: 0.85, dashArray: '8 6',
    }).addTo(route);
  }
  const ferryLeg = L.layerGroup().addTo(map);
  for (const lane of [WATER_GDN_NYN, WATER_GDY_KAA]) {
    L.polyline(lane.map(([lng, lat]) => L.latLng(lat, lng)), { color: '#6BA8D6', weight: 3, opacity: 0.9 }).addTo(ferryLeg);
  }
  const geofences = L.layerGroup().addTo(map);
  const poi = L.layerGroup().addTo(map);
  const fleet = L.layerGroup().addTo(map);
  const situations = L.layerGroup().addTo(map);
  const ais = L.layerGroup().addTo(map);
  for (const p of POINTS) {
    L.circleMarker([p.lat, p.lng], { radius: 6, color: '#080F15', weight: 1, fillColor: '#E5A544', fillOpacity: 1 })
      .bindTooltip(p.name, { direction: 'top', offset: [0, -8] })
      .addTo(poi);
  }
  if (pooled) poolStats.created += 1;
  else poolStats.oneOff += 1;
  return {
    map, el, pooled, tilesTheme: null, tilesLoaded: false, basemapSeq: 0, views: new Map(),
    layers: { tiles, route, ferryLeg, geofences, poi, fleet, situations, ais },
    health: { state: 'loading', tries: 0, via: 'fallback', reported: false, cause: 'tiles' },
    healthSubs: new Set(), unwatch: null, chunkFails: 0, slot: 'map',
  };
}

function setHealth(e: PoolEntry, next: BasemapHealth): void {
  const prev = e.health;
  if (prev.state === next.state && prev.tries === next.tries && prev.via === next.via
    && prev.reported === next.reported && prev.cause === next.cause) return;
  e.health = next;
  for (const fn of e.healthSubs) fn(next);
  // Jedno zgłoszenie na epizod awarii (przejście do „failed”); wynik zapisu pokazuje przypis komunikatu.
  if (next.state === 'failed' && prev.state !== 'failed') {
    const seq = e.basemapSeq;
    void reportBasemapFailure({ via: next.via, tries: next.tries, slot: e.slot, cause: next.cause })
      .then((ok) => {
        if (ok && e.basemapSeq === seq && e.health.state === 'failed') setHealth(e, { ...e.health, reported: true });
      })
      .catch(() => { /* zgłoszenie nie może samo psuć mapy */ });
  }
}

/** wyglad/P9-a: subskrypcja stanu podkładu (widok mapy). Od razu oddaje bieżący stan. */
export function subscribeBasemapHealth(e: PoolEntry, fn: (h: BasemapHealth) => void): () => void {
  e.healthSubs.add(fn);
  fn(e.health);
  return () => { e.healthSubs.delete(fn); };
}

/** wyglad/P9-a: „Spróbuj ponownie” — podkład zakładany od nowa (nowa warstwa, liczniki od zera). */
export function retryBasemap(e: PoolEntry): void {
  e.tilesTheme = null;
  e.chunkFails = 0;
  setHealth(e, { ...e.health, state: 'loading', tries: 0, reported: false });
  void ensureBasemap(e, useTowerStore.getState().theme);
}

function safeInvalidate(map: L.Map): void {
  try {
    if (map.getPane('mapPane')) map.invalidateSize({ animate: false });
  } catch {
    /* mapa usunięta */
  }
}

/** Wpina mapę do kontenera widoku. Ten sam widok co ostatnio w tym miejscu → bez `setView` (zero nowych kafelków). */
export function acquireMap(root: HTMLElement, slot: MapSlot): PoolEntry {
  if (inUse) {
    const one = build(false, root);
    one.slot = slot;
    if (slot !== 'drawer') fitCorridor(one.map);
    return one;
  }
  inUse = true;
  if (!entry) {
    entry = build(true, root);
    entry.slot = slot;
    if (slot !== 'drawer') fitCorridor(entry.map);
    return entry;
  }
  poolStats.reused += 1;
  const e = entry;
  e.slot = slot;
  root.appendChild(e.el);
  safeInvalidate(e.map);
  const saved = e.views.get(slot);
  /* E1: Kokpit i Mapa zawsze w kadrze całej trasy (bez zapamiętanego przesunięcia); panel transportu — jak ostatnio */
  const target = slot === 'drawer'
    ? (saved ? { center: saved.center, zoom: saved.zoom } : null)
    : corridorView(e.map);
  /* ten sam widok = ten sam zoom i środek co do piksela (Leaflet zaokrągla środek do piksela po `setView`) */
  const samePixel = (a: L.LatLng, b: L.LatLng, z: number) => e.map.project(a, z).distanceTo(e.map.project(b, z)) < 1;
  const untouched = !!target && (slot !== 'drawer' || (!!saved && saved.w === e.el.clientWidth && saved.h === e.el.clientHeight))
    && e.map.getZoom() === target.zoom && samePixel(e.map.getCenter(), target.center, target.zoom);
  // Powrót do tego samego miejsca bez zmiany rozmiaru i widoku → nic (zero nowych kafelków). Inaczej widok ustawiany
  // od nowa (`reset`) — piksel w piksel jak świeżo utworzona mapa (wzorce wizualne), kafelki z pamięci przeglądarki.
  if (!untouched) {
    e.map.setView(target?.center ?? L.latLng(DEFAULT_CENTER), target?.zoom ?? DEFAULT_ZOOM, { reset: true } as L.ZoomPanOptions);
    // Warstwy wektorowe od nowa w tej samej kolejności (obcięcie linii i wzór kresek jak w świeżej mapie). Bez kafelków.
    const { route, ferryLeg, geofences, poi, fleet, situations, ais } = e.layers;
    const on = [route, ferryLeg, geofences, poi, fleet, situations, ais].filter((l) => e.map.hasLayer(l));
    for (const l of on) e.map.removeLayer(l);
    const m = e.map as unknown as { _renderer?: L.Renderer; _paneRenderers?: Record<string, L.Renderer> };
    if (m._renderer) { e.map.removeLayer(m._renderer); m._renderer = undefined; m._paneRenderers = {}; }
    for (const l of on) l.addTo(e.map);
  }
  return e;
}

/** Zwalnia mapę: wspólną odkłada do schowka (ten sam rozmiar), jednorazową niszczy. */
export function releaseMap(e: PoolEntry, slot: MapSlot): void {
  if (!e.pooled) {
    e.map.remove();
    e.unwatch?.();
    e.unwatch = null;
    e.healthSubs.clear();
    e.el.remove();
    poolStats.destroyed += 1;
    return;
  }
  // Element jest już odpięty przez React (sprzątanie efektów po usunięciu DOM) — rozmiar z pamięci Leaflet.
  const { x: w, y: h } = e.map.getSize();
  e.views.set(slot, { center: e.map.getCenter(), zoom: e.map.getZoom(), w, h });
  if (!holder) {
    holder = document.createElement('div');
    holder.setAttribute('aria-hidden', 'true');
    holder.dataset.mapPool = 'parked';
    Object.assign(holder.style, { position: 'fixed', left: '-20000px', top: '0', visibility: 'hidden', pointerEvents: 'none', overflow: 'hidden' });
    document.body.appendChild(holder);
  }
  holder.style.width = `${Math.max(1, w)}px`;
  holder.style.height = `${Math.max(1, h)}px`;
  holder.appendChild(e.el);
  inUse = false;
}

/**
 * Podkład na mapie z puli: ten sam motyw → nic (zero kafelków). Zmiana motywu albo zamknięcie budżetu D-78 →
 * nowy podkład niezależnie od widoku, który go zamówił (widok mógł się już zamknąć).
 */
export function ensureBasemap(e: PoolEntry, theme: ThemeName): Promise<L.Layer> {
  if (e.tilesTheme === theme) return Promise.resolve(e.layers.tiles);
  e.tilesTheme = theme;
  e.tilesLoaded = false;
  const seq = ++e.basemapSeq;
  const markLoaded = (layer: L.Layer) => {
    layer.once('load', () => { if (e.basemapSeq === seq) e.tilesLoaded = true; });
    // wyglad/P9-a (E24-1): podkład „jest” dopiero po pierwszym kafelku z obrazem; 3 nieudane próby = komunikat.
    e.unwatch?.();
    e.chunkFails = 0;
    const via = tileVia(e.map.getContainer().dataset.tilePath);
    setHealth(e, { state: 'loading', tries: 0, via, reported: false, cause: 'tiles' });
    e.unwatch = watchTiles(layer as unknown as Parameters<typeof watchTiles>[0], (h) => {
      if (e.basemapSeq !== seq) return;
      setHealth(e, { ...e.health, ...h, via: tileVia(e.map.getContainer().dataset.tilePath), cause: 'tiles' });
    });
  };
  /*
   * wyglad/P9-a (E22 w E24-1): plik aplikacji z podkładem się nie pobrał (karta sprzed wdrożenia) — wcześniej
   * `tilesTheme` zostawał ustawiony i mapa była szara do odświeżenia. Teraz: 3 próby (po 1 s i 2 s), potem komunikat
   * z „Odśwież stronę”.
   */
  const onChunkFail = (): L.Layer => {
    if (e.basemapSeq !== seq) return e.layers.tiles;
    e.tilesTheme = null;
    e.chunkFails += 1;
    if (e.chunkFails >= TILE_TRIES) {
      setHealth(e, { ...e.health, state: 'failed', tries: e.chunkFails, reported: false, cause: 'chunk' });
    } else {
      setHealth(e, { ...e.health, state: 'loading', tries: e.chunkFails, reported: false, cause: 'chunk' });
      setTimeout(() => {
        if (e.basemapSeq === seq && e.tilesTheme === null) void ensureBasemap(e, useTowerStore.getState().theme);
      }, TILE_RETRY_MS(e.chunkFails));
    }
    return e.layers.tiles;
  };
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') {
    return import('./fallbackTiles').then(({ installFallback }) => {
      if (e.basemapSeq !== seq) return e.layers.tiles;
      const layer = installFallback(e.map, e.layers.tiles, theme);
      e.layers.tiles = layer;
      markLoaded(layer);
      return layer;
    }, onChunkFail);
  }
  return import('./applyBasemap').then(({ applyBasemap }) => applyBasemap(e.map, e.layers.tiles, theme, () => {
    // Budżet D-78 zamknięty — przełóż podkład (zapas) dla bieżącego motywu.
    e.tilesTheme = null;
    void ensureBasemap(e, useTowerStore.getState().theme);
  })).then((layer) => {
    if (e.basemapSeq !== seq) {
      if (e.map.hasLayer(layer) && layer !== e.layers.tiles) e.map.removeLayer(layer);
      return e.layers.tiles;
    }
    e.layers.tiles = layer;
    markLoaded(layer);
    return layer;
  }, onChunkFail);
}

/** Tylko testy. */
export function __resetMapPool(): void {
  entry = null;
  inUse = false;
  holder = null;
  poolStats.created = 0; poolStats.reused = 0; poolStats.oneOff = 0; poolStats.destroyed = 0;
}

/** Pomiar/testy: liczba słuchaczy `zoomend` i `moveend` na wspólnej mapie (wyciek słuchaczy = rośnie po przejściach). */
export function poolListeners(): { zoomend: number; moveend: number } {
  const ev = (entry?.map as unknown as { _events?: Record<string, unknown[]> } | undefined)?._events ?? {};
  return { zoomend: ev.zoomend?.length ?? 0, moveend: ev.moveend?.length ?? 0 };
}

if (typeof window !== 'undefined') {
  const w = window as unknown as { __wtMapPool?: typeof poolStats & { listeners?: typeof poolListeners } };
  w.__wtMapPool = Object.assign(poolStats, { listeners: poolListeners });
}
