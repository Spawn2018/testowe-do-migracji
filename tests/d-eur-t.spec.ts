/**
 * D-EUR-T — display currency modes (ZLECENIE_FINAL).
 *
 * Two modes (user preference):
 *   EUR: zero PLN, zł, SEK, kr, kronor, złotych in UI chrome
 *   PLN: zero SEK, kr
 *
 * Exceptions (data-deur-exempt): fuel index data, FX/table on invoice,
 * invoice amounts in invoice currency, policy sum.
 *
 * Run: `npm run test:deur` (also in pre-push).
 */
import { test, expect, type Page } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { DEMO_FX } from '../src/lib/money/demoFx'

const FROZEN_NOW = '2026-09-23T14:32:00Z'
const FROZEN_URL = `/#/?now=${encodeURIComponent(FROZEN_NOW)}`
const PERSIST_KEY = 'watch-tower-ui-v6-ready-gate'
const HEIGHT = 1080

const VIEWS = ['dash', 'map', 'sched', 'risk', 'docs', 'fin', 'inv', 'wf', 'geo', 'options'] as const

/** EUR mode — banned tokens (word-ish). */
const EUR_BANNED =
  /\bPLN\b|\bzł\b|\bSEK\b|\bkr\b|\bkronor\b|\bzłotych\b|\bzlotych\b/i
/** PLN mode — banned tokens (M4: po przełączeniu na PLN żadna kwota nie zostaje w EUR). */
const PLN_BANNED = /\bSEK\b|\bkr\b|\bkronor\b|\bEUR\b|€/i

/** M4 — widoki KSH i SCX (waluta ustawiana w „Ustawienia”). */
const ROLE_VIEWS = {
  KSH: ['dash', 'map', 'sched', 'risk', 'docs', 'fin', 'inv', 'settings'],
  SCX: ['dash', 'map', 'sched', 'risk', 'docs', 'fin', 'inv', 'tasks', 'settings'],
} as const

type Hit = { mode: string; view: string; text: string; path: string }

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPORT_PATH = join(__dirname, '../test-results/d-eur-hits.json')

async function gotoFrozen(page: Page) {
  await page.setViewportSize({ width: 1440, height: HEIGHT })
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
  await page.waitForSelector('.topbar, #roleSeg', { timeout: 30_000 })
  await page.waitForTimeout(300)
}

async function setRoleHhl(page: Page) {
  await setRole(page, 'HHL')
}

async function setRole(page: Page, role: 'HHL' | 'KSH' | 'SCX') {
  await page.evaluate((r) => {
    const btn = document.querySelector(`#roleSeg button[data-role="${r}"]`) as HTMLButtonElement | null
    if (!btn) throw new Error(r + ' role missing')
    btn.click()
  }, role)
  await page.waitForTimeout(400)
}

async function setLocalePl(_page: Page) {
  /* B-SMOKE-LANG: #langSeg usunięty — PL jest domyślny, nic nie klikamy */
}

async function navTo(page: Page, dataView: string) {
  await page.evaluate((key) => {
    const btn = document.querySelector(`nav button[data-view="${key}"]`) as HTMLButtonElement | null
    if (!btn) throw new Error('nav missing: ' + key)
    btn.click()
  }, dataView)
  await page.waitForTimeout(500)
}

/** Set display currency via Options preference (HHL). */
async function setDisplayCurrency(page: Page, currency: 'EUR' | 'PLN', prefsView = 'options') {
  await navTo(page, prefsView)
  await page.evaluate((cur) => {
    const select = document.querySelector(
      '[data-deur-exempt="currency-pref"] select, dd[data-deur-exempt="currency-pref"] select',
    ) as HTMLSelectElement | null
    if (!select) {
      // fallback: find by nearby dt text
      const dts = Array.from(document.querySelectorAll('dt'))
      const dt = dts.find((d) => /waluta|currency|valuta/i.test(d.textContent || ''))
      const s = dt?.nextElementSibling?.querySelector('select') as HTMLSelectElement | null
      if (!s) throw new Error('currency select missing')
      s.value = cur
      s.dispatchEvent(new Event('change', { bubbles: true }))
      return
    }
    select.value = cur
    select.dispatchEvent(new Event('change', { bubbles: true }))
  }, currency)
  await page.waitForTimeout(400)
  const got = await page.evaluate(() => {
    const select = document.querySelector(
      '[data-deur-exempt="currency-pref"] select',
    ) as HTMLSelectElement | null
    return select?.value ?? null
  })
  expect(got).toBe(currency)
}

async function collectHits(
  page: Page,
  mode: string,
  view: string,
  reSource: string,
): Promise<Hit[]> {
  return page.evaluate(
    ({ mode, view, reSource }) => {
      const re = new RegExp(reSource, 'i')
      const hits: Hit[] = []
      const root = document.querySelector('.app') ?? document.body
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      const seen = new Set<string>()
      let node: Node | null = walker.nextNode()
      while (node) {
        const text = (node.textContent || '').replace(/\s+/g, ' ').trim()
        if (text && re.test(text)) {
          const el = node.parentElement
          if (el && !el.closest('[data-deur-exempt]') && !el.closest('[data-content]')) {
            const style = el.ownerDocument.defaultView?.getComputedStyle(el)
            /* B-SMOKE-DRIFT: treść zwiniętych sekcji <details> (Opcje DEC-6) nie jest widoczna — checkVisibility */
            const visible = typeof el.checkVisibility === 'function' ? el.checkVisibility() : true
            if (visible && style && style.visibility !== 'hidden' && style.display !== 'none') {
              const key = `${view}::${text}`
              if (!seen.has(key)) {
                seen.add(key)
                const path =
                  el.tagName.toLowerCase() +
                  (el.className && typeof el.className === 'string'
                    ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
                    : '')
                hits.push({ mode, view, text: text.slice(0, 160), path })
              }
            }
          }
        }
        node = walker.nextNode()
      }
      return hits
    },
    { mode, view, reSource },
  )
}

async function assertMoneyCode(page: Page, code: 'EUR' | 'PLN') {
  await navTo(page, 'sched')
  const sample = await page.evaluate((want) => {
    const cells = Array.from(document.querySelectorAll('.money, .num.money, [class*="money"]'))
    const texts = cells.map((c) => (c.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
    const withCode = texts.filter((t) => new RegExp(`\\b${want}\\b`).test(t))
    return { total: texts.length, withCode: withCode.length, sample: withCode[0] ?? texts[0] ?? '' }
  }, code)
  expect(sample.total, `expected money cells on schedule (${code})`).toBeGreaterThan(0)
  expect(sample.withCode, `expected ${code} in money cells, sample=${sample.sample}`).toBeGreaterThan(0)
}

test.describe('D-EUR-T display currency EUR vs PLN', () => {
  test.describe.configure({ mode: 'serial' })

  test('EUR + PLN modes: banned tokens zero outside exemptions; money code matches', async ({
    page,
  }) => {
    test.setTimeout(360_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await gotoFrozen(page)
    await setRoleHhl(page)
    await setLocalePl(page)

    // Sanity: P6 fixture mid used by app display FX
    expect(DEMO_FX.mid).toBe(4.39)
    expect(DEMO_FX.no).toBe('186/A/NBP/2026')

    const all: Hit[] = []

    for (const mode of ['EUR', 'PLN'] as const) {
      await setDisplayCurrency(page, mode)
      await assertMoneyCode(page, mode)

      const banned = mode === 'EUR' ? EUR_BANNED : PLN_BANNED
      for (const view of VIEWS) {
        await navTo(page, view)
        const hits = await collectHits(page, mode, view, banned.source)
        all.push(...hits)
      }
    }

    // Options FX note should mention demo mid (Polish decimal comma)
    await navTo(page, 'options')
    /* B-SMOKE-DRIFT: Opcje w akordeonie DEC-6 (5685099) — nota FX w sekcji „Cennik” (data-fx-note), bez .pricing-panel */
    const note = await page.locator('[data-section="rates"] [data-fx-note="demo"]').first().textContent()
    expect(note || '').toMatch(/4[,.]3900/)
    expect(note || '').toMatch(/186\/A\/NBP\/2026/)

    const byMode = {
      EUR: all.filter((h) => h.mode === 'EUR').length,
      PLN: all.filter((h) => h.mode === 'PLN').length,
    }
    mkdirSync(join(__dirname, '../test-results'), { recursive: true })
    writeFileSync(
      REPORT_PATH,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          demoFx: { no: DEMO_FX.no, mid: DEMO_FX.mid, effectiveDate: DEMO_FX.effectiveDate },
          total: all.length,
          byMode,
          sample: all.slice(0, 80),
        },
        null,
        2,
      ),
    )
    // eslint-disable-next-line no-console
    console.log(`D-EUR-T counter: total=${all.length} EUR=${byMode.EUR} PLN=${byMode.PLN} report=${REPORT_PATH}`)

    expect(byMode.EUR, `EUR mode hits: ${JSON.stringify(all.filter((h) => h.mode === 'EUR').slice(0, 20))}`).toBe(0)
    expect(byMode.PLN, `PLN mode hits: ${JSON.stringify(all.filter((h) => h.mode === 'PLN').slice(0, 20))}`).toBe(0)
  })

  test('M4: KSH i SCX — waluta z „Ustawienia”, EUR i PLN we wszystkich widokach roli', async ({ page }) => {
    test.setTimeout(360_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await gotoFrozen(page)
    await setLocalePl(page)
    const all: Hit[] = []
    for (const role of ['KSH', 'SCX'] as const) {
      await setRole(page, role)
      for (const mode of ['EUR', 'PLN'] as const) {
        await setDisplayCurrency(page, mode, 'settings')
        await assertMoneyCode(page, mode)
        const banned = mode === 'EUR' ? EUR_BANNED : PLN_BANNED
        for (const view of ROLE_VIEWS[role]) {
          await navTo(page, view)
          all.push(...(await collectHits(page, `${role}:${mode}`, view, banned.source)))
        }
      }
    }
    mkdirSync(join(__dirname, '../test-results'), { recursive: true })
    writeFileSync(join(__dirname, '../test-results/d-eur-hits-roles.json'), JSON.stringify({ total: all.length, sample: all.slice(0, 80) }, null, 2))
    // eslint-disable-next-line no-console
    console.log(`D-EUR-T roles counter: total=${all.length}`)
    expect(all.length, JSON.stringify(all.slice(0, 20))).toBe(0)
  })
})
