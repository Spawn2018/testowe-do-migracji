/**
 * DP-224 B3 (#817): prefetch leniwych tras głównych po starcie powłoki.
 * Etap: C2 / mapa; paczka: pakiet/c2-dp-224-b3-prefetch-e.
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pref = () => readFileSync('src/lib/prefetchMainChunks.ts', 'utf8')
const shell = () => readFileSync('src/TowerShell.tsx', 'utf8')

describe('DP-224 B3 prefetchMainChunks', () => {
  it('ładowacze: Mapa, Harmonogram, Ryzyka, Dokumenty, CorridorMap, LoadDrawer', () => {
    const src = pref()
    expect(src).toMatch(/loadMapViewChunk/)
    expect(src).toMatch(/loadScheduleViewChunk/)
    expect(src).toMatch(/loadRisksViewChunk/)
    expect(src).toMatch(/loadDocsViewChunk/)
    expect(src).toMatch(/loadCorridorMapChunk/)
    expect(src).toMatch(/loadLoadDrawerChunk/)
    expect(src).toMatch(/requestIdleCallback/)
  })

  it('TowerShell woła prefetch; *Lazy i LazyCorridorMap dzielą te same loadery', () => {
    expect(shell()).toMatch(/prefetchMainChunks\(\)/)
    expect(shell()).toMatch(/loadLoadDrawerChunk/)
    expect(shell()).not.toMatch(/loadDrawerChunk/)
    for (const f of [
      'src/views/mapLazy.tsx',
      'src/views/scheduleLazy.tsx',
      'src/views/risksLazy.tsx',
      'src/views/docsLazy.tsx',
      'src/components/map/LazyCorridorMap.tsx',
    ]) {
      expect(readFileSync(f, 'utf8')).toMatch(/prefetchMainChunks/)
    }
  })
})
