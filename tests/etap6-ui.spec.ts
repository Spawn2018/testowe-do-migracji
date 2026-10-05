/**
 * Etap 6 — odbiór końcowy (UI, DemoProvider).
 * O4: oznaczenie danych demonstracyjnych ZOSTAJE (do potwierdzenia przez właściciela prawdziwych stawek
 *     i parametrów opłaty paliwowej); panel warunków drogowych SE zostaje demonstracyjny do czasu klucza
 *     Trafikverket. Oznaczenia domyślnie włączone; przełącznik w Opcjach je ukrywa (i przywraca).
 */
import { expect, test, type Page } from '@playwright/test'

const url = (path: string) => `/#${path}?now=2026-09-23T14%3A32%3A00Z`

async function fresh(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1080 })
  await page.goto(url('/'), { waitUntil: 'networkidle', timeout: 120_000 })
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k)
  })
  await page.reload({ waitUntil: 'networkidle', timeout: 120_000 })
  await page.waitForSelector('#roleSeg', { timeout: 30_000 })
  /* B-SMOKE-LANG: bez #langSeg — PL domyślny */
}

test.describe('O4 — oznaczenie demo zostaje', () => {
  test('stawki i opłata paliwowa (Opcje, Finanse) oraz SE drogi (Ryzyka) oznaczone jako demo; przełącznik działa', async ({ page }) => {
    await fresh(page)
    await page.goto(url('/opcje'), { waitUntil: 'networkidle' })
    await expect(page.locator('[data-demo-mark]')).toHaveCount(2)
    await page.goto(url('/finanse'), { waitUntil: 'networkidle' })
    await expect(page.locator('[data-demo-mark]')).toHaveCount(1)
    await page.goto(url('/ryzyka'), { waitUntil: 'networkidle' })
    const se = page.locator('[data-panel="road-se"]')
    await expect(se).toHaveAttribute('data-demo', 'trafikverket')
    await expect(se.locator('[data-demo-mark]')).toHaveCount(1)
    await expect(se.locator('.note')).toContainText('demonstracyjne')
    // przełącznik w Opcjach ukrywa oznaczenia, ponowne włączenie przywraca
    await page.goto(url('/opcje'), { waitUntil: 'networkidle' })
    const sw = page.locator('xpath=//dt[normalize-space()="Oznaczenia demonstracyjne"]/following-sibling::dd[1]//input[@type="checkbox"]')
    await sw.uncheck()
    await expect(page.locator('[data-demo-mark]')).toHaveCount(0)
    await sw.check()
    await expect(page.locator('[data-demo-mark]')).toHaveCount(2)
  })
})
