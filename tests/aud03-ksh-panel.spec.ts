/**
 * AUD-03 — KSH — PANEL ZLECENIA (decyzja właściciela 05.10). DemoProvider, zamrożony zegar.
 * KSH: ten sam panel (6 zakładek, dane), bez kosztu przewoźnika i marży, „Edytuj” w Przeglądzie → okno
 * z WYŁĄCZNIE datą i godziną załadunku / rozładunku; zapis zmienia daty i dodaje wpis w Historii.
 * „Zmień ciągnik” i przyciski przewoźnika/HHL niewidoczne dla KSH (blokada w bazie: tests/db/aud03.sh).
 * Dowód = asercje (zasada właściciela 06.10: bez zrzutów) — komputer 1366 i telefon 390 px.
 */
import { test, expect, type Page } from '@playwright/test'

const FROZEN_URL = `/#/?now=${encodeURIComponent('2026-09-23T14:32:00Z')}`

async function boot(page: Page, w = 1366, h = 900, r: 'HHL' | 'KSH' | 'SCX' = 'HHL') {
  await page.setViewportSize({ width: 1366, height: 900 })
  await page.goto(FROZEN_URL, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k)
  })
  await page.reload({ waitUntil: 'networkidle', timeout: 120_000 })
  await page.waitForSelector('#roleSeg', { timeout: 30_000 })
  /* przełącznik „Widok” jest na szerokim ekranie — rola przed zmianą rozmiaru (telefon 390 px) */
  await role(page, r)
  await sched(page)
  if (w !== 1366 || h !== 900) {
    await page.setViewportSize({ width: w, height: h })
    await page.waitForTimeout(300)
  }
}
async function role(page: Page, r: 'HHL' | 'KSH' | 'SCX') {
  await page.locator(`#roleSeg button[data-role="${r}"]`).click()
  await page.waitForTimeout(300)
}
async function sched(page: Page) {
  await page.locator('nav button[data-view="sched"]').click()
  await page.waitForTimeout(300)
}
const ROW = '[data-load]:visible'
const PRE = ['PLANNED', 'RESOURCES_PENDING', 'DOCS_PENDING', 'READY'].map((x) => `[data-load][data-status="${x}"]:visible`).join(', ')
/** Pierwszy transport przed wjazdem na załadunek (KSH może zmienić daty). */
async function openEditable(page: Page) {
  await page.locator(PRE).first().click()
  await page.waitForSelector('.drawer')
  await page.locator('.drawer button[aria-selected]').nth(0).click()
  await page.waitForSelector('.drawer [data-ksh-edit]', { timeout: 10_000 })
  await page.locator('.drawer [data-ksh-edit]').click()
  const modal = page.locator('[data-ksh-dates-modal]')
  await expect(modal).toBeVisible()
  await expect(modal.locator('[data-ksh-locked]')).toHaveCount(0)
  return modal
}

for (const vp of [{ w: 1366, h: 900, tag: 'komputer' }, { w: 390, h: 844, tag: 'telefon' }]) {
  test(`AUD-03 KSH: pełny panel, „Edytuj” → okno dat, zapis + Historia (${vp.tag})`, async ({ page }) => {
    test.setTimeout(90_000)
    await boot(page, vp.w, vp.h, 'KSH')
    await expect(page.locator('[data-change-tractor]')).toHaveCount(0)
    await page.locator(ROW).first().click()
    await page.waitForSelector('.drawer [data-ksh-edit]')
    await expect(page.locator('.drawer[data-ksh-side-menu]')).toHaveCount(0)
    await expect(page.locator('.drawer button[aria-selected]')).toHaveCount(6)
    await expect(page.locator('.drawer [data-order]')).toHaveCount(2)
    await expect(page.locator('.drawer [data-load-when]')).toHaveText(/\d/)
    await expect(page.locator('.drawer [data-ksh-actions] [data-ksh-edit]')).toHaveText('Edytuj')
    /* Ceny: przychód tak, koszt przewoźnika i marża — nie */
    await page.locator('.drawer button[aria-selected]').nth(3).click()
    await expect(page.locator('.drawer [data-money-side="cost"]')).toHaveCount(0)
    await expect(page.locator('.drawer').getByText(/marża/i)).toHaveCount(0)
    /* Ustalenia: bez przycisków przewoźnika/HHL (statusy, przypisanie, zasoby) */
    await page.locator('.drawer button[aria-selected]').nth(4).click()
    await expect(page.locator('.drawer [data-carrier-actions]')).toHaveCount(0)
    await expect(page.locator('.drawer [data-action="mark-ready"]')).toHaveCount(0)
    await page.locator('.drawer .drawer-hd button.iconbtn').last().click()
    await page.waitForSelector('.drawer', { state: 'detached' })

    const modal = await openEditable(page)
    /* okno: wyłącznie 4 pola daty i godziny */
    await expect(modal.locator('input, select, textarea')).toHaveCount(4)
    await expect(modal.locator('input[type="datetime-local"]')).toHaveCount(4)
    const code = (await page.locator('.drawer .wb-code').textContent())?.trim() ?? ''
    const lf = await modal.locator('input[name="ksh_load_from"]').inputValue()
    const day = lf.slice(0, 10)
    const next = new Date(`${day}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1)
    const nd = next.toISOString().slice(0, 10)
    await modal.locator('input[name="ksh_load_from"]').fill(`${nd}T08:00`)
    await modal.locator('input[name="ksh_load_to"]').fill(`${nd}T14:00`)
    const df = await modal.locator('input[name="ksh_del_from"]').inputValue()
    if (df.slice(0, 10) < nd) {
      await modal.locator('input[name="ksh_del_from"]').fill(`${nd}T16:00`)
      await modal.locator('input[name="ksh_del_to"]').fill(`${nd}T18:00`)
    }
    await modal.locator('[data-ksh-dates-save]').click()
    await expect(modal).toHaveCount(0)
    const [y, m, d] = nd.split('-')
    await expect(page.locator('.drawer [data-load-when]')).toContainText(`${d}.${m}`)
    void y
    await page.locator('.drawer button[aria-selected]').nth(5).click()
    const entry = page.locator('.drawer [data-history] li').first()
    await expect(entry).toContainText('Zmiana dat i godzin planu')
    await expect(entry).toContainText('// KSH')
    expect(code).toMatch(/^SG-/)
  })
}

test('AUD-03: „Zmień ciągnik” — przewoźnik i HHL widzą, KSH nie', async ({ page }) => {
  await boot(page)
  for (const r of ['SCX', 'HHL'] as const) {
    await role(page, r)
    await sched(page)
    expect(await page.locator('[data-change-tractor]').count()).toBeGreaterThan(0)
  }
  await role(page, 'KSH')
  await sched(page)
  await expect(page.locator('[data-change-tractor]')).toHaveCount(0)
  await expect(page.locator(ROW).first()).toBeVisible()
})

test('AUD-03: przewoźnik nie ma „Edytuj” dat KSH; HHL też nie', async ({ page }) => {
  await boot(page)
  for (const r of ['SCX', 'HHL'] as const) {
    await role(page, r)
    await sched(page)
    await page.locator(ROW).first().click()
    await page.waitForSelector('.drawer [data-order="hhl"]')
    await expect(page.locator('.drawer [data-ksh-edit]')).toHaveCount(0)
    await page.locator('.drawer .drawer-hd button.iconbtn').last().click()
    await page.waitForSelector('.drawer', { state: 'detached' })
  }
})
