import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync } from 'fs'

const chrome = existsSync('/usr/bin/google-chrome-stable')
  ? '/usr/bin/google-chrome-stable'
  : '/usr/bin/google-chrome'

mkdirSync('/tmp', { recursive: true })
mkdirSync('/workspace/watch-tower-app/shots-identical', { recursive: true })

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900'],
  defaultViewport: { width: 1440, height: 900 },
})

async function prep(page) {
  await page.goto('http://127.0.0.1:4177/', { waitUntil: 'networkidle0', timeout: 90000 })
  await page.evaluate(() => {
    try { sessionStorage.setItem('wtNavCollapsed', '0') } catch {}
    for (const k of Object.keys(localStorage)) if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k)
  })
  await page.reload({ waitUntil: 'networkidle0' })
  await page.evaluate(() => document.querySelector('.app')?.classList.remove('nav-collapsed'))
  await new Promise((r) => setTimeout(r, 400))
}

async function setRole(page, nameRe) {
  await page.evaluate((re) => {
    const rx = new RegExp(re)
    const btn = [...document.querySelectorAll('.roleswitch .seg button')].find((b) => rx.test(b.textContent || ''))
    btn?.click()
  }, nameRe)
  await new Promise((r) => setTimeout(r, 600))
}

async function nav(page, labelRe) {
  await page.evaluate((re) => {
    const rx = new RegExp(re)
    const btn = [...document.querySelectorAll('nav button')].find((b) =>
      rx.test(b.getAttribute('aria-label') || b.textContent || ''),
    )
    btn?.click()
  }, labelRe)
  await new Promise((r) => setTimeout(r, 700))
}

async function shot(page, path, clip) {
  if (clip) await page.screenshot({ path, clip })
  else await page.screenshot({ path, fullPage: false })
  console.log('wrote', path)
}

const page = await browser.newPage()
await prep(page)
await setRole(page, 'H&H')

await nav(page, 'Kokpit')
await shot(page, '/tmp/wt-fix-banner.png', { x: 200, y: 70, width: 1200, height: 120 })
await shot(page, '/tmp/wt-fix-exq.png', { x: 200, y: 280, width: 620, height: 420 })
await shot(page, '/workspace/watch-tower-app/shots-identical/01-dash-hhl.png')

// open drawer via first exq
await page.evaluate(() => document.querySelector('.exq li')?.click())
await new Promise((r) => setTimeout(r, 800))
await shot(page, '/tmp/wt-fix-drawer.png', { x: 880, y: 0, width: 560, height: 900 })
await shot(page, '/workspace/watch-tower-app/shots-identical/02-drawer-hhl.png')
await page.evaluate(() => document.querySelector('.drawer .iconbtn')?.click())
await new Promise((r) => setTimeout(r, 300))

await nav(page, 'Harmonogram')
await shot(page, '/tmp/wt-fix-sched.png')
await shot(page, '/workspace/watch-tower-app/shots-identical/03-sched-hhl.png')

await nav(page, 'Ryzyka')
await shot(page, '/workspace/watch-tower-app/shots-identical/04-risk-hhl.png')

await nav(page, 'Mapa')
await shot(page, '/workspace/watch-tower-app/shots-identical/05-map-hhl.png')

await nav(page, 'Dokumenty')
await shot(page, '/workspace/watch-tower-app/shots-identical/06-docs-hhl.png')

await nav(page, 'Finanse')
await shot(page, '/workspace/watch-tower-app/shots-identical/07-fin-hhl.png')

await nav(page, 'Faktury')
await shot(page, '/workspace/watch-tower-app/shots-identical/08-inv-hhl.png')

await nav(page, 'Automatyzacje')
await shot(page, '/workspace/watch-tower-app/shots-identical/09-wf-hhl.png')

await nav(page, 'Strefy')
await shot(page, '/workspace/watch-tower-app/shots-identical/10-geo-hhl.png')

await setRole(page, '^KSH$')
await nav(page, 'Kokpit')
await shot(page, '/workspace/watch-tower-app/shots-identical/11-dash-ksh.png')

await setRole(page, 'Scandinavian')
await nav(page, 'Kokpit')
await shot(page, '/workspace/watch-tower-app/shots-identical/12-dash-scx.png')
await nav(page, 'Moje zadania')
await shot(page, '/workspace/watch-tower-app/shots-identical/13-tasks-scx.png')

// Claude ref shots
await page.goto('http://127.0.0.1:4177/claude-ref.html', { waitUntil: 'networkidle0', timeout: 90000 })
await new Promise((r) => setTimeout(r, 800))
await shot(page, '/tmp/wt-claude-dash.png')
await page.evaluate(() => {
  const b = [...document.querySelectorAll('nav button, [data-view]')].find((el) =>
    /Harmonogram|sched/i.test(el.textContent || el.getAttribute('data-view') || ''),
  )
  b?.click()
})
await new Promise((r) => setTimeout(r, 600))
await shot(page, '/tmp/wt-claude-sched.png')

// DOM audit snippet from app
await page.goto('http://127.0.0.1:4177/', { waitUntil: 'networkidle0' })
await setRole(page, 'H&H')
await nav(page, 'Kokpit')
const audit = await page.evaluate(() => {
  const banner = document.querySelector('.banner')?.textContent?.trim().slice(0, 120)
  const exq = [...document.querySelectorAll('.exq li')].slice(0, 3).map((li) => ({
    sev: li.getAttribute('data-sev'),
    t: li.querySelector('.t')?.textContent?.trim(),
    m: li.querySelector('.m')?.textContent?.trim(),
    age: li.querySelector('.age')?.textContent?.trim(),
  }))
  const kpiExc = [...document.querySelectorAll('.kpis .kpi, .kpis button, .kpis > *')].map((el) =>
    el.textContent?.replace(/\s+/g, ' ').trim().slice(0, 80),
  )
  const excCount = document.querySelectorAll('.exq li').length
  const sub = document.querySelector('.panel-hd .sub')?.textContent
  return { banner, exq, excCount, sub, kpiExc: kpiExc.slice(0, 8) }
})
console.log('AUDIT', JSON.stringify(audit, null, 2))

await browser.close()
