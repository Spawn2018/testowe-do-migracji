import { Suspense, lazy, useEffect, useRef, useState } from 'react';
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
import { severityLabel } from '../../lib/enumLabels';
import { getNowIso, isFrozenNow } from '../../lib/frozenNow';
import { ferryMarkerTone } from '../../lib/ferry/stenaAis';
import { isServerId } from '../../data/registry';
import { transportLabel } from '../../lib/transportName';
import { SUPABASE_AUTH_ENABLED } from '../../auth/config';
import { h6Requests } from '../../lib/map/draw';
import {
  acquireMap, ensureBasemap, fitCorridor, releaseMap, retryBasemap, subscribeBasemapHealth,
  type BasemapHealth, type LayerBag, type MapSlot, type PoolEntry,
} from './mapPool';
import { BasemapFailCard } from './BasemapFailCard';
import { mapRow, markerTone, type MapRow } from '../../lib/p9cMap';
import { p9m, p9mp } from '../../i18n/p9c';

/* III-5 — odtwarzanie przebiegu z bazy: tylko build Supabase (chunk leniwy); demo bez zmian */
const TrackReplay = import.meta.env.VITE_AUTH_MODE === 'supabase' && SUPABASE_AUTH_ENABLED ? lazy(() => import('./TrackReplay')) : null;


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
function vehicleTip(row: MapRow, locale: Parameters<typeof t>[0]): string {
  const l1 = `<b>${esc(row.label)}</b> · ${esc(t(locale, row.stageKey))}`;
  const eta = row.eta.main && row.eta.main !== p9m(locale, 'p9c_eta_none') ? p9mp(locale, 'p9c_tip_eta', { eta: row.eta.main }) : '';
  const late = row.late && row.delayMin ? `<span class="r">${esc(p9mp(locale, 'p9c_tip_late', { d: durTextLocal(row.delayMin) }))}</span>` : '';
  const l2 = [late, esc(eta)].filter(Boolean).join(' · ');
  const last = row.pos.kind === 'nogps' ? row.pos.text : row.lastFixAt ? p9mp(locale, 'p9c_tip_last', { t: row.pos.text }) : '';
  const l3 = [last, p9m(locale, `p9c_tip_seg_${row.seg}`)].filter(Boolean).map(esc).join(' · ');
  return [l1, l2, `<span class="g">${l3}</span>`, `<span class="g">${esc(p9m(locale, 'p9c_tip_click'))}</span>`].filter((x) => x && x !== '<span class="g"></span>').join('<br>');
}
function durTextLocal(m: number): string {
  const h = Math.floor(m / 60);
  const mm = Math.round(m % 60);
  return h ? `${h} h${mm ? ` ${mm} min` : ''}` : `${mm} min`;
}

/** Podpisy na stronie Mapa: przy ≤ 15 autach zawsze, przy większej liczbie od przybliżenia 7 (bez zasłaniania trasy). */
const LABELS_MAX = 15;
/** E1 (Przegląd): przybliżenie na pojeździe i odstęp podążania. */
const DRAWER_ZOOM = 11;
const FOLLOW_MS = 60_000;

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
  const theme = useTowerStore((s) => s.theme);
  /* E41: podpis znacznika i przebieg — nazwa transportu według firmy, która patrzy */
  const role = useTowerStore((s) => s.role);
  const locale = useTowerStore((s) => s.locale);
  const mapLayers = useTowerStore((s) => s.mapLayers);
  const geofences = useTowerStore((s) => s.geofences);
  const selectLoad = useTowerStore((s) => s.selectLoad);
  const setHoverLoad = useTowerStore((s) => s.setHoverLoad);
  const selectedLoadId = useTowerStore((s) => s.selectedLoadId);
  const focusMode = useTowerStore((s) => s.focusMode);
  const mapFocusKey = useTowerStore((s) => s.mapFocusKey);
  const toggleMapFocus = useTowerStore((s) => s.toggleMapFocus);
  const navigateTo = useTowerStore((s) => s.navigateTo);
  const risks = useTowerStore((s) => s.risks);
  const sailings = useTowerStore((s) => s.sailings);
  const onMarkerRef = useRef(onMarker);
  onMarkerRef.current = onMarker;
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
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => {
      safeInvalidate();
      const size = `${pooled.el.clientWidth}x${pooled.el.clientHeight}`;
      if (size !== lastSize) refit();
      lastSize = size;
    }) : null;
    if (ro) ro.observe(pooled.el);
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

  useEffect(() => {
    if (!mapReady || !basemapReady || import.meta.env.VITE_AUTH_MODE !== 'supabase') return;
    let cancelled = false;
    void import('./applyBasemap').then(({ loadRoadLines }) => loadRoadLines()).then((lines) => {
      const layers = layersRef.current;
      if (cancelled || !layers || lines.length === 0) return;
      layers.route.clearLayers();
      for (const line of lines) {
        L.polyline(line.map(([lat, lng]) => L.latLng(lat, lng)), {
          color: '#E5A544', weight: 3, opacity: 0.9,
        }).addTo(layers.route);
      }
    });
    return () => { cancelled = true; };
  }, [mapReady, basemapReady]);

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
    if (mapLayers.vehicles) {
      const visibleLoads =
        focusMode && selectedLoadId ? loads.filter((l) => l.id === selectedLoadId) : loads;
      const markerIn: VehicleMarkerIn[] = visibleLoads.map((l) => ({
        id: l.id,
        code: transportLabel(l, role),
        status: l.status,
        progress: l.progress,
        driver: l.resources.driverName,
        plate: l.resources.tractorPlate,
      }));
      const fleet = PROD_BUILD ? prodFleetMarkers(markerIn, gpsFixes) : demoFleetMarkers(markerIn, tick);
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
      /* III-5 (SCOPE 5.10): produkcja — pozycje z bazy/statusu często w tym samym punkcie (np. plac załadunku);
         nakładające się znaczniki rozkładamy na okręgu/spirali (≥ 22 px), by etykiety i kliknięcia nie kolidowały.
         Tryb demo bez zmian (wzorzec zrzutów makiety). */
      for (const f of fleet) {
        const ll = L.latLng(f.lat, f.lng);
        const row = rowOf(f.id);
        const m = L.marker(ll, {
          icon: row ? vehicleIcon(row, labels ? row.label : null) : truckDivIcon(f.status, statusColor(f.status)),
          keyboard: false,
        });
        /* telefon (E29 pkt 9): zamiast dymka arkusz po dotknięciu */
        if (!onMarkerRef.current) {
          m.bindTooltip(
            row ? vehicleTip(row, loc) : [f.code, f.driver, f.plate].filter(Boolean).join(' · '),
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
      }
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
        const delay = s.delayMin != null ? ` · +${s.delayMin} min` : '';
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
        const heading = typeof p.cog === 'number' ? p.cog : (p.vesselId === liveSail.vessel ? (liveSail.depPort === 'GDN' ? 20 : 200) : 20);
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
  }, [loads, tick, situations, aisPositions, mapLayers, focusMode, selectedLoadId, geofences, mapFocusKey, risks, zoom, gpsFixes, role, sailings, embedded, slot]);

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
      {/* wyglad/P4-b (E27): pusta lista = nikt w oknie śledzenia (Mapa: „W trasie: 0”, panel poza oknem) — to nie „brak danych” */}
      {PROD_BUILD && mapLayers.vehicles && gpsReady && loads.length > 0 && !loads.some((l) => gpsFixes.has(l.id)) ? (
        <div className="note" data-empty="vehicle-positions" style={{ position: 'absolute', left: 12, right: 12, bottom: embedded ? 8 : 36, zIndex: 500, maxWidth: 360, background: 'var(--surface)', padding: '6px 8px' }}>
          {slot === 'drawer' ? p9m(locale, 'p9c_drawer_nogps') : t(locale, 'b1_no_vehicle_positions')}
        </div>
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
        </div>
      ) : null}
    </div>
  );
}
