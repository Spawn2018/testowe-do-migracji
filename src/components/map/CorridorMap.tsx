import { Suspense, lazy, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { activeDriver } from '../../lib/activeDriver';
import L from 'leaflet';

import { useTowerStore } from '../../store/useTowerStore';
import { t } from '../../i18n/messages';
import { fetchSituations, type RoadSituation } from '../../lib/trafikverket';
import { PROD_BUILD, shows } from '../../lib/prodFacade';
import { demoFleetMarkers, prodFleetMarkers, type VehicleMarkerIn } from '../../lib/vehicleMarkers';
import { subscribeFerryPositions, type AisPosition } from '../../lib/ais';
import { formatOpsDateTime } from '../../lib/time';
import type { Load } from '../../types';
import { truckDivIcon, ferryDivIcon } from '../../lib/mapMarkers';
import { nextLiveSailing } from '../../lib/ferry';
import { geofenceDisplayName, severityLabel } from '../../lib/enumLabels';
import { getNowIso, isFrozenNow } from '../../lib/frozenNow';
import { ferryMarkerTone } from '../../lib/ferry/stenaAis';
import { isServerId } from '../../data/registry';
import { transportLabel } from '../../lib/transportName';
import { SUPABASE_AUTH_ENABLED } from '../../auth/config';
import { h6Requests } from '../../lib/map/draw';
import { routeOfVessel, vesselKeyOf } from '../../lib/vesselGroups';
import { vesselsLoader } from '../../lib/vesselsLoad';
import { useVesselGroups } from '../../lib/useVesselGroups';
import {
  acquireMap, attributionOf, drawFerryLanes, ensureBasemap, FERRY_LANE_STYLE, fitCorridor, releaseMap, retryBasemap, subscribeBasemapHealth,
  type BasemapHealth, type LayerBag, type MapSlot, type PoolEntry,
} from './mapPool';
import { BasemapFailCard } from './BasemapFailCard';
import { hm, mapRow, markerTone, type MapRow, type MarkerTone } from '../../lib/p9cMap';
import { stageTileOf } from '../../lib/stageTiles';
import { p9m, p9mp } from '../../i18n/p9c';
import {
  demoStageAnchor, groupView, placeMarkers, splitLabel, vesselKey,
  type FerryInfo, type GroupItem, type GroupView, type GroupZone, type Placed, type ShipFix,
  estNote,
} from '../../lib/p9eGroups';
import { p9e, p9ep } from '../../i18n/p9e';
import { formatListDateTime } from '../../lib/format';
import { TZ_OPS } from '../../lib/time';
import { useIsPhone } from '../../lib/useIsPhone';
import { GroupList } from './GroupList';
import { drawerMapNote } from '../../lib/p9fNote';
import { detourLinesOf, subscribeDetourLines } from '../../lib/e49Source';
import { detourLineOk, detourLineTip } from '../../lib/e49Detour';
import { e49t } from '../../i18n/e49';
import { lazyRetry } from '../../lib/lazyRetry';
import { etaDuration } from '../../lib/etaDuration';

/* III-5 — odtwarzanie przebiegu z bazy: tylko build Supabase (chunk leniwy); demo bez zmian */
const TrackReplay = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(lazyRetry(() => import('./TrackReplay'))) : null;


function statusColor(status: string): string {
  switch (status) {
    case 'LOADING':
    case 'RESOURCES_PENDING':
    case 'READY':
      return '#E5A544';
    case 'ON_FERRY':
    case 'IN_TRANSIT_PL':
    case 'IN_TRANSIT_SE':
    case 'AT_PORT_SE':
    case 'AT_PORT':
      return '#6BA8D6';
    case 'DELAYED':
      return '#E8687C';
    case 'SILENT':
      return '#748896';
    case 'APPROACHING_SITE':
    case 'UNLOADING':
    case 'DELIVERED':
      return '#4FB79E';
    case 'DOC_MISSING':
      return '#7E93A1';
    default:
      return '#6BA8D6';
  }
}


function severityColor(severity: string): string {
  if (severity === 'CRITICAL' || severity === 'HIGH') return '#E8687C';
  if (severity === 'MEDIUM') return '#E5A544';
  return '#7E93A1';
}

const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/**
 * wyglad/P9-c (E29 pkt 4 i 7, makieta `makiety_html/E29/map.html`): znacznik według etapu E28 — załadunek, w drodze,
 * na placu; opóźnienie = czerwona obwódka, brak GPS = wyszarzenie; podpis z nazwą (E41) na stronie Mapa.
 */
function vehicleIcon(row: MapRow, label: string | null): L.DivIcon {
  const tone = markerTone(row.tile);
  const cls = ['wt-mk', `is-${tone}`, row.late ? 'is-late' : '', row.nogps ? 'is-nogps' : ''].filter(Boolean).join(' ');
  return L.divIcon({
    className: 'wt-marker',
    html: `<div class="${cls}" data-mk="${tone}"><i class="wt-mk-arrow"></i>${label ? `<span class="wt-mk-lb">${esc(label)}</span>` : ''}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

/** Dymek znacznika (E29 pkt 7): nazwa · etap / opóźnienie · ETA / ostatnia pozycja · odcinek / kliknij. */
function vehicleTip(row: MapRow, locale: Parameters<typeof t>[0], est: string | null = null): string {
  const l1 = `<b>${esc(row.label)}</b> · ${esc(t(locale, row.stageKey))}`;
  const eta = row.eta.main && row.eta.main !== p9m(locale, 'p9c_eta_none') ? p9mp(locale, 'p9c_tip_eta', { eta: row.eta.main }) : '';
  const late = row.late && row.delayMin ? `<span class="r">${esc(p9mp(locale, 'p9c_tip_late', { d: etaDuration(row.delayMin) }))}</span>` : '';
  const l2 = [late, esc(eta)].filter(Boolean).join(' · ');
  const last = row.pos.kind === 'nogps' ? row.pos.text : row.lastFixAt ? p9mp(locale, 'p9c_tip_last', { t: row.pos.text }) : '';
  const l3 = [last, p9m(locale, `p9c_tip_seg_${row.seg}`)].filter(Boolean).map(esc).join(' · ');
  /* J-17: pozycja szacowana statku (auto na promie bez grupy) — osobna linia przed „kliknij” */
  const l4 = est ? `<span class="g">${esc(est)}</span>` : '';
  return [l1, l2, `<span class="g">${l3}</span>`, l4, `<span class="g">${esc(p9m(locale, 'p9c_tip_click'))}</span>`].filter((x) => x && x !== '<span class="g"></span>').join('<br>');
}
/**
 * wyglad/P9-e (E45 pkt 5, R5): znacznik grupy — auta jednego rejsu na statku (strzałka statku) albo kilka aut w jednej
 * strefie; liczba aut w pomarańczowym kółku (makieta `a-ferry.webp`). Bez AIS — wyszarzony, w dymku „brak AIS”.
 */
const ZONE_TONE: Record<string, MarkerTone> = { LOADING: 'load', PORT_OUT: 'road', PORT_IN: 'road', SITE: 'site' };
function groupIcon(g: Extract<Placed, { kind: 'ferry' | 'zone' }>): L.DivIcon {
  const n = g.ids.length;
  const tone: MarkerTone = g.kind === 'ferry' ? 'road' : ZONE_TONE[g.zoneType] ?? 'road';
  const cls = [
    'wt-mk', 'is-grp', `is-${tone}`,
    g.kind === 'ferry' ? 'is-ship' : '',
    g.kind === 'ferry' && g.ais === 'none' ? 'is-noais' : '',
    g.kind === 'ferry' && g.ais === 'est' ? 'is-est' : '',
    g.late ? 'is-late' : '',
  ].filter(Boolean).join(' ');
  return L.divIcon({
    className: 'wt-marker',
    /* liczba obok kółka (nie w nim) — przy wyszarzeniu „brak AIS” zostaje czytelna */
    html: `<div class="wt-mk-grp"><div class="${cls}" data-mk="${g.kind}" data-n="${n}">${g.kind === 'ferry' ? '<i class="wt-mk-arrow"></i>' : ''}</div><span class="wt-mk-n">${n}</span></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}
/** Dymek grupy: tytuł · liczba aut / rejs albo rodzaj miejsca / nazwy (E41) / AIS / „kliknij: lista transportów”. */
const GROUP_TIP_NAMES = 6;
function groupTip(v: GroupView, locale: Parameters<typeof t>[0]): string {
  /* E45 pkt 5: najechanie — rejs i kody */
  const names = v.rows.slice(0, GROUP_TIP_NAMES).map((r) => esc(splitLabel(r.label).code)).join(' · ')
    + (v.rows.length > GROUP_TIP_NAMES ? ` ${esc(p9ep(locale, 'p9e_more', { n: v.rows.length - GROUP_TIP_NAMES }))}` : '');
  return [
    `<b>${esc(v.title)}</b>`,
    v.sub ? esc(v.sub) : '',
    names,
    v.note ? `<span class="g">${esc(v.note)}</span>` : '',
    `<span class="g">${esc(p9e(locale, 'p9e_tip_click'))}</span>`,
  ].filter(Boolean).join('<br>');
}

/** Podpisy na stronie Mapa: przy ≤ 15 autach zawsze, przy większej liczbie od przybliżenia 7 (bez zasłaniania trasy). */
const LABELS_MAX = 15;
/** E1 (Przegląd): przybliżenie na pojeździe i odstęp podążania. */
const DRAWER_ZOOM = 11;
const FOLLOW_MS = 60_000;
/** audyt D-03: podświetlony znacznik nad innymi (grupy mają 1000). */
const HOVER_Z = 3000;

export function CorridorMap({ loads, embedded = false, slot = embedded ? 'kokpit' : 'map', onMarker }: {
  loads: Load[];
  embedded?: boolean;
  slot?: MapSlot;
  /** wyglad/P9-c (E29 pkt 9): telefon — dotknięcie znacznika otwiera arkusz zamiast panelu. */
  onMarker?: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<LayerBag | null>(null);
  const entryRef = useRef<PoolEntry | null>(null);
  /* DP-17 (F7 r2 #672): statki z bazy także na mapach (jedna pamięć z Rejsami).
     B1 (F7 #674): wersja listy jest zależnością efektu rysowania — po pobraniu dymki się przerysowują (także w PROD). */
  const vessels = useVesselGroups();
  useEffect(() => {
    vesselsLoader?.load().catch(() => {
      console.warn('[Mapa] lista statków z bazy niedostępna — lista zapasowa');
    });
  }, []);
  const theme = useTowerStore((s) => s.theme);
  /* E41: podpis znacznika i przebieg — nazwa transportu według firmy, która patrzy */
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const mapLayers = useTowerStore((s) => s.mapLayers);
  const geofences = useTowerStore((s) => s.geofences);
  const selectLoad = useTowerStore((s) => s.selectLoad);
  const setHoverLoad = useTowerStore((s) => s.setHoverLoad);
  /* audyt D-03 (E29, 08.10): najechanie na wiersz tabeli podświetla znacznik (albo znacznik grupy z tym autem) */
  const hoverLoadId = useTowerStore((s) => s.hoverLoadId);
  const selectedLoadId = useTowerStore((s) => s.selectedLoadId);
  const focusMode = useTowerStore((s) => s.focusMode);
  const mapFocusKey = useTowerStore((s) => s.mapFocusKey);
  const toggleMapFocus = useTowerStore((s) => s.toggleMapFocus);
  const navigateTo = useTowerStore((s) => s.navigateTo);
  const risks = useTowerStore((s) => s.risks);
  const sailings = useTowerStore((s) => s.sailings);
  /* wyglad/P9-f (E32 pkt 3): Przegląd w panelu — transport panelu także poza oknem śledzenia (dopisek pod mapą) */
  const allLoads = useTowerStore((s) => s.loads);
  const panelLoad = slot === 'drawer' && selectedLoadId ? allLoads.find((l) => l.id === selectedLoadId) ?? null : null;
  const panelAtSite = !!panelLoad && stageTileOf(panelLoad) === 'SITE';
  const events = useTowerStore((s) => s.events);
  /* „Na placu od …” — ostatni wjazd do strefy placu (jak w Kokpicie, B3 / H3.5) */
  const panelSiteSince = (() => {
    if (!panelLoad || !panelAtSite) return null;
    let best: string | null = null;
    for (const e of events) {
      if (e.loadId !== panelLoad.id || e.type !== 'GEOFENCE_ENTER') continue;
      const pl = (e.payload ?? {}) as { geofence_type?: string; zone?: string };
      if (pl.geofence_type !== 'SITE' && pl.zone !== 'SITE') continue;
      if (!best || Date.parse(e.at) > Date.parse(best)) best = e.at;
    }
    return best;
  })();
  const onMarkerRef = useRef(onMarker);
  onMarkerRef.current = onMarker;
  /* wyglad/P9-e: otwarta lista grupy (klucz) i widoki grup z ostatniego rysowania */
  const phone = useIsPhone();
  const phoneRef = useRef(phone);
  phoneRef.current = phone;
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const groupViewsRef = useRef<Map<string, GroupView>>(new Map());
  const closeGroup = useCallback(() => setOpenGroup(null), []);
  /* E1 (Przegląd): przybliżenie 11 na ostatniej pozycji, podążanie co 60 s, póki użytkownik nie ruszy mapy */
  const programmaticRef = useRef(false);
  const userMovedRef = useRef(false);
  const lastFollowRef = useRef(0);
  const followedIdRef = useRef<string | null>(null);
  const [tick, setTick] = useState(0);
  const [situations, setSituations] = useState<RoadSituation[]>([]);
  const [aisPositions, setAisPositions] = useState<AisPosition[]>([]);
  const [gpsFixes, setGpsFixes] = useState<Map<string, { lat: number; lng: number }>>(() => new Map());
  const [gpsReady, setGpsReady] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [mapReady, setMapReady] = useState<L.Map | null>(null);
  /* AUD-01: produkcja — dane mapy (pozycje, trasa, sytuacje, AIS) dopiero po narysowaniu podkładu (albo po 1,5 s). */
  const [basemapReady, setBasemapReady] = useState(import.meta.env.VITE_AUTH_MODE !== 'supabase');
  /* wyglad/P9-a (E24-1): stan podkładu — po 3 nieudanych próbach komunikat zamiast szarej mapy */
  const [health, setHealth] = useState<BasemapHealth | null>(null);
  const [retrying, setRetrying] = useState(false);
  /* III-5: odtwarzany transport = ostatnio wybrany (zostaje po zamknięciu szuflady, znika po wyłączeniu warstwy „Ślad”) */
  const [replayId, setReplayId] = useState<string | null>(null);
  useEffect(() => { if (selectedLoadId && isServerId(selectedLoadId)) setReplayId(selectedLoadId); }, [selectedLoadId]);
  /* wyglad/P9-e: kliknięcie w mapę poza znacznikiem zamyka listę grupy */
  useEffect(() => {
    if (!mapReady) return undefined;
    mapReady.on('click', closeGroup);
    return () => { mapReady.off('click', closeGroup); };
  }, [mapReady, closeGroup]);

  const selectLoadRef = useRef(selectLoad);
  const setHoverLoadRef = useRef(setHoverLoad);
  const toggleMapFocusRef = useRef(toggleMapFocus);
  const navigateToRef = useRef(navigateTo);
  const risksRef = useRef(risks);
  const mapFocusKeyRef = useRef(mapFocusKey);
  selectLoadRef.current = selectLoad;
  setHoverLoadRef.current = setHoverLoad;
  toggleMapFocusRef.current = toggleMapFocus;
  navigateToRef.current = navigateTo;
  risksRef.current = risks;
  mapFocusKeyRef.current = mapFocusKey;
  /* audyt D-03: znaczniki z ostatniego rysowania — podświetlenie bez rysowania od nowa (najechanie nie przerysowuje mapy) */
  const hoverRef = useRef(hoverLoadId);
  hoverRef.current = hoverLoadId;
  const hoverMarksRef = useRef<{ m: L.Marker; ids: readonly string[]; z: number }[]>([]);
  const applyHover = useCallback((id: string | null) => {
    for (const h of hoverMarksRef.current) {
      const on = !!id && h.ids.includes(id);
      h.m.getElement()?.classList.toggle('is-hover', on);
      h.m.setZIndexOffset(on ? HOVER_Z : h.z);
    }
  }, []);
  useEffect(() => { applyHover(hoverLoadId); }, [hoverLoadId, applyHover]);

  useEffect(() => {
    if (!shows('roadSituationsSe')) return; // I-2e: produkcja — bez źródła nie rysujemy zdarzeń przykładowych
    if (!basemapReady) return;
    let cancelled = false;
    fetchSituations().then((r) => {
      if (!cancelled) {
        setSituations(r.items);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [basemapReady]);

  useEffect(() => {
    if (!basemapReady) return undefined;
    return subscribeFerryPositions({
      prod: PROD_BUILD,
      onUpdate: (pos, mode) => {
        // I-2e/I-2j: produkcja — nigdy pozycje przykładowe (seed); tylko pozycje z bazy (vessel_positions) z czasem sygnału
        if (mode === 'seed' && !shows('aisSeedPositions')) { setAisPositions([]); return; }
        setAisPositions(pos);
      },
    });
  }, [basemapReady]);

  useEffect(() => {
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase' || !basemapReady) return undefined;
    let cancelled = false;
    const ids = loads.map((l) => l.id);
    const run = () => {
      void import('../../lib/vehiclePositions').then(({ fetchLatestVehicleFixes }) => fetchLatestVehicleFixes(ids)).then(
        (rows) => {
          if (cancelled) return;
          setGpsFixes(new Map(rows.map((r) => [r.loadId, { lat: r.lat, lng: r.lng }])));
          setGpsReady(true);
        },
        () => {
          if (cancelled) return;
          setGpsFixes(new Map());
          setGpsReady(true);
        },
      );
    };
    run();
    const id = window.setInterval(run, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [loads, basemapReady]);

  useEffect(() => {
    // D15/G5: przy zamrożonym czasie (?now=, VITE_FROZEN_NOW) bez dryfu pozycji — ujęcia deterministyczne
    // niezależnie od chwili zamontowania mapy (leniwy kawałek).
    if (isFrozenNow() || PROD_BUILD) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    /* AUD-01e: jedna mapa na sesję — wpinana do kontenera widoku, przy zamknięciu odkładana (nie niszczona). */
    const pooled = acquireMap(containerRef.current, slot);
    const { map } = pooled;
    entryRef.current = pooled;
    layersRef.current = pooled.layers;
    mapRef.current = map;
    const onZoom = () => setZoom(map.getZoom());
    map.on('zoomend', onZoom);
    setMapReady(map);

    let alive = true;
    const safeInvalidate = () => {
      if (!alive) return;
      try {
        if (!map.getPane('mapPane')) return;
        map.invalidateSize({ animate: false });
      } catch {
        /* mapa już usunięta / panel niegotowy */
      }
    };
    /* E1: Kokpit i Mapa — kadr całej trasy także po zmianie rozmiaru (bez zapamiętywania przesunięcia) */
    let refitRaf = 0;
    const refit = () => {
      if (!alive || slot === 'drawer') return;
      cancelAnimationFrame(refitRaf);
      refitRaf = requestAnimationFrame(() => { if (alive) fitCorridor(map); });
    };
    const raf = requestAnimationFrame(() => safeInvalidate());
    const t = window.setTimeout(() => safeInvalidate(), 250);
    let lastSize = '';
    /* audyt D-05: podpis podkładu dochodzi po wczytaniu podkładu (zmienia wysokość) — kadr liczony od nowa */
    const attr = attributionOf(map);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
      safeInvalidate();
      const size = `${pooled.el.clientWidth}x${pooled.el.clientHeight}:${attr?.offsetHeight ?? 0}`;
      if (size !== lastSize) refit();
      lastSize = size;
    }) : null;
    if (ro) ro.observe(pooled.el);
    if (ro && attr) ro.observe(attr);
    /* E1 (Przegląd): użytkownik przesunął albo przybliżył → mapa przestaje podążać za pojazdem */
    const onUserMove = () => { if (!programmaticRef.current) userMovedRef.current = true; };
    map.on('dragstart', onUserMove);
    map.on('zoomstart', onUserMove);

    return () => {
      alive = false;
      cancelAnimationFrame(refitRaf);
      map.off('dragstart', onUserMove);
      map.off('zoomstart', onUserMove);
      cancelAnimationFrame(raf);
      clearTimeout(t);
      ro?.disconnect();
      map.off('zoomend', onZoom);
      releaseMap(pooled, slot);
      entryRef.current = null;
      mapRef.current = null;
      layersRef.current = null;
      setMapReady(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const pooled = entryRef.current;
    if (!pooled || !mapReady) return;
    let cancelled = false;
    let off: (() => void) | null = null;
    void ensureBasemap(pooled, theme).then((layer) => {
      if (cancelled) return;
      if (pooled.tilesLoaded) { setBasemapReady(true); return; }
      const done = () => { if (!cancelled) setBasemapReady(true); };
      layer.once('load', done);
      off = () => { layer.off('load', done); };
    });
    const readyTimer = window.setTimeout(() => { if (!cancelled) setBasemapReady(true); }, 1500);
    return () => { cancelled = true; off?.(); window.clearTimeout(readyTimer); };
  }, [theme, mapReady]);

  useEffect(() => {
    const pooled = entryRef.current;
    if (!pooled || !mapReady) return undefined;
    return subscribeBasemapHealth(pooled, (h) => {
      setHealth(h);
      if (h.state !== 'loading') setRetrying(false);
    });
  }, [mapReady]);

  /* E45 (D-20261016-0230-01 Z3 pkt 8): po decyzji SCX „Jedziemy objazdem” — przerywana linia objazdu (geometria HERE)
     z podpisem „kod · objazd przez …: +km, +czas · decyzja SCX”. Przegląd w panelu — tylko transport panelu. */
  const [detourTick, setDetourTick] = useState(0);
  useEffect(() => subscribeDetourLines(() => setDetourTick((n) => n + 1)), []);
  useEffect(() => {
    const layers = layersRef.current;
    if (!mapReady || !layers) return;
    layers.detour.clearLayers();
    const scope = panelLoad ? [panelLoad] : focusMode && selectedLoadId ? loads.filter((l) => l.id === selectedLoadId) : loads;
    const byId = new Map(scope.map((l) => [l.id, l]));
    for (const d of detourLinesOf(scope, getNowIso())) {
      const l = byId.get(d.loadId);
      if (!l || !detourLineOk(d.line)) continue;
      L.polyline(d.line.map(([lat, lng]) => L.latLng(lat, lng)), {
        color: '#E5A544', weight: 4, opacity: 1, dashArray: '8 6', className: 'wt-detour',
      })
        .bindTooltip(detourLineTip(transportLabel(l, role), d, e49t), { direction: 'top', sticky: true, className: 'wt-detour-tip' })
        .addTo(layers.detour);
    }
  }, [mapReady, loads, panelLoad, focusMode, selectedLoadId, role, detourTick]);

  useEffect(() => {
    if (!mapReady || !basemapReady || import.meta.env.VITE_AUTH_MODE !== 'supabase') return;
    let cancelled = false;
    void Promise.all([import('./applyBasemap'), import('./orangeRoads')]).then(async ([{ loadRoadLines }, { paintOrangeRoads }]) => {
      const lines = await loadRoadLines();
      const layers = layersRef.current;
      if (cancelled || !layers) return;
      paintOrangeRoads(layers.route, lines);
    });
    /* E45 pkt 1 (L56): przeprawy według HERE, gdy serwer je poda; inaczej zostają stałe tory wodne z `mapPool` */
    void import('./applyBasemap').then(({ loadFerryLines }) => loadFerryLines()).then(({ lines: ferries, summary }) => {
      const layers = layersRef.current;
      /* L56: na TEST widać, czy przeprawa jest z HERE, czy został stały tor — i dlaczego */
      if (!cancelled && summary && entryRef.current) entryRef.current.el.dataset.ferries = summary;
      if (cancelled || !layers || ferries.length === 0) return;
      layers.ferryLeg.clearLayers();
      for (const f of ferries) L.polyline(f.line.map(([lat, lng]) => L.latLng(lat, lng)), FERRY_LANE_STYLE).addTo(layers.ferryLeg);
      /* DP-7: przeprawa bez odcinka z HERE i tory Korytarza bałtyckiego — to samo rysowanie co przy tworzeniu mapy */
      drawFerryLanes(layers.ferryLeg, new Set(ferries.map((f) => f.leg)));
    });
    return () => { cancelled = true; };
  }, [mapReady, basemapReady]);

  /* BN9-b: tory nowych przepraw rysuje teraz zawsze warstwa promu (`mapPool` → ferryLeg) — bez osobnej warstwy */

  useEffect(() => {
    const map = mapRef.current;
    const layers = layersRef.current;
    if (!map || !layers) return;

    const setVis = (layer: L.Layer, on: boolean) => {
      if (on) {
        if (!map.hasLayer(layer)) layer.addTo(map);
      } else if (map.hasLayer(layer)) {
        map.removeLayer(layer);
      }
    };
    /* E45 pkt 2–3 (potwierdzone 07.10 22:42): „Trasa” = droga i prom razem; statki AIS pod „Pojazdy”; bez kropek */
    setVis(layers.route, !!mapLayers.route);
    setVis(layers.ferryLeg, !!mapLayers.route);
    /* E45 (Z3 pkt 8): linia objazdu w tej samej warstwie co trasa — chowa ją „Trasa” */
    setVis(layers.detour, !!mapLayers.route);
    setVis(layers.geofences, !!mapLayers.geofence);
    setVis(layers.poi, false);
    setVis(layers.fleet, !!mapLayers.vehicles);
    setVis(layers.situations, !!mapLayers.seEvents);
    setVis(layers.ais, !!mapLayers.vehicles);

    layers.geofences.clearLayers();
    if (mapLayers.geofence) {
      for (const g of geofences) {
        // Cap display radius so 20–50 km fences don't paint solid chrome blobs
        const r = Math.min(g.radiusM, 2500);
        const gfKey = `gf:${g.id}`;
        const circ = L.circle([g.lat, g.lng], {
          radius: r,
          color: mapFocusKeyRef.current === gfKey ? '#E5A544' : '#6BA8D6',
          weight: mapFocusKeyRef.current === gfKey ? 2 : 1,
          fillColor: '#6BA8D6',
          fillOpacity: g.radiusM > 2500 ? 0.06 : 0.14,
          dashArray: g.radiusM > 2500 ? '4 6' : undefined,
        });
        circ.bindTooltip(`${g.name}${g.radiusM > 2500 ? ` · ${Math.round(g.radiusM / 1000)} km` : ''}`, {
          direction: 'top',
        });
        circ.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          const was = mapFocusKeyRef.current === gfKey;
          toggleMapFocusRef.current(gfKey);
          if (was) {
            // 2nd click: clear only — do not open Prom/Ryzyka
            navigateToRef.current({ riskFilter: null });
          }
          // 1st click: select/focus only; stay on map
        });
        circ.addTo(layers.geofences);
      }
    }

    layers.fleet.clearLayers();
    hoverMarksRef.current = [];
    /* wyglad/P9-f (E32 pkt 3): na placu — strefa placu na mapie Przeglądu (bez względu na warstwę „Strefy”) */
    if (slot === 'drawer' && panelAtSite && mapLayers.vehicles) {
      for (const g of geofences) {
        if (!g.active || g.type !== 'SITE') continue;
        L.circle([g.lat, g.lng], { radius: g.radiusM, color: '#1B6E5D', weight: 1.5, fillColor: '#1B6E5D', fillOpacity: 0.12, interactive: false })
          .addTo(layers.fleet);
      }
    }
    /* wyglad/P9-e: statki, na których pozycji stoi znacznik rejsu z liczbą aut — bez drugiego znacznika w warstwie AIS */
    const takenShips = new Set<string>();
    if (!mapLayers.vehicles) groupViewsRef.current = new Map();
    if (mapLayers.vehicles) {
      const visibleLoads =
        focusMode && selectedLoadId ? loads.filter((l) => l.id === selectedLoadId) : loads;
      const markerIn: VehicleMarkerIn[] = visibleLoads.map((l) => ({
        id: l.id,
        code: transportLabel(l, role),
        status: l.status,
        progress: l.progress,
        /* E29/E6: kierowca i ciągnik z odcinka, na którym auto jest teraz (wyglad/E6-tel) */
        driver: activeDriver(l).name,
        plate: activeDriver(l).tractor,
      }));
      const zones: GroupZone[] = geofences.map((g) => ({
        id: g.id, name: g.name, type: g.type, lat: g.lat, lng: g.lng, radiusM: g.radiusM, active: g.active,
      }));
      const loadOf = new Map(visibleLoads.map((l) => [l.id, l]));
      /* wyglad/P9-e: demo — auto w strefie swojego etapu (załadunek, port, plac) albo na morzu (prom) */
      const demoAnchored = () => demoFleetMarkers(markerIn, tick).map((f) => {
        const l = loadOf.get(f.id);
        const a = l ? demoStageAnchor(stageTileOf(l), zones) : null;
        return a ? { ...f, lat: a.lat, lng: a.lng } : f;
      });
      const ferryKeyOf = (l: Load | undefined): string | null => {
        if (!l) return null;
        if (l.sailingId) return l.sailingId;
        /* bez przypisanego rejsu: statek (jeden statek płynie w danej chwili jednym rejsem) */
        return l.ferry.vessel ? `v:${vesselKey(l.ferry.vessel)}` : null;
      };
      const ferryInfo = (fk: string): FerryInfo | null => {
        const s = sailings.find((x) => x.id === fk);
        if (s) return { vessel: s.vessel, route: s.route, departureAt: s.delayedDepartureAt ?? s.departureAt };
        const l = visibleLoads.find((x) => ferryKeyOf(x) === fk);
        if (!l) return null;
        const ls = l.sailingId ? undefined : sailings.find((x) => vesselKeyOf(x.vessel) === vesselKeyOf(l.ferry.vessel) && x.departureAt === l.ferry.departureAt);
        /* DP-4: bez rejsu — trasa z armatora statku (jedna trasa wyjazdowa), nie domyślne GDN-NYN */
        return { vessel: l.ferry.vessel, route: ls?.route ?? routeOfVessel(l.ferry.vessel, vessels), departureAt: l.ferry.departureAt };
      };
      const shipOf = (fk: string): ShipFix | null => {
        const v = vesselKey(ferryInfo(fk)?.vessel);
        if (!v) return null;
        /* I-2e: pozycje przykładowe (seed) nie są pozycją statku */
        const p = aisPositions.find((x) => x.source !== 'seed' && vesselKey(x.name) === v);
        if (!p) return null;
        return { lat: p.lat, lng: p.lng, ts: p.ts, stale: !p.estimated && ferryMarkerTone(p.ts, getNowIso()) === 'stale', vessel: p.name, estimated: p.estimated };
      };
      const fleet0 = PROD_BUILD ? prodFleetMarkers(markerIn, gpsFixes) : demoAnchored();
      /* 22.10.2026 (SG-17 „stoi w porcie”): tracker milknie na promie — auto „Na promie” stoi na pozycji statku z AIS
         (Mapa, Kokpit, Przegląd i tryb skupienia; centrowanie Przeglądu za statkiem). Statek nie jest rysowany drugi raz. */
      /* J-17 (audyt 25.10): auto na pozycji szacowanej statku (Przegląd, tryb skupienia — bez grup) — dopisek w dymku */
      const estById = new Map<string, string | null>();
      const fleet = PROD_BUILD
        ? fleet0.map((f) => {
          const l = loadOf.get(f.id);
          const fk = l && stageTileOf(l) === 'FERRY' ? ferryKeyOf(l) : null;
          const ship = fk ? shipOf(fk) : null;
          if (!ship) return f;
          takenShips.add(vesselKey(ship.vessel));
          if (ship.estimated) estById.set(f.id, ship.estimated.lastAisTs ?? null);
          return { ...f, lat: ship.lat, lng: ship.lng };
        })
        : fleet0;
      /* E29 pkt 4 i 7: etap, opóźnienie, brak GPS i dymek z tych samych danych co tabela Mapy */
      const loc = useTowerStore.getState().locale;
      const nowIso = getNowIso();
      const byId = new Map(visibleLoads.map((l) => [l.id, l]));
      const rowOf = (id: string): MapRow | null => {
        const l = byId.get(id);
        if (!l) return null;
        return mapRow(l, {
          role, nowIso, prod: PROD_BUILD, hasFix: (x) => gpsFixes.has(x),
          sailingOf: (sid) => (sid ? sailings.find((x) => x.id === sid) : undefined),
          tx: (k, p) => (p ? p9mp(loc, k, p) : p9m(loc, k)),
          vessels,
        });
      };
      const labels = !embedded && (fleet.length <= LABELS_MAX || zoom >= 7);
      if (slot === 'drawer') {
        const f = fleet[0];
        const nowMs = Date.now();
        if (f && followedIdRef.current !== f.id) { followedIdRef.current = f.id; userMovedRef.current = false; lastFollowRef.current = 0; }
        if (f && !userMovedRef.current && nowMs - lastFollowRef.current >= FOLLOW_MS) {
          programmaticRef.current = true;
          try { map.setView([f.lat, f.lng], DRAWER_ZOOM, { animate: false }); } finally { programmaticRef.current = false; }
          lastFollowRef.current = nowMs;
        } else if (!f && followedIdRef.current !== '-') {
          /* brak pozycji GPS → cała trasa i „Brak pozycji GPS” */
          followedIdRef.current = '-';
          programmaticRef.current = true;
          try { fitCorridor(map); } finally { programmaticRef.current = false; }
        }
      }
      /* wyglad/P9-e (E45 pkt 5, R5): auta jednego rejsu na promie — jeden znacznik na statku z AIS; więcej niż 1 auto
         w strefie załadunku, portu PL, portu SE albo placu — jeden znacznik z liczbą. Przegląd i tryb skupienia bez grup. */
      const fleetById = new Map(fleet.map((f) => [f.id, f]));
      const groupItems: GroupItem[] = fleet.map((f) => {
        const row = rowOf(f.id);
        return {
          id: f.id, lat: f.lat, lng: f.lng, tile: row?.tile ?? null, ferryKey: ferryKeyOf(byId.get(f.id)),
          lastFixAt: row?.lastFixAt ?? null, late: !!row?.late,
        };
      });
      const placed = placeMarkers(groupItems, {
        zones, shipOf, grouping: slot !== 'drawer' && !(focusMode && selectedLoadId),
      });
      const views = new Map<string, GroupView>();
      const groupMarkers: L.Marker[] = [];
      for (const g of placed) {
        if (g.kind === 'one') continue;
        if (g.kind === 'ferry' && g.ais !== 'none' && g.vessel) takenShips.add(vesselKey(g.vessel));
        const v = groupView(g, {
          nowIso,
          row: (id) => { const r = rowOf(id); return r ? { id, label: r.label, stageKey: r.stageKey, late: r.late } : null; },
          ferryInfo,
          tx: (k, p) => (p ? p9ep(loc, k, p) : p9e(loc, k)),
          hm,
          dt: (iso) => formatListDateTime(iso, TZ_OPS),
        });
        views.set(g.key, v);
        const gm = L.marker([g.lat, g.lng], { icon: groupIcon(g), keyboard: false, zIndexOffset: 1000 });
        if (!onMarkerRef.current && !phoneRef.current) {
          gm.bindTooltip(groupTip(v, loc), { direction: 'top', offset: [0, -16], className: 'wt-mk-tip' });
        }
        gm.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          gm.closeTooltip();
          /* jedno auto na promie — od razu panel (jak zwykły znacznik) */
          if (g.ids.length === 1) {
            if (onMarkerRef.current) onMarkerRef.current(g.ids[0]);
            else selectLoadRef.current(g.ids[0]);
            return;
          }
          setOpenGroup(g.key);
        });
        groupMarkers.push(gm);
        hoverMarksRef.current.push({ m: gm, ids: g.ids, z: 1000 });
      }
      groupViewsRef.current = views;
      /* III-5 (SCOPE 5.10): produkcja — pozycje z bazy/statusu często w tym samym punkcie (np. plac załadunku);
         nakładające się znaczniki rozkładamy na okręgu/spirali (≥ 22 px), by etykiety i kliknięcia nie kolidowały.
         Tryb demo bez zmian (wzorzec zrzutów makiety). */
      for (const p of placed) {
        if (p.kind !== 'one') continue;
        const f = fleetById.get(p.id);
        if (!f) continue;
        const ll = L.latLng(f.lat, f.lng);
        const row = rowOf(f.id);
        const m = L.marker(ll, {
          icon: row ? vehicleIcon(row, labels ? row.label : null) : truckDivIcon(f.status, statusColor(f.status)),
          keyboard: false,
        });
        /* telefon (E29 pkt 9): zamiast dymka arkusz po dotknięciu */
        if (!onMarkerRef.current) {
          const estAt = estById.get(f.id);
          const est = estAt === undefined ? null
            : estNote(estAt, (k, p) => (p ? p9ep(loc, k, p) : p9e(loc, k)), (iso) => formatListDateTime(iso, TZ_OPS));
          m.bindTooltip(
            row ? vehicleTip(row, loc, est) : [f.code, f.driver, f.plate, est].filter(Boolean).join(' · '),
            { direction: 'top', offset: [0, -14], className: 'wt-mk-tip' },
          );
        }
        m.on('mouseover', () => {
          setHoverLoadRef.current(f.id);
        });
        m.on('mouseout', () => {
          setHoverLoadRef.current(null);
        });
        m.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          if (onMarkerRef.current) onMarkerRef.current(f.id);
          else selectLoadRef.current(f.id);
        });
        m.addTo(layers.fleet);
        hoverMarksRef.current.push({ m, ids: [f.id], z: 0 });
      }
      /* grupy po zwykłych znacznikach (nad nimi) */
      for (const gm of groupMarkers) gm.addTo(layers.fleet);
      /* audyt D-03: po narysowaniu — podświetlenie transportu z wiersza, nad którym jest kursor */
      applyHover(hoverRef.current);
    }

    layers.situations.clearLayers();
    if (mapLayers.seEvents) {
      for (const s of situations) {
        const sitKey = `sit:${s.id}`;
        const m = L.circleMarker([s.lat, s.lng], {
          radius: mapFocusKeyRef.current === sitKey ? 9 : 7,
          color: '#080F15',
          weight: mapFocusKeyRef.current === sitKey ? 2 : 1,
          fillColor: severityColor(s.severity),
          fillOpacity: 1,
        });
        const delay = s.delayMin != null ? ` · +${etaDuration(s.delayMin)}` : '';
        m.bindTooltip(`${s.title} (${severityLabel(s.severity, useTowerStore.getState().locale)})${delay}`, { direction: 'top' });
        m.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          const was = mapFocusKeyRef.current === sitKey;
          toggleMapFocusRef.current(sitKey);
          if (was) {
            // 2nd click same POI: clear focus — do not open Prom/Ryzyka
            navigateToRef.current({ riskFilter: null });
            return;
          }
          // 1st click: stay on map; highlight related ROAD_SE / FORCE_MAJEURE risk if any
          const linked =
            risksRef.current.find((r) => r.situationId === s.id) ??
            risksRef.current.find((r) => r.type === 'ROAD_SE' || r.type === 'FORCE_MAJEURE');
          if (linked) {
            navigateToRef.current({ riskFilter: linked.id });
            if (linked.loadId) selectLoadRef.current(linked.loadId);
          }
        });
        m.addTo(layers.situations);
      }
    }

    layers.ais.clearLayers();
    if (mapLayers.vehicles) {
      const liveSail = nextLiveSailing();
      for (const p of aisPositions) {
        if (p.source === 'seed') continue;
        if (takenShips.has(vesselKey(p.name))) continue;
        const heading = typeof p.cog === 'number' ? p.cog : (p.vesselId === liveSail.vessel ? (liveSail.depPort === 'GDN' ? 20 : 200) : 20);
        const loc = useTowerStore.getState().locale;
        if (p.estimated) {
          /* #429 C: pozycja szacowana z rozkładu — znacznik przerywany, opis z godziną ostatniego AIS */
          const last = p.estimated.lastAisTs;
          const est = last
            ? t(loc, 'i429_est_tip').replace('{d}', formatOpsDateTime(last))
            : t(loc, 'i429_est_tip_none');
          L.marker([p.lat, p.lng], {
            icon: ferryDivIcon('#6BA8D6', heading, false, true),
            keyboard: false,
          })
            .bindTooltip(`${p.name || p.mmsi} · ${est}`, { direction: 'top', offset: [0, -10] })
            .addTo(layers.ais);
          continue;
        }
        const stale = ferryMarkerTone(p.ts, getNowIso()) === 'stale';
        const when = formatOpsDateTime(p.ts);
        const tip = stale
          ? `${p.name || p.mmsi} · ${t(useTowerStore.getState().locale, 'i2_ais_stale').replace('{d}', when)}`
          : (p.source === 'db'
            ? `${p.name || p.mmsi} · ${t(useTowerStore.getState().locale, 'i2_ais_read_at').replace('{d}', when)}`
            : (p.name || p.mmsi));
        L.marker([p.lat, p.lng], {
          icon: ferryDivIcon(stale ? '#8E9BA6' : '#6BA8D6', heading, stale),
          keyboard: false,
        })
          .bindTooltip(tip, { direction: 'top', offset: [0, -10] })
          .addTo(layers.ais);
      }
    }
  }, [loads, tick, situations, aisPositions, mapLayers, focusMode, selectedLoadId, geofences, mapFocusKey, risks, zoom, gpsFixes, role, sailings, embedded, slot, panelAtSite, applyHover, vessels]);

  /* wyglad/P9-e: lista grupy z ostatniego rysowania; grupa, która zniknęła (np. auto wyjechało ze strefy), zamyka listę */
  const openView = openGroup ? groupViewsRef.current.get(openGroup) ?? null : null;
  const drawerNote = panelLoad && mapLayers.vehicles
    ? drawerMapNote(panelLoad, {
      nowIso: getNowIso(),
      prod: PROD_BUILD,
      gpsReady,
      hasFix: gpsFixes.has(panelLoad.id),
      tx: (k, p) => (k.startsWith('p9c_') ? (p ? p9mp(locale, k, p) : p9m(locale, k)) : (p ? p9ep(locale, k, p) : p9e(locale, k))),
      dt: (iso) => formatListDateTime(iso, TZ_OPS),
      siteSince: panelSiteSince,
      hm,
      siteZone: (() => { const g = geofences.find((x) => x.type === 'SITE' && x.active); return g ? geofenceDisplayName(g.name, locale) : null; })(),
    })
    : null;
  /* P11 (e1, e32): dopisek stoi nad podpisem podkładu (prawa autorskie), nie na nim — wysokość podpisu z elementu Leaflet */
  const hasNote = !!drawerNote;
  const [attrH, setAttrH] = useState(0);
  useEffect(() => {
    if (!hasNote || !mapReady) return;
    const attr = attributionOf(mapReady);
    if (!attr) return;
    const read = () => setAttrH(attr.offsetHeight || 0);
    read();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read);
    ro?.observe(attr);
    return () => ro?.disconnect();
  }, [hasNote, mapReady]);
  /* cała trasa (bez pozycji) — po przesunięciu dopisku nad podpis i zmianie liczby linii kadr liczony od nowa, trasa nad dopiskiem */
  const noteLines = drawerNote?.lines.length ?? 0;
  useEffect(() => {
    if (!mapReady || slot !== 'drawer' || followedIdRef.current !== '-') return;
    const raf = requestAnimationFrame(() => {
      programmaticRef.current = true;
      try { fitCorridor(mapReady); } finally { programmaticRef.current = false; }
    });
    return () => cancelAnimationFrame(raf);
  }, [attrH, noteLines, mapReady, slot]);

  return (
    <div
      className="corridor-map-root"
      data-h6={h6Requests(false, true) ? 'on' : 'off'}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', minHeight: 0 }}
    >
      {/* AUD-01e: gniazdo — tu wpinany jest element `.corridor-map-el` wspólnej mapy (mapPool) */}
      <div
        ref={containerRef}
        className="corridor-map-host"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
      />
      {TrackReplay && !embedded && mapReady && mapLayers.trail && replayId ? (
        <Suspense fallback={null}>
          <TrackReplay key={replayId} map={mapReady} loadId={replayId} code={(() => { const rl = loads.find((l) => l.id === replayId); return rl ? transportLabel(rl, role) : ''; })()} noFix={gpsReady && !gpsFixes.has(replayId)} />
        </Suspense>
      ) : null}
      {health && (health.state === 'failed' || (retrying && health.state === 'loading')) ? (
        <BasemapFailCard
          health={health}
          busy={retrying && health.state === 'loading'}
          locale={locale}
          onRetry={() => {
            const pooled = entryRef.current;
            if (!pooled) return;
            setRetrying(true);
            retryBasemap(pooled);
          }}
          onReload={() => window.location.reload()}
        />
      ) : null}
      {/* wyglad/P9-f (E32 pkt 3, E27): Przegląd — bez pozycji powód z danych, przed oknem „Śledzenie od …”, na placu „Na placu od …” */}
      {drawerNote ? (
        <div
          className="note po-mapnote"
          style={attrH ? ({ ['--note-bottom' as string]: `${attrH + 6}px` } as CSSProperties) : undefined}
          data-map-bottom
          data-drawer-note={drawerNote.kind}
          data-empty={drawerNote.kind === 'site' ? undefined : 'vehicle-positions'}
        >
          {drawerNote.lines.map((ln, i) => (
            <span key={i} className={`po-mapnote-l${drawerNote.alert === i ? ' is-alert' : ''}`}>{ln}</span>
          ))}
        </div>
      ) : null}
      {/* wyglad/P4-b (E27): pusta lista = nikt w oknie śledzenia (Mapa: „W trasie: 0”, panel poza oknem) — to nie „brak danych” */}
      {slot !== 'drawer' && PROD_BUILD && mapLayers.vehicles && gpsReady && loads.length > 0 && !loads.some((l) => gpsFixes.has(l.id)) ? (
        <div className="note" data-empty="vehicle-positions" style={{ position: 'absolute', left: 12, right: 12, bottom: embedded ? 8 : 36, zIndex: 500, maxWidth: 360, background: 'var(--surface)', padding: '6px 8px' }}>
          {t(locale, 'b1_no_vehicle_positions')}
        </div>
      ) : null}
      {openView ? (
        <GroupList
          view={openView}
          phone={phone}
          locale={locale}
          onClose={closeGroup}
          onPick={(id) => {
            setOpenGroup(null);
            if (onMarkerRef.current) onMarkerRef.current(id);
            else selectLoadRef.current(id);
          }}
        />
      ) : null}
      {!embedded ? (
        /* E29 pkt 4: legenda tylko z tego, co może wystąpić (etapy E28, opóźnienie, brak GPS, statek z liczbą aut) */
        <div className="mapkey" data-mapkey="e29" aria-label={t(locale, 'map_legend')} style={{ zIndex: 500 }}>
          <span><i className="mk-dot is-load" />{p9m(locale, 'p9c_lg_load')}</span>
          <span><i className="mk-dot is-road" />{p9m(locale, 'p9c_lg_road')}</span>
          <span><i className="mk-dot is-site" />{p9m(locale, 'p9c_lg_site')}</span>
          <span><i className="mk-dot is-late" />{p9m(locale, 'p9c_lg_late')}</span>
          <span><i className="mk-dot is-nogps" />{p9m(locale, 'p9c_lg_nogps')}</span>
          <span><i className="mk-dot is-ship" />{p9m(locale, 'p9c_lg_ship')}</span>
          <span><i className="mk-dot is-grp" />{p9e(locale, 'p9e_lg_zone')}</span>
        </div>
      ) : null}
    </div>
  );
}
