#!/usr/bin/env node
import puppeteer from 'puppeteer-core'
import { mkdirSync, writeFileSync, existsSync } from 'fs'
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
        if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k)
      }
    } catch {}
  })
}

async function expandNav() {
  await page.evaluate(() => {
    try { sessionStorage.setItem('wtNavCollapsed', '0') } catch {}
    const app = document.querySelector('.app')
    app?.classList.remove('nav-collapsed')
    const nav = document.querySelector('nav')
    if (nav && nav.getBoundingClientRect().width < 100) {
      const btn = [...document.querySelectorAll('button')].find(
        (b) =>
          (b.textContent || '').includes('»') ||
          /rozwiń|expand/i.test(b.getAttribute('title') || '') ||
          /nawigacji|menu/i.test(b.getAttribute('aria-label') || ''),
      )
      btn?.click()
    }
  })
  await new Promise((r) => setTimeout(r, 350))
}

async function clickRole(code) {
  // HHL / KSH / SCX — match short or full Claude labels
  await page.evaluate((code) => {
    const aliases = {
      HHL: ['HHL', 'H&H Logistics', 'H&H'],
      KSH: ['KSH'],
      SCX: ['SCX', 'Scandinavian Express'],
    }
    const want = aliases[code] || [code]
    const btns = [...document.querySelectorAll('.roleswitch .seg button, .seg button')]
    const btn = btns.find((b) => want.some((w) => (b.textContent || '').trim() === w || (b.textContent || '').includes(w)))
    btn?.click()
  }, code)
  await new Promise((r) => setTimeout(r, 700))
}

async function clickNav(reSrc) {
  await page.evaluate((reSrc) => {
    const re = new RegExp(reSrc, 'i')
    const btn = [...document.querySelectorAll('nav button')].find((b) =>
      re.test(b.getAttribute('aria-label') || b.textContent || ''),
    )
    btn?.click()
  }, reSrc)
  await new Promise((r) => setTimeout(r, 900))
}

async function metrics(selBrand = '.brand b', selTop = '.topbar', selStage = '.stage .n', selKpi = '.kpi .v') {
  return page.evaluate(({ selBrand, selTop, selStage, selKpi }) => {
    const cs = getComputedStyle(document.documentElement)
    const body = getComputedStyle(document.body)
    const brand = document.querySelector(selBrand)
    const top = document.querySelector(selTop)
    const nav = document.querySelector('nav')
    const spineN = document.querySelector(selStage)
    const kpiV = document.querySelector(selKpi)
    const stages = [...document.querySelectorAll('.stage .l')].map((el) => el.textContent.trim())
    const navLabels = [...document.querySelectorAll('nav button .lbl')].map((el) => el.textContent.trim())
    return {
      theme: document.documentElement.getAttribute('data-theme'),
      bodyFont: body.fontFamily,
      brandFont: brand ? getComputedStyle(brand).fontFamily : null,
      brandSize: brand ? getComputedStyle(brand).fontSize : null,
      brandText: brand ? brand.textContent : null,
      topH: top ? Math.round(top.getBoundingClientRect().height) : null,
      navW: nav ? Math.round(nav.getBoundingClientRect().width) : null,
      spineN: spineN ? getComputedStyle(spineN).fontSize : null,
      kpiV: kpiV ? getComputedStyle(kpiV).fontSize : null,
      page: cs.getPropertyValue('--page').trim(),
      surface: cs.getPropertyValue('--surface').trim(),
      ink: cs.getPropertyValue('--ink').trim(),
      amber: cs.getPropertyValue('--amber').trim(),
      stages,
      navLabels,
      hasApp: !!document.querySelector('.app'),
      hasCorridor: !!document.querySelector('.corridor'),
      leaflet: !!document.querySelector('.leaflet-container'),
      tileImgs: document.querySelectorAll('.leaflet-tile-pane img').length,
    }
  }, { selBrand, selTop, selStage, selKpi })
}

const report = {}

// --- Makieta ---
await page.goto(MAKIETA, { waitUntil: 'networkidle0', timeout: 90000 })
await page.waitForSelector('.topbar', { timeout: 20000 })
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
await new Promise((r) => setTimeout(r, 400))
report.makietaDark = await metrics()
await page.screenshot({ path: `${out}/from-zero-claude-makieta-dark.png`, fullPage: false })
await page.screenshot({ path: `${out}/from-claude-zero-makieta.png`, fullPage: false })
console.log('makieta', report.makietaDark.theme, report.makietaDark.brandText, report.makietaDark.topH, report.makietaDark.navW)

// --- APP ---
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 })
await clearState()
await page.reload({ waitUntil: 'networkidle0', timeout: 90000 })
await page.waitForSelector('.topbar', { timeout: 20000 })
await expandNav()

await clickRole('HHL')
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
await clickNav('kokpit|dashboard|dash')
await expandNav()
await new Promise((r) => setTimeout(r, 1500))
report.hhlDark = await metrics()
await page.screenshot({ path: `${out}/from-zero-claude-hhl-dark.png`, fullPage: false })
await page.screenshot({ path: `${out}/from-claude-zero-app-cockpit.png`, fullPage: false })
console.log('hhl-dark', report.hhlDark.theme, report.hhlDark.brandText, report.hhlDark.topH, report.hhlDark.navW, report.hhlDark.stages?.slice(0, 3))

await expandNav()
await page.screenshot({ path: `${out}/from-zero-claude-nav.png`, fullPage: false })

await clickNav('mapa|map')
await new Promise((r) => setTimeout(r, 2000))
report.map = await metrics()
await page.screenshot({ path: `${out}/from-zero-claude-map.png`, fullPage: false })
await page.screenshot({ path: `${out}/from-claude-zero-app-map.png`, fullPage: false })
console.log('map', report.map.leaflet, report.map.tileImgs)

await clickRole('KSH')
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'))
await clickNav('kokpit|dashboard|dash')
await expandNav()
await new Promise((r) => setTimeout(r, 1200))
report.kshLight = await metrics()
await page.screenshot({ path: `${out}/from-zero-claude-ksh-light.png`, fullPage: false })
console.log('ksh-light', report.kshLight.theme, report.kshLight.page)

// Gate checks vs makieta
const gate = {
  brandBarlowCondensed: /Barlow Condensed/i.test(report.hhlDark.brandFont || ''),
  brandSize23: report.hhlDark.brandSize === '23px',
  topbar52: report.hhlDark.topH === 52,
  nav186: report.hhlDark.navW === 186,
  pageDarkMatch: report.hhlDark.page?.toLowerCase() === report.makietaDark.page?.toLowerCase(),
  surfaceMatch: report.hhlDark.surface?.toLowerCase() === report.makietaDark.surface?.toLowerCase(),
  inkMatch: report.hhlDark.ink?.toLowerCase() === report.makietaDark.ink?.toLowerCase(),
  hasAppShell: report.hhlDark.hasApp && report.hhlDark.hasCorridor,
  kshLightPage: report.kshLight.page?.toLowerCase() === '#e3e9ed',
  spine26: report.hhlDark.spineN === '26px',
  kpi29: report.hhlDark.kpiV === '29px',
}
report.gate = gate
writeFileSync(`${out}/from-zero-claude-metrics.json`, JSON.stringify(report, null, 2))
console.log('GATE', gate)

await browser.close()
console.log('SHOTS_OK', out)
