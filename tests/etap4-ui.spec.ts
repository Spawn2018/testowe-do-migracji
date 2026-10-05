import { plPlural } from '../src/lib/plPlural'
/**
 * Etap 4 — ścieżki interfejsu na DemoProvider (świeży build HEAD w pre-push: scripts/ci/fresh-smoke.sh).
 * M5: numery zleceń — trzy kolumny, „każda strona swój”, GOTOWY bez numeru HHL → zrozumiały komunikat,
 *     przewoźnik nie widzi okien planowych jako edytowalnych (AN2).
 * M7: plan przypomnień w szczegółach faktury (płatnik i wierzyciel, opłacona → wstrzymane).
 * M6: faktury v2 — moduł KSH (tylko HHL → KSH, spór z uzasadnieniem), kreator przychodowy HHL, SCX bez „Opłacona”.
 * M8: szuflada „Ceny” — poziom, mnożnik z datą, kurs (tymczasowy); Finanse — zestawienie poziomów.
 * M9: aplikacja kierowcy — zgoda na lokalizację (język telefonu), bez zgody tylko przyciski etapów.
 * D26: import harmonogramu — usunięcia wyłącznie za zgodą (pole domyślnie odznaczone, liczba i kody).
 * M11: Finanse — marża w trzech wierszach (zafakturowana / zrealizowana niezafakturowana / prognozowana) = łączna.
 * G4: kokpit — pill poziomu pewności i kursu tymczasowego przy kwotach (odłożone z M8).
 * M10: rozkład rejsów (HHL: dodanie / opóźnienie / odwołanie), przypisanie rejsu (SCX przed wypłynięciem), KSH odczyt.
 * Run: `npm run test:etap4`.
 */
import { test, expect, type Page } from '@playwright/test'
import ExcelJS from 'exceljs'
import { COLUMN_MAP_DEFAULT } from '../src/lib/scheduleParse'

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
      expect(cols.slice(0, 3), r).toEqual(['code', 'ord_hhl', 'ord_scx'])
      // ostatnia kolumna przyklejona do prawej krawędzi (przewijanie w poziomie)
      expect(await page.locator('table.sched-table thead th.stick').count(), r).toBeGreaterThan(0)
    }
    await role(page, 'HHL')
    await nav(page, 'sched')
    const row = page.locator('tr[data-load]', { has: page.locator('span.code', { hasText: /^SG-34$/ }) })
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

test.describe('M11 — rozbicie marży', () => {
  test('HHL: trzy wiersze .mrow + marża łączna (liczby transportów się sumują), waluta z ustawień; KSH/SCX bez marży', async ({ page }) => {
    await boot(page)
    await role(page, 'HHL')
    await nav(page, 'fin')
    const split = page.locator('[data-margin-split]')
    await expect(split.locator('.mrow[data-margin-tier]')).toHaveCount(3)
    const n = async (k: string) => Number(await split.locator(`[data-margin-tier="${k}"]`).getAttribute('data-count'))
    const total = Number(await split.locator('[data-margin-total]').getAttribute('data-count'))
    expect(total).toBe(72)
    expect((await n('FAKTURA')) + (await n('REALIZACJA')) + (await n('PROGNOZA'))).toBe(total)
    await nav(page, 'options')
    await page.locator('[data-deur-exempt="currency-pref"] select').selectOption('PLN')
    await nav(page, 'fin')
    await expect(split.locator('[data-margin-total]')).toContainText('PLN')
    await nav(page, 'options')
    await page.locator('[data-deur-exempt="currency-pref"] select').selectOption('EUR')
    await nav(page, 'fin')
    await expect(split.locator('[data-margin-total]')).toContainText(/€|EUR/)
    for (const r of ['KSH', 'SCX'] as const) {
      await role(page, r)
      await nav(page, 'fin')
      await expect(page.locator('[data-margin-split]')).toHaveCount(0)
    }
  })
})

test.describe('M9 — aplikacja kierowcy', () => {
  test('zgoda w języku telefonu; bez zgody tylko przyciski etapów; ze zgodą pozycja ciągła', async ({ page, context }) => {
    await page.setViewportSize({ width: 412, height: 915 })
    await page.goto(`/#/driver/demo-active`, { waitUntil: 'networkidle', timeout: 120_000 })
    await page.evaluate(() => localStorage.removeItem('wt-driver-geo-consent'))
    await page.reload({ waitUntil: 'networkidle' })
    const lang = await page.evaluate(() => navigator.language.slice(0, 2))
    const consent = page.locator('[data-driver-consent]')
    await expect(consent).toBeVisible()
    if (lang === 'en') await expect(consent.locator('h2')).toHaveText('Location consent')
    // odmowa: panel znika, przyciski etapów działają, brak pozycji
    await consent.locator('[data-consent="deny"]').click()
    await expect(page.locator('[data-tracking="off"]')).toBeVisible()
    await expect(page.locator('[data-tracking="on"]')).toHaveCount(0)
    const stage = page.locator('main button.driver-btn-block').first()
    await expect(stage).toBeEnabled()
    // zgoda: pozycja z telefonu (atrapa GPS) → „ostatnia pozycja”
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 54.40372, longitude: 18.6813, accuracy: 12 })
    await page.locator('[data-tracking="off"] [data-consent="allow"]').click()
    await expect(page.locator('[data-tracking="on"] [data-last-fix]')).toContainText('54.4037, 18.6813')
    // zgoda zapamiętana — bez ponownego pytania
    await page.reload({ waitUntil: 'networkidle' })
    await expect(page.locator('[data-driver-consent]')).toHaveCount(0)
    await expect(page.locator('[data-tracking="on"]')).toBeVisible()
    await page.locator('[data-consent="withdraw"]').click()
    await expect(page.locator('[data-tracking="off"]')).toBeVisible()
  })
})

test.describe('M10 — rejsy i automat statusów', () => {
  test('HHL: rozkład (dodanie, opóźnienie, odwołanie → ryzyko); SCX przypisuje rejs, po wypłynięciu blokada; KSH tylko odczyt', async ({ page }) => {
    await boot(page)
    await role(page, 'HHL')
    await nav(page, 'sched')
    await page.locator('[data-sched-tab="sailings"]').click()
    const table = page.locator('[data-sailings]')
    await expect(table.locator('tr[data-sailing]').first()).toBeVisible()
    // dodanie
    await page.locator('[data-sail-new]').click()
    const form = page.locator('[data-sail-form]')
    await form.locator('input[name="dep"]').fill('2026-10-20T18:00')
    await form.locator('input[name="arr"]').fill('2026-10-20T17:00')
    await form.locator('[data-sail-submit]').click()
    await expect(page.locator('[data-sail-error]')).toContainText('po odejściu')
    await form.locator('input[name="arr"]').fill('2026-10-21T12:00')
    await form.locator('[data-sail-submit]').click()
    await expect(page.locator('[data-sail-form]')).toHaveCount(0)
    // opóźnienie pierwszego przyszłego rejsu
    const first = table.locator('tr[data-sail-status="ZAPLANOWANY"]', { has: page.locator('[data-sail-delay]') }).first()
    const sid = await first.getAttribute('data-sailing')
    await first.locator('[data-sail-delay]').click()
    await page.locator('[data-sail-delay-form] [data-sail-delay-submit]').click()
    await expect(table.locator(`tr[data-sailing="${sid}"]`)).toHaveAttribute('data-sail-status', 'OPOZNIONY')
    // odwołanie
    await table.locator(`tr[data-sailing="${sid}"] [data-sail-cancel]`).click()
    await expect(table.locator(`tr[data-sailing="${sid}"]`)).toHaveAttribute('data-sail-status', 'ODWOLANY')
    await expect(table.locator(`tr[data-sailing="${sid}"] [data-sail-cancel]`)).toHaveCount(0)

    // SCX: przypisanie rejsu w szufladzie (transport przed promem)
    await role(page, 'SCX')
    await nav(page, 'sched')
    await page.locator('[data-sched-tab="loads"]').click()
    await openLoad(page, 'SG-34')
    await actionsTab(page)
    const sf = page.locator('.drawer [data-sailing-form]')
    await expect(sf).toBeVisible()
    const opt = await sf.locator('select[name="sailingId"] option').nth(1).getAttribute('value')
    await sf.locator('select[name="sailingId"]').selectOption(opt!)
    await sf.locator('input[name="bookingRef"]').fill('PF-TEST-1')
    await sf.locator('[data-sailing-submit]').click()
    await actionsTab(page)
    await expect(page.locator('.drawer [data-sailing-form] select[name="sailingId"]')).toHaveValue(opt!)
    await closeDrawer(page)
    // SCX: transport na promie — rejs tylko do odczytu
    const onFerry = 'SG-06' // status PROM w danych demo
    await openLoad(page, onFerry)
    await actionsTab(page)
    await expect(page.locator('.drawer [data-sailing-locked]')).toBeVisible()
    await expect(page.locator('.drawer [data-sailing-form]')).toHaveCount(0)
    await closeDrawer(page)
    // KSH: rozkład bez przycisków, szuflada bez formularza rejsu
    await role(page, 'KSH')
    await nav(page, 'sched')
    await page.locator('[data-sched-tab="sailings"]').click()
    await expect(page.locator('[data-sail-new]')).toHaveCount(0)
    await expect(page.locator('[data-sail-delay]')).toHaveCount(0)
  })
})

test.describe('D26 — import: anulowania za zgodą (ANEKS 3 §2.1)', () => {
  test('HHL (I-2a: import tylko HHL, także w demo): podgląd pokazuje −0 i odznaczone pole z liczbą i kodami; zaznaczenie zmienia licznik; zatwierdzenie bez zgody niczego nie usuwa', async ({ page }) => {
    const fields = Object.keys(COLUMN_MAP_DEFAULT) as (keyof typeof COLUMN_MAP_DEFAULT)[]
    const row = (code: string, delivery: string): Record<string, string> => ({
      shipmentCode: code, itemType: 'SG', dimensions: '12,00 x 2,40 x 2,40', unitWeight: '18,00', qty: '1',
      totalWeight: '18,00', loadDate: '01.10.2026', deliveryDate: delivery,
    })
    const wb = new ExcelJS.Workbook()
    const sh = wb.addWorksheet('Harmonogram')
    sh.addRow(fields.map((f) => COLUMN_MAP_DEFAULT[f]))
    for (const r of [row('SG-01', '06.10.2026'), row('QA-D26-E2E', '03.10.2026')]) sh.addRow(fields.map((f) => (r as Record<string, string>)[f] ?? null))
    const buffer = Buffer.from(await wb.xlsx.writeBuffer())

    await boot(page)
    await role(page, 'HHL')
    await nav(page, 'sched')
    const before = await page.locator('tr[data-load]').count()
    await page.locator('button.chipbtn', { hasText: 'Wgraj aktualizacje' }).click()
    await page.locator('input[type="file"][accept*=".xlsx"]').setInputFiles({ name: 'd26.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer })
    await page.getByRole('button', { name: 'Podgląd zmian' }).click()
    const box = page.locator('[data-import-removals]')
    await expect(box).toBeVisible()
    await expect(page.locator('[data-import-removed-count]')).toHaveText('−0')
    const cb = page.locator('[data-import-allow-removals]')
    await expect(cb).not.toBeChecked()
    const n = (await page.locator('[data-import-removal-codes]').innerText()).split(', ').length
    // ANEKS 3 §2.1: 71 nieobecnych = do anulowania + zablokowane (od załadunku / na fakturze), z powodem
    const blocked = (await page.locator('[data-import-blocked-codes]').innerText()).split(' · ')
    expect(n + blocked.length).toBe(71)
    expect(blocked.length).toBeGreaterThan(0)
    expect(blocked.every((b) => /\((od załadunku — anuluje HHL ręcznie, z powodem|na fakturze)\)$/.test(b))).toBe(true)
    await expect(page.locator('[data-import-blocked]')).toContainText(`Nie do anulowania przez import (${blocked.length}):`)
    const pozycje = plPlural(n, 'pozycję nieobecną', 'pozycje nieobecne', 'pozycji nieobecnych')
    await expect(box).toContainText(`Anuluj ${n} ${pozycje}`)
    await cb.check()
    await expect(page.locator('[data-import-removed-count]')).toHaveText(`−${n}`)
    await cb.uncheck()
    await expect(page.locator('[data-import-removed-count]')).toHaveText('−0')
    await page.getByRole('button', { name: 'Zatwierdź' }).click()
    await expect(page.locator('tr[data-load]')).toHaveCount(before + 1)
  })
})

test.describe('G4 — kokpit: poziom i kurs tymczasowy (z M8)', () => {
  test('HHL marża i SCX tydzień: pill poziomu + pill kursu tymczasowego; KSH bez kwot w kokpicie', async ({ page }) => {
    await boot(page)
    for (const r of ['HHL', 'SCX'] as const) {
      await role(page, r)
      await nav(page, 'dash')
      const tag = page.locator('.kpi [data-kpi-tier]')
      await expect(tag).toHaveCount(1)
      await expect(tag.locator('.pill').first()).toHaveText(/Prognoza|Realizacja|Faktura/)
      const prov = Number(await tag.getAttribute('data-kpi-provisional'))
      await expect(tag.locator('.pill.p-amber')).toHaveCount(prov > 0 ? 1 : 0)
    }
    await role(page, 'KSH')
    await nav(page, 'dash')
    await expect(page.locator('.kpi [data-kpi-tier]')).toHaveCount(0)
  })
})
