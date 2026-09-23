import puppeteer from 'puppeteer-core'
import { existsSync } from 'fs'
const out = '/workspace/watch-tower-app/shots-start'
const chrome = existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : '/usr/bin/google-chrome'
const browser = await puppeteer.launch({
  executablePath: chrome, headless: 'new',
  args: ['--no-sandbox','--disable-dev-shm-usage','--window-size=1440,900'],
  defaultViewport: { width: 1440, height: 900 },
})
const page = await browser.newPage()
await page.goto('http://127.0.0.1:4177/', { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.evaluate(() => {
  try { sessionStorage.setItem('wtNavCollapsed', '0') } catch {}
  for (const k of Object.keys(localStorage)) if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k)
})
await page.reload({ waitUntil: 'networkidle0' })
await page.evaluate(() => {
  document.querySelector('.app')?.classList.remove('nav-collapsed')
  const hhl = [...document.querySelectorAll('.roleswitch .seg button')].find((b) => /H&H/.test(b.textContent||''))
  hhl?.click()
})
await new Promise(r => setTimeout(r, 800))
await page.evaluate(() => {
  const dash = [...document.querySelectorAll('nav button')].find((b) => /Kokpit/.test(b.getAttribute('aria-label')||b.textContent||''))
  dash?.click()
})
await new Promise(r => setTimeout(r, 700))
// verify computed display
const disp = await page.evaluate(() => {
  const t = document.querySelector('.exq .t')
  const m = document.querySelector('.exq .m')
  const csT = t ? getComputedStyle(t).display : null
  const csM = m ? getComputedStyle(m).display : null
  const sample = [...document.querySelectorAll('.exq li')].slice(0,3).map(li => ({
    t: li.querySelector('.t')?.textContent,
    m: li.querySelector('.m')?.textContent,
  }))
  return { csT, csM, sample }
})
console.log(JSON.stringify(disp, null, 2))
await page.screenshot({ path: `${out}/identical-claude-app.png`, fullPage: false })
await browser.close()
