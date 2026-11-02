import L from 'leaflet';
import { basemapFor, type ThemeName } from '../../lib/map/draw';
import { fallbackTileLayer } from './applyBasemap';
import { programmatic } from './programmaticMove';

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
  /* F7 r2 #740 R2-W1: przycięcie przybliżenia to ruch programowy (nie użytkownika) */
  programmatic(map, () => map.setMaxZoom(choice.maxZoom));
  const layer = fallbackTileLayer(choice);
  layer.addTo(map);
  const el = map.getContainer();
  el.dataset.basemap = choice.provider;
  el.dataset.hereRequests = '0';
  el.dataset.h6 = 'off';
  return layer;
}
