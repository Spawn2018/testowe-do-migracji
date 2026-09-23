#!/usr/bin/env node
/** Smoke: XLSX download bytes > 0 + import guard strings + driver route */
import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'

const BASE = 'http://127.0.0.1:4177/'
const DL = '/tmp/wt-fn3b-dl'
mkdirSync(DL, { recursive: true })
for (const f of readdirSync(DL)) {
  try { unlinkSync(join(DL, f)) } catch {}
}

const chrome = existsSync('/usr/bin/google-chrome-stable')
  ? '/usr/bin/google-chrome-stable'
  : '/usr/bin/google-chrome'

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900'],
  defaultViewport: { width: 1440, height: 900 },
})

const results = { exportXlsx: null, importGuard: null, driverAttach: null, bundle: null, errors: [] }

try {
  const page = await browser.newPage()
  const client = await page.createCDPSession()
  await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL })

  await page.goto(BASE + '?fn3b=' + Date.now(), { waitUntil: 'networkidle0', timeout: 60000 })
  await page.evaluate(() => {
    try {
      for (const k of Object.keys(localStorage)) {
        if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k)
      }
      sessionStorage.setItem('wtNavCollapsed', '0')
    } catch {}
  })
  await page.reload({ waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 1000))

  results.bundle = await page.evaluate(() =>
    document.querySelector('script[src*="index-"]')?.getAttribute('src') || null,
  )

  // Navigate to Harmonogram
  await page.evaluate(() => {
    document.querySelector('.app')?.classList.remove('nav-collapsed')
    const items = [...document.querySelectorAll('button, a, [role="button"], .nav a, nav button')]
    const sched = items.find((b) => /harmonogram/i.test((b.textContent || '').trim()))
    sched?.click()
  })
  await new Promise((r) => setTimeout(r, 800))

  // Wait for export button
  await page.waitForFunction(
    () =>
      !!document.querySelector('[data-action="export-xlsx"]') ||
      [...document.querySelectorAll('button')].some((b) => /Eksport XLSX/i.test(b.textContent || '')),
    { timeout: 10000 },
  ).catch(() => null)

  const before = new Set(readdirSync(DL))

  // Intercept blobs AND click
  await page.evaluate(() => {
    window.__wtBlobs = []
    const orig = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (blob) => {
      const u = orig(blob)
      window.__wtBlobs.push({ size: blob?.size ?? 0, type: blob?.type ?? '' })
      return u
    }
  })

  const clicked = await page.evaluate(() => {
    const btn =
      document.querySelector('[data-action="export-xlsx"]') ||
      [...document.querySelectorAll('button')].find((b) => /Eksport XLSX/i.test(b.textContent || ''))
    if (!btn) return { ok: false, reason: 'no button' }
    btn.click()
    return { ok: true }
  })

  let file = null
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 200))
    const now = readdirSync(DL).filter((f) => !f.endsWith('.crdownload'))
    const fresh = now.filter((f) => !before.has(f) && f.endsWith('.xlsx'))
    if (fresh.length) {
      file = fresh[0]
      break
    }
  }

  const blobs = await page.evaluate(() => window.__wtBlobs || [])
  if (file) {
    const st = statSync(join(DL, file))
    results.exportXlsx = { ok: st.size > 0, bytes: st.size, file, via: 'cdp-download', clicked }
  } else {
    const hit = (blobs || []).find((x) => x.size > 0)
    results.exportXlsx = hit
      ? { ok: true, bytes: hit.size, via: 'blob-intercept', clicked, blobs }
      : { ok: false, reason: 'no xlsx download', clicked, blobs }
  }

  // Bundle guards
  const guard = await page.evaluate(async () => {
    const src = document.querySelector('script[src*="index-"]')?.src || ''
    const js = await fetch(src).then((r) => r.text())
    return {
      hasDisable: /accepted\s*===\s*0/.test(js),
      hasToast: /Import odrzucony — brak poprawnych wierszy, baza nietknięta/.test(js),
      hasExportFix: /webdriver|Pusty bufor XLSX|showSaveFilePicker/.test(js),
      hasDriverGuard: /brak ładunku/.test(js),
      hasKshNote: /H&H Logistics/.test(js),
      src,
    }
  })
  results.importGuard = { ok: guard.hasDisable && guard.hasToast && guard.hasKshNote, ...guard }

  await page.goto(BASE + '#/driver/demo-active', { waitUntil: 'networkidle0' })
  await new Promise((r) => setTimeout(r, 600))
  const driverUi = await page.evaluate(() => {
    const title = document.body?.innerText || ''
    return {
      hasCam: /Aparat|CMR/.test(title),
      tokenOk: /demo-active|SG-14/.test(title),
      snippet: title.slice(0, 180),
    }
  })
  results.driverAttach = { ok: driverUi.hasCam && driverUi.tokenOk, ...driverUi }
} catch (e) {
  results.errors.push(String(e?.stack || e))
} finally {
  await browser.close()
}

writeFileSync('/tmp/wt-fn3b-smoke.json', JSON.stringify(results, null, 2))
console.log(JSON.stringify(results, null, 2))
const pass =
  results.exportXlsx?.ok &&
  results.importGuard?.ok &&
  results.driverAttach?.ok &&
  results.errors.length === 0
process.exit(pass ? 0 : 2)
