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
  /* B-SMOKE-LANG: bez #langSeg — PL domyślny */
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
/* wyglad/P4-b — E25 (img/e25-after): „Zmień status” jest w zakładce Status (nie w Ustaleniach) */
async function statusTab(page: Page) {
  await page.locator('.drawer button[aria-selected]').nth(1).click()
  await page.waitForTimeout(200)
}
async function openLoad(page: Page, code: string, opts?: { orders?: boolean }) {
  await page.locator(`tr[data-code="${code}"]`).first().click()
  await page.waitForSelector('.drawer')
  await page.locator('.drawer button[aria-selected]').nth(0).click()
  if (opts?.orders !== false) await page.waitForSelector('.drawer [data-order="hhl"]')
}
/** E41 (P2): KSH bez pól numerów; jedyny przycisk zmian = „Edytuj”. */
async function openLoadKsh(page: Page, code: string) {
  await openLoad(page, code, { orders: false })
  await page.waitForSelector('.drawer [data-ksh-edit]')
}
/** B-SMOKE-DRIFT: nr HHL edytowany w oknie awizacji (AWIZ-4 / HHL-4a, 13ace35), nie w polu szuflady. */
async function setHhlOrder(page: Page, v: string) {
  await page.locator('.drawer button[aria-selected]').nth(0).click()
  await page.locator('.drawer [data-hhl-order-btn]').click()
  const modal = page.locator('[data-awiz-modal]')
  await modal.locator('[data-awiz-hhl-order]').fill(v)
  await modal.locator('[data-awiz-save]').click()
  await expect(modal).toHaveCount(0)
}

test.describe('M5 — numery zleceń', () => {
  test('harmonogram: kolumny numerów dla HHL i SCX, KSH tylko kod (E41 P2)', async ({ page }) => {
    await boot(page)
    for (const r of ['HHL', 'SCX'] as const) {
      await role(page, r)
      await nav(page, 'sched')
      const cols = await page.locator('table.sched-table thead th').evaluateAll((ths) => ths.map((t) => t.getAttribute('data-col')))
      expect(cols.slice(0, 3), r).toEqual(['code', 'ord_hhl', 'ord_scx'])
      expect(await page.locator('table.sched-table thead th.stick').count(), r).toBeGreaterThan(0)
    }
    await role(page, 'KSH')
    await nav(page, 'sched')
    const kshCols = await page.locator('table.sched-table thead th').evaluateAll((ths) => ths.map((t) => t.getAttribute('data-col')))
    expect(kshCols).not.toContain('ord_hhl')
    expect(kshCols).not.toContain('ord_scx')
    expect(kshCols[0]).toBe('code')
    await role(page, 'HHL')
    await nav(page, 'sched')
    const row = page.locator('tr[data-load]', { has: page.locator('td[data-col="code"] span.code', { hasText: /^SG-34$/ }) })
    // E38 1A (P2-wyglad V1, D-20261013-1535-01): „Wysyłka” = sam kod. Numer zostaje w swojej kolumnie.
    await expect(row.locator('td[data-col="code"] span.code')).toHaveText('SG-34')
    await expect(row.locator('td[data-col="ord_hhl"]')).toHaveText(/^HHL\/2026\//)
    await expect(row.locator('td[data-col="ord_scx"]')).toHaveText(/^SCX-26-/)
  })

  // E25 (P4): zamiast „Oznacz jako gotowy” — okno „Zmień status” (PLAN §4 P4 testy do przepisania)
  test('HHL: GOTOWY bez numeru HHL → zrozumiały komunikat; numer przewoźnika tylko do odczytu', async ({ page }) => {
    await boot(page)
    await role(page, 'HHL')
    await nav(page, 'sched')
    let code = ''
    for (const c of ['SG-29', 'SS-03', 'P-01', 'SG-09', 'SG-11', 'SG-18', 'SG-19', 'SG-20', 'T-10', 'SG-30', 'T-14', 'SS-04', 'SS-05', 'K-03', 'P-02', 'R-03']) {
      await openLoad(page, c)
      await statusTab(page)
      const btn = page.locator('.drawer [data-action="change-status"]')
      if ((await btn.count()) > 0 && (await btn.isEnabled())) { code = c; break }
      await closeDrawer(page)
    }
    expect(code, 'transport z przyciskiem Zmień status').not.toBe('')
    await page.locator('.drawer button[aria-selected]').nth(0).click()
    await expect(page.locator('.drawer [data-order="scx"] input')).toHaveCount(0)
    await expect(page.locator('.drawer [data-order="hhl"] .mono')).toHaveText(/^HHL\/2026\//)
    await setHhlOrder(page, '')
    await closeDrawer(page)
    const row0 = page.locator('tr[data-load]', { has: page.locator('span.code', { hasText: new RegExp(`^${code}`) }) })
    await expect(row0.locator('td[data-col="ord_hhl"]')).toHaveText('— brak —')
    await openLoad(page, code)
    await statusTab(page)
    await page.locator('.drawer [data-action="change-status"]').click()
    const modal = page.locator('[data-status-change-modal]')
    await expect(modal).toBeVisible()
    await modal.locator('[data-status-select]').selectOption('READY')
    await modal.locator('[data-status-save]').click()
    await expect(page.getByText('Nie można oznaczyć jako gotowy — brak numeru zlecenia HHL', { exact: false }).first()).toBeVisible()
    await setHhlOrder(page, 'HHL/2026/9001')
    await closeDrawer(page)
    const row = page.locator('tr[data-load]', { has: page.locator('span.code', { hasText: new RegExp(`^${code}`) }) })
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
    /* AN2 po AWIZ-4 (13ace35): blok „okna planowe (odczyt)” z zakładki działań usunięty — okno załadunku przewoźnik widzi jako tekst w Przeglądzie */
    await page.locator('.drawer button[aria-selected]').nth(0).click()
    await expect(page.locator('.drawer [data-load-when]')).toHaveText(/\d/)
    await expect(page.locator('.drawer [data-load-when] input')).toHaveCount(0)
    await closeDrawer(page)
    await role(page, 'KSH')
    await nav(page, 'sched')
    await openLoadKsh(page, 'SG-11')
    /* E41 (P2): KSH nie widzi pól numerów zleceń */
    await expect(page.locator('.drawer [data-order]')).toHaveCount(0)
    await expect(page.locator('.drawer [data-order] input')).toHaveCount(0)
    await expect(page.locator('.drawer input')).toHaveCount(0)
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
    /* B-K.1 (8322d02): KSH bez zakładki „Ceny” — swoją cenę widzi w harmonogramie, koszt przewoźnika nigdzie */
    const kshRow = page.locator('tr[data-code="SG-34"]')
    await expect(kshRow.locator('td[data-col="rev"]')).toHaveText(/\d/)
    await expect(page.locator('table.sched-table [data-col="cost"]')).toHaveCount(0)
    await openLoadKsh(page, 'SG-34')
    await expect(page.locator('.drawer [data-money-side]')).toHaveCount(0)
    await closeDrawer(page)

    await role(page, 'HHL')
    await nav(page, 'fin')
    /* przepisane w wyglad/P5 — E16: etapy rozliczenia w tabeli „Od przychodu do marży” (Zafakturowane, Dostarczone, Prognoza) */
    const stages = page.locator('[data-fin-stages="both"]')
    await expect(stages).toBeVisible()
    let total = 0
    for (const k of ['PROGNOZA', 'REALIZACJA', 'FAKTURA']) total += Number(await stages.locator(`[data-fin-stage="${k}"]`).getAttribute('data-count'))
    expect(total).toBeGreaterThan(0)
  })
})

test.describe('M11 — rozbicie marży', () => {
  /* przepisane w wyglad/P5 — E16: jedna tabela etapów (Zafakturowane / Dostarczone / Prognoza + Razem), waluta z „Dla mnie”;
     KSH („Rozliczenia”) tylko swoja cena, SCX („Moje stawki”) tylko swoja stawka — bez marży */
  test('HHL: trzy etapy + razem (liczby transportów się sumują), waluta z ustawień; KSH/SCX bez marży', async ({ page }) => {
    await boot(page)
    await role(page, 'HHL')
    await nav(page, 'fin')
    const stages = page.locator('[data-fin-stages="both"]')
    await expect(stages.locator('tbody [data-fin-stage]')).toHaveCount(3)
    const n = async (k: string) => Number(await stages.locator(`[data-fin-stage="${k}"]`).getAttribute('data-count'))
    const total = Number(await stages.locator('[data-fin-stage-total]').getAttribute('data-count'))
    expect(total).toBe(72)
    expect((await n('FAKTURA')) + (await n('REALIZACJA')) + (await n('PROGNOZA'))).toBe(total)
    await nav(page, 'options')
    /* wyglad/P3-c (E11): waluta w Dla mnie › Wygląd i waluta */
    await page.click('[data-opt-nav="look"]')
    await page.locator('[data-deur-exempt="currency-pref"] select').selectOption('PLN')
    await nav(page, 'fin')
    await expect(stages.locator('[data-fin-stage-total]')).toContainText('PLN')
    await nav(page, 'options')
    await page.click('[data-opt-nav="look"]')
    await page.locator('[data-deur-exempt="currency-pref"] select').selectOption('EUR')
    await nav(page, 'fin')
    await expect(stages.locator('[data-fin-stage-total]')).toContainText('EUR')
    for (const r of ['KSH', 'SCX'] as const) {
      await role(page, r)
      await nav(page, 'fin')
      await expect(page.locator('[data-fin-stages="both"]')).toHaveCount(0)
      await expect(page.locator('[data-fin-stages]')).toHaveCount(1)
      await expect(page.locator('[data-page="finance"]')).not.toContainText('Marża')
      await expect(page.locator('[data-fin-types]')).toHaveCount(0)
    }
  })
})

test.describe('M9 — aplikacja kierowcy', () => {
  /* B-SMOKE-DRIFT: DRV-CLOSE (4399a18, U-38/D-36, PLAN: DONE 05.10) — trasa #/driver/:token pokazuje „Link nieaktywny”,
     zgoda/pozycja z telefonu wyłączone (pozycje tylko z telematyki). Kod PWA zostaje w repo, ale się nie renderuje. */
  test('DRV-CLOSE: link kierowcy nieaktywny — bez zgody na lokalizację i bez wysyłania pozycji', async ({ page, context }) => {
    await page.setViewportSize({ width: 412, height: 915 })
    await context.grantPermissions(['geolocation'])
    await context.setGeolocation({ latitude: 54.40372, longitude: 18.6813, accuracy: 12 })
    await page.goto(`/#/driver/demo-active`, { waitUntil: 'networkidle', timeout: 120_000 })
    await expect(page.locator('[data-driver-link-closed]')).toContainText('Link nieaktywny')
    await expect(page.locator('[data-driver-consent]')).toHaveCount(0)
    await expect(page.locator('[data-tracking]')).toHaveCount(0)
    await expect(page.locator('main button.driver-btn-block')).toHaveCount(0)
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
    /* AWIZ-4 (13ace35): rejs wybierany w oknie awizacji (armator → rejs → statek); B-10b: bez nr rezerwacji promu */
    await openLoad(page, 'SG-34')
    await actionsTab(page)
    await page.locator('.drawer [data-awiz-chat-note] + .awiz-row button').click()
    const modal = page.locator('[data-awiz-modal]')
    const sel = modal.locator('select[data-awiz-sailing]')
    await expect(sel).toBeVisible()
    const opt = await sel.locator('option').nth(1).getAttribute('value')
    await sel.selectOption(opt!)
    await modal.locator('[data-awiz-save]').click()
    await expect(modal).toHaveCount(0)
    await page.locator('.drawer [data-awiz-chat-note] + .awiz-row button').click()
    await expect(modal.locator('select[data-awiz-sailing]')).toHaveValue(opt!)
    await modal.locator('.panel-hd .iconbtn').click()
    await closeDrawer(page)
    // SCX: transport na promie — rejs tylko do odczytu
    const onFerry = 'SG-06' // status PROM w danych demo
    await openLoad(page, onFerry)
    await actionsTab(page)
    await page.locator('.drawer [data-awiz-chat-note] + .awiz-row button').click()
    await expect(page.locator('[data-awiz-modal] [data-sailing-locked]')).toBeVisible()
    await expect(page.locator('[data-awiz-modal] select[data-awiz-sailing]')).toHaveCount(0)
    await page.locator('[data-awiz-modal] .panel-hd .iconbtn').click()
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

/* Przepisane w wyglad/P3-b — E9 (decyzja 07.10 19:11, img/e9-after): kwota jest tylko na kafelku „Marża (prognoza)” HHL;
   poziom pewności stoi w etykiecie kafelka, kurs tymczasowy przy kwocie. SCX i KSH nie mają kwot w Kokpicie. */
test.describe('G4 — kokpit: poziom i kurs tymczasowy (z M8)', () => {
  test('HHL marża: poziom w etykiecie + pill kursu tymczasowego; SCX i KSH bez kwot w kokpicie', async ({ page }) => {
    await boot(page)
    await role(page, 'HHL')
    await nav(page, 'dash')
    const tile = page.locator('.kpi[data-ck="margin"]')
    await expect(tile.locator('.k')).toContainText(/Marża \((prognoza|realizacja|faktura)\)/)
    const tag = page.locator('.kpi [data-kpi-tier]')
    await expect(tag).toHaveCount(1)
    const prov = Number(await tag.getAttribute('data-kpi-provisional'))
    await expect(tag.locator('.pill.p-amber')).toHaveCount(prov > 0 ? 1 : 0)
    for (const r of ['SCX', 'KSH'] as const) {
      await role(page, r)
      await nav(page, 'dash')
      await expect(page.locator('.kpi [data-kpi-tier]')).toHaveCount(0)
    }
  })
})
