/**
 * Etap 5 — Fala 4 (UI, DemoProvider).
 * D14: trasy adresowalne (HashRouter) — link do transportu otwiera szufladę; widok ↔ adres w obie strony;
 *      wstecz zamyka szufladę; rola i język w trwałym ustawieniu; widok spoza roli → zastąpiony dozwolonym;
 *      query `?now=` zachowane.
 * D15: kawałki leniwe działają — mapa (kokpit, Mapa), eksport XLSX (ExcelJS), paczka ZIP dokumentów (JSZip).
 */
import { expect, test, type Page } from '@playwright/test'

const NOW = 'now=2026-09-23T14%3A32%3A00Z'
const url = (path: string) => `/#${path}?${NOW}`

async function fresh(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1080 })
  await page.goto(url('/'), { waitUntil: 'networkidle', timeout: 120_000 })
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k)
  })
  await page.reload({ waitUntil: 'networkidle', timeout: 120_000 })
  await page.waitForSelector('#roleSeg', { timeout: 30_000 })
}
const hashPath = (page: Page) => new URL(page.url()).hash.replace(/^#/, '').split('?')[0]

test.describe('D14 — trasy adresowalne', () => {
  test('link #/transport/SG-32 otwiera szufladę; zamknięcie → ścieżka widoku; ?now zachowane', async ({ page }) => {
    await fresh(page)
    await page.goto(url('/transport/SG-32'), { waitUntil: 'networkidle' })
    await expect(page.locator('.drawer .wb-code')).toHaveText('SG-32')
    expect(page.url()).toContain(NOW)
    await page.locator('.drawer .drawer-hd button.iconbtn').last().click()
    await expect(page.locator('.drawer')).toHaveCount(0)
    expect(hashPath(page)).toBe('/kokpit')
    expect(page.url()).toContain(NOW)
  })

  test('nawigacja zmienia adres; transport z tabeli → /transport/<kod>; wstecz zamyka szufladę', async ({ page }) => {
    await fresh(page)
    await expect.poll(() => hashPath(page)).toBe('/kokpit')
    await page.locator('nav button[data-view="sched"]').click()
    await expect.poll(() => hashPath(page)).toBe('/harmonogram')
    const row = page.locator('tr[data-load]').first()
    const code = (await row.locator('span.code').first().textContent())!.trim()
    await row.click()
    await expect(page.locator('.drawer .wb-code')).toHaveText(code)
    await expect.poll(() => hashPath(page)).toBe(`/transport/${code}`)
    await page.goBack()
    await expect(page.locator('.drawer')).toHaveCount(0)
    await expect.poll(() => hashPath(page)).toBe('/harmonogram')
    await page.goForward()
    await expect(page.locator('.drawer .wb-code')).toHaveText(code)
  })

  test('adresy /harmonogram, /mapa, /faktury, /ustawienia wchodzą w widok; rola i język przetrwają przeładowanie', async ({ page }) => {
    await fresh(page)
    for (const [path, view] of [['/harmonogram', 'sched'], ['/mapa', 'map'], ['/faktury', 'inv']] as const) {
      await page.goto(url(path), { waitUntil: 'networkidle' })
      await expect(page.locator(`nav button[data-view="${view}"]`)).toHaveAttribute('aria-current', 'page')
    }
    await page.locator('#roleSeg button[data-role="KSH"]').click()
    await page.locator('#langSeg button[data-lang="en"]').click()
    await page.goto(url('/ustawienia'), { waitUntil: 'networkidle' })
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('#roleSeg button[data-role="KSH"]')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('#langSeg button[data-lang="en"]')).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator('nav button[data-view="settings"]')).toHaveAttribute('aria-current', 'page')
    expect(hashPath(page)).toBe('/ustawienia')
  })

  test('widok spoza roli (HHL → /ustawienia) i nieznany kod transportu → adres zastąpiony dozwolonym widokiem', async ({ page }) => {
    await fresh(page)
    await page.goto(url('/ustawienia'), { waitUntil: 'networkidle' })
    await expect.poll(() => hashPath(page)).toBe('/kokpit')
    await page.goto(url('/transport/XX-99'), { waitUntil: 'networkidle' })
    await expect(page.locator('.drawer')).toHaveCount(0)
    await expect.poll(() => hashPath(page)).toBe('/kokpit')
  })
})

test.describe('D15 — kawałki ładowane leniwie', () => {
  test('mapa w kokpicie i widoku Mapa; eksport XLSX i paczka ZIP pobierają pliki', async ({ page }) => {
    await fresh(page)
    await expect(page.locator('.corridor-map-el.leaflet-container')).toHaveCount(1)
    await page.locator('nav button[data-view="map"]').click()
    await expect(page.locator('.corridor-map-el.leaflet-container')).toHaveCount(1)
    await expect(page.locator('.mapkey')).toBeVisible()
    await page.locator('nav button[data-view="sched"]').click()
    const [xlsx] = await Promise.all([page.waitForEvent('download'), page.locator('[data-action="export-xlsx"]').click()])
    expect(xlsx.suggestedFilename()).toMatch(/\.xlsx$/)
    await page.locator('nav button[data-view="docs"]').click()
    const [zip] = await Promise.all([page.waitForEvent('download'), page.locator('button.chipbtn', { hasText: /ZIP|paczk/i }).first().click()])
    expect(zip.suggestedFilename()).toMatch(/\.zip$/)
  })
})
