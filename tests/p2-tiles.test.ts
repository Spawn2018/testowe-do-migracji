/**
 * P2-TILES (06.10.2026) — mapowanie URL kafelków podkładu na pliki w tests/fixtures/tiles.
 * Brama wizualna nie pobiera kafelków z sieci (zmiana u dostawcy nie psuje wzorców).
 */
import { describe, expect, it } from 'vitest'
import { existsSync } from 'fs'
import { tileFor, TILE_URL_RE, MISSING_TILE } from '../scripts/visual/tiles.mjs'

describe('P2-TILES: tileFor', () => {
  it('CARTO dark — subdomeny a–d → jeden plik z/x/y', () => {
    const a = tileFor('https://a.basemaps.cartocdn.com/dark_all/4/8/5.png')
    const d = tileFor('https://d.basemaps.cartocdn.com/dark_all/4/8/5.png')
    expect(a?.provider).toBe('carto-dark')
    expect(a?.path).toBe(d?.path)
    expect(a?.path.endsWith('tests/fixtures/tiles/carto-dark/4/8/5.png')).toBe(true)
  })
  it('Esri World_Street_Map — kolejność tile/{z}/{y}/{x}', () => {
    const t = tileFor('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/4/5/8')
    expect(t?.provider).toBe('esri-streets')
    expect([t?.z, t?.x, t?.y]).toEqual(['4', '8', '5'])
    expect(t?.path.endsWith('tests/fixtures/tiles/esri-streets/4/8/5.jpg')).toBe(true)
  })
  it('inne adresy nie są przechwytywane', () => {
    expect(tileFor('https://x.supabase.co/functions/v1/here-raster?z=4&x=8&y=5')).toBeNull()
    expect(tileFor('http://127.0.0.1:4179/assets/index.js')).toBeNull()
    expect(TILE_URL_RE.test('https://b.basemaps.cartocdn.com/dark_all/4/8/5.png')).toBe(true)
    expect(TILE_URL_RE.test('https://fonts.gstatic.com/x.woff2')).toBe(false)
  })
  it('kafelki matrycy są w repozytorium (CARTO i Esri, zoom 4) + zastępnik', () => {
    expect(existsSync(MISSING_TILE)).toBe(true)
    expect(tileFor('https://a.basemaps.cartocdn.com/dark_all/4/8/4.png')?.path).toBeTruthy()
    const carto = ['carto-dark', 'esri-streets'].map((p) => existsSync(`tests/fixtures/tiles/${p}/4`))
    expect(carto).toEqual([true, true])
  })
})
