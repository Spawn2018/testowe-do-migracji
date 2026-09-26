/**
 * D19-T — EN/SV UI must not contain Polish diacritics in chrome/copy.
 * Data cells (names, places, codes) use `data-content` and are excluded.
 *
 * Run: `npm run test:d19` (not in pre-push until D19 drives hits → 0).
 */
import { test, expect, type Page } from '@playwright/test'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { I18N_ALL } from '../src/i18n/messages'
import KNOWN from './fixtures/d19-dict-known.json' with { type: 'json' }

const FROZEN_NOW = '2026-09-23T14:32:00Z'
const FROZEN_URL = `/#/?now=${encodeURIComponent(FROZEN_NOW)}`
const PERSIST_KEY = 'watch-tower-ui-v6-ready-gate'
const HEIGHT = 1080
const PL_DIACRITICS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/

/** HHL views present in nav (stable data-view). */
const VIEWS = ['dash', 'map', 'sched', 'risk', 'docs', 'fin', 'inv', 'wf', 'geo', 'options'] as const

type Hit = { locale: string; view: string; text: string; path: string }

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPORT_PATH = join(__dirname, '../test-results/d19-hits.json')

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
  await page.evaluate(() => {
    const btn = document.querySelector('#roleSeg button[data-role="HHL"]') as HTMLButtonElement | null
    if (!btn) throw new Error('HHL role missing')
    btn.click()
  })
  await page.waitForTimeout(400)
}

async function setLocale(page: Page, lang: 'en' | 'sv') {
  await page.evaluate((code) => {
    const btn = document.querySelector(`#langSeg button[data-lang="${code}"]`) as HTMLButtonElement | null
    if (!btn) throw new Error('lang missing: ' + code)
    btn.click()
  }, lang)
  await page.waitForTimeout(350)
}

async function navTo(page: Page, dataView: string) {
  await page.evaluate((key) => {
    const btn = document.querySelector(`nav button[data-view="${key}"]`) as HTMLButtonElement | null
    if (!btn) throw new Error('nav missing: ' + key)
    btn.click()
  }, dataView)
  await page.waitForTimeout(500)
}

/** Collect visible text with PL diacritics, skipping [data-content] subtrees. */
async function collectHits(page: Page, locale: string, view: string): Promise<Hit[]> {
  return page.evaluate(
    ({ locale, view, reSource }) => {
      const re = new RegExp(reSource)
      const hits: Hit[] = []
      const root = document.querySelector('.app') ?? document.body
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      const seen = new Set<string>()
      let node: Node | null = walker.nextNode()
      while (node) {
        const text = (node.textContent || '').replace(/\s+/g, ' ').trim()
        if (text && re.test(text)) {
          const el = node.parentElement
          if (el && !el.closest('[data-content]')) {
            // skip non-visible
            const style = el.ownerDocument.defaultView?.getComputedStyle(el)
            if (style && style.visibility !== 'hidden' && style.display !== 'none') {
              const key = `${view}::${text}`
              if (!seen.has(key)) {
                seen.add(key)
                const path =
                  el.tagName.toLowerCase() +
                  (el.className && typeof el.className === 'string'
                    ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.')
                    : '')
                hits.push({ locale, view, text: text.slice(0, 160), path })
              }
            }
          }
        }
        node = walker.nextNode()
      }
      return hits
    },
    { locale, view, reSource: PL_DIACRITICS.source },
  )
}

test.describe('D19-T EN/SV no Polish diacritics in UI chrome', () => {
  test.describe.configure({ mode: 'serial' })

  test('EN + SV views: zero PL diacritics outside [data-content]', async ({ page }) => {
    test.setTimeout(300_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await gotoFrozen(page)
    await setRoleHhl(page)

    const all: Hit[] = []
    for (const locale of ['en', 'sv'] as const) {
      await setLocale(page, locale)
      for (const view of VIEWS) {
        await navTo(page, view)
        const hits = await collectHits(page, locale, view)
        all.push(...hits)
      }
    }

    const byLocale = {
      en: all.filter((h) => h.locale === 'en').length,
      sv: all.filter((h) => h.locale === 'sv').length,
    }
    mkdirSync(join(__dirname, '../test-results'), { recursive: true })
    writeFileSync(
      REPORT_PATH,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          total: all.length,
          byLocale,
          sample: all.slice(0, 80),
        },
        null,
        2,
      ),
    )
    console.log(`D19-T counter: total=${all.length} en=${byLocale.en} sv=${byLocale.sv} report=${REPORT_PATH}`)

    // Hard gate for D19: expect 0. Until then run via npm run test:d19 (not pre-push).
    expect(all.length, `D19-T fail: ${byLocale.en} EN + ${byLocale.sv} SV diacritic hits in UI. See ${REPORT_PATH}`).toBe(0)
  })
})

/**
 * D19-T (odp. właściciela §5) — napisy na sztywno niezależnie od polskich liter:
 * w EN i SV żaden tekst (także w [data-content]) nie może być równy wartości ze słownika PL,
 * chyba że ta sama wartość jest w słowniku EN/SV (kody, nazwy własne). Wszystkie role, wszystkie widoki.
 */
function forbiddenFor(locale: 'en' | 'sv'): Set<string> {
  const pl = I18N_ALL.pl, loc = I18N_ALL[locale]
  const allowed = new Set(Object.values(loc).map((v) => v.trim()))
  const out = new Set<string>()
  for (const [k, v] of Object.entries(pl)) {
    const val = v.trim()
    if (val.length < 3 || /\{[a-z_]+\}/i.test(val) || !/[a-ząćęłńóśźż]{3}/i.test(val)) continue
    if (loc[k]?.trim() === val || allowed.has(val)) continue
    out.add(val)
  }
  return out
}

test.describe('D19-T słownik: EN/SV bez wartości PL', () => {
  test('wszystkie role i widoki: zero tekstów równych wartości PL', async ({ page }) => {
    test.setTimeout(600_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await gotoFrozen(page)
    const hits: { locale: string; role: string; view: string; text: string }[] = []
    for (const role of ['HHL', 'KSH', 'SCX'] as const) {
      await page.evaluate((r) => (document.querySelector(`#roleSeg button[data-role="${r}"]`) as HTMLButtonElement | null)?.click(), role)
      await page.waitForTimeout(400)
      for (const locale of ['en', 'sv'] as const) {
        await setLocale(page, locale)
        const forbidden = [...forbiddenFor(locale)]
        const views = await page.evaluate(() => [...document.querySelectorAll('nav button[data-view]')].map((b) => (b as HTMLElement).dataset.view!))
        for (const view of views) {
          await navTo(page, view)
          const found = await page.evaluate((list) => {
            const set = new Set(list)
            const res = new Set<string>()
            const walker = document.createTreeWalker(document.querySelector('.app') ?? document.body, NodeFilter.SHOW_TEXT)
            for (let n = walker.nextNode(); n; n = walker.nextNode()) {
              const text = (n.textContent || '').replace(/\s+/g, ' ').trim()
              const el = n.parentElement
              if (!text || !el || !set.has(text)) continue
              const st = getComputedStyle(el)
              if (st.display === 'none' || st.visibility === 'hidden') continue
              res.add(text)
            }
            return [...res]
          }, forbidden)
          for (const text of found) hits.push({ locale, role, view, text: text.slice(0, 160) })
        }
      }
    }
    mkdirSync(join(__dirname, '../test-results'), { recursive: true })
    writeFileSync(join(__dirname, '../test-results/d19-dict-hits.json'), JSON.stringify({ total: hits.length, hits }, null, 2))
    const key = (h: { locale: string; role: string; view: string; text: string }) => `${h.locale}|${h.role}|${h.view}|${h.text}`
    const known = new Set((KNOWN.hits as { locale: string; role: string; view: string; text: string }[]).map(key))
    const fresh = hits.filter((h) => !known.has(key(h)))
    console.log(`D19-T słownik: trafień=${hits.length} (znane poza banerem: ${hits.length - fresh.length}, nowe: ${fresh.length})`)
    expect(fresh, `D19-T słownik: ${fresh.length} nowych tekstów PL w EN/SV — test-results/d19-dict-hits.json`).toEqual([])
  })
})
