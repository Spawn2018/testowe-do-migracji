/**
 * Etap 4 — ścieżki interfejsu na DemoProvider (świeży build HEAD w pre-push: scripts/ci/fresh-smoke.sh).
 * M5: numery zleceń — trzy kolumny, „każda strona swój”, GOTOWY bez numeru HHL → zrozumiały komunikat,
 *     przewoźnik nie widzi okien planowych jako edytowalnych (AN2).
 * Run: `npm run test:etap4`.
 */
import { test, expect, type Page } from '@playwright/test'

const FROZEN_URL = `/#/?now=${encodeURIComponent('2026-09-23T14:32:00Z')}`

async function boot(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1080 })
  await page.goto(FROZEN_URL, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k)
  })
  await page.reload({ waitUntil: 'networkidle', timeout: 120_000 })
  await page.waitForSelector('#roleSeg', { timeout: 30_000 })
  await page.evaluate(() => (document.querySelector('#langSeg button[data-lang="pl"]') as HTMLButtonElement | null)?.click())
}
async function role(page: Page, r: 'HHL' | 'KSH' | 'SCX') {
  await page.locator(`#roleSeg button[data-role="${r}"]`).click()
  await page.waitForTimeout(300)
}
async function nav(page: Page, v: string) {
  await page.locator(`nav button[data-view="${v}"]`).click()
  await page.waitForTimeout(300)
}
async function closeDrawer(page: Page) {
  await page.locator('.drawer .drawer-hd button.iconbtn').last().click()
  await page.waitForSelector('.drawer', { state: 'detached' })
}
/** Zakładka działań szuflady (formularze, przyciski statusu) — piąta zakładka. */
async function actionsTab(page: Page) {
  await page.locator('.drawer button[aria-selected]').nth(4).click()
  await page.waitForTimeout(200)
}
async function openLoad(page: Page, code: string) {
  await page.locator('tr[data-load]', { has: page.locator('span.code', { hasText: new RegExp(`^${code}$`) }) }).first().click()
  await page.waitForSelector('.drawer')
  await page.locator('.drawer button[aria-selected]').nth(0).click()
  await page.waitForSelector('.drawer [data-order="hhl"]')
}

test.describe('M5 — numery zleceń', () => {
  test('harmonogram: trzy kolumny KSH / HHL / SCX obok kodu wysyłki, w każdej roli', async ({ page }) => {
    await boot(page)
    for (const r of ['HHL', 'KSH', 'SCX'] as const) {
      await role(page, r)
      await nav(page, 'sched')
      const cols = await page.locator('table.sched-table thead th').evaluateAll((ths) => ths.map((t) => t.getAttribute('data-col')))
      expect(cols.slice(0, 4), r).toEqual(['code', 'ord_ksh', 'ord_hhl', 'ord_scx'])
      // ostatnia kolumna przyklejona do prawej krawędzi (przewijanie w poziomie)
      expect(await page.locator('table.sched-table thead th.stick').count(), r).toBeGreaterThan(0)
    }
    await role(page, 'HHL')
    await nav(page, 'sched')
    const row = page.locator('tr[data-load]', { has: page.locator('span.code', { hasText: /^SG-34$/ }) })
    await expect(row.locator('td[data-col="ord_ksh"]')).toHaveText(/^KSH\/2026\//)
    await expect(row.locator('td[data-col="ord_hhl"]')).toHaveText(/^HHL\/2026\//)
    await expect(row.locator('td[data-col="ord_scx"]')).toHaveText(/^SCX-26-/)
  })

  test('HHL: GOTOWY bez numeru HHL → zrozumiały komunikat; numer przewoźnika tylko do odczytu', async ({ page }) => {
    await boot(page)
    await role(page, 'HHL')
    await nav(page, 'sched')
    // transport, dla którego GOTOWY nie jest zablokowany dokumentami (sprawdzamy wyłącznie blokadę numeru)
    let code = ''
    for (const c of ['SG-29', 'SS-03', 'P-01', 'SG-09', 'SG-11', 'SG-18', 'SG-19', 'SG-20', 'T-10', 'SG-30', 'T-14', 'SS-04', 'SS-05', 'K-03', 'P-02', 'R-03']) {
      await openLoad(page, c)
      await actionsTab(page)
      if (await page.locator('.drawer button', { hasText: 'Oznacz jako gotowy' }).isEnabled()) { code = c; break }
      await closeDrawer(page)
    }
    expect(code, 'transport z odblokowanym GOTOWY').not.toBe('')
    await page.locator('.drawer button[aria-selected]').nth(0).click()
    await expect(page.locator('.drawer [data-order="scx"] input')).toHaveCount(0)
    const hhl = page.locator('.drawer [data-order="hhl"] input')
    await expect(hhl).toHaveValue(/^HHL\/2026\//)
    await hhl.fill('')
    await page.locator('.drawer [data-order="hhl"] button[type="submit"]').click()
    await closeDrawer(page)
    const row0 = page.locator('tr[data-load]', { has: page.locator('span.code', { hasText: new RegExp(`^${code}$`) }) })
    await expect(row0.locator('td[data-col="ord_hhl"]')).toHaveText('— brak —')
    await openLoad(page, code)
    await actionsTab(page)
    await page.locator('.drawer button', { hasText: 'Oznacz jako gotowy' }).click()
    await expect(page.getByText('Nie można oznaczyć jako gotowy — brak numeru zlecenia HHL', { exact: false }).first()).toBeVisible()
    await page.locator('.drawer button[aria-selected]').nth(0).click()
    await hhl.fill('HHL/2026/9001')
    await page.locator('.drawer [data-order="hhl"] button[type="submit"]').click()
    await closeDrawer(page)
    const row = page.locator('tr[data-load]', { has: page.locator('span.code', { hasText: new RegExp(`^${code}$`) }) })
    await expect(row.locator('td[data-col="ord_hhl"]')).toHaveText('HHL/2026/9001')
  })

  test('SCX: edytuje wyłącznie swój numer; okna planowe tylko do odczytu (AN2); KSH bez edycji', async ({ page }) => {
    await boot(page)
    await role(page, 'SCX')
    await nav(page, 'sched')
    await openLoad(page, 'SG-11')
    await expect(page.locator('.drawer [data-order="hhl"] input')).toHaveCount(0)
    await expect(page.locator('.drawer [data-order="scx"] input')).toHaveCount(1)
    await actionsTab(page)
    await expect(page.locator('.drawer input[name="loadWindowStart"], .drawer input[name="loadWindowEnd"], .drawer input[name="unloadWindowStart"]')).toHaveCount(0)
    await expect(page.locator('.drawer [data-plan-readonly]')).toHaveCount(1)
    await closeDrawer(page)
    await role(page, 'KSH')
    await nav(page, 'sched')
    await openLoad(page, 'SG-11')
    await expect(page.locator('.drawer [data-order] input')).toHaveCount(0)
  })
})
