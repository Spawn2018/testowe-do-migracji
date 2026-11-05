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
import { DEMO_ROAD_LEGS } from '../../data/roadLinesDemo';
import { WATER_GDN_NYN, type LatLng, type ThemeName } from '../../lib/map/draw';
import { CORE_LANE_TRACKS, ferryLaneLines, WATER_GDY_KAA_LANE, ferryLaneOptions, restyleFerryLanes } from '../../lib/map/ferryLanes';
import { WATER_TRACKS_EXTRA } from '../../lib/map/ferryLines';
import { corridorScope, FAMILY_EXTENT, linesInScope, networkScope, type CorridorScope, type RouteLegRow } from '../../lib/map/routeLegs';
import { programmatic } from './programmaticMove';
import type { WaterTrackId } from '../../lib/ferryCatalog';
import { paintRoadLegs } from './orangeRoads';
import { useTowerStore } from '../../store/useTowerStore';
import { reportBasemapFailure } from '../../lib/p9aSource';
import { TILE_RETRY_MS, TILE_TRIES, tileVia, watchTiles, type TileHealth, type TileVia } from './tileHealth';

export type MapSlot = 'map' | 'kokpit' | 'drawer';

export type LayerBag = {
  tiles: L.Layer;
  route: L.LayerGroup;
  ferryLeg: L.LayerGroup;
  /** E45 (Z3 pkt 8): linie objazdu po decyzji SCX — przerywane, widoczne z „Trasą”. */
  detour: L.LayerGroup;
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
  /**
   * DP-76: motyw, w którym są narysowane tory promów — niezależny od podkładu (`tilesTheme` bywa null przy awarii,
   * ponawianiu i budżecie D-78, a tory i tak muszą przejść na nowy motyw).
   */
  lanesTheme: ThemeName;
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
  /** BN9-c5: zakres linii tras narysowany teraz (karta transportu / Mapa i Kokpit), wczytane legi i przeprawy z HERE (po wczytaniu rysowany jest zakres z chwili zakończenia). */
  lines: {
    spec: LinesSpec; legs: { leg: string; line: readonly LatLng[] }[] | null; routeLegs: RouteLegRow[];
    /** Przeprawy z HERE (PROD, `loadFerryLines`), gdy przeszły sprawdzenie. */
    ferries: { leg: string; line: readonly LatLng[] }[];
  };
};

/**
 * BN9-c5 (#718 BN7 §4): co rysuje mapa — trasy (kody rejsów) i czy z rdzeniem Polska–Szwecja czy bez (karta transportu:
 * tylko trasa transportu; trasa nieznana — rdzeń). `network` — decyzja 88: Mapa i Kokpit, cała sieć (rdzeń, wszystkie
 * legi BN7 i tory bałtyckie) niezależnie od transportów.
 */
export type LinesSpec = { routes: readonly string[]; baseline: boolean; network?: boolean };
export const BASELINE_LINES: LinesSpec = { routes: [], baseline: true };
/** Decyzja 88: Mapa i Kokpit — cała sieć zawsze. */
export const NETWORK_LINES: LinesSpec = { routes: [], baseline: true, network: true };

/** wyglad/P9-a (E24-1): stan podkładu na mapie z puli. `reported` = zgłoszenie zapisane dla HHL (p9aSource). */
export type BasemapHealth = TileHealth & { via: TileVia; reported: boolean; cause: 'tiles' | 'chunk' };

export const DEFAULT_CENTER: L.LatLngTuple = [58.5, 18.5];
export const DEFAULT_ZOOM = 4.2;

/** Liczniki do testów i pomiaru (`window.__wtMapPool`). `roadsLoads` = wołania sieciowe legów (DP-224 B). */
export const poolStats = { created: 0, reused: 0, oneOff: 0, destroyed: 0, roadsLoads: 0 };

let entry: PoolEntry | null = null;
let inUse = false;
let holder: HTMLDivElement | null = null;

const POINTS = [SITES.loading, SITES.portOut, SITES.portIn, SITES.site];

/**
 * wyglad/P9-d (E1, zdecydowane 07.10): Kokpit i Mapa — kadr całej trasy (droga, promy, Śrem i Boden), margines 24 px,
 * krok przybliżenia 0,25; przy każdym wejściu i zmianie rozmiaru, bez zapamiętywania przesunięcia, bez „Cała trasa”.
 * BN9-c5 (#718 BN7 §4 pkt 4 i 7): z trasami bałtyckimi w zakresie mapy kadr obejmuje też ich tory wodne i drogi (punkty
 * via legów, `FAMILY_EXTENT`); bez tras bałtyckich — kadr Polska–Szwecja bez zmian. Decyzja 88: Mapa i Kokpit mają
 * w zakresie wszystkie tory — kadr domyślny to cała sieć (Gdańsk/Śrem – Boden z Bałtykiem).
 */
let corridorBounds: L.LatLngBounds | null = null;
const balticBounds = new Map<string, L.LatLngBounds>();
export function corridorBoundsOf(tracks: ReadonlySet<WaterTrackId> = CORE_LANE_TRACKS): L.LatLngBounds {
  if (!corridorBounds) {
    const pts: L.LatLngExpression[] = [
      ...CORRIDOR_REF_COORDS.map(([lng, lat]) => [lat, lng] as L.LatLngTuple),
      ...[...WATER_GDN_NYN, ...WATER_GDY_KAA_LANE].map(([lng, lat]) => [lat, lng] as L.LatLngTuple),
      ...POINTS.map((p) => [p.lat, p.lng] as L.LatLngTuple),
    ];
    corridorBounds = L.latLngBounds(pts);
  }
  const extra = (Object.keys(WATER_TRACKS_EXTRA) as WaterTrackId[]).filter((id) => tracks.has(id));
  if (extra.length === 0) return corridorBounds;
  const key = extra.join(',');
  const hit = balticBounds.get(key);
  if (hit) return hit;
  const b = L.latLngBounds(corridorBounds.getSouthWest(), corridorBounds.getNorthEast());
  for (const id of extra) {
    for (const [lat, lng] of WATER_TRACKS_EXTRA[id as keyof typeof WATER_TRACKS_EXTRA]) b.extend([lat, lng]);
    for (const [lat, lng] of FAMILY_EXTENT[id] ?? []) b.extend([lat, lng]);
  }
  balticBounds.set(key, b);
  return b;
}
/** Tory w zakresie mapy (do kadru) — ustawiane przy rysowaniu linii (`drawCorridorLines`) i przy wzięciu mapy z puli. */
const fitTracks = new WeakMap<L.Map, ReadonlySet<WaterTrackId>>();
function boundsFor(map: L.Map): L.LatLngBounds {
  return corridorBoundsOf(fitTracks.get(map));
}
export const CORRIDOR_PADDING = 24;
/**
 * Margines kadru (E1: 24 px). Na stronie Mapa legenda leży na dole mapy — margines dolny liczony od jej górnej krawędzi,
 * żeby legenda nie zasłaniała początku trasy (Śrem). To samo dla dopisku na mapie Przeglądu (P9-f) i dla podpisu
 * podkładu (audyt D-05, na telefonie 2 linie). Kokpit (podpis ukryty) i telefon (legenda w arkuszu) — bez legendy na mapie.
 */
/** Podpis podkładu (Leaflet) tej mapy — do marginesu kadru i do obserwacji jego wysokości (D-05). */
export function attributionOf(map: L.Map): HTMLElement | null {
  try {
    return map.getContainer().querySelector<HTMLElement>('.leaflet-control-attribution');
  } catch {
    return null;
  }
}
export function corridorPadding(map: L.Map): { paddingTopLeft: L.PointTuple; paddingBottomRight: L.PointTuple } {
  let extra = 0;
  let top = 0;
  try {
    /* legenda Mapy i dopisek Przeglądu (wyglad/P9-f) leżą na dole mapy; dopisek Przeglądu na telefonie leży u góry —
       wtedy margines górny (wcześniej nakładka u góry liczona była jak dolna, na wysokość całej mapy, i kadr spadał do
       najmniejszego przybliżenia). DP-191: dopisku trasy bałtyckiej („Trasa orientacyjna…”) już nie ma */
    const over = map.getContainer().closest('.corridor-map-root')?.querySelectorAll<HTMLElement>('.mapkey, [data-map-bottom]') ?? [];
    for (const key of over) {
      if (!(key.offsetHeight > 0)) continue;
      const root = key.offsetParent as HTMLElement | null;
      if (root && key.offsetTop + key.offsetHeight / 2 < root.clientHeight / 2) {
        top = Math.max(top, Math.round(key.offsetTop + key.offsetHeight));
        continue;
      }
      const fromBottom = root ? root.clientHeight - key.offsetTop : key.offsetHeight;
      extra = Math.max(extra, Math.round(fromBottom));
    }
    /* audyt D-05 (E1 pkt 1a–1b): podpis podkładu leży na dole mapy — na telefonie ma 2 linie i zasłaniał Śrem; margines
       dolny liczony od jego górnej krawędzi (wysokość z elementu, niezależnie od długości tekstu dostawcy podkładu) */
    const attr = attributionOf(map);
    if (attr && attr.offsetHeight > 0) {
      const corner = attr.offsetParent as HTMLElement | null;
      const fromBottom = corner ? corner.offsetHeight - attr.offsetTop : attr.offsetHeight;
      extra = Math.max(extra, Math.round(fromBottom));
    }
  } catch {
    /* mapa bez kontenera */
  }
  /* F7 #740 D2: niska mapa (telefon) — nakładki przycięte tak, żeby na trasę zostało ≥ 80 px; inaczej margines większy
     od mapy daje nieskończone przybliżenie w `getScaleZoom` (szara mapa) */
  let h = 0;
  try { h = map.getContainer().clientHeight || map.getSize().y; } catch { h = 0; }
  const room = Math.max(0, h - 2 * CORRIDOR_PADDING - 80);
  if (h > 0 && top + extra > room) {
    const k = room / (top + extra);
    top = Math.floor(top * k);
    extra = Math.floor(extra * k);
  }
  return { paddingTopLeft: [CORRIDOR_PADDING, CORRIDOR_PADDING + top], paddingBottomRight: [CORRIDOR_PADDING, CORRIDOR_PADDING + extra] };
}
/**
 * DP-176: miejsce, w którym mapa jest teraz wpięta (`acquireMap`) — Kokpit ma ciaśniejszy kadr całej sieci.
 * Mapa i karta transportu — kadr jak dotąd (`corridorPadding`).
 */
const slotOf = new WeakMap<L.Map, MapSlot>();
/** DP-176: margines kadru mini-mapy Kokpitu (zamiast 24 px). */
export const KOKPIT_PADDING = 12;
type FramePadding = ReturnType<typeof corridorPadding>;
/**
 * DP-176: mini-mapa Kokpitu jest szeroka i niska (727 × 360 przy 1920), a sieć (Śrem – Boden) wysoka i wąska — w Kokpicie
 * margines 12 px zamiast 24 px (większe przybliżenie, cała sieć w kadrze). Marginesy od nakładek (`corridorPadding`)
 * zostają, pomniejszone o różnicę marginesu bazowego. DP-191: bez dopisku „Trasa orientacyjna…” — bez wariantu
 * „dopisek z boku”.
 */
function kokpitPadding(base: FramePadding): FramePadding {
  const d = CORRIDOR_PADDING - KOKPIT_PADDING;
  return {
    paddingTopLeft: [KOKPIT_PADDING, base.paddingTopLeft[1] - d],
    paddingBottomRight: [KOKPIT_PADDING, base.paddingBottomRight[1] - d],
  };
}
/** Margines kadru całej trasy dla miejsca mapy: Kokpit — `kokpitPadding` (DP-176), reszta — `corridorPadding`. */
export function framePadding(map: L.Map): FramePadding {
  const base = corridorPadding(map);
  return slotOf.get(map) === 'kokpit' ? kokpitPadding(base) : base;
}

/** Widok całej trasy dla bieżącego rozmiaru mapy (bez ruszania mapy). */
export function corridorView(map: L.Map): { center: L.LatLng; zoom: number } {
  const b = boundsFor(map);
  /* ten sam rachunek co `fitBounds` (środek w rzucie mapy, nie średnia stopni) — powrót bez zmiany widoku = zero kafelków */
  const m = map as unknown as { _getBoundsCenterZoom?: (bb: L.LatLngBounds, o: L.FitBoundsOptions) => { center: L.LatLng; zoom: number } };
  if (typeof m._getBoundsCenterZoom === 'function') {
    return m._getBoundsCenterZoom(b, framePadding(map));
  }
  const pad = framePadding(map);
  const zoom = map.getBoundsZoom(b, false, L.point(pad.paddingTopLeft).add(pad.paddingBottomRight));
  return { center: b.getCenter(), zoom };
}
/** Kadr całej trasy (E1). */
export function fitCorridor(map: L.Map): void {
  try {
    if (!map.getPane('mapPane')) return;
    /* F7 r2 #740 R2-W1: kadr to ruch programowy (zdarzenia Leaflet synchronicznie — znacznik obejmuje cały łańcuch) */
    programmatic(map, () => map.fitBounds(boundsFor(map), { ...framePadding(map), animate: false }));
  } catch {
    /* mapa usunięta albo bez rozmiaru */
  }
}

/** DP-77: promień znaczników miejsc (Śrem, porty, Boden) — przy przybliżeniu < 5,5 mniejszy, żeby nie zakrywał linii. */
export const POI_RADIUS = { low: 3.5, normal: 6 } as const;
export function poiRadius(zoom: number): number {
  return zoom < 5.5 ? POI_RADIUS.low : POI_RADIUS.normal;
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
  const ferryLeg = L.layerGroup().addTo(map);
  /* DP-76: tory w bieżącym motywie (domyślny motyw `drawFerryLanes`) — zapamiętany w `lanesTheme` */
  const lanesTheme = useTowerStore.getState().theme;
  const detour = L.layerGroup().addTo(map);
  const geofences = L.layerGroup().addTo(map);
  const poi = L.layerGroup().addTo(map);
  const fleet = L.layerGroup().addTo(map);
  const situations = L.layerGroup().addTo(map);
  const ais = L.layerGroup().addTo(map);
  const pins = POINTS.map((p) => L.circleMarker([p.lat, p.lng], { radius: poiRadius(map.getZoom()), color: '#080F15', weight: 1, fillColor: '#E5A544', fillOpacity: 1 })
    .bindTooltip(p.name, { direction: 'top', offset: [0, -8] })
    .addTo(poi));
  /* DP-77: przy małym przybliżeniu znaczniki Śrem i Gdańsk zakrywały polski odcinek pomarańczowej linii — mniejsze
     (dalej klikalne, z podpisem); od przybliżenia 5,5 jak dotąd */
  map.on('zoomend', () => { const r = poiRadius(map.getZoom()); for (const m of pins) if (m.getRadius() !== r) m.setRadius(r); });
  if (pooled) poolStats.created += 1;
  else poolStats.oneOff += 1;
  const e: PoolEntry = {
    map, el, pooled, tilesTheme: null, lanesTheme, tilesLoaded: false, basemapSeq: 0, views: new Map(),
    layers: { tiles, route, ferryLeg, detour, geofences, poi, fleet, situations, ais },
    health: { state: 'loading', tries: 0, via: 'fallback', reported: false, cause: 'tiles' },
    healthSubs: new Set(), unwatch: null, chunkFails: 0, slot: 'map',
    lines: { spec: BASELINE_LINES, legs: null, routeLegs: [], ferries: [] },
  };
  /* #667 A / BN9-c5: drogi (demo: linie przykładowe; PROD: legi z `map_display_state`) i tory — od razu rdzeń
     Polska–Szwecja; CorridorMap przerysowuje zakres widoku (karta transportu, Mapa, Kokpit) */
  void drawCorridorLines(e, BASELINE_LINES, true);
  return e;
}

/** Zakres linii dla specyfikacji (legi z `route_legs`, gdy już wczytane). */
export function scopeOfSpec(spec: LinesSpec, routeLegs: readonly RouteLegRow[] = []): CorridorScope {
  if (spec.network) return networkScope(routeLegs);
  return corridorScope(spec.routes, routeLegs, spec.baseline);
}

const HERE_FERRY_TRACK: Readonly<Record<string, WaterTrackId>> = { 'FERRY-GDN-NYN': 'GDN-NYN', 'FERRY-GDY-KAA': 'GDY-KAA' };

/** Warstwa promu od nowa: przeprawy z HERE z zakresu (PROD) i stałe tory zakresu bez nich (DP-7, DP-76). */
function paintHereFerries(e: PoolEntry, scope: CorridorScope): void {
  /* F7 #740 D4: HERE podaje dziś odcinki promowe tylko dla GDN-NYN i GDY-KAA (`FerryLeg`); przeprawy bałtyckie zostają
     na stałych torach (`WATER_TRACKS_EXTRA`) — `drawFerryLanes` niżej */
  const { ferryLeg } = e.layers;
  ferryLeg.clearLayers();
  /* DP-76: styl torów z motywu (`ferryLaneOptions`); zmianę motywu na żywo przerysowuje `ensureBasemap` */
  const theme = useTowerStore.getState().theme;
  const mine = e.lines.ferries.filter((f) => scope.tracks.has(HERE_FERRY_TRACK[f.leg]));
  const laneOpts = ferryLaneOptions(theme);
  for (const f of mine) L.polyline(f.line.map(([lat, lng]) => L.latLng(lat, lng)), laneOpts).addTo(ferryLeg);
  /* DP-7: przeprawa bez odcinka z HERE i tory bałtyckie zakresu — to samo rysowanie co przy tworzeniu mapy */
  drawFerryLanes(ferryLeg, new Set(mine.map((f) => f.leg)), theme, scope.tracks);
  e.lanesTheme = theme;
}

/**
 * BN9-c5 (#718 BN7 §4): linie tras na mapie z puli — legi drogowe (`#E5A544`) i tory wodne (`ferryLaneOptions`) tylko
 * z zakresu `spec`. Tory i legi już wczytane — od razu (wspólna mapa przechodzi między widokami bez starych linii);
 * `load` — wczytanie legów (demo: linie przykładowe; PROD: `loadRoadLines` + `loadRoadLegs`, przeprawy z HERE).
 * Po wczytaniu rysuje zakres z chwili zakończenia (`e.lines.spec`), więc rysowanie z tworzenia mapy nie nadpisze
 * zakresu widoku (późniejszy widok wygrywa).
 */
export function drawCorridorLines(e: PoolEntry, spec: LinesSpec, load: boolean): Promise<void> {
  e.lines.spec = spec;
  const pre = scopeOfSpec(spec, e.lines.routeLegs);
  fitTracks.set(e.map, pre.tracks);
  const { route } = e.layers;
  paintHereFerries(e, pre);
  if (e.lines.legs) paintRoadLegs(route, linesInScope(e.lines.legs, pre).map((l) => l.line));
  if (!load) return Promise.resolve();
  /* DP-224 B (#817): legi już w puli sesji — Kokpit↔Mapa↔karta tylko przerysowuje zakres, bez map_display_state */
  if (e.lines.legs) return Promise.resolve();
  /* Bramka przez import.meta.env (nie PROD_BUILD), żeby Vite wyciął applyBasemap z paczki demo (I-2). */
  if (import.meta.env.VITE_AUTH_MODE !== 'supabase') {
    /* audyt D-07 (E45, E1): demo — odcinki lądowe; BN9-c5: legi przykładowe z kodem, ten sam filtr co PROD */
    e.lines.legs = DEMO_ROAD_LEGS.map((l) => ({ leg: l.leg, line: l.line }));
    paintRoadLegs(route, linesInScope(e.lines.legs, pre).map((l) => l.line));
    return Promise.resolve();
  }
  poolStats.roadsLoads += 1;
  return import('./applyBasemap').then(async ({ loadRoadLines, loadRoadLegs, loadFerryLines }) => {
    /* #667: `loadRoadLines` dociąga brakujące legi rdzenia (here-roads); legi z kodem z tego samego odczytu stanu */
    await loadRoadLines();
    const { legs, routeLegs } = await loadRoadLegs();
    e.lines.legs = legs;
    e.lines.routeLegs = routeLegs;
    /* zakres z chwili zakończenia (widok mógł się zmienić w trakcie wczytywania) — późniejszy widok wygrywa */
    const scope = scopeOfSpec(e.lines.spec, routeLegs);
    fitTracks.set(e.map, scope.tracks);
    paintRoadLegs(route, linesInScope(legs, scope).map((l) => l.line));
    /* E45 pkt 1 (L56): przeprawy według HERE, gdy serwer je poda; inaczej zostają stałe tory wodne */
    const { lines: ferries, summary } = await loadFerryLines();
    /* L56: na TEST widać, czy przeprawa jest z HERE, czy został stały tor — i dlaczego */
    if (summary) e.el.dataset.ferries = summary;
    e.lines.ferries = ferries;
    paintHereFerries(e, scopeOfSpec(e.lines.spec, routeLegs));
  }).catch(() => undefined);
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
export function acquireMap(root: HTMLElement, slot: MapSlot, spec?: LinesSpec): PoolEntry {
  if (inUse) {
    const one = build(false, root);
    one.slot = slot;
    slotOf.set(one.map, slot);
    if (spec) void drawCorridorLines(one, spec, false);
    if (slot !== 'drawer') fitCorridor(one.map);
    return one;
  }
  inUse = true;
  if (!entry) {
    entry = build(true, root);
    entry.slot = slot;
    slotOf.set(entry.map, slot);
    if (spec) void drawCorridorLines(entry, spec, false);
    if (slot !== 'drawer') fitCorridor(entry.map);
    return entry;
  }
  poolStats.reused += 1;
  const e = entry;
  e.slot = slot;
  slotOf.set(e.map, slot);
  /* BN9-c5: zakres linii widoku od razu (tory, legi już wczytane, kadr) — bez linii poprzedniego widoku */
  if (spec) void drawCorridorLines(e, spec, false);
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
    programmatic(e.map, () => e.map.setView(target?.center ?? L.latLng(DEFAULT_CENTER), target?.zoom ?? DEFAULT_ZOOM, { reset: true } as L.ZoomPanOptions));
    // Warstwy wektorowe od nowa w tej samej kolejności (obcięcie linii i wzór kresek jak w świeżej mapie). Bez kafelków.
    const { route, ferryLeg, detour, geofences, poi, fleet, situations, ais } = e.layers;
    const on = [route, ferryLeg, detour, geofences, poi, fleet, situations, ais].filter((l) => e.map.hasLayer(l));
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
    /* podkład zamówiony przed zamknięciem (plik podkładu jeszcze się pobiera) nie trafia już na usuniętą mapę —
       wcześniej: „Cannot read properties of undefined (reading 'appendChild')” po szybkim otwarciu panelu */
    e.basemapSeq += 1;
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
  /* DP-76: zmiana motywu na żywo — tory promów (stałe i z HERE) w stylu nowego motywu, także gdy podkład jest
     w awarii / ponawianiu (`tilesTheme` = null); własny znacznik `lanesTheme`, bez przerysowania w tym samym motywie */
  if (e.lanesTheme !== theme) {
    restyleFerryLanes(e.layers.ferryLeg, theme);
    e.lanesTheme = theme;
  }
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
  return import('./applyBasemap').then(({ applyBasemap }) => (e.basemapSeq !== seq ? e.layers.tiles : applyBasemap(e.map, e.layers.tiles, theme, () => {
    // Budżet D-78 zamknięty — przełóż podkład (zapas) dla bieżącego motywu.
    if (e.basemapSeq !== seq) return;
    e.tilesTheme = null;
    void ensureBasemap(e, useTowerStore.getState().theme);
  }))).then((layer) => {
    if (e.basemapSeq !== seq) {
      if (e.map.hasLayer(layer) && layer !== e.layers.tiles) e.map.removeLayer(layer);
      return e.layers.tiles;
    }
    e.layers.tiles = layer;
    markLoaded(layer);
    return layer;
  }, onChunkFail);
}

/** Tylko testy: wspólna mapa (warstwy linii tras). */
export function __poolEntryForTests(): PoolEntry | null {
  return entry;
}

/** Tylko testy. */
export function __resetMapPool(): void {
  entry = null;
  inUse = false;
  holder = null;
  poolStats.created = 0; poolStats.reused = 0; poolStats.oneOff = 0; poolStats.destroyed = 0; poolStats.roadsLoads = 0;
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

/**
 * DP-7: stałe tory wodne do warstwy promu — linie z `ferryLaneLines` (jedno źródło dla mapPool i CorridorMap).
 * DP-76: styl z `ferryLaneOptions(theme)` (domyślnie bieżący motyw aplikacji).
 */
export function drawFerryLanes(
  layer: L.LayerGroup,
  skipLegs: ReadonlySet<string> = new Set(),
  theme: ThemeName = useTowerStore.getState().theme,
  tracks: ReadonlySet<WaterTrackId> = CORE_LANE_TRACKS,
): void {
  const opts = ferryLaneOptions(theme);
  for (const line of ferryLaneLines(skipLegs, tracks)) L.polyline(line.map(([lat, lng]) => L.latLng(lat, lng)), opts).addTo(layer);
}
