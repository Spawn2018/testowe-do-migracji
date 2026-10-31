import L from 'leaflet';
import type { LatLng } from '../../lib/map/draw';

/** #667: jeden styl pomarańczowej trasy drogowej (bez zależności od auth / applyBasemap). */
export const ORANGE_ROAD_STYLE = { color: '#E5A544', weight: 3, opacity: 0.9 } as const;

/** Rysuje legi drogowe na warstwie; czyści warstwę tylko gdy są linie do narysowania. */
export function paintOrangeRoads(layer: L.LayerGroup, lines: readonly LatLng[][]): void {
  if (lines.length === 0) return;
  layer.clearLayers();
  for (const line of lines) {
    L.polyline(line.map(([lat, lng]) => L.latLng(lat, lng)), ORANGE_ROAD_STYLE).addTo(layer);
  }
}
