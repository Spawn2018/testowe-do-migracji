import puppeteer from 'puppeteer-core'
import { writeFileSync, existsSync, readFileSync } from 'fs'
import { pathToFileURL } from 'url'

const out = '/workspace/watch-tower-app/shots-start'
const chrome = existsSync('/usr/bin/google-chrome-stable')
  ? '/usr/bin/google-chrome-stable'
  : '/usr/bin/google-chrome'
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  args: ['--no-sandbox','--disable-dev-shm-usage','--window-size=1440,900'],
  defaultViewport: { width: 1440, height: 900 },
})
const page = await browser.newPage()

// Prefer public ref
let url = 'http://127.0.0.1:4177/claude-ref.html'
try {
  const r = await fetch(url)
  if (!r.ok) throw new Error('no')
} catch {
  url = pathToFileURL('/workspace/watch-tower/claude-visual-ref/tower-makieta.html').href
}
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'dark')
  const hhl = [...document.querySelectorAll('[data-role], .roleswitch .seg button')].find((b) =>
    /H&H|HHL/i.test(b.textContent || '') || b.getAttribute('data-role') === 'HHL',
  )
  hhl?.click()
  // dash view
  const dash = [...document.querySelectorAll('nav button, [data-view]')].find((b) =>
    /Kokpit|dash/i.test(b.textContent || '') || b.getAttribute('data-view') === 'dash',
  )
  dash?.click()
})
await new Promise((r) => setTimeout(r, 900))
await page.screenshot({ path: `${out}/identical-claude-makieta.png`, fullPage: false })

const data = JSON.parse(readFileSync(`${out}/identical-claude-diff-notes.json`, 'utf8'))
const diffs = data.diffs || []
const html = `<!doctype html><html><head><meta charset=utf-8>
<style>
body{margin:0;font:14px Arial,sans-serif;background:#0E1418;color:#E8EEF2;padding:24px}
h1{font-family:Arial;font-size:26px;margin:0 0 12px}
table{border-collapse:collapse;width:100%;font-size:13px}
td,th{border:1px solid #2A343C;padding:8px 10px;text-align:left;vertical-align:top}
th{background:#161D22}
.ok{color:#3D9A6A}.bad{color:#C44B4B}.muted{color:#8B969E}
pre{white-space:pre-wrap;margin:0;font:12px monospace}
</style></head><body>
<h1>IDENTICAL CLAUDE — diff notes</h1>
<p class="muted">App vs makieta chrome · 2026-09-23 CEST · doubled IDs fixed</p>
<table>
<tr><th>Field</th><th>App</th><th>Makieta</th><th></th></tr>
${[
  ['brand', data.app.brand, data.makieta.brand],
  ['brandSub', data.app.brandSub, data.makieta.brandSub],
  ['roles', data.app.roles, data.makieta.roles],
  ['stages', data.app.stages, data.makieta.stages],
  ['navLabels', data.app.navLabels, data.makieta.navLabels],
  ['kpiLabels', data.app.kpiLabels, data.makieta.kpiLabels],
  ['panelH2', data.app.panelH2, data.makieta.panelH2],
  ['topH / navW', `${data.app.topH}/${data.app.navW}`, `${data.makieta.topH}/${data.makieta.navW}`],
  ['corridorMin', data.app.corridorMin, data.makieta.corridorMin],
  ['hasLogoChip', data.app.hasLogoChip, data.makieta.hasLogoChip],
  ['doubledEx', data.app.doubled, data.makieta.doubled],
  ['exTitles sample', data.app.exTitles, data.makieta.exTitles],
].map(([f,a,m]) => {
  const same = JSON.stringify(a)===JSON.stringify(m)
  const soft = f.includes('exTitles') || f==='brandSub'
  const ok = same || soft
  return `<tr><td>${f}</td><td><pre>${JSON.stringify(a)}</pre></td><td><pre>${JSON.stringify(m)}</pre></td><td class="${ok?'ok':'bad'}">${ok?'PASS':'DIFF'}</td></tr>`
}).join('')}
</table>
<p class="muted">Allowed: seed copy (exception titles/meta values), live clock/date in brandSub panel sub, hamburger+bell additive chrome.</p>
</body></html>`
await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 })
await page.screenshot({ path: `${out}/identical-claude-diff-notes.png`, fullPage: true })
console.log('shots done')
await browser.close()
