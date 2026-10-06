/**
 * AUD-01e — jedna instancja mapy na sesję (kokpit ↔ Mapa ↔ inny widok ↔ panel zlecenia).
 * Sprawdza: ta sama mapa (ten sam element DOM, `created` = 1), brak ponownego tworzenia, brak wycieku słuchaczy,
 * zero nowych żądań kafelków przy powrocie do widoku z niezmienionym widokiem mapy, czas do widocznej mapy ≤ 0,3 s.
 * Użycie: PW_BASE_URL=http://127.0.0.1:4173 npx playwright test tests/aud01e-map-pool.spec.ts
 */
import { expect, test, type Page } from '@playwright/test'

const NOW = 'now=2026-09-23T14%3A32%3A00Z'
type Pool = { created: number; reused: number; oneOff: number; destroyed: number; listeners: () => { zoomend: number; moveend: number } }
const TILE = /arcgisonline\.com\/ArcGIS\/rest\/services\/.*\/tile\/|maps\.hereapi\.com\/v3\/base|\/tiles\/logistics\.|here-raster/

const pool = (page: Page) =>
  page.evaluate(() => {
    const p = (window as unknown as { __wtMapPool?: Pool }).__wtMapPool
    return p ? { created: p.created, reused: p.reused, oneOff: p.oneOff, destroyed: p.destroyed, ...p.listeners() } : null
  })

/** Klik w nawigację → ms do chwili, gdy mapa w nowym widoku ma rozmiar i wszystkie kafelki widoku są wczytane. */
async function switchTo(page: Page, view: string, host: string): Promise<number> {
  return (await switchCount(page, view, host)).ms
}

/** To samo + liczba NOWYCH elementów `<img>` kafelków dodanych przez Leaflet w trakcie przejścia (0 = mapa nie przerysowana). */
async function switchCount(page: Page, view: string, host: string): Promise<{ ms: number; newTiles: number }> {
  return page.evaluate(
    ([v, h]) =>
      new Promise<{ ms: number; newTiles: number }>((resolve, reject) => {
        let newTiles = 0
        const mo = new MutationObserver((list) => { for (const m of list) for (const n of m.addedNodes) if (n instanceof HTMLImageElement && n.classList.contains('leaflet-tile')) newTiles++ })
        mo.observe(document.body, { childList: true, subtree: true })
        const t0 = performance.now()
        ;(document.querySelector(`nav button[data-view="${v}"]`) as HTMLElement).click()
        const tick = () => {
          const el = document.querySelector(`${h} .corridor-map-el.leaflet-container`) as HTMLElement | null
          const imgs = el ? [...el.querySelectorAll<HTMLImageElement>('img.leaflet-tile')] : []
          const r = el?.getBoundingClientRect()
          if (el && r && r.width > 0 && r.height > 0 && imgs.length > 0 && imgs.every((i) => i.complete && i.naturalWidth > 0)) {
            const ms = performance.now() - t0
            setTimeout(() => { mo.disconnect(); resolve({ ms, newTiles }) }, 300)
            return
          }
          if (performance.now() - t0 > 15_000) reject(new Error('mapa niewidoczna po 15 s'))
          else requestAnimationFrame(tick)
        }
        requestAnimationFrame(tick)
      }),
    [view, host] as const,
  )
}

test('AUD-01e: jedna mapa na sesję, bez ponownego tworzenia, bez nowych kafelków przy powrocie, powrót ≤ 0,3 s', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto(`/#/?${NOW}`, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.waitForSelector('.grid2-map-body .corridor-map-el.leaflet-container img.leaflet-tile-loaded', { timeout: 30_000 })
  await page.evaluate(() => { (document.querySelector('.corridor-map-el') as HTMLElement & { __wtMark?: number }).__wtMark = 1 })
  const first = await switchTo(page, 'map', '.mapbox')
  await page.waitForLoadState('networkidle')
  const p1 = (await pool(page))!
  expect(p1.created).toBe(1)
  expect(p1.oneOff).toBe(0)
  expect(await page.locator('.corridor-map-el.leaflet-container').count()).toBe(1)
  expect(await page.evaluate(() => (document.querySelector('.mapbox .corridor-map-el') as HTMLElement & { __wtMark?: number }).__wtMark)).toBe(1)

  const tiles: string[] = []
  page.on('request', (r) => { if (TILE.test(r.url())) tiles.push(r.url()) })
  const backs: number[] = []
  for (let i = 0; i < 3; i++) {
    await page.locator('nav button[data-view="sched"]').click()
    await page.waitForTimeout(150)
    tiles.length = 0
    const r = await switchCount(page, 'map', '.mapbox')
    backs.push(r.ms)
    expect(r.newTiles, `nowe elementy kafelków przy powrocie #${i + 1}`).toBe(0)
    await page.waitForTimeout(100)
    expect(tiles, `nowe żądania kafelków przy powrocie #${i + 1}`).toEqual([])
  }
  const p2 = (await pool(page))!
  expect(p2.created).toBe(1)
  expect(p2.destroyed).toBe(0)
  expect(p2.zoomend).toBe(p1.zoomend)
  expect(p2.moveend).toBe(p1.moveend)
  for (const ms of backs) expect(ms).toBeLessThanOrEqual(300)

  const kokpit = await switchTo(page, 'dash', '.grid2-map-body')
  const back = await switchTo(page, 'map', '.mapbox')
  const p3 = (await pool(page))!
  expect(p3.created).toBe(1)
  expect(await page.locator('.corridor-map-el.leaflet-container').count()).toBe(1)
  // Panel zlecenia nad widokiem Mapa: mapa wspólna zajęta → jednorazowa, niszczona przy zamknięciu (bez wycieku).
  await page.evaluate(() => { location.hash = '#/transport/SG-32?now=2026-09-23T14%3A32%3A00Z' })
  await page.waitForSelector('.drawer .corridor-map-el.leaflet-container', { timeout: 15_000 })
  expect((await pool(page))!.oneOff).toBe(1)
  await page.keyboard.press('Escape')
  await expect(page.locator('.drawer')).toHaveCount(0)
  const p4 = (await pool(page))!
  expect(p4.destroyed).toBe(1)
  expect(p4.created).toBe(1)
  expect(await page.locator('.corridor-map-el.leaflet-container').count()).toBe(1)
  console.log(`AUD-01e pomiar: pierwsze przejście kokpit→Mapa ${first.toFixed(0)} ms; powroty Mapa ${backs.map((b) => b.toFixed(0)).join('/')} ms; Mapa→kokpit ${kokpit.toFixed(0)} ms; kokpit→Mapa ${back.toFixed(0)} ms; pula ${JSON.stringify(p3)}`)
})
