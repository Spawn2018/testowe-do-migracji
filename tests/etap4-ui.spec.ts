/**
 * Etap 4 — ścieżki interfejsu na DemoProvider (świeży build HEAD w pre-push: scripts/ci/fresh-smoke.sh).
 * M5: numery zleceń — trzy kolumny, „każda strona swój”, GOTOWY bez numeru HHL → zrozumiały komunikat,
 *     przewoźnik nie widzi okien planowych jako edytowalnych (AN2).
 * M7: plan przypomnień w szczegółach faktury (płatnik i wierzyciel, opłacona → wstrzymane).
 * M6: faktury v2 — moduł KSH (tylko HHL → KSH, spór z uzasadnieniem), kreator przychodowy HHL, SCX bez „Opłacona”.
 * M8: szuflada „Ceny” — poziom, mnożnik z datą, kurs (tymczasowy); Finanse — zestawienie poziomów.
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

const PDF = { name: 'faktura.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%test\n') }

test.describe('M6 — faktury v2', () => {
  test('KSH: moduł faktur — wyłącznie HHL → KSH; SPORNA wymaga uzasadnienia; ZAAKCEPTOWANA', async ({ page }) => {
    await boot(page)
    await role(page, 'KSH')
    await nav(page, 'inv')
    await expect(page.locator('[data-bill-section="PRZYCHOD"]')).toHaveCount(1)
    await expect(page.locator('[data-bill-section="KOSZT"]')).toHaveCount(0)
    await expect(page.locator('[data-bill-new]')).toHaveCount(0)
    const rows = page.locator('[data-bill-section="PRZYCHOD"] tr[data-bill]')
    expect(await rows.count()).toBeGreaterThan(0)
    await expect(page.locator('tr[data-bill] span.code', { hasText: /^SCX\// })).toHaveCount(0)
    const target = page.locator('tr[data-bill]', { has: page.locator('[data-verif="DO_WERYFIKACJI"]') }).first()
    const id = await target.getAttribute('data-bill')
    await target.click()
    const detail = page.locator(`[data-bill-detail="${id}"]`)
    await expect(detail.locator('th', { hasText: 'Wg cen KSH' })).toHaveCount(1)
    await expect(detail.locator('[data-paid], [data-unpaid]')).toHaveCount(0)
    await detail.locator('[data-verify="SPORNA"]').click()
    await expect(page.locator(`tr[data-bill="${id}"] [data-verif="DO_WERYFIKACJI"]`)).toHaveCount(1)
    await detail.locator('input[aria-label="Uzasadnienie sporu"]').fill('Stawka niezgodna z cennikiem KSH')
    await detail.locator('[data-verify="SPORNA"]').click()
    await expect(page.locator(`tr[data-bill="${id}"] [data-verif="SPORNA"]`)).toHaveCount(1)
    await expect(detail).toContainText('Stawka niezgodna z cennikiem KSH')
    await detail.locator('[data-verify="ZAAKCEPTOWANA"]').click()
    await expect(page.locator(`tr[data-bill="${id}"] [data-verif="ZAAKCEPTOWANA"]`)).toHaveCount(1)
  })

  test('HHL: kreator faktury przychodowej (PLN, kurs per pozycja) → lista; „Opłacona” z datą', async ({ page }) => {
    await boot(page)
    await role(page, 'HHL')
    await nav(page, 'inv')
    await expect(page.locator('[data-bill-section="KOSZT"]')).toHaveCount(1)
    await expect(page.locator('[data-bill-section="PRZYCHOD"]')).toHaveCount(1)
    await expect(page.locator('[data-bill-new="KOSZT"]')).toHaveCount(0)
    const before = await page.locator('[data-bill-section="PRZYCHOD"] tr[data-bill]').count()
    await page.locator('[data-bill-new="PRZYCHOD"]').click()
    const wz = page.locator('[data-bill-wizard="PRZYCHOD"]')
    await expect(wz.locator('tr[data-w-line]').first()).toBeVisible()
    await wz.locator('[data-cur="PLN"]').click()
    const line = wz.locator('tr[data-w-line]').first()
    await expect(line.locator('[data-flag="BRAK_KURSU"]')).toHaveCount(1)
    await line.locator('[data-fx-confirm]').check()
    await expect(line.locator('[data-flag="BRAK_KURSU"]')).toHaveCount(0)
    // bez numeru / kwot / PDF → komunikaty, brak zapisu
    await wz.locator('[data-w="submit"]').click()
    await expect(wz.locator('[data-w-errors]')).toContainText('Numer faktury jest wymagany')
    await expect(wz.locator('[data-w-errors]')).toContainText('system nie liczy VAT')
    await wz.locator('[data-w="number"]').fill('HHL/FV/2026/0950')
    await wz.locator('[data-w="net"]').fill('10000')
    await wz.locator('[data-w="vat"]').fill('0')
    await wz.locator('[data-w="gross"]').fill('10000')
    await wz.locator('[data-w="pdf"]').setInputFiles(PDF)
    await wz.locator('[data-w="submit"]').click()
    await expect(wz).toHaveCount(0)
    await expect(page.locator('[data-bill-section="PRZYCHOD"] tr[data-bill]')).toHaveCount(before + 1)
    const row = page.locator('tr[data-bill]', { has: page.locator('span.code', { hasText: 'HHL/FV/2026/0950' }) })
    await expect(row.locator('[data-verif="DO_WERYFIKACJI"]')).toHaveCount(1)
    await expect(row.locator('[data-pay="NIEOPLACONA"]')).toHaveCount(1)
    const id = await row.getAttribute('data-bill')
    const detail = page.locator(`[data-bill-detail="${id}"]`)
    await expect(detail).toBeVisible()
    await expect(detail.locator('[data-verify]')).toHaveCount(0) // wystawca nie weryfikuje
    // M7: plan przypomnień −3/0/+1/+7/+14 do płatnika i wierzyciela; po „Opłacona” — wstrzymane
    await expect(detail.locator('[data-reminders] [data-reminder]')).toHaveCount(5)
    await expect(detail.locator('[data-reminders]')).toContainText('KSH (płatnik) · HHL (wierzyciel)')
    await detail.locator('[data-paid]').click()
    await expect(row.locator('[data-pay="OPLACONA"]')).toHaveCount(1)
    await expect(detail.locator('[data-reminder="ZAPLANOWANE"]')).toHaveCount(0)
    await expect(detail.locator('[data-reminder="WSTRZYMANE"]')).toHaveCount(5)
    // KSH widzi nową fakturę i powiadomienie
    await role(page, 'KSH')
    await nav(page, 'inv')
    await expect(page.locator('tr[data-bill] span.code', { hasText: 'HHL/FV/2026/0950' })).toHaveCount(1)
  })

  test('SCX: rejestruje fakturę kosztową, widzi status i termin, bez „Opłacona”; nie widzi przychodowych', async ({ page }) => {
    await boot(page)
    await role(page, 'SCX')
    await nav(page, 'inv')
    await expect(page.locator('[data-bill-section="KOSZT"]')).toHaveCount(1)
    await expect(page.locator('[data-bill-section="PRZYCHOD"]')).toHaveCount(0)
    await expect(page.locator('tr[data-bill] span.code', { hasText: /^HHL\// })).toHaveCount(0)
    await page.locator('[data-bill-new="KOSZT"]').click()
    const wz = page.locator('[data-bill-wizard="KOSZT"]')
    await wz.locator('[data-w="number"]').fill('SCX/FV/2026/77')
    await wz.locator('[data-w="net"]').fill('1')
    await wz.locator('[data-w="vat"]').fill('0')
    await wz.locator('[data-w="gross"]').fill('1')
    await wz.locator('[data-w="pdf"]').setInputFiles(PDF)
    await wz.locator('[data-w="submit"]').click()
    const row = page.locator('tr[data-bill]', { has: page.locator('span.code', { hasText: 'SCX/FV/2026/77' }) })
    await expect(row).toHaveCount(1)
    // po rejestracji szczegóły faktury są otwarte
    const detail = page.locator(`[data-bill-detail="${await row.getAttribute('data-bill')}"]`)
    await expect(detail).toBeVisible()
    await expect(detail.locator('[data-paid], [data-unpaid], [data-verify]')).toHaveCount(0)
  })
})

test.describe('M8 — poziom wyceny i kurs tymczasowy', () => {
  test('szuflada „Ceny”: poziom, mnożnik z datą, kurs; KSH bez strony kosztu; Finanse — zestawienie poziomów', async ({ page }) => {
    await boot(page)
    await role(page, 'HHL')
    await nav(page, 'sched')
    await openLoad(page, 'SG-34')
    await page.locator('.drawer button[aria-selected]').nth(3).click()
    const cost = page.locator('.drawer [data-money-side="cost"]')
    const rev = page.locator('.drawer [data-money-side="rev"]')
    await expect(cost.locator('[data-tier]')).toHaveCount(1)
    await expect(rev.locator('[data-tier]')).toHaveCount(1)
    const refC = await cost.locator('[data-fuel-ref]').getAttribute('data-fuel-ref')
    expect(refC).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(await rev.locator('[data-fuel-ref]').getAttribute('data-fuel-ref')).toBe(refC)
    await expect(page.locator('.drawer [data-money-error]')).toHaveCount(0)
    await closeDrawer(page)

    await role(page, 'KSH')
    await nav(page, 'sched')
    await openLoad(page, 'SG-34')
    await page.locator('.drawer button[aria-selected]').nth(3).click()
    await expect(page.locator('.drawer [data-money-side="cost"]')).toHaveCount(0)
    await expect(page.locator('.drawer [data-money-side="rev"] [data-tier]')).toHaveCount(1)
    await closeDrawer(page)

    await role(page, 'HHL')
    await nav(page, 'fin')
    const sum = page.locator('[data-tier-summary]')
    await expect(sum).toBeVisible()
    let total = 0
    for (const k of ['PROGNOZA', 'REALIZACJA', 'FAKTURA']) total += Number(await sum.locator(`[data-tier-count="${k}"]`).innerText())
    expect(total).toBeGreaterThan(0)
    await expect(page.locator('[data-money-ok]')).toBeVisible()
  })
})
