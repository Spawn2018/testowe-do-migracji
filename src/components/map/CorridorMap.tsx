import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import L from 'leaflet';

import { useTowerStore } from '../../store/useTowerStore';
import { t } from '../../i18n/messages';
import { CORRIDOR_REF_COORDS } from '../../lib/corridor';
import { SITES } from '../../lib/status';
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
import { SUPABASE_AUTH_ENABLED } from '../../auth/config';
import { installFallback } from './fallbackTiles';
import { WATER_GDN_NYN, WATER_GDY_KAA, h6Requests } from '../../lib/map/draw';

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

const Punkty = [
  { name: SITES.loading.name, lat: SITES.loading.lat, lng: SITES.loading.lng },
  { name: SITES.portOut.name, lat: SITES.portOut.lat, lng: SITES.portOut.lng },
  { name: SITES.portIn.name, lat: SITES.portIn.lat, lng: SITES.portIn.lng },
  { name: SITES.site.name, lat: SITES.site.lat, lng: SITES.site.lng },
];

type LayerBag = {
  tiles: L.Layer;
  route: L.LayerGroup;
  ferryLeg: L.LayerGroup;
  geofences: L.LayerGroup;
  poi: L.LayerGroup;
  fleet: L.LayerGroup;
  situations: L.LayerGroup;
  ais: L.LayerGroup;
};

export function CorridorMap({ loads, embedded = false }: { loads: Load[]; embedded?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layersRef = useRef<LayerBag | null>(null);
  const theme = useTowerStore((s) => s.theme);
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
  const [tick, setTick] = useState(0);
  const [situations, setSituations] = useState<RoadSituation[]>([]);
  const [aisPositions, setAisPositions] = useState<AisPosition[]>([]);
  const [gpsFixes, setGpsFixes] = useState<Map<string, { lat: number; lng: number }>>(() => new Map());
  const [gpsReady, setGpsReady] = useState(false);
  const [zoom, setZoom] = useState(0);
  const [mapReady, setMapReady] = useState<L.Map | null>(null);
  /* AUD-01: produkcja — dane mapy (pozycje, trasa, sytuacje, AIS) dopiero po narysowaniu podkładu (albo po 1,5 s). */
  const [basemapReady, setBasemapReady] = useState(import.meta.env.VITE_AUTH_MODE !== 'supabase');
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

    const map = L.map(containerRef.current, {
      center: [58.5, 18.5],
      zoom: 4.2,
      zoomControl: false,
      attributionControl: true,
    });
    L.control.zoom({ position: 'topright' }).addTo(map);

    const tiles = L.layerGroup().addTo(map);

    const route = L.layerGroup().addTo(map);
    if (!PROD_BUILD) {
      L.polyline(
        CORRIDOR_REF_COORDS.map(([lng, lat]) => L.latLng(lat, lng)),
        { color: '#E5A544', weight: 3, opacity: 0.85, dashArray: '8 6' },
      ).addTo(route);
    }

    const ferryLeg = L.layerGroup().addTo(map);
    for (const lane of [WATER_GDN_NYN, WATER_GDY_KAA]) {
      L.polyline(lane.map(([lng, lat]) => L.latLng(lat, lng)), {
        color: '#6BA8D6', weight: 3, opacity: 0.9,
      }).addTo(ferryLeg);
    }

    const geofenceGroup = L.layerGroup().addTo(map);
    const poiGroup = L.layerGroup().addTo(map);
    const fleetGroup = L.layerGroup().addTo(map);
    const sitGroup = L.layerGroup().addTo(map);
    const aisGroup = L.layerGroup().addTo(map);

    for (const p of Punkty) {
      L.circleMarker([p.lat, p.lng], {
        radius: 6,
        color: '#080F15',
        weight: 1,
        fillColor: '#E5A544',
        fillOpacity: 1,
      })
        .bindTooltip(p.name, { direction: 'top', offset: [0, -8] })
        .addTo(poiGroup);
    }

    layersRef.current = {
      tiles,
      route,
      ferryLeg,
      geofences: geofenceGroup,
      poi: poiGroup,
      fleet: fleetGroup,
      situations: sitGroup,
      ais: aisGroup,
    };
    mapRef.current = map;
    map.on('zoomend', () => setZoom(map.getZoom()));
    setMapReady(map);

    let alive = true;
    const safeInvalidate = (opts?: boolean | { animate?: boolean }) => {
      if (!alive) return;
      try {
        if (!map.getPane('mapPane')) return;
        map.invalidateSize(opts);
      } catch {
        /* mapa już usunięta / panel niegotowy */
      }
    };
    requestAnimationFrame(() => safeInvalidate());
    const t = window.setTimeout(() => safeInvalidate(), 250);
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          safeInvalidate({ animate: false });
        })
      : null;
    if (ro && containerRef.current) ro.observe(containerRef.current);

    return () => {
      alive = false;
      clearTimeout(t);
      ro?.disconnect();
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
      setMapReady(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    let current: L.Layer | null = layersRef.current?.tiles ?? null;
    if (import.meta.env.VITE_AUTH_MODE !== 'supabase') {
      const layer = installFallback(map, current, theme);
      if (layersRef.current) layersRef.current.tiles = layer;
      return;
    }
    let switching = false;
    const run = () => {
      void import('./applyBasemap').then(({ applyBasemap }) => applyBasemap(map, current, theme, () => {
        if (cancelled || switching) return;
        switching = true;
        run();
      })).then((layer) => {
        if (cancelled) {
          if (map.hasLayer(layer)) map.removeLayer(layer);
          return;
        }
        current = layer;
        switching = false;
        if (layersRef.current) layersRef.current.tiles = layer;
        layer.once('load', () => { if (!cancelled) setBasemapReady(true); });
      });
    };
    run();
    const readyTimer = window.setTimeout(() => { if (!cancelled) setBasemapReady(true); }, 1500);
    return () => { cancelled = true; window.clearTimeout(readyTimer); };
  }, [theme, mapReady]);

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
    setVis(layers.route, !!mapLayers.route);
    setVis(layers.ferryLeg, !!mapLayers.ferry);
    setVis(layers.geofences, !!mapLayers.geofence);
    setVis(layers.poi, !!mapLayers.poi);
    setVis(layers.fleet, !!mapLayers.vehicles);
    setVis(layers.situations, !!mapLayers.seEvents);
    setVis(layers.ais, !!(mapLayers.ferry ?? mapLayers.vehicles));

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
        code: l.code,
        status: l.status,
        progress: l.progress,
        driver: l.resources.driverName,
        plate: l.resources.tractorPlate,
      }));
      const fleet = PROD_BUILD ? prodFleetMarkers(markerIn, gpsFixes) : demoFleetMarkers(markerIn, tick);
      /* III-5 (SCOPE 5.10): produkcja — pozycje z bazy/statusu często w tym samym punkcie (np. plac załadunku);
         nakładające się znaczniki rozkładamy na okręgu/spirali (≥ 22 px), by etykiety i kliknięcia nie kolidowały.
         Tryb demo bez zmian (wzorzec zrzutów makiety). */
      for (const f of fleet) {
        const ll = L.latLng(f.lat, f.lng);
        const m = L.marker(ll, {
          icon: truckDivIcon(f.status, statusColor(f.status)),
          keyboard: false,
        });
        m.bindTooltip(
          [f.code, f.driver, f.plate].filter(Boolean).join(' · '),
          { direction: 'top', offset: [0, -8] },
        );
        m.on('mouseover', () => {
          setHoverLoadRef.current(f.id);
        });
        m.on('mouseout', () => {
          setHoverLoadRef.current(null);
        });
        m.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          selectLoadRef.current(f.id);
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
    if (mapLayers.ferry) {
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
  }, [loads, tick, situations, aisPositions, mapLayers, focusMode, selectedLoadId, geofences, mapFocusKey, risks, zoom, gpsFixes]);

  return (
    <div
      className="corridor-map-root"
      data-h6={h6Requests(false, true) ? 'on' : 'off'}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', minHeight: 0 }}
    >
      <div
        ref={containerRef}
        className="corridor-map-el"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
      />
      {TrackReplay && !embedded && mapReady && mapLayers.trail && replayId ? (
        <Suspense fallback={null}>
          <TrackReplay key={replayId} map={mapReady} loadId={replayId} code={loads.find((l) => l.id === replayId)?.code ?? ''} noFix={gpsReady && !gpsFixes.has(replayId)} />
        </Suspense>
      ) : null}
      {PROD_BUILD && mapLayers.vehicles && gpsReady && !loads.some((l) => gpsFixes.has(l.id)) ? (
        <div className="note" data-empty="vehicle-positions" style={{ position: 'absolute', left: 12, right: 12, bottom: embedded ? 8 : 36, zIndex: 500, maxWidth: 360, background: 'var(--surface)', padding: '6px 8px' }}>
          {t(locale, 'b1_no_vehicle_positions')}
        </div>
      ) : null}
      {!embedded ? (
        <div className="mapkey" aria-label={t(locale, 'map_legend')} style={{ zIndex: 500 }}>
          <span>
            <i className="mk-transit" style={{ background: 'var(--sea)' }} />
            {t(locale, 'kpi_on_road').toLowerCase()}
          </span>
          <span>
            <i className="mk-load" style={{ background: 'var(--amber)' }} />
            {t(locale, 'map_load')}
          </span>
          <span>
            <i className="mk-delay" style={{ background: 'var(--red)' }} />
            {t(locale, 'map_delayed')}
          </span>
          <span>
            <i className="mk-site" style={{ background: 'var(--go)' }} />
            {t(locale, 's_on_site').toLowerCase()}
          </span>
          <span>
            <i className="mk-silent" style={{ background: 'var(--ink-3)' }} />
            {t(locale, 'map_silent')}
          </span>
        </div>
      ) : null}
    </div>
  );
}
