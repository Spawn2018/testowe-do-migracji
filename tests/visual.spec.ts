/**
 * C2.4 — smoke pixel-diff (Playwright).
 *
 * Mały zestaw (HHL / pl / 1920, kokpit + mapa, light + dark-default) —
 * pełna matryca ~720 ujęć to robota C2.3 (`scripts/baseline.mjs` → `shots-baseline/`).
 *
 * Snapshoty: `tests/__screenshots__/<nazwa>.png`
 * Brak snapshotu → czerwony test; odśwież: `npm run test:visual:update`
 *
 * Wzorzec = aktualny stan UI (dryf od dziś), nie HTML SoT.
 */
import { test, expect, type Page } from '@playwright/test'

const FROZEN_NOW = '2026-09-23T14:32:00Z'
const FROZEN_URL = `/#/?now=${encodeURIComponent(FROZEN_NOW)}`
const PERSIST_KEY = 'watch-tower-ui-v6-ready-gate'
const HEIGHT = 1080

/** Smoke ↔ te same nazwy co baseline.mjs (widok__rola__jezyk__szerokosc__motyw). */
const SMOKE: Array<{
  file: string
  width: number
  role: 'HHL' | 'KSH' | 'SCX'
  lang: string
  theme: 'light' | 'dark'
  roleDefault: 'light' | 'dark'
  dataView: string
}> = [
  {
    file: 'kokpit__hhl__pl__1920__light.png',
    width: 1920,
    role: 'HHL',
    lang: 'PL',
    theme: 'light',
    roleDefault: 'dark',
    dataView: 'dash',
  },
  {
    file: 'kokpit__hhl__pl__1920__dark-default.png',
    width: 1920,
    role: 'HHL',
    lang: 'PL',
    theme: 'dark',
    roleDefault: 'dark',
    dataView: 'dash',
  },
  {
    file: 'mapa__hhl__pl__1920__light.png',
    width: 1920,
    role: 'HHL',
    lang: 'PL',
    theme: 'light',
    roleDefault: 'dark',
    dataView: 'map',
  },
  {
    file: 'mapa__hhl__pl__1920__dark-default.png',
    width: 1920,
    role: 'HHL',
    lang: 'PL',
    theme: 'dark',
    roleDefault: 'dark',
    dataView: 'map',
  },
]

async function gotoFrozen(page: Page, width: number) {
  await page.setViewportSize({ width, height: HEIGHT })
  await page.goto(FROZEN_URL, { waitUntil: 'networkidle', timeout: 120_000 })
  await page.evaluate((key) => {
    try {
      sessionStorage.setItem('wtNavCollapsed', '0')
      sessionStorage.removeItem('wt-persist-wipe-notice')
    } catch {
      /* ignore */
    }
    try {
      localStorage.removeItem(key)
      for (const k of Object.keys(localStorage)) {
        if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k)
      }
    } catch {
      /* ignore */
    }
  }, PERSIST_KEY)
  await page.reload({ waitUntil: 'networkidle', timeout: 120_000 })
  await page.evaluate(() => document.querySelector('.app')?.classList.remove('nav-collapsed'))
  await page.waitForSelector('.topbar, #roleSeg, .roleswitch', { timeout: 30_000 })
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready
  })
  await page.waitForTimeout(400)
}

async function setRole(page: Page, roleId: string) {
  await page.evaluate((id) => {
    const btn = document.querySelector(`#roleSeg button[data-role="${id}"]`)
    if (!btn) throw new Error('role btn not found: data-role=' + id)
    ;(btn as HTMLButtonElement).click()
  }, roleId)
  await page.waitForTimeout(500)
}

async function setLocale(_page: Page, label: string) {
  /* B-SMOKE-LANG: #langSeg usunięty (8322d02) — UI PL-only; smoke tylko PL */
  if (label.toUpperCase() !== 'PL') throw new Error('B-SMOKE-LANG: tylko PL, dostano ' + label)
}

async function setTheme(page: Page, theme: 'light' | 'dark', roleDefault: 'light' | 'dark') {
  const current = await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
  )
  if (current === theme) return
  if (current !== roleDefault) {
    await page.evaluate(() => (document.querySelector('#themeBtn') as HTMLButtonElement).click()) /* wyglad/P3 (E37): motyw w zamkniętym menu konta */
    await page.waitForTimeout(300)
  }
  const mid = await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
  )
  if (mid !== theme) {
    await page.evaluate(() => (document.querySelector('#themeBtn') as HTMLButtonElement).click()) /* wyglad/P3 (E37): motyw w zamkniętym menu konta */
    await page.waitForTimeout(300)
  }
  const final = await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
  )
  if (final !== theme) throw new Error(`theme want=${theme} got=${final}`)
}

async function navTo(page: Page, dataView: string) {
  await page.evaluate((key) => {
    const btn = document.querySelector(`nav button[data-view="${key}"]`)
    if (!btn) throw new Error('nav not found: data-view=' + key)
    ;(btn as HTMLButtonElement).click()
  }, dataView)
  await page.waitForTimeout(600)
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready
  })
  await page.waitForTimeout(200)
}

test.describe('C2.4 visual smoke (HHL pl 1920)', () => {
  test.describe.configure({ mode: 'serial' })

  for (const job of SMOKE) {
    test(job.file, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await gotoFrozen(page, job.width)
      await setRole(page, job.role)
      await setLocale(page, job.lang)
      await setTheme(page, job.theme, job.roleDefault)
      await navTo(page, job.dataView)

      /* F2.2 — same defaults as playwright.config.ts expect.toHaveScreenshot */
      await expect(page).toHaveScreenshot(job.file, {
        fullPage: true,
        maxDiffPixels: 60,
        threshold: 0.28,
        animations: 'disabled',
      })
    })
  }
})

/* BN9-c1 / decyzja 63b — Harmonogram › Rejsy › „Wczytaj rozkład Vikinga z pliku” (Administrator HHL).
   Demo: podgląd przykładowy (wymyślone rejsy, G-09), zapis nieaktywny z wyjaśnieniem. Migawka samego ekranu importu,
   komputer 1440 i telefon 390. Plik: wycinek struktury strony Viking Cargo z testów BN2 (bez danych osobowych). */
const VIKING_FIXTURE = 'tests/fixtures/viking-cargo-helsinki-tallinn-sample.html'
test.describe('BN9-c1 visual — import rozkładu Vikinga (HHL pl)', () => {
  test.describe.configure({ mode: 'serial' })

  for (const width of [1440, 390]) {
    const file = `rejsy-viking-import__hhl__pl__${width}__light.png`
    test(file, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await gotoFrozen(page, width)
      await setRole(page, 'HHL')
      await setTheme(page, 'light', 'dark')
      await page.evaluate((now) => { location.hash = `#/harmonogram?now=${encodeURIComponent(now)}` }, FROZEN_NOW)
      await page.locator('[data-sched-tab="sailings"]').click()
      await expect(page.locator('[data-sailings]')).toBeVisible()
      await page.locator('[data-sail-viking]').click()
      const panel = page.locator('[data-viking-import]')
      await expect(panel).toBeVisible()
      await expect(panel.locator('[data-vi-history] [data-vi-hist]')).toHaveCount(2)
      await panel.locator('[data-vi-file]').setInputFiles(VIKING_FIXTURE)
      await expect(panel.locator('[data-vi-file-ok]')).toBeVisible()
      await panel.locator('[data-vi-preview]').click()
      await expect(panel.locator('[data-vi-plan]')).toBeVisible()
      await expect(panel.locator('[data-vi-commit]')).toBeDisabled()
      await page.evaluate(async () => {
        if (document.fonts?.ready) await document.fonts.ready
      })
      await page.waitForTimeout(300)
      await expect(panel).toHaveScreenshot(file, {
        maxDiffPixels: 60,
        threshold: 0.28,
        animations: 'disabled',
      })
    })
  }
})
