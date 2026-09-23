import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { useTowerStore } from '../../store/useTowerStore';
import {
  CORRIDOR_REF_COORDS,
  FERRY_LEG_COORDS,
  positionAlongCorridor,
} from '../../lib/corridor';
import { SITES } from '../../lib/status';
import { fetchSituations, type RoadSituation } from '../../lib/trafikverket';
import { subscribeAis, type AisMode, type AisPosition } from '../../lib/ais';
import { activeOrNextSailing, ferryLabel, vesselById } from '../../lib/ferry';
import type { Load } from '../../types';

/** Requested Carto public URLs — CDN now watermarks without key (2026-09). */
export const CARTO_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png';
export const CARTO_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';

/** Working public no-key rasters (Esri Canvas Gray). Esri tile order: z/y/x. */
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

const POI = [
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
  const mapLayers = useTowerStore((s) => s.mapLayers);
  const geofences = useTowerStore((s) => s.geofences);
  const selectLoad = useTowerStore((s) => s.selectLoad);
  const setHoverLoad = useTowerStore((s) => s.setHoverLoad);
  const selectedLoadId = useTowerStore((s) => s.selectedLoadId);
  const focusMode = useTowerStore((s) => s.focusMode);
  const [tick, setTick] = useState(0);
  const [situations, setSituations] = useState<RoadSituation[]>([]);
  const [sitMode, setSitMode] = useState<'live' | 'seed'>('seed');
  const [aisPositions, setAisPositions] = useState<AisPosition[]>([]);
  const [aisMode, setAisMode] = useState<AisMode>('seed');
  const basemapLabel = `Kafelki Carto · ${theme === 'dark' ? 'ciemny' : 'jasny'}`;

  const sailing = activeOrNextSailing();
  const vessel = vesselById(sailing.vessel);

  const selectLoadRef = useRef(selectLoad);
  const setHoverLoadRef = useRef(setHoverLoad);
  selectLoadRef.current = selectLoad;
  setHoverLoadRef.current = setHoverLoad;

  useEffect(() => {
    let cancelled = false;
    fetchSituations().then((r) => {
      if (!cancelled) {
        setSituations(r.items);
        setSitMode(r.mode);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return subscribeAis({
      onUpdate: (pos, mode) => {
        setAisPositions(pos);
        setAisMode(mode);
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

    for (const p of POI) {
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

    return () => {
      clearTimeout(t);
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
    setVis(layers.ais, !!mapLayers.ferry);

    layers.geofences.clearLayers();
    if (mapLayers.geofence) {
      for (const g of geofences) {
        L.circle([g.lat, g.lng], {
          radius: g.radiusM,
          color: '#6BA8D6',
          weight: 1,
          fillColor: '#6BA8D6',
          fillOpacity: 0.18,
        })
          .bindTooltip(g.name, { direction: 'top' })
          .addTo(layers.geofences);
      }
    }

    layers.fleet.clearLayers();
    if (mapLayers.vehicles) {
      const visibleLoads =
        focusMode && selectedLoadId ? loads.filter((l) => l.id === selectedLoadId) : loads;
      for (const f of fleetPositions(visibleLoads, tick)) {
        const m = L.circleMarker([f.lat, f.lng], {
          radius: 6,
          color: '#080F15',
          weight: 1.5,
          fillColor: statusColor(f.status),
          fillOpacity: 1,
        });
        m.bindTooltip(
          [f.code, f.driver, f.plate].filter(Boolean).join(' · '),
          { direction: 'top', offset: [0, -6] },
        );
        m.on('mouseover', () => {
          setHoverLoadRef.current(f.id);
          m.setStyle({ weight: 2.5, radius: 7 });
        });
        m.on('mouseout', () => {
          setHoverLoadRef.current(null);
          m.setStyle({ weight: 1.5, radius: 6 });
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
        L.circleMarker([s.lat, s.lng], {
          radius: 7,
          color: '#080F15',
          weight: 1,
          fillColor: severityColor(s.severity),
          fillOpacity: 1,
        })
          .bindTooltip(`${s.title} (${s.severity})`, { direction: 'top' })
          .addTo(layers.situations);
      }
    }

    layers.ais.clearLayers();
    if (mapLayers.ferry) {
      for (const p of aisPositions) {
        L.circleMarker([p.lat, p.lng], {
          radius: 9,
          color: '#DCE7EE',
          weight: 2,
          fillColor: '#6BA8D6',
          fillOpacity: 1,
        })
          .bindTooltip(p.name || p.mmsi, { direction: 'top', offset: [0, -8] })
          .addTo(layers.ais);
      }
    }
  }, [loads, tick, situations, aisPositions, mapLayers, focusMode, selectedLoadId, geofences]);

  return (
    <div className="relative w-full h-full min-h-full" style={{ minHeight: '100%' }}>
      <div
        ref={containerRef}
        className="absolute inset-0"
        style={{ minHeight: '100%', width: '100%', height: '100%', zIndex: 0 }}
      />
      {!embedded ? (
        <div className="mapkey" aria-label="Legenda statusów" style={{ zIndex: 500 }}>
          <span>
            <i className="mk-transit" style={{ background: 'var(--sea)' }} />
            w drodze
          </span>
          <span>
            <i className="mk-load" style={{ background: 'var(--amber)' }} />
            załadunek
          </span>
          <span>
            <i className="mk-delay" style={{ background: 'var(--red)' }} />
            opóźniony
          </span>
          <span>
            <i className="mk-site" style={{ background: 'var(--go)' }} />
            na placu
          </span>
          <span>
            <i className="mk-silent" style={{ background: 'var(--ink-3)' }} />
            brak sygnału
          </span>
        </div>
      ) : null}
    </div>
  );
}
