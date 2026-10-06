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
  views: Map<MapSlot, { center: L.LatLng; zoom: number }>;
};

export const DEFAULT_CENTER: L.LatLngTuple = [58.5, 18.5];
export const DEFAULT_ZOOM = 4.2;

/** Liczniki do testów i pomiaru (`window.__wtMapPool`). */
export const poolStats = { created: 0, reused: 0, oneOff: 0, destroyed: 0 };

let entry: PoolEntry | null = null;
let inUse = false;
let holder: HTMLDivElement | null = null;

const POINTS = [SITES.loading, SITES.portOut, SITES.portIn, SITES.site];

function build(pooled: boolean): PoolEntry {
  const el = document.createElement('div');
  el.className = 'corridor-map-el';
  Object.assign(el.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', zIndex: '0' });
  const map = L.map(el, { center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM, zoomControl: false, attributionControl: true });
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
  };
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
  let e: PoolEntry;
  if (!inUse) {
    if (entry) poolStats.reused += 1;
    else entry = build(true);
    inUse = true;
    e = entry;
  } else {
    e = build(false);
  }
  root.appendChild(e.el);
  safeInvalidate(e.map);
  const saved = e.views.get(slot);
  const center = saved?.center ?? L.latLng(DEFAULT_CENTER);
  const zoom = saved?.zoom ?? Math.round(DEFAULT_ZOOM);
  if (e.map.getZoom() !== zoom || !e.map.getCenter().equals(center, 1e-9)) {
    e.map.setView(center, zoom, { animate: false });
  }
  return e;
}

/** Zwalnia mapę: wspólną odkłada do schowka (ten sam rozmiar), jednorazową niszczy. */
export function releaseMap(e: PoolEntry, slot: MapSlot): void {
  if (!e.pooled) {
    e.map.remove();
    e.el.remove();
    poolStats.destroyed += 1;
    return;
  }
  e.views.set(slot, { center: e.map.getCenter(), zoom: e.map.getZoom() });
  const w = e.el.clientWidth;
  const h = e.el.clientHeight;
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
  };
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') {
    return import('./fallbackTiles').then(({ installFallback }) => {
      if (e.basemapSeq !== seq) return e.layers.tiles;
      const layer = installFallback(e.map, e.layers.tiles, theme);
      e.layers.tiles = layer;
      markLoaded(layer);
      return layer;
    });
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
  });
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
