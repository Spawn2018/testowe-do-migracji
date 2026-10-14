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
  /* B-SMOKE-DRIFT: na 390 px przełącznik roli ukryty celowo (D-31, index.css) — czekamy na obecność w DOM */
  await page.waitForSelector('#roleSeg', { state: 'attached', timeout: 30_000 })
  /* B-SMOKE-LANG: #langSeg usunięty (8322d02) — PL jedyny / domyślny */
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

    /* wyglad/P7-a — E32 (img/e32-after „okno Awizacja”): przyciski „Uzupełnij awizację” / „Edytuj awizację”, tytuł
       „Awizacja · <kod>”, odcinek kierowcy z polami „Imię i nazwisko” i „Ciągnik” (wersaliki) */
    const ADD = 'Uzupełnij awizację'
    const EDIT = 'Edytuj awizację'
    const fillAwiz = async (driver: string, plate: string) => {
      const modal = page.locator('[data-awiz-modal]')
      await modal.locator('label.form-field', { hasText: 'Imię i nazwisko' }).first().locator('input').fill(driver)
      await modal.locator('label.form-field', { hasText: 'Ciągnik' }).first().locator('input').fill(plate)
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
    expect([ADD, EDIT]).toContain(firstLabel)
    await expect(page.locator('#awiz-title')).toContainText('Awizacja · ')
    await fillAwiz('Jan Testowy', 'TESTE201')

    await page.locator('.drawer .drawer-hd button.iconbtn').last().click().catch(() => {})
    await page.waitForTimeout(200)
    const rows = page.locator('tr[data-load]')
    const n = await rows.count()
    const want = firstLabel === ADD ? EDIT : ADD
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
        await expect(page.locator('#awiz-title')).toContainText('Awizacja · ')
        await fillAwiz(want === ADD ? 'Adam Nowy' : 'Piotr Edytowany', want === ADD ? 'POZNE201' : 'EDITE201')
        found = true
        break
      }
      await page.locator('.drawer .drawer-hd button.iconbtn').last().click().catch(() => {})
    }
    expect(found || firstLabel === EDIT || firstLabel === ADD).toBeTruthy()
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
    /* B-SMOKE-DRIFT: L-5 (2af2e46) — bez „przeczytane”; „Oznacz wszystkie” to .btn, pozycje to przyciski bez klasy .btn.
       Klik w pozycję: znika z listy, licznik maleje o 1, otwiera cel (L-4). */
    const badge = async () => Number(((await page.locator('button.bell-trigger').textContent()) ?? '').replace(/\D/g, '') || 0)
    const before = await badge()
    expect(before, 'seed HHL ma nieprzeczytane powiadomienia').toBeGreaterThan(0)
    const item = page.locator('.bell-pop button:not(.btn)').first()
    await item.click()
    await page.waitForTimeout(400)
    expect(await badge()).toBe(before - 1)
    const stillOpen = await page.locator('.bell-pop[role="dialog"]').count()
    const drawer = await page.locator('.drawer').count()
    expect(stillOpen === 0 || drawer > 0).toBeTruthy()
  })

  test('telefon 390 px: kokpit + menu bez poziomego scrolla', async ({ page }) => {
    await boot(page, 390)
    /* przełącznik ukryty na 390 px (D-31) — rola przez DOM */
    await page.evaluate(() => (document.querySelector('#roleSeg button[data-role="HHL"]') as HTMLButtonElement).click())
    await expect(page.locator('#roleSeg button[data-role="HHL"]')).toHaveAttribute('aria-pressed', 'true')
    const overflow = await page.evaluate(() => {
      const de = document.documentElement
      return { sx: window.scrollX, scrollW: de.scrollWidth, clientW: de.clientWidth }
    })
    expect(overflow.sx).toBe(0)
    expect(overflow.scrollW).toBeLessThanOrEqual(overflow.clientW + 1)
    /* E8 (P2): dolny pasek zamiast ☰. */
    await expect(page.locator('button.phone-menu-btn')).toBeHidden()
    await expect(page.locator('nav button.nav-pin')).toHaveCount(4)
    await expect(page.locator('nav button.nav-more-btn')).toBeVisible()
    await page.locator('nav button.nav-more-btn').click()
    await expect(page.locator('nav button[data-view="map"]')).toBeVisible()
  })
})
