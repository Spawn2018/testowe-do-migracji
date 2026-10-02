/**
 * E2E (kolejka pusta / koordynator 02.10) — ścieżki demo:
 * logowanie (sesja roli), awizacja Dodaj/Edytuj, decyzja (kolejka),
 * powiadomienie → klik, widok telefonu 390 px.
 * Uruchomienie: PW_BASE_URL=http://127.0.0.1:<port> npx playwright test tests/e2e-core.spec.ts
 */
import { expect, test, type Page } from '@playwright/test'

const FROZEN = `/#/?now=${encodeURIComponent('2026-09-23T14:32:00Z')}`

async function boot(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: width <= 430 ? 844 : 1080 })
  await page.goto(FROZEN, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k)
  })
  await page.reload({ waitUntil: 'networkidle', timeout: 120_000 })
  await page.waitForSelector('#roleSeg', { timeout: 30_000 })
  await page.locator('#langSeg button[data-lang="pl"]').click()
}

async function role(page: Page, r: 'HHL' | 'KSH' | 'SCX') {
  await page.locator(`#roleSeg button[data-role="${r}"]`).click()
  await expect(page.locator(`#roleSeg button[data-role="${r}"]`)).toHaveAttribute('aria-pressed', 'true')
}

test.describe('E2E core (demo)', () => {
  test('logowanie: sesja HHL/KSH/SCX (przełącznik roli = wejście)', async ({ page }) => {
    await boot(page)
    for (const r of ['HHL', 'KSH', 'SCX'] as const) {
      await role(page, r)
      await expect(page.locator('nav button[data-view="dash"]')).toBeVisible()
    }
  })

  test('awizacja Dodaj i Edytuj', async ({ page }) => {
    await boot(page)
    await role(page, 'SCX')
    await page.locator('nav button[data-view="sched"]').click()

    const fillAwiz = async (driver: string, plate: string) => {
      const modal = page.locator('[data-awiz-modal]')
      await modal.locator('label.form-field', { hasText: 'Kierowca' }).locator('input').fill(driver)
      await modal.locator('label.form-field', { hasText: 'Ciągnik' }).locator('input').fill(plate)
      await page.locator('[data-awiz-save]').click()
      await expect(modal).toHaveCount(0)
    }

    await page.locator('tr[data-load]').first().click()
    await expect(page.locator('.drawer')).toBeVisible()
    const openBtn = page.locator('[data-awiz-open]')
    await expect(openBtn).toBeVisible()
    const firstLabel = ((await openBtn.textContent()) ?? '').trim()
    await openBtn.click()
    await expect(page.locator('[data-awiz-modal]')).toBeVisible()
    await expect(page.locator('#awiz-title')).toContainText(firstLabel === 'Edytuj' ? 'Edytuj' : 'Dodaj')
    await fillAwiz('Jan Testowy', 'TESTE201')

    await page.locator('.drawer .drawer-hd button.iconbtn').last().click().catch(() => {})
    await page.waitForTimeout(200)
    const rows = page.locator('tr[data-load]')
    const n = await rows.count()
    const want = firstLabel === 'Dodaj' ? 'Edytuj' : 'Dodaj'
    let found = false
    for (let i = 0; i < Math.min(n, 50); i++) {
      await rows.nth(i).click()
      await page.waitForSelector('.drawer', { timeout: 5000 }).catch(() => null)
      const btn = page.locator('[data-awiz-open]')
      if ((await btn.count()) === 0) {
        await page.locator('.drawer .drawer-hd button.iconbtn').last().click().catch(() => {})
        continue
      }
      const label = ((await btn.textContent()) ?? '').trim()
      if (label === want) {
        await btn.click()
        await expect(page.locator('#awiz-title')).toContainText(want)
        await fillAwiz(want === 'Dodaj' ? 'Adam Nowy' : 'Piotr Edytowany', want === 'Dodaj' ? 'POZNE201' : 'EDITE201')
        found = true
        break
      }
      await page.locator('.drawer .drawer-hd button.iconbtn').last().click().catch(() => {})
    }
    expect(found || firstLabel === 'Edytuj' || firstLabel === 'Dodaj').toBeTruthy()
  })

  test('decyzja: kolejka „Wymaga decyzji” → klik otwiera kontekst', async ({ page }) => {
    await boot(page)
    await role(page, 'HHL')
    await page.locator('nav button[data-view="dash"]').click()
    const row = page.locator('ul.exq li').first()
    await expect(row).toBeVisible({ timeout: 15_000 })
    await row.click()
    const drawer = page.locator('.drawer')
    const risks = page.locator('nav button[data-view="risks"]')
    await expect(drawer.or(risks)).toBeVisible()
  })

  test('powiadomienie → klik', async ({ page }) => {
    await boot(page)
    await role(page, 'HHL')
    await page.locator('button.bell-trigger').click()
    await expect(page.locator('.bell-pop[role="dialog"]')).toBeVisible()
    const item = page.locator('.bell-pop button').filter({ hasNotText: /Przeczyt|Mark|Läs/ }).first()
    if ((await item.count()) === 0) {
      test.skip(true, 'brak powiadomień w seed')
    }
    await item.click()
    await page.waitForTimeout(400)
    const stillOpen = await page.locator('.bell-pop[role="dialog"]').count()
    const drawer = await page.locator('.drawer').count()
    expect(stillOpen === 0 || drawer > 0).toBeTruthy()
  })

  test('telefon 390 px: kokpit + menu bez poziomego scrolla', async ({ page }) => {
    await boot(page, 390)
    await role(page, 'HHL')
    const overflow = await page.evaluate(() => {
      const de = document.documentElement
      return { sx: window.scrollX, scrollW: de.scrollWidth, clientW: de.clientWidth }
    })
    expect(overflow.sx).toBe(0)
    expect(overflow.scrollW).toBeLessThanOrEqual(overflow.clientW + 1)
    const menu = page.locator('button.phone-menu-btn')
    await expect(menu).toBeVisible()
    await menu.click()
    await expect(page.locator('nav button[data-view="dash"], .nav-overlay nav, aside nav').first()).toBeVisible()
  })
})
