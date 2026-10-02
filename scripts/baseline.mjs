/**
 * Etap C2.2 — visual baseline shot generator (tooling only).
 *
 * Filename: widok__rola__jezyk__szerokosc__motyw.png
 *   motyw = light | dark | light-default | dark-default
 *   (acceptance #12: HHL+SCX default dark, KSH default light)
 *
 * HashRouter reality: only `/driver/:token` and `/*` exist. In-app screens are
 * Zustand `view` NavKeys under TowerShell — navigate via data-role / data-view
 * (stable; no translated labels).
 *
 * Clock freeze (C2.1): hash query `now` (default 2026-09-23T14:32:00Z)
 *   → http://host/#/?now=2026-09-23T14:32:00Z
 *
 * Usage:
 *   node scripts/baseline.mjs
 *   BASE_URL=http://127.0.0.1:4177/ node scripts/baseline.mjs
 *   DRY_RUN=1 node scripts/baseline.mjs     # list planned files, no browser
 *   ONLY=1 node scripts/baseline.mjs        # one smoke shot
 *   FILTER=kokpit__ksh__en node scripts/baseline.mjs  # filename substring
 *   OUT=shots-baseline FROZEN_NOW=2026-09-23T14:32:00Z node scripts/baseline.mjs
 *
 * Do NOT run the full matrix here (C2.3 later). Prefer DRY_RUN, ONLY=1, or FILTER.
 *
 * Seed contract (D22 / visual safety):
 *   gotoFrozen CLEARS persist keys (watch-tower-ui-v6-ready-gate + /watch|tower|wt/i)
 *   then reloads → app boots from in-code seed defaults (data/seed.ts), NOT leftover
 *   localStorage from a prior run. A store migration wipe therefore cannot empty the
 *   840-shot matrix (G4; 720 do Fali 3A): baseline never depends on migrated user state.
 */
import puppeteer from 'puppeteer-core'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, writeFileSync, readdirSync, readFileSync, statSync } from 'fs'
import { join, dirname, relative } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

/** Bump when nav/role selectors or matrix semantics change. */
const SCRIPT_VERSION = '2026-09-26-g4-fala3b-views'

const chromeCandidates = [
  process.env.CHROME_PATH,
  '/usr/bin/google-chrome-stable',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA
    ? join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe')
    : '',
].filter(Boolean)
const chrome = chromeCandidates.find((p) => existsSync(p))
if (!chrome) {
  console.error('baseline: brak Chrome (ustaw CHROME_PATH). Szukano:', chromeCandidates.join(' | '))
  process.exit(1)
}

const BASE = (process.env.BASE_URL || 'http://127.0.0.1:4177/').replace(/\/?$/, '/')
const OUT = join(ROOT, process.env.OUT || 'shots-baseline')
const FROZEN_NOW = process.env.FROZEN_NOW || '2026-09-23T14:32:00Z'
const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'
const ONLY = process.env.ONLY === '1' || process.env.ONLY === 'true'
const FILTER = (process.env.FILTER || '').trim()
const HEIGHT = Number(process.env.HEIGHT || 1080)
const PERSIST_KEY = 'watch-tower-ui-v6-ready-gate'
/**
 * G4 zestaw kontrolny PLN (SET=pln): kokpit i harmonogram, każda rola, 1440, motyw domyślny roli,
 * waluta wyświetlania PLN ustawiona przez Opcje/Ustawienia. Pliki z sufiksem `__pln`.
 */
const SET = (process.env.SET || '').trim()

mkdirSync(OUT, { recursive: true })

/**
 * Requested Polish names → real NavKey (store view via data-view).
 * Finanse / Moje stawki / Rozliczenia share NavKey `fin` (role-specific label).
 */
const VIEWS = [
  { name: 'Kokpit', file: 'kokpit', dataView: 'dash' },
  { name: 'Mapa', file: 'mapa', dataView: 'map' },
  { name: 'Harmonogram', file: 'harmonogram', dataView: 'sched' },
  { name: 'Ryzyka', file: 'ryzyka', dataView: 'risk' },
  { name: 'Dokumenty', file: 'dokumenty', dataView: 'docs' },
  { name: 'Finanse', file: 'finanse', dataView: 'fin', roles: ['HHL'] },
  // G4 (Fala 3B): Faktury także dla KSH (moduł faktur HHL → KSH).
  { name: 'Faktury', file: 'faktury', dataView: 'inv', roles: ['HHL', 'KSH', 'SCX'] },
  // G4: faktury przychodowe HHL leżą pod sekcją kosztową — osobne ujęcie przewinięte do sekcji.
  { name: 'Faktury przychodowe', file: 'faktury-przychodowe', dataView: 'inv', roles: ['HHL'], scrollTo: '[data-bill-section="PRZYCHOD"]' },
  { name: 'Automatyzacje', file: 'automatyzacje', dataView: 'wf', roles: ['HHL'] },
  { name: 'Strefy', file: 'strefy', dataView: 'geo', roles: ['HHL'] },
  { name: 'Opcje', file: 'opcje', dataView: 'options', roles: ['HHL'] },
  { name: 'Moje zadania', file: 'moje-zadania', dataView: 'tasks', roles: ['SCX'] },
  { name: 'Moje stawki', file: 'moje-stawki', dataView: 'fin', roles: ['SCX'] },
  { name: 'Rozliczenia', file: 'rozliczenia', dataView: 'fin', roles: ['KSH'] },
  // G4: Ustawienia (waluta wyświetlania itd.) dla KSH i SCX.
  { name: 'Ustawienia', file: 'ustawienia', dataView: 'settings', roles: ['KSH', 'SCX'] },
]

const ROLES = [
  { id: 'HHL', defaultTheme: 'dark' },
  { id: 'KSH', defaultTheme: 'light' },
  { id: 'SCX', defaultTheme: 'dark' },
]

const LANGS = [
  { id: 'pl', label: 'PL', dataLang: 'pl' },
  { id: 'en', label: 'EN', dataLang: 'en' },
  { id: 'sv', label: 'SV', dataLang: 'sv' },
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

/** sha256 of package.json + package-lock.json + all files under src/ (sorted paths). */
function computeAppChecksum() {
  try {
    const hash = createHash('sha256')
    const files = []
    for (const name of ['package.json', 'package-lock.json']) {
      const p = join(ROOT, name)
      if (existsSync(p)) files.push(p)
    }
    const walk = (dir) => {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, ent.name)
        if (ent.isDirectory()) walk(p)
        else if (ent.isFile()) files.push(p)
      }
    }
    const src = join(ROOT, 'src')
    if (existsSync(src)) walk(src)
    files.sort()
    for (const p of files) {
      hash.update(relative(ROOT, p).replace(/\\/g, '/'))
      hash.update('\0')
      hash.update(readFileSync(p))
      hash.update('\0')
    }
    return hash.digest('hex')
  } catch {
    return null
  }
}

function* planPln() {
  const views = VIEWS.filter((v) => v.file === 'kokpit' || v.file === 'harmonogram')
  for (const view of views) {
    for (const role of ROLES) {
      yield {
        view, role, lang: LANGS[0], width: 1440, theme: role.defaultTheme, currency: 'PLN',
        file: shotName(view.file, role.id, 'pl', 1440, role.defaultTheme, role.defaultTheme).replace(/\.png$/, '__pln.png'),
      }
    }
  }
}

const planned = SET === 'pln' ? [...planPln()] : [...plan()]
console.log(`baseline: ${planned.length} shots planned → ${OUT}`)
console.log(`scriptVersion=${SCRIPT_VERSION}`)
console.log(`freeze URL: ${frozenUrl()}`)
console.log(`DRY_RUN=${DRY_RUN} ONLY=${ONLY} FILTER=${FILTER || '(none)'}`)

if (DRY_RUN) {
  let sample = planned
  if (FILTER) sample = sample.filter((p) => p.file.includes(FILTER))
  if (ONLY) sample = sample.slice(0, 1)
  writeFileSync(join(OUT, '_plan.txt'), sample.map((p) => p.file).join('\n') + '\n')
  console.log(sample.slice(0, 25).map((p) => p.file).join('\n'))
  if (sample.length > 25) console.log(`… +${sample.length - 25} more (see _plan.txt)`)
  process.exit(0)
}

let jobs = planned
if (FILTER) jobs = jobs.filter((p) => p.file.includes(FILTER))
if (ONLY) jobs = jobs.slice(0, 1)

if (!jobs.length) {
  console.error('baseline: no jobs after FILTER/ONLY')
  process.exit(1)
}

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
      sessionStorage.removeItem('wt-persist-wipe-notice')
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

async function setRole(roleId) {
  await page.evaluate((id) => {
    const btn = document.querySelector(`#roleSeg button[data-role="${id}"]`)
    if (!btn) throw new Error('role btn not found: data-role=' + id)
    btn.click()
  }, roleId)
  await sleep(500)
}

async function setLocale(lang) {
  await page.evaluate((dataLang) => {
    const btn = document.querySelector(`#langSeg button[data-lang="${dataLang}"]`)
    if (!btn) throw new Error('lang btn not found: data-lang=' + dataLang)
    btn.click()
  }, lang.dataLang)
  await sleep(300)
}

/**
 * G-V 28.09: przełącznik motywu klikany w DOM (bez page.click) — page.click przewija okno do przycisku,
 * co przy 390 px przesuwało ujęcie w poziomie zależnie od kolejności zadań (artefakt SV 390 dark, a956ab6).
 */
async function clickThemeBtn() {
  await page.evaluate(() => {
    const btn = document.querySelector('#themeBtn')
    if (!btn) throw new Error('theme btn not found: #themeBtn')
    btn.click()
  })
}

/** G-V 28.09: przed ujęciem zerujemy przewinięcie okna w poziomie (pion zostaje — ustawia go navTo). */
async function resetHorizontalScroll() {
  await page.evaluate(() => {
    window.scrollTo(0, window.scrollY)
    for (const el of [document.scrollingElement, document.documentElement, document.body]) if (el) el.scrollLeft = 0
  })
}

/** After setRole (applies role default), toggle #themeBtn once if non-default wanted. */
async function setTheme(theme, roleDefault) {
  const current = await page.evaluate(() => {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'
  })
  if (current === theme) return
  if (current !== roleDefault) {
    await clickThemeBtn()
    await sleep(300)
  }
  const mid = await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
  )
  if (mid !== theme) {
    await clickThemeBtn()
    await sleep(300)
  }
  const final = await page.evaluate(() =>
    document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark',
  )
  if (final !== theme) throw new Error(`theme want=${theme} got=${final}`)
}

async function navTo(dataView, scrollTo) {
  await page.evaluate((key) => {
    const btn = document.querySelector(`nav button[data-view="${key}"]`)
    if (!btn) throw new Error('nav not found: data-view=' + key)
    btn.click()
  }, dataView)
  await sleep(600)
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready
  })
  // F2.1: Risks exceptions queue filled the 1080 viewport — Prom (D4) + SE demo (D3)
  // lived below the fold, so Fala2 GATE reported 0 ryzyka diffs despite real UI changes.
  if (dataView === 'risk') {
    await page.evaluate(() => {
      const main = document.querySelector('main')
      const ferry = document.querySelector('[data-panel="ferry"]')
      if (!main || !ferry) throw new Error('F2.1: risk ferry panel missing')
      const mainRect = main.getBoundingClientRect()
      const ferryTop = ferry.getBoundingClientRect().top
      main.scrollTop += ferryTop - mainRect.top - 4
      // Prefer keeping SE demo header in frame when Prom is short enough
      const se = document.querySelector('[data-panel="road-se"]')
      if (se) {
        const seBottom = se.getBoundingClientRect().bottom
        const overflow = seBottom - mainRect.bottom
        if (overflow > 0 && overflow < 220) main.scrollTop += overflow + 4
      }
    })
    await sleep(300)
  }
  if (scrollTo) {
    await page.evaluate((sel) => {
      const main = document.querySelector('main')
      const el = document.querySelector(sel)
      if (!main || !el) throw new Error('G4: scroll target missing: ' + sel)
      main.scrollTop += el.getBoundingClientRect().top - main.getBoundingClientRect().top - 4
    }, scrollTo)
    await sleep(300)
  }
  await sleep(200)
}

async function setCurrency(roleId, currency) {
  await navTo(roleId === 'HHL' ? 'options' : 'settings')
  const sel = '[data-deur-exempt="currency-pref"] select'
  await page.waitForSelector(sel, { timeout: 10_000 })
  await page.select(sel, currency)
  await sleep(300)
  const v = await page.$eval(sel, (el) => el.value)
  if (v !== currency) throw new Error(`currency want=${currency} got=${v}`)
}

async function shoot(file) {
  await resetHorizontalScroll()
  const path = join(OUT, file)
  await page.screenshot({ path, type: 'png', fullPage: false })
  return path
}

/* D-25: RECTS_SEL='sel1;;sel2' — prostokąty wskazanych elementów (współrzędne ujęcia) → OUT/_rects.json */
const RECTS_SEL = (process.env.RECTS_SEL || '').split(';;').map((x) => x.trim()).filter(Boolean)
const rects = {}
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
    await setRole(job.role.id)
    await setLocale(job.lang)
    await setTheme(job.theme, job.role.defaultTheme)
    if (job.currency) await setCurrency(job.role.id, job.currency)
    await navTo(job.view.dataView, job.view.scrollTo)
    await shoot(job.file)
    if (RECTS_SEL.length) {
      rects[job.file] = await page.evaluate((sels) => sels.flatMap((sel) => [...document.querySelectorAll(sel)].map((el) => {
        const r = el.getBoundingClientRect(); return { sel, x: r.x, y: r.y, w: r.width, h: r.height }
      })), RECTS_SEL)
    }
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
if (RECTS_SEL.length) writeFileSync(join(OUT, '_rects.json'), JSON.stringify(rects, null, 1))

const appChecksum = computeAppChecksum()

writeFileSync(
  join(OUT, '_summary.json'),
  JSON.stringify(
    {
      ok,
      fail,
      total: jobs.length,
      scriptVersion: SCRIPT_VERSION,
      frozenNow: FROZEN_NOW,
      appChecksum,
      url: frozenUrl(),
      errors,
    },
    null,
    2,
  ),
)
console.log(`baseline done: ok=${ok} fail=${fail} / ${jobs.length} scriptVersion=${SCRIPT_VERSION}`)
if (fail) process.exitCode = 1
