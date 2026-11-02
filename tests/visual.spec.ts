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
      /* cały ekran importu w kadrze: wyższe okno (aplikacja przewija wnętrze, nie stronę) */
      await page.setViewportSize({ width, height: width < 769 ? 3400 : 2200 })
      await page.waitForTimeout(300)
      await panel.scrollIntoViewIfNeeded()
      await expect(panel).toHaveScreenshot(file, {
        /* dolny pasek telefonu (E8) przykrywa treść — poza migawką ekranu */
        style: 'nav{visibility:hidden !important}',
        maxDiffPixels: 60,
        threshold: 0.28,
        animations: 'disabled',
      })
    })
  }
})

/* BN9-c2 (#573) — karta transportu na promie: pasek śledzenia „Na promie · statek · trasa” z pozycją statku
   zamiast milczącego lokalizatora naczepy. Demo (SG-03, Nova Star): pozycje przykładowe nie są pozycją statku,
   więc pasek mówi „brak pozycji statku”. Migawka samego paska, komputer 1440 i telefon 390. */
test.describe('BN9-c2 visual — pasek śledzenia na promie (HHL pl)', () => {
  test.describe.configure({ mode: 'serial' })

  for (const width of [1440, 390]) {
    const file = `pasek-na-promie__hhl__pl__${width}__light.png`
    test(file, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await gotoFrozen(page, width)
      await setRole(page, 'HHL')
      await setTheme(page, 'light', 'dark')
      await navTo(page, 'sched')
      await page.evaluate(() => {
        const el = [...document.querySelectorAll('[data-load]')].find((r) => /\bSG-03\b/.test(r.textContent ?? '')) as HTMLElement | undefined
        if (!el) throw new Error('brak wiersza SG-03')
        el.click()
      })
      const bar = page.locator('.drawer [data-tracking-bar]')
      await expect(bar).toHaveAttribute('data-trk-ferry', 'none')
      await expect(bar).toContainText('Na promie')
      await page.evaluate(async () => {
        if (document.fonts?.ready) await document.fonts.ready
      })
      await page.waitForTimeout(300)
      await expect(bar).toHaveScreenshot(file, {
        maxDiffPixels: 60,
        threshold: 0.28,
        animations: 'disabled',
      })
    })
  }
})

/* BN9-c3 (#573 „Ekrany po BN5”) — Ryzyka › Sytuacja na trasie › „Pogoda na przeprawach”: pięć przepraw (Polska – Szwecja
   i trzy bałtyckie), najpierw ryzyko wyższe; atrybucja, dopisek NAVTEX, link do mapy lodowej FMI. Demo: wartości przykładowe
   (G-09). Migawka samej sekcji, komputer 1440 i telefon 390 (zakładka „Na trasie”). */
test.describe('BN9-c3 visual — pogoda na przeprawach (HHL pl)', () => {
  test.describe.configure({ mode: 'serial' })

  for (const width of [1440, 390]) {
    const file = `pogoda-przeprawy__hhl__pl__${width}__light.png`
    test(file, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await gotoFrozen(page, width)
      await setRole(page, 'HHL')
      await setTheme(page, 'light', 'dark')
      await navTo(page, 'risk')
      if (width < 769) await page.locator('[data-rk-tab="route"]').click()
      const sec = page.locator('[data-panel="marine"]')
      await expect(sec).toBeVisible()
      await expect(sec.locator('[data-marine-row]')).toHaveCount(5)
      await expect(sec.locator('a[data-ice-chart]')).toHaveAttribute('rel', 'noopener noreferrer')
      /* telefon: bez poziomego przewijania strony */
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(0)
      await page.evaluate(async () => {
        if (document.fonts?.ready) await document.fonts.ready
      })
      /* dolny pasek telefonu (E8) przykrywa treść — poza migawką sekcji; wyższe okno, cała sekcja w kadrze */
      await page.addStyleTag({ content: 'nav.tower-nav{display:none !important}' })
      await page.setViewportSize({ width, height: width < 769 ? 3400 : 2200 })
      await sec.scrollIntoViewIfNeeded()
      await page.waitForTimeout(300)
      await expect(sec).toHaveScreenshot(file, {
        maxDiffPixels: 60,
        threshold: 0.28,
        animations: 'disabled',
      })
    })
  }
})

/* BN9-c3 (przegląd #723 pkt 3) — Ryzyka u KSH na komputerze: „Pogoda na przeprawach” na pełną szerokość pod promami
   i drogami; „Drogi PL” i „Drogi SE” zostają w prawej kolumnie obok promów. Demo, migawka strony Ryzyk (1440). */
test.describe('BN9-c3 visual — Ryzyka KSH (pl 1440)', () => {
  test.describe.configure({ mode: 'serial' })

  const file = 'ryzyka__ksh__pl__1440__light.png'
  test(file, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await gotoFrozen(page, 1440)
    await setRole(page, 'KSH')
    await setTheme(page, 'light', 'light')
    await navTo(page, 'risk')
    const pg = page.locator('[data-page="risks"]')
    await expect(pg.locator('[data-panel="marine"] [data-marine-row]')).toHaveCount(5)
    await expect(pg.locator('[data-panel="road-se"]')).toBeVisible()
    await page.setViewportSize({ width: 1440, height: 2200 })
    await page.evaluate(async () => {
      if (document.fonts?.ready) await document.fonts.ready
    })
    await page.waitForTimeout(300)
    await expect(pg).toHaveScreenshot(file, {
      maxDiffPixels: 60,
      threshold: 0.28,
      animations: 'disabled',
    })
  })
})

/* BN9-c4 (#573 „Ekrany po BN6”) — Ryzyka › Drogi: „Drogi LT”, „Drogi LV”, „Drogi EE”, „Drogi FI” pod „Drogi PL” i „Drogi SE”.
   Demo: przykładowa trasa transportu Tallinn – Helsinki, zdarzenia wymyślone (G-09), limit masy wyróżniony, Estonia bez
   zdarzeń („Brak utrudnień na korytarzu”); sekcje rozwinięte kliknięciem (domyślnie zwinięte z licznikiem). Migawka obszaru czterech sekcji, komputer 1440 i telefon 390 (zakładka „Na trasie”). */
test.describe('BN9-c4 visual — drogi LT/LV/EE/FI (HHL pl)', () => {
  test.describe.configure({ mode: 'serial' })

  for (const width of [1440, 390]) {
    const file = `drogi-baltyckie__hhl__pl__${width}__light.png`
    test(file, async ({ page }) => {
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await gotoFrozen(page, width)
      await setRole(page, 'HHL')
      await setTheme(page, 'light', 'dark')
      await navTo(page, 'risk')
      if (width < 769) await page.locator('[data-rk-tab="route"]').click()
      const secs = page.locator('[data-baltic]')
      await expect(secs).toHaveCount(4)
      /* sekcje zwinięte domyślnie (licznik) — rozwinięte do migawki */
      for (const t of await page.locator('[data-baltic-toggle]').all()) await t.click()
      await expect(page.locator('[data-panel="road-fi"] [data-limit="WEIGHT"]')).toHaveCount(1)
      await expect(page.locator('[data-empty="road-ee"]')).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(0)
      await page.evaluate(async () => {
        if (document.fonts?.ready) await document.fonts.ready
      })
      await page.addStyleTag({ content: 'nav.tower-nav{display:none !important}' })
      await page.setViewportSize({ width, height: width < 769 ? 4200 : 2600 })
      await page.evaluate(() => window.scrollTo(0, 0))
      await page.waitForTimeout(300)
      /* obszar od „Drogi LT” do „Drogi FI” (sekcje stoją jedna pod drugą) */
      const clip = await page.evaluate(() => {
        const els = [...document.querySelectorAll('[data-baltic]')].map((e) => e.getBoundingClientRect())
        const x = Math.min(...els.map((r) => r.left))
        const y = Math.min(...els.map((r) => r.top)) + window.scrollY
        const w = Math.max(...els.map((r) => r.right)) - x
        const h = Math.max(...els.map((r) => r.bottom)) + window.scrollY - y
        return { x: Math.floor(x), y: Math.floor(y), width: Math.ceil(w), height: Math.ceil(h) }
      })
      await expect(page).toHaveScreenshot(file, {
        clip,
        fullPage: true,
        maxDiffPixels: 60,
        threshold: 0.28,
        animations: 'disabled',
      })
    })
  }
})
