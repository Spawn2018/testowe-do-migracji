/**
 * B-PERSIST-TOAST (06.10.2026) — pierwsze wejście z pustym magazynem NIE pokazuje toastu
 * „Zapisany stan aplikacji był uszkodzony…”. Regresja Q-9 B (e5ccb96): onRehydrateStorage wołał
 * useTowerStore.setState przed przypisaniem store (synchroniczna hydratacja w create()), gdy motyw
 * systemu (jasny) ≠ motyw startowy (ciemny) → TypeError → callback z `error` → toast.
 * Naprawdę uszkodzony zapis nadal pokazuje toast.
 */
import { expect, test, type Page } from '@playwright/test'

const URL = `/#/?now=${encodeURIComponent('2026-09-23T14:32:00Z')}`
const TOAST = 'Zapisany stan aplikacji był uszkodzony'

async function firstVisit(page: Page) {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.waitForSelector('#roleSeg', { timeout: 30_000 })
  await page.waitForTimeout(500)
  return errors
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`B-PERSIST-TOAST — system ${scheme}`, () => {
    test.use({ colorScheme: scheme })
    test('pusty magazyn → bez toastu, motyw = system', async ({ page }) => {
      const errors = await firstVisit(page)
      expect(await page.evaluate(() => document.body.innerText.includes('uszkodzony'))).toBe(false)
      await expect(page.getByText(TOAST)).toHaveCount(0)
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme)
      expect(errors).toEqual([])
    })
  })
}

test.describe('B-PERSIST-TOAST — uszkodzony zapis', () => {
  test('nieczytelny JSON w magazynie → toast zostaje', async ({ page }) => {
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('wt-test-seeded')) {
        sessionStorage.setItem('wt-test-seeded', '1')
        localStorage.setItem('watch-tower-ui-v6-ready-gate', '{to nie jest json')
      }
    })
    await firstVisit(page)
    expect(await page.evaluate(() => document.body.innerText.includes('uszkodzony'))).toBe(true)
  })
})
