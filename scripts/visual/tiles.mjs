/**
 * P2-TILES (06.10.2026) — kafelki mapy w testach wizualnych z repozytorium, bez sieci.
 *
 * Podkład zapasowy demo (bez HERE): ciemny = CARTO dark_all, jasny = Esri World_Street_Map
 * (`supabase/functions/_shared/map/draw.ts`). Zmiana u dostawcy (np. CARTO „API KEY REQUIRED” od 10.2026)
 * psuła bramę. Testy podają kafelki z `tests/fixtures/tiles/<dostawca>/<z>/<x>/<y>.<ext>`.
 * Produkcja bez zmian — to wyłącznie warstwa testów (Playwright `page.route`, puppeteer interception).
 *
 * TILES=replay (domyślnie) — z repozytorium; brak pliku → szary kafelek `_missing.png` + wpis w liczniku
 * TILES=record — pobierz z sieci i zapisz (tylko świadome odświeżenie, z przyczyną w PLAN/POSTEP)
 * TILES=live — bez przechwytywania (zachowanie sprzed P2-TILES)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const TILE_DIR = join(ROOT, 'tests', 'fixtures', 'tiles')
export const TILE_MODE = (process.env.TILES || 'replay').toLowerCase()
export const MISSING_TILE = join(TILE_DIR, '_missing.png')

const RULES = [
  {
    provider: 'carto-dark',
    re: /^https:\/\/[a-d]\.basemaps\.cartocdn\.com\/dark_all\/(\d+)\/(\d+)\/(\d+)\.png(?:\?.*)?$/,
    zxy: (m) => [m[1], m[2], m[3]],
    ext: 'png',
    type: 'image/png',
  },
  {
    provider: 'esri-streets',
    re: /^https:\/\/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Street_Map\/MapServer\/tile\/(\d+)\/(\d+)\/(\d+)(?:\?.*)?$/,
    zxy: (m) => [m[1], m[3], m[2]], // Esri: tile/{z}/{y}/{x}
    ext: 'jpg',
    type: 'image/jpeg',
  },
]

/** Wzorzec URL kafelków do `page.route` (Playwright). */
export const TILE_URL_RE = /^https:\/\/([a-d]\.basemaps\.cartocdn\.com\/dark_all|server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Street_Map)\//

export function tileFor(url) {
  for (const r of RULES) {
    const m = r.re.exec(url)
    if (!m) continue
    const [z, x, y] = r.zxy(m)
    return { provider: r.provider, z, x, y, type: r.type, path: join(TILE_DIR, r.provider, z, x, `${y}.${r.ext}`) }
  }
  return null
}

export const stats = { served: 0, missing: 0, recorded: 0, missingList: [] }

/** Treść kafelka z repozytorium (replay) albo szary zastępnik. */
export function readTile(t) {
  if (existsSync(t.path)) {
    stats.served++
    return { body: readFileSync(t.path), type: t.type }
  }
  stats.missing++
  if (stats.missingList.length < 50) stats.missingList.push(`${t.provider}/${t.z}/${t.x}/${t.y}`)
  return { body: readFileSync(MISSING_TILE), type: 'image/png' }
}

export function saveTile(t, body) {
  mkdirSync(dirname(t.path), { recursive: true })
  writeFileSync(t.path, body)
  stats.recorded++
}

export function tileSummary() {
  return `kafelki[${TILE_MODE}]: z repo ${stats.served}, brak ${stats.missing}, zapisane ${stats.recorded}` +
    (stats.missing ? ` — brakujące: ${stats.missingList.slice(0, 10).join(', ')}` : '')
}

/** Puppeteer: włącz przechwytywanie kafelków na stronie. */
export async function installPuppeteerTiles(page) {
  if (TILE_MODE === 'live') return
  await page.setRequestInterception(true)
  page.on('request', (req) => {
    if (req.isInterceptResolutionHandled?.()) return
    const t = tileFor(req.url())
    if (!t) return void req.continue()
    if (TILE_MODE === 'record') return void req.continue()
    const { body, type } = readTile(t)
    void req.respond({ status: 200, contentType: type, body, headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } })
  })
  if (TILE_MODE === 'record') {
    page.on('response', async (res) => {
      const t = tileFor(res.url())
      if (!t || res.status() !== 200) return
      try { saveTile(t, await res.buffer()) } catch { /* kafel przerwany */ }
    })
  }
}

/** Playwright: przechwytywanie kafelków w kontekście (page albo context). */
export async function installPlaywrightTiles(target) {
  if (TILE_MODE === 'live') return
  await target.route(TILE_URL_RE, async (route) => {
    const t = tileFor(route.request().url())
    if (!t) return route.continue()
    if (TILE_MODE === 'record') {
      const res = await route.fetch()
      if (res.status() === 200) saveTile(t, await res.body())
      return route.fulfill({ response: res })
    }
    const { body, type } = readTile(t)
    return route.fulfill({ status: 200, contentType: type, body, headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' } })
  })
}
