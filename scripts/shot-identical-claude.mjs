#!/usr/bin/env node
import puppeteer from 'puppeteer-core'
import { mkdirSync, writeFileSync, existsSync } from 'fs'
import { pathToFileURL } from 'url'

const out = '/workspace/watch-tower-app/shots-start'
mkdirSync(out, { recursive: true })
const BASE = 'http://127.0.0.1:4177/'
const REF = 'http://127.0.0.1:4177/claude-ref.html'
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
    document.querySelector('.app')?.classList.remove('nav-collapsed')
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
  await new Promise((r) => setTimeout(r, 400))
}

async function clickRole(code) {
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

async function scrapeChrome() {
  return page.evaluate(() => {
    const brand = document.querySelector('.brand b')?.textContent?.trim()
    const brandSub = document.querySelector('.brand span')?.textContent?.trim()
    const roles = [...document.querySelectorAll('.roleswitch .seg button')].map((b) => b.textContent.trim())
    const stages = [...document.querySelectorAll('.stage .l')].map((el) => el.textContent.trim())
    const navLabels = [...document.querySelectorAll('nav button .lbl')].map((el) => el.textContent.trim())
    const kpiLabels = [...document.querySelectorAll('.kpi .k')].map((el) => el.textContent.trim())
    const panelH2 = [...document.querySelectorAll('.panel-hd h2')].map((el) => el.textContent.trim())
    const exTitles = [...document.querySelectorAll('.exq .t')].slice(0, 5).map((el) => el.textContent.trim())
    const exMeta = [...document.querySelectorAll('.exq .m')].slice(0, 5).map((el) => el.textContent.trim())
    const topH = document.querySelector('.topbar')?.getBoundingClientRect().height
    const navW = document.querySelector('nav')?.getBoundingClientRect().width
    const corridorMin = getComputedStyle(document.querySelector('.corridor-inner') || document.body).minWidth
    const hasLogoChip = !!document.querySelector('.brand img')
    const doubled = exTitles.filter((t) => /SG-\d{2}.*SG-\d{2}/.test(t) || /SG-\d{2}SG-\d{2}/.test(t))
    const doubledMeta = exMeta.filter((t) => /SG-\d{2}/.test(t) && document.querySelector(`.exq .t`)?.textContent?.includes(t.match(/SG-\d{2}/)?.[0] || '___'))
    return {
      brand, brandSub, roles, stages, navLabels, kpiLabels, panelH2, exTitles, exMeta,
      topH, navW, corridorMin, hasLogoChip, doubled, theme: document.documentElement.getAttribute('data-theme'),
    }
  })
}

const notes = []

// --- APP HHL dark cockpit ---
await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 60000 })
await clearState()
await page.reload({ waitUntil: 'networkidle0' })
await expandNav()
await clickRole('HHL')
await clickNav('Kokpit|Overview|Översikt')
await new Promise((r) => setTimeout(r, 600))
await page.screenshot({ path: `${out}/identical-claude-app.png`, fullPage: false })
const appChrome = await scrapeChrome()
notes.push({ side: 'app', ...appChrome })

// --- MAKIETA via public ref (same origin) or file ---
let refUrl = REF
try {
  const r = await fetch(REF)
  if (!r.ok) refUrl = MAKIETA
} catch {
  refUrl = MAKIETA
}
await page.goto(refUrl, { waitUntil: 'networkidle0', timeout: 60000 })
await new Promise((r) => setTimeout(r, 800))
// force HHL + PL if makieta
await page.evaluate(() => {
  const hhl = [...document.querySelectorAll('[data-role], .roleswitch .seg button')].find((b) =>
    /H&H|HHL/i.test(b.textContent || '') || b.getAttribute('data-role') === 'HHL',
  )
  hhl?.click()
  const pl = [...document.querySelectorAll('[data-lang], .seg button')].find((b) => (b.textContent || '').trim() === 'PL')
  pl?.click()
})
await new Promise((r) => setTimeout(r, 700))
await page.screenshot({ path: `${out}/identical-claude-makieta.png`, fullPage: false })
const makChrome = await scrapeChrome()
notes.push({ side: 'makieta', ...makChrome })

// Diff notes
const diffs = []
const keys = ['brand', 'brandSub', 'roles', 'stages', 'navLabels', 'kpiLabels', 'panelH2', 'corridorMin', 'hasLogoChip', 'topH', 'navW']
for (const k of keys) {
  const a = JSON.stringify(appChrome[k])
  const m = JSON.stringify(makChrome[k])
  if (a !== m) diffs.push({ field: k, app: appChrome[k], makieta: makChrome[k] })
}
diffs.push({ field: 'doubledExTitles_app', app: appChrome.doubled, makieta: makChrome.doubled })

writeFileSync(`${out}/identical-claude-diff-notes.json`, JSON.stringify({ app: appChrome, makieta: makChrome, diffs }, null, 2))

// Render a simple diff-notes PNG via HTML
await page.setContent(`<!doctype html><html><head><meta charset=utf-8>
<style>
body{margin:0;font:14px Barlow,Arial,sans-serif;background:#0E1418;color:#E8EEF2;padding:24px}
h1{font-family:"Barlow Condensed",sans-serif;font-size:28px;margin:0 0 12px}
table{border-collapse:collapse;width:100%;font-size:13px}
td,th{border:1px solid #2A343C;padding:8px 10px;text-align:left;vertical-align:top}
th{background:#161D22;font-family:"Barlow Condensed"}
.ok{color:#3D9A6A}.bad{color:#C44B4B}.muted{color:#8B969E}
pre{white-space:pre-wrap;margin:0;font:12px ui-monospace,monospace}
</style></head><body>
<h1>IDENTICAL CLAUDE — diff notes</h1>
<p class="muted">App vs makieta chrome · 2026-09-23 Europe/Warsaw</p>
<table>
<tr><th>Field</th><th>App</th><th>Makieta</th><th></th></tr>
${diffs.map(d => {
  const same = JSON.stringify(d.app) === JSON.stringify(d.makieta)
  // allowed: brandSub date vs date format, kpi values not compared here, counts
  const allow = ['brandSub','topH','navW','kpiLabels'].includes(d.field) // kpi labels should match though
  const status = same ? 'ok' : (d.field === 'doubledExTitles_app' && !(d.app||[]).length ? 'ok' : 'bad')
  return `<tr><td>${d.field}</td><td><pre>${JSON.stringify(d.app,null,0)}</pre></td><td><pre>${JSON.stringify(d.makieta,null,0)}</pre></td><td class="${status}">${status==='ok'?'PASS':'DIFF'}</td></tr>`
}).join('')}
</table>
<p class="muted" style="margin-top:16px">Doubled IDs app: ${JSON.stringify(appChrome.doubled)} · ex sample: ${JSON.stringify(appChrome.exTitles)}</p>
</body></html>`, { waitUntil: 'networkidle0' })
await page.screenshot({ path: `${out}/identical-claude-diff-notes.png`, fullPage: true })

console.log(JSON.stringify({ diffs, doubled: appChrome.doubled, stagesApp: appChrome.stages, stagesMak: makChrome.stages }, null, 2))
await browser.close()
