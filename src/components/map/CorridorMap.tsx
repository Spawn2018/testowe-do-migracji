import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

import { useTowerStore } from '../../store/useTowerStore';
import { t } from '../../i18n/messages';
import {
  CORRIDOR_REF_COORDS,
  FERRY_LEG_COORDS,
  positionAlongCorridor,
} from '../../lib/corridor';
import { SITES } from '../../lib/status';
import { fetchSituations, type RoadSituation } from '../../lib/trafikverket';
import { subscribeAis, type AisPosition } from '../../lib/ais';
import type { Load } from '../../types';
import { truckDivIcon, ferryDivIcon } from '../../lib/mapMarkers';
import { nextLiveSailing } from '../../lib/ferry';
import { severityLabel } from '../../lib/enumLabels';

/** Requested Carto public URLs — CDN now watermarks without key (2026-09). */
export const CARTO_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
export const CARTO_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';

/** Working public no-key rasters (Esri (publiczna)). Esri tile order: z/y/x. */
const TILE_DARK =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const TILE_LIGHT =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';

const ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a> · Esri';

type FleetPos = {
  id: string;
  code: string;
  status: string;
  lat: number;
  lng: number;
  driver: string | null;
  plate: string | null;
};

function fleetPositions(loads: Load[], tickBump: number): FleetPos[] {
  return loads.map((l) => {
    const drift = ['IN_TRANSIT_PL', 'ON_FERRY', 'IN_TRANSIT_SE', 'APPROACHING_SITE'].includes(l.status)
      ? (tickBump % 40) * 0.00012
      : 0;
    const prog = Math.min(1, l.progress + drift);
    const pos = positionAlongCorridor(prog);
    return {
      id: l.id,
      code: l.code,
      status: l.status,
      lat: pos.lat,
      lng: pos.lng,
      driver: l.resources.driverName,
      plate: l.resources.tractorPlate,
    };
  });
}

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
  tiles: L.TileLayer;
  route: L.Polyline;
  ferryLeg: L.Polyline;
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
    let cancelled = false;
    fetchSituations().then((r) => {
      if (!cancelled) {
        setSituations(r.items);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return subscribeAis({
      onUpdate: (pos) => {
        setAisPositions(pos);
      },
    });
  }, []);

  useEffect(() => {
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

    const tiles = L.tileLayer(theme === 'dark' ? TILE_DARK : TILE_LIGHT, {
      attribution: ATTR,
      maxZoom: 16,
    }).addTo(map);

    const route = L.polyline(
      CORRIDOR_REF_COORDS.map(([lng, lat]) => L.latLng(lat, lng)),
      { color: '#E5A544', weight: 3, opacity: 0.85, dashArray: '8 6' },
    ).addTo(map);

    const ferryLeg = L.polyline(
      FERRY_LEG_COORDS.map(([lng, lat]) => L.latLng(lat, lng)),
      { color: '#6BA8D6', weight: 3, opacity: 0.9 },
    ).addTo(map);

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

    requestAnimationFrame(() => map.invalidateSize());
    const t = window.setTimeout(() => map.invalidateSize(), 250);
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          map.invalidateSize({ animate: false });
        })
      : null;
    if (ro && containerRef.current) ro.observe(containerRef.current);

    return () => {
      clearTimeout(t);
      ro?.disconnect();
      map.remove();
      mapRef.current = null;
      layersRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const layers = layersRef.current;
    if (!layers) return;
    layers.tiles.setUrl(theme === 'dark' ? TILE_DARK : TILE_LIGHT);
  }, [theme]);

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
      for (const f of fleetPositions(visibleLoads, tick)) {
        const m = L.marker([f.lat, f.lng], {
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
        const heading = typeof p.cog === 'number' ? p.cog : (p.vesselId === liveSail.vessel ? (liveSail.depPort === 'GDN' ? 20 : 200) : 20);
        L.marker([p.lat, p.lng], {
          icon: ferryDivIcon('#6BA8D6', heading),
          keyboard: false,
        })
          .bindTooltip(p.name || p.mmsi, { direction: 'top', offset: [0, -10] })
          .addTo(layers.ais);
      }
    }
  }, [loads, tick, situations, aisPositions, mapLayers, focusMode, selectedLoadId, geofences, mapFocusKey, risks]);

  return (
    <div
      className="corridor-map-root"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', minHeight: 0 }}
    >
      <div
        ref={containerRef}
        className="corridor-map-el"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}
      />
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
