import type L from 'leaflet'

/**
 * DP-224 E (#817): bezpieczne zniszczenie mapy Leaflet.
 * Animacja zoom/pan po odmontowaniu → `Cannot read properties of undefined (reading '_leaflet_pos')`.
 * Przed `remove()`: `stop()`; bez `_mapPane` nic nie wołamy.
 */
export function destroyLeafletMap(map: L.Map): void {
  try {
    map.stop()
  } catch {
    /* mapa już w połowie usuwania */
  }
  const pane = (map as unknown as { _mapPane?: unknown })._mapPane
  if (pane == null) return
  try {
    map.remove()
  } catch {
    /* ignore */
  }
}

/** Zatrzymaj animacje przed schowaniem mapy do puli (mapa żyje, ale slot React znika). */
export function stopLeafletMap(map: L.Map): void {
  try {
    map.stop()
  } catch {
    /* ignore */
  }
}
