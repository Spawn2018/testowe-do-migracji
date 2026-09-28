/**
 * III-2 (SCOPE 0.8, 0.9) — zrzuty wzorcowe STANÓW na świeżym buildzie demo (PW_BASE_URL, np. fresh-smoke :4179 / :4188):
 * najechanie, fokus, wciśnięty, zablokowany, ładowanie (szkielet tabeli), pusty, błąd, błąd walidacji.
 * Harmonogram HHL · pl · 1440 × 900 · motyw domyślny roli (ciemny) + 3 ujęcia w jasnym. Próg: 0,1% pikseli
 * (maxDiffPixelRatio 0.001) przy tolerancji koloru 0.28 jak smoke (krawędzie antyaliasingu).
 * Wzorce: tests/__screenshots__/stan-*.png — odśwież tylko świadomie: npm run test:visual:update -- tests/visual-states.spec.ts
 */
import { test, expect, type Page } from '@playwright/test'
import ExcelJS from 'exceljs'

const FROZEN_URL = `/#/?now=${encodeURIComponent('2026-09-23T14:32:00Z')}`
const W = 1440
const H = 900
const SHOT = { fullPage: false, maxDiffPixelRatio: 0.001, threshold: 0.28, animations: 'disabled' as const, caret: 'hide' as const }

async function open(page: Page, theme: 'dark' | 'light') {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.setViewportSize({ width: W, height: H })
  await page.goto(FROZEN_URL, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.evaluate(() => {
    try { sessionStorage.setItem('wtNavCollapsed', '0'); sessionStorage.removeItem('wt-persist-wipe-notice') } catch { /* */ }
    try { for (const k of Object.keys(localStorage)) if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k) } catch { /* */ }
  })
  await page.reload({ waitUntil: 'networkidle', timeout: 120_000 })
  await page.waitForSelector('#roleSeg', { timeout: 30_000 })
  await page.evaluate(() => (document.querySelector('#roleSeg button[data-role="HHL"]') as HTMLButtonElement).click())
  await page.evaluate(() => (document.querySelector('#langSeg button[data-lang="pl"]') as HTMLButtonElement | null)?.click())
  await page.waitForTimeout(300)
  const cur = await page.evaluate(() => document.documentElement.getAttribute('data-theme'))
  if (cur !== theme) await page.click('#themeBtn')
  await page.evaluate(async () => { if (document.fonts?.ready) await document.fonts.ready })
}
async function sched(page: Page, opts: { holdSkeleton?: boolean } = {}) {
  if (opts.holdSkeleton) {
    /* szkielet trwa SKELETON_MS = 260 ms — zatrzymujemy tylko ten jeden licznik, reszta aplikacji bez zmian */
    await page.evaluate(() => {
      const orig = window.setTimeout
      ;(window as unknown as { setTimeout: unknown }).setTimeout = ((fn: TimerHandler, ms?: number, ...a: unknown[]) =>
        ms === 260 ? 0 : orig(fn, ms, ...a)) as typeof window.setTimeout
    })
  }
  await page.evaluate(() => (document.querySelector('nav button[data-view="sched"]') as HTMLButtonElement).click())
  if (opts.holdSkeleton) await page.waitForSelector('tr[data-sched-skel]')
  else await page.waitForSelector('tr[data-load]')
  await page.mouse.move(W - 5, H - 5)
  await page.waitForTimeout(400)
}
async function xlsx(headers: string[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Harmonogram')
  ws.addRow(headers)
  ws.addRow(headers.map((_, i) => `w${i + 1}`))
  return Buffer.from(await wb.xlsx.writeBuffer())
}

test.describe('III-2 zrzuty stanów (HHL pl 1440)', () => {
  test.describe.configure({ mode: 'serial' })

  for (const theme of ['dark', 'light'] as const) {
    test(`stan-najechanie (${theme})`, async ({ page }) => {
      await open(page, theme); await sched(page)
      await page.locator('tr[data-load]').nth(2).hover()
      await page.waitForTimeout(200)
      await expect(page.locator('tr[data-load]').nth(2)).toHaveClass(/\bhl\b/)
      await expect(page).toHaveScreenshot(`stan-najechanie__${theme}.png`, SHOT)
    })

    test(`stan-fokus (${theme})`, async ({ page }) => {
      await open(page, theme); await sched(page)
      await page.locator('[data-page="schedule"] .filters input[type="search"]').focus()
      await page.keyboard.press('Tab')
      await expect(page.locator('[data-page="schedule"] .filters .chipbtn').first()).toBeFocused()
      await expect(page).toHaveScreenshot(`stan-fokus__${theme}.png`, SHOT)
    })

    test(`stan-pusty (${theme})`, async ({ page }) => {
      await open(page, theme); await sched(page)
      await page.locator('[data-page="schedule"] .filters input[type="search"]').fill('zzz-brak-takiego')
      await expect(page.locator('[data-sched-empty]')).toBeVisible()
      await page.locator('[data-page="schedule"] .filters input[type="search"]').blur()
      await expect(page).toHaveScreenshot(`stan-pusty__${theme}.png`, SHOT)
      await page.locator('[data-sched-clear]').click()
      await expect(page.locator('tr[data-load]').first()).toBeVisible()
    })
  }

  test('stan-wcisniety (dark)', async ({ page }) => {
    await open(page, 'dark'); await sched(page)
    const chips = page.locator('[data-page="schedule"] .filters .chipbtn')
    await chips.nth(2).click() // „Opóźnione” — aria-pressed
    const box = (await chips.nth(3).boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down() // :active na „Braki dokumentów”
    await expect(chips.nth(2)).toHaveAttribute('aria-pressed', 'true')
    await expect(page).toHaveScreenshot('stan-wcisniety__dark.png', SHOT)
    await page.mouse.up()
  })

  test('stan-zablokowany (dark)', async ({ page }) => {
    await open(page, 'dark'); await sched(page)
    await page.locator('[data-page="schedule"] .filters .chipbtn').nth(3).click() // braki dokumentów
    await page.locator('tr[data-load]').first().click()
    await page.locator('.drawer button[aria-selected]').nth(4).click() // zakładka zasobów (akcje statusu)
    const btn = page.locator('.drawer [data-action="mark-ready"]')
    await expect(btn).toBeDisabled()
    await page.mouse.move(W - 5, H - 5)
    await page.waitForTimeout(400)
    await expect(page).toHaveScreenshot('stan-zablokowany__dark.png', SHOT)
  })

  test('stan-ladowanie (dark)', async ({ page }) => {
    await open(page, 'dark'); await sched(page, { holdSkeleton: true })
    await expect(page.locator('tr[data-sched-skel]')).toHaveCount(12)
    await expect(page).toHaveScreenshot('stan-ladowanie__dark.png', SHOT)
  })

  test('stan-blad (dark)', async ({ page }) => {
    await open(page, 'dark'); await sched(page)
    await page.locator('[data-page="schedule"] .panel-hd .chipbtn').first().click() // „Wgraj harmonogram”
    await page.locator('[data-page="schedule"] input[type="file"]').setInputFiles({ name: 'harmonogram.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('to nie jest plik XLSX') })
    const err = page.locator('[data-page="schedule"] .note [style*="var(--red)"]')
    await expect(err).toBeVisible()
    await page.mouse.move(W - 5, H - 5)
    await expect(page).toHaveScreenshot('stan-blad__dark.png', SHOT)
  })

  test('stan-walidacja (dark)', async ({ page }) => {
    await open(page, 'dark'); await sched(page)
    await page.locator('[data-page="schedule"] .panel-hd .chipbtn').first().click()
    await page.locator('[data-page="schedule"] input[type="file"]').setInputFiles({ name: 'obcy-uklad.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: await xlsx(['Kolumna A', 'Kolumna B', 'Kolumna C']) })
    await expect(page.locator('[data-import-colmap]')).toBeVisible({ timeout: 20_000 })
    await expect(page.locator('[data-import-colmap] button[disabled]').first()).toBeVisible()
    await page.mouse.move(W - 5, H - 5)
    await expect(page).toHaveScreenshot('stan-walidacja__dark.png', SHOT)
  })

  test('tryb systemowy: motyw domyślny roli wygrywa z ustawieniem systemu (SCOPE 17.9)', async ({ page }) => {
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
      await page.goto(FROZEN_URL, { waitUntil: 'networkidle', timeout: 120_000 })
      await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k) })
      await page.reload({ waitUntil: 'networkidle', timeout: 120_000 })
      await page.waitForSelector('#roleSeg')
      for (const [role, want] of [['HHL', 'dark'], ['KSH', 'light'], ['SCX', 'dark']] as const) {
        await page.evaluate((r) => (document.querySelector(`#roleSeg button[data-role="${r}"]`) as HTMLButtonElement).click(), role)
        await expect(page.locator('html')).toHaveAttribute('data-theme', want)
      }
    }
  })
})
