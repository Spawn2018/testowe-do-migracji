import L from 'leaflet';
import { basemapFor, type ThemeName } from '../../lib/map/draw';
import { fallbackTileLayer } from './applyBasemap';

/** Podkład zapasowy z etykietami. Bez HERE i bez adresu funkcji. */
export function installFallback(map: L.Map, prev: L.Layer | null, theme: ThemeName): L.Layer {
  const choice = basemapFor({
    theme,
    spentUsd: 80,
    spentMonth: '1970-01-01',
    now: new Date(),
    allowHere: false,
  });
  if (prev && map.hasLayer(prev)) map.removeLayer(prev);
  map.setMaxZoom(choice.maxZoom);
  const layer = fallbackTileLayer(choice);
  layer.addTo(map);
  const el = map.getContainer();
  el.dataset.basemap = choice.provider;
  el.dataset.hereRequests = '0';
  el.dataset.h6 = 'off';
  return layer;
}
