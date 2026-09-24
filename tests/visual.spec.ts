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

async function setLocale(page: Page, label: string) {
  await page.evaluate((lab) => {
    const code = lab.toLowerCase()
    let btn = document.querySelector(`#langSeg button[data-lang="${code}"]`)
    if (!btn) {
      btn = [...document.querySelectorAll('#langSeg button')].find(
        (b) => (b.textContent || '').trim().toUpperCase() === lab,
      )
    }
    if (!btn) throw new Error('lang btn not found: ' + lab)
    ;(btn as HTMLButtonElement).click()
  }, label)
  await page.waitForTimeout(300)
}

async function setTheme(page: Page, theme: 'light' | 'dark', roleDefault: 'light' | 'dark') {
  const current = await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
  )
  if (current === theme) return
  if (current !== roleDefault) {
    await page.click('#themeBtn')
    await page.waitForTimeout(300)
  }
  const mid = await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
  )
  if (mid !== theme) {
    await page.click('#themeBtn')
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
