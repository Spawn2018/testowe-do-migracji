#!/usr/bin/env node
import puppeteer from 'puppeteer-core'
import { mkdirSync, existsSync, writeFileSync } from 'fs'
import { pathToFileURL } from 'url'

const out = '/workspace/watch-tower-app/shots-start'
mkdirSync(out, { recursive: true })
const BASE = 'http://127.0.0.1:4177/'
const MAKIETA = pathToFileURL('/workspace/watch-tower/claude-visual-ref/tower-makieta.html').href

const browser = await puppeteer.launch({
  executablePath: existsSync('/usr/bin/google-chrome-stable')
    ? '/usr/bin/google-chrome-stable'
    : '/usr/bin/google-chrome',
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--use-gl=angle',
    '--use-angle=swiftshader-webgl',
    '--window-size=1440,900',
  ],
  defaultViewport: { width: 1440, height: 900 },
})

const page = await browser.newPage()

async function clearState() {
  await page.evaluate(() => {
    try {
      sessionStorage.setItem('wtNavCollapsed', '0')
      for (const k of Object.keys(localStorage)) {
        if (/watch|tower|wt|theme|role|lang/i.test(k)) localStorage.removeItem(k)
      }
    } catch {}
  })
}

async function waitFonts() {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready
  })
  await new Promise((r) => setTimeout(r, 600))
}

async function forceHhlDark() {
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
    // click HHL role if present
    const btns = [...document.querySelectorAll('.seg button')]
    const hhl = btns.find((b) => /H&H|HHL|Logistics/i.test(b.textContent || ''))
    if (hhl) hhl.click()
    // ensure dash view
    const kokpit = [...document.querySelectorAll('nav button')].find((b) =>
      /Kokpit|Overview|Översikt/i.test(b.textContent || ''),
    )
    if (kokpit) kokpit.click()
  })
  await new Promise((r) => setTimeout(r, 400))
}

async function openDrawer() {
  await page.evaluate(() => {
    const row =
      document.querySelector('.exq li') ||
      document.querySelector('.exq button.exq-row') ||
      document.querySelector('.mlist li.exq-row') ||
      document.querySelector('tbody tr')
    if (row) row.click()
  })
  await page.waitForSelector('.drawer', { timeout: 5000 }).catch(() => null)
  await new Promise((r) => setTimeout(r, 500))
}

async function metrics() {
  return page.evaluate(() => {
    const cs = getComputedStyle(document.body)
    const drawer = document.querySelector('.drawer')
    const dhd = document.querySelector('.drawer-hd h3')
    const panelBd = document.querySelector('.panel-bd')
    const navBtn = document.querySelector('nav button')
    const exq = document.querySelector('.exq li, .exq button.exq-row')
    const rightCol = document.querySelector('.grid2 > div:last-child, .mlist')
    const brand = document.querySelector('.brand b')
    return {
      bodyFont: cs.fontFamily,
      bodySize: cs.fontSize,
      bodyLh: cs.lineHeight,
      brand: brand?.textContent?.trim(),
      brandSize: brand ? getComputedStyle(brand).fontSize : null,
      panelBdPad: panelBd ? getComputedStyle(panelBd).padding : null,
      navBtnPad: navBtn ? getComputedStyle(navBtn).padding : null,
      exqPad: exq ? getComputedStyle(exq).padding : null,
      drawerW: drawer ? Math.round(drawer.getBoundingClientRect().width) : null,
      drawerH3: dhd ? getComputedStyle(dhd).fontSize : null,
      drawerH3Ff: dhd ? getComputedStyle(dhd).fontFamily : null,
      drawerMeta: document.querySelector('.drawer-hd .meta')
        ? getComputedStyle(document.querySelector('.drawer-hd .meta')).fontSize
        : null,
      dbodyPad: document.querySelector('.dbody')
        ? getComputedStyle(document.querySelector('.dbody')).padding
        : null,
      rightExists: !!rightCol,
      plex: /Plex|IBM/i.test(cs.fontFamily),
      panelSubs: [...document.querySelectorAll('.panel-hd .sub')].map((el) => el.textContent.trim()),
      panelH2: [...document.querySelectorAll('.panel-hd h2')].map((el) => el.textContent.trim()),
    }
  })
}

// --- APP cockpit ---
await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 60000 })
await clearState()
await page.reload({ waitUntil: 'networkidle0' })
await waitFonts()
await forceHhlDark()
await waitFonts()
await page.screenshot({ path: `${out}/spacing-fix-app.png`, fullPage: false })
const appMetrics = await metrics()

// right column crop (grid2 right / mlist)
const rightBox = await page.evaluate(() => {
  const el = document.querySelector('.grid2 > div:last-child') || document.querySelector('.mlist')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4), width: Math.min(r.width + 8, 700), height: Math.min(r.height + 8, 820) }
})
if (rightBox) {
  await page.screenshot({ path: `${out}/spacing-fix-right-app.png`, clip: rightBox })
} else {
  await page.screenshot({ path: `${out}/spacing-fix-right-app.png`, fullPage: false })
}

// open drawer for right-panel shot overlay
await openDrawer()
const drawerBox = await page.evaluate(() => {
  const el = document.querySelector('.drawer')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.x, y: r.y, width: r.width, height: Math.min(r.height, 900) }
})
const appDrawer = await metrics()
if (drawerBox) {
  await page.screenshot({ path: `${out}/spacing-fix-right-app-drawer.png`, clip: drawerBox })
}

// --- CLAUDE makieta ---
await page.goto(MAKIETA, { waitUntil: 'networkidle0', timeout: 60000 })
await waitFonts()
await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'dark')
  const btns = [...document.querySelectorAll('#roleSeg button, .seg button')]
  const hhl = btns.find((b) => /HHL|H&H|Logistics/i.test(b.textContent || '') || b.dataset.role === 'HHL')
  if (hhl) hhl.click()
  const dash = [...document.querySelectorAll('nav button, [data-view]')].find(
    (b) => b.dataset.view === 'dash' || /Kokpit/i.test(b.textContent || ''),
  )
  if (dash) dash.click()
})
await new Promise((r) => setTimeout(r, 500))
await waitFonts()
await page.screenshot({ path: `${out}/spacing-fix-claude.png`, fullPage: false })
const claudeMetrics = await metrics()

const rightBoxC = await page.evaluate(() => {
  const el = document.querySelector('.grid2 > div:last-child') || document.querySelector('.mlist')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: Math.max(0, r.x - 4), y: Math.max(0, r.y - 4), width: Math.min(r.width + 8, 700), height: Math.min(r.height + 8, 820) }
})
if (rightBoxC) {
  await page.screenshot({ path: `${out}/spacing-fix-right-claude.png`, clip: rightBoxC })
}

// open makieta drawer
await page.evaluate(() => {
  const li = document.querySelector('.exq li')
  if (li) li.click()
})
await page.waitForSelector('.drawer', { timeout: 5000 }).catch(() => null)
await new Promise((r) => setTimeout(r, 400))
const claudeDrawer = await metrics()
const drawerBoxC = await page.evaluate(() => {
  const el = document.querySelector('.drawer')
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { x: r.x, y: r.y, width: r.width, height: Math.min(r.height, 900) }
})
if (drawerBoxC) {
  await page.screenshot({ path: `${out}/spacing-fix-right-claude-drawer.png`, clip: drawerBoxC })
}

const report = { app: appMetrics, appDrawer, claude: claudeMetrics, claudeDrawer }
writeFileSync(`${out}/spacing-fix-metrics.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
await browser.close()
console.log('shots written to', out)
