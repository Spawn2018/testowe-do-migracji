/**
 * DP-224 E (#817): zniszczenie mapy Leaflet bez `_leaflet_pos` po animacji.
 * Etap: C2 / mapa; paczka: pakiet/c2-dp-224-b3-prefetch-e.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { destroyLeafletMap, stopLeafletMap } from '../src/lib/destroyLeafletMap'

describe('DP-224 E destroyLeafletMap', () => {
  it('stop + remove gdy jest _mapPane; bez pane nie woła remove', () => {
    const stop = vi.fn()
    const remove = vi.fn()
    destroyLeafletMap({ stop, remove, _mapPane: {} } as never)
    expect(stop).toHaveBeenCalledOnce()
    expect(remove).toHaveBeenCalledOnce()

    const stop2 = vi.fn()
    const remove2 = vi.fn()
    destroyLeafletMap({ stop: stop2, remove: remove2 } as never)
    expect(stop2).toHaveBeenCalledOnce()
    expect(remove2).not.toHaveBeenCalled()
  })

  it('stopLeafletMap tylko zatrzymuje animację', () => {
    const stop = vi.fn()
    stopLeafletMap({ stop } as never)
    expect(stop).toHaveBeenCalledOnce()
  })

  it('mapPool i ZonesMap używają bezpiecznego teardown; setView bez animate', () => {
    const pool = readFileSync('src/components/map/mapPool.ts', 'utf8')
    expect(pool).toMatch(/destroyLeafletMap/)
    expect(pool).toMatch(/stopLeafletMap/)
    expect(pool).toMatch(/animate:\s*false/)
    expect(pool).not.toMatch(/e\.map\.remove\(\)/)
    expect(readFileSync('src/components/zones/ZonesMap.tsx', 'utf8')).toMatch(/destroyLeafletMap/)
  })
})
