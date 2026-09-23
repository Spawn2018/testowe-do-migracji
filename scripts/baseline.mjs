/**
 * Etap C2.2 — visual baseline shot generator (tooling only).
 *
 * Filename: widok__rola__jezyk__szerokosc__motyw.png
 *   motyw = light | dark | light-default | dark-default
 *   (acceptance #12: HHL+SCX default dark, KSH default light)
 *
 * HashRouter reality: only `/driver/:token` and `/*` exist. In-app screens are
 * Zustand `view` NavKeys under TowerShell — navigate via role/lang/theme controls
 * + nav buttons (same pattern as wt-full-shots.mjs / qa-reship-frozen.mjs).
 * Do not invent paths like `#/finanse`.
 *
 * Clock freeze (C2.1): hash query `now` (default 2026-09-23T14:32:00Z)
 *   → http://host/#/?now=2026-09-23T14:32:00Z
 *
 * Usage:
 *   node scripts/baseline.mjs
 *   BASE_URL=http://127.0.0.1:4177/ node scripts/baseline.mjs
 *   DRY_RUN=1 node scripts/baseline.mjs     # list planned files, no browser
 *   ONLY=1 node scripts/baseline.mjs        # one smoke shot
 *   OUT=shots-baseline FROZEN_NOW=2026-09-23T14:32:00Z node scripts/baseline.mjs
 *
 * Do NOT run the full matrix here (C2.3 later). Prefer DRY_RUN or ONLY=1.
 */
import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const chrome = existsSync('/usr/bin/google-chrome-stable')
  ? '/usr/bin/google-chrome-stable'
  : existsSync('/usr/bin/google-chrome')
    ? '/usr/bin/google-chrome'
    : '/usr/bin/chromium'

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:4177/').replace(/\/?$/, '/')
const OUT = join(ROOT, process.env.OUT || 'shots-baseline')
const FROZEN_NOW = process.env.FROZEN_NOW || '2026-09-23T14:32:00Z'
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'
const ONLY = process.env.ONLY === '1' || process.env.ONLY === 'true'
const HEIGHT = Number(process.env.HEIGHT || 1080)
const PERSIST_KEY = 'watch-tower-ui-v6-ready-gate'

mkdirSync(OUT, { recursive: true })

/**
 * Requested Polish names → real NavKey (store view).
 * SKIPPED: none — all 13 map to NavKeys. Finanse / Moje stawki / Rozliczenia
 * share NavKey `fin` (role-specific nav label). No per-view HashRouter routes.
 */
const VIEWS = [
  { name: 'Kokpit', file: 'kokpit', labelRe: 'Kokpit|Dashboard|Översikt' },
  { name: 'Mapa', file: 'mapa', labelRe: 'Mapa|Map|Karta' },
  { name: 'Harmonogram', file: 'harmonogram', labelRe: 'Harmonogram|Schedule|Schema' },
  { name: 'Ryzyka', file: 'ryzyka', labelRe: 'Ryzyka|Risks|Risker' },
  { name: 'Dokumenty', file: 'dokumenty', labelRe: 'Dokumenty|Documents|Dokument' },
  { name: 'Finanse', file: 'finanse', labelRe: 'Finanse|Finance|Ekonomi', roles: ['HHL'] },
  { name: 'Faktury', file: 'faktury', labelRe: 'Faktury|Invoices|Fakturor', roles: ['HHL', 'SCX'] },
  { name: 'Automatyzacje', file: 'automatyzacje', labelRe: 'Automatyzacje|Workflows|Automatiseringar', roles: ['HHL'] },
  { name: 'Strefy', file: 'strefy', labelRe: 'Strefy|Geofences|Zoner|Strefy geograficzne', roles: ['HHL'] },
  { name: 'Opcje', file: 'opcje', labelRe: 'Opcje|Options|Alternativ', roles: ['HHL'] },
  { name: 'Moje zadania', file: 'moje-zadania', labelRe: 'Moje zadania|Tasks|Uppgifter', roles: ['SCX'] },
  { name: 'Moje stawki', file: 'moje-stawki', labelRe: 'Moje stawki|My rates|Mina priser', roles: ['SCX'] },
  { name: 'Rozliczenia', file: 'rozliczenia', labelRe: 'Rozliczenia|Charges|Kostnader', roles: ['KSH'] },
]

const ROLES = [
  // Topbar buttons render ROLE_META[r].name
  { id: 'HHL', re: 'H&H|HHL', defaultTheme: 'dark' },
  { id: 'KSH', re: '^KSH$', defaultTheme: 'light' },
  { id: 'SCX', re: 'Scandinavian|SCX', defaultTheme: 'dark' },
]

const LANGS = [
  { id: 'pl', label: 'PL' },
  { id: 'en', label: 'EN' },
  { id: 'sv', label: 'SV' },
]

const WIDTHS = [1920, 1440, 1280, 768, 390]
const THEMES = ['light', 'dark']

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** HashRouter freeze: query lives in the hash (`#/?now=...`). */
function frozenUrl() {
  return `${BASE}#/?now=${encodeURIComponent(FROZEN_NOW)}`
}

function themeFilePart(theme, roleDefault) {
  return theme === roleDefault ? `${theme}-default` : theme
}

function shotName(viewFile, roleId, langId, width, theme, roleDefault) {
  return `${viewFile}__${roleId.toLowerCase()}__${langId}__${width}__${themeFilePart(theme, roleDefault)}.png`
}

function* plan() {
  for (const view of VIEWS) {
    for (const role of ROLES) {
      if (view.roles && !view.roles.includes(role.id)) continue
      for (const lang of LANGS) {
        for (const width of WIDTHS) {
          for (const theme of THEMES) {
            yield {
              view,
              role,
              lang,
              width,
              theme,
              file: shotName(view.file, role.id, lang.id, width, theme, role.defaultTheme),
            }
          }
        }
      }
    }
  }
}

const planned = [...plan()]
console.log(`baseline: ${planned.length} shots planned → ${OUT}`)
console.log(`freeze URL: ${frozenUrl()}`)
console.log(`DRY_RUN=${DRY_RUN} ONLY=${ONLY}`)

if (DRY_RUN) {
  const sample = ONLY ? planned.slice(0, 1) : planned
  writeFileSync(join(OUT, '_plan.txt'), sample.map((p) => p.file).join('\n') + '\n')
  console.log(sample.slice(0, 25).map((p) => p.file).join('\n'))
  if (sample.length > 25) console.log(`… +${sample.length - 25} more (see _plan.txt)`)
  process.exit(0)
}

const jobs = ONLY ? planned.slice(0, 1) : planned

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', `--window-size=1920,${HEIGHT}`],
})

const page = await browser.newPage()
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])

async function gotoFrozen(width) {
  await page.setViewport({ width, height: HEIGHT, deviceScaleFactor: 1 })
  await page.goto(frozenUrl(), { waitUntil: 'networkidle0', timeout: 120_000 })
  await page.evaluate((key) => {
    try {
      sessionStorage.setItem('wtNavCollapsed', '0')
    } catch {}
    try {
      localStorage.removeItem(key)
      for (const k of Object.keys(localStorage)) {
        if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k)
      }
    } catch {}
  }, PERSIST_KEY)
  await page.reload({ waitUntil: 'networkidle0', timeout: 120_000 })
  await page.evaluate(() => document.querySelector('.app')?.classList.remove('nav-collapsed'))
  await page.waitForSelector('.topbar, #roleSeg, .roleswitch', { timeout: 30_000 })
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready
  })
  await sleep(400)
}

async function setRole(nameRe) {
  await page.evaluate((re) => {
    const rx = new RegExp(re)
    const btn = [...document.querySelectorAll('#roleSeg button, .roleswitch .seg button, .roleswitch button')].find(
      (b) => rx.test(b.textContent || ''),
    )
    if (!btn) throw new Error('role btn not found: ' + re)
    btn.click()
  }, nameRe)
  await sleep(500)
}

async function setLocale(label) {
  await page.evaluate((lab) => {
    const btn = [...document.querySelectorAll('#langSeg button')].find(
      (b) => (b.textContent || '').trim().toUpperCase() === lab,
    )
    if (!btn) throw new Error('lang btn not found: ' + lab)
    btn.click()
  }, label)
  await sleep(300)
}

/** After setRole (applies role default), toggle #themeBtn once if non-default wanted. */
async function setTheme(theme, roleDefault) {
  const current = await page.evaluate(() => {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
  })
  // Role switch resets to roleDefault when themeManual is false (fresh storage).
  // After first toggle, themeManual sticks — so prefer: ensure we start from default,
  // then toggle only when needed.
  if (current === theme) return
  // If we're not on roleDefault, toggle back first (themeManual path after prior job).
  if (current !== roleDefault) {
    await page.click('#themeBtn')
    await sleep(300)
  }
  const mid = await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
  )
  if (mid !== theme) {
    await page.click('#themeBtn')
    await sleep(300)
  }
  const final = await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
  )
  if (final !== theme) throw new Error(`theme want=${theme} got=${final}`)
}

async function navTo(labelRe) {
  await page.evaluate((re) => {
    const rx = new RegExp(re, 'i')
    const btn = [...document.querySelectorAll('nav button')].find((b) =>
      rx.test(b.getAttribute('aria-label') || b.textContent || ''),
    )
    if (!btn) throw new Error('nav not found: ' + re)
    btn.click()
  }, labelRe)
  await sleep(600)
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready
  })
  await sleep(200)
}

async function shoot(file) {
  const path = join(OUT, file)
  await page.screenshot({ path, type: 'png', fullPage: false })
  return path
}

let ok = 0
let fail = 0
const errors = []

let lastWidth = null
for (const job of jobs) {
  try {
    if (job.width !== lastWidth) {
      await gotoFrozen(job.width)
      lastWidth = job.width
    } else if (!page.url().includes('now=')) {
      await gotoFrozen(job.width)
      lastWidth = job.width
    }
    await setRole(job.role.re)
    await setLocale(job.lang.label)
    await setTheme(job.theme, job.role.defaultTheme)
    await navTo(job.view.labelRe)
    await shoot(job.file)
    ok++
    console.log('OK', job.file)
  } catch (e) {
    fail++
    const msg = `${job.file}: ${e?.message || e}`
    errors.push(msg)
    console.error('FAIL', msg)
    try {
      await gotoFrozen(job.width)
      lastWidth = job.width
    } catch {
      lastWidth = null
    }
  }
}

await browser.close()

writeFileSync(
  join(OUT, '_summary.json'),
  JSON.stringify({ ok, fail, total: jobs.length, frozenNow: FROZEN_NOW, url: frozenUrl(), errors }, null, 2),
)
console.log(`baseline done: ok=${ok} fail=${fail} / ${jobs.length}`)
if (fail) process.exitCode = 1
