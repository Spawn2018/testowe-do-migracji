import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { useTowerStore } from '../../store/useTowerStore';

const TILE_DARK =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const TILE_LIGHT =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a> · Esri';

const PIN = L.divIcon({
  className: 'gf-pin',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export function GeofenceEditorMap({
  lat,
  lng,
  radiusM,
  hysteresisM,
  onMove,
}: {
  lat: number;
  lng: number;
  radiusM: number;
  hysteresisM: number;
  onMove: (lat: number, lng: number) => void;
}) {
  const theme = useTowerStore((s) => s.theme);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const groupRef = useRef<L.LayerGroup | null>(null);
  const tilesRef = useRef<L.TileLayer | null>(null);
  const onMoveRef = useRef(onMove);
  const fittedRef = useRef('');
  onMoveRef.current = onMove;

  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;
    const map = L.map(el, { zoomControl: true, attributionControl: true });
    map.setView([lat, lng], 11);
    const tiles = L.tileLayer(theme === 'dark' ? TILE_DARK : TILE_LIGHT, {
      maxZoom: 16,
      attribution: ATTR,
    }).addTo(map);
    const group = L.layerGroup().addTo(map);
    map.on('click', (e) => {
      onMoveRef.current(e.latlng.lat, e.latlng.lng);
    });
    mapRef.current = map;
    groupRef.current = group;
    tilesRef.current = tiles;
    const timer = window.setTimeout(() => map.invalidateSize(), 200);
    return () => {
      window.clearTimeout(timer);
      map.remove();
      mapRef.current = null;
      groupRef.current = null;
      tilesRef.current = null;
    };
    // Mapa powstaje raz. Środek i koła dogrywa efekt poniżej.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    tilesRef.current?.setUrl(theme === 'dark' ? TILE_DARK : TILE_LIGHT);
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    const group = groupRef.current;
    if (!map || !group) return;
    group.clearLayers();
    const radius = Math.max(radiusM, 10);
    const buffer = radius + Math.max(hysteresisM, 0);
    const outer = L.circle([lat, lng], {
      radius: buffer,
      color: '#E5A544',
      weight: 1,
      dashArray: '6 6',
      fillColor: '#E5A544',
      fillOpacity: 0.06,
    }).addTo(group);
    L.circle([lat, lng], {
      radius,
      color: '#6BA8D6',
      weight: 2,
      fillColor: '#6BA8D6',
      fillOpacity: 0.18,
    }).addTo(group);
    const marker = L.marker([lat, lng], { draggable: true, icon: PIN }).addTo(group);
    marker.on('dragend', () => {
      const p = marker.getLatLng();
      onMoveRef.current(p.lat, p.lng);
    });
    const fitKey = `${Math.round(radius)}:${Math.round(buffer)}`;
    if (fittedRef.current !== fitKey) {
      map.fitBounds(outer.getBounds(), { padding: [24, 24], maxZoom: 13, animate: false });
      fittedRef.current = fitKey;
    } else if (!map.getBounds().pad(-0.15).contains([lat, lng])) {
      map.panTo([lat, lng], { animate: false });
    }
  }, [lat, lng, radiusM, hysteresisM]);

  return <div ref={containerRef} className="gf-editor-map" data-geofence-map />;
}
