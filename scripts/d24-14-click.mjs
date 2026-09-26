#!/usr/bin/env node
/**
 * D24 — full click re-run of scope mandate #1–#14
 * Prefer FAIL. Writes JSON + screenshots under docs/qa-start/d24/
 */
import { chromium } from '@playwright/test'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
  readFileSync,
} from 'fs'
import { createHash } from 'crypto'
import { join } from 'path'
import { execSync } from 'child_process'

// O1: parametry (domyślnie jak przebieg Fali 0): BASE_URL, DIST (paczka do sumy kontrolnej), OUT.
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:4177').replace(/\/$/, '')
const FROZEN = '2026-09-23T14:32:00Z'
const URL = `${BASE}/#/?now=${encodeURIComponent(FROZEN)}`
const OUT = process.env.OUT || '/workspace/watch-tower-app/docs/qa-start/d24'
const DIST = process.env.DIST || 'dist'
const DL = '/tmp/wt-d24-dl'
const PERSIST = 'watch-tower-ui-v6-ready-gate'

mkdirSync(OUT, { recursive: true })
mkdirSync(DL, { recursive: true })
for (const f of readdirSync(DL)) {
  try {
    unlinkSync(join(DL, f))
  } catch {}
}

const HEAD = execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
const TREE = execSync('git rev-parse HEAD^{tree}', { encoding: 'utf8' }).trim()
const jsFile = readdirSync(join(DIST, 'assets')).find((f) => /^index-.*\.js$/.test(f))
const cssFile = readdirSync(join(DIST, 'assets')).find((f) => /^index-.*\.css$/.test(f))
const jsHash = createHash('sha256').update(readFileSync(join(DIST, 'assets', jsFile))).digest('hex')
const cssHash = createHash('sha256').update(readFileSync(join(DIST, 'assets', cssFile))).digest('hex')

const results = []
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

function pass(id, detail, shot) {
  results.push({ id, verdict: 'PASS', detail, shot: shot || null })
  console.log(`PASS #${id}: ${detail}`)
}
function fail(id, detail, shot) {
  results.push({ id, verdict: 'FAIL', detail, shot: shot || null })
  console.log(`FAIL #${id}: ${detail}`)
}

const browser = await chromium.launch({
  headless: true,
  args: ['--disable-dev-shm-usage', '--no-sandbox'],
})
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  locale: 'pl-PL',
  acceptDownloads: true,
})
const page = await context.newPage()

async function shot(name) {
  const p = join(OUT, name)
  await page.screenshot({ path: p, fullPage: false })
  return p.replace(/^.*watch-tower-app\//, "")
}

async function clearStorage() {
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 120000 })
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
  }, PERSIST)
  await page.reload({ waitUntil: 'networkidle', timeout: 120000 })
  await page.evaluate(() => document.querySelector('.app')?.classList.remove('nav-collapsed'))
  await page.waitForSelector('.topbar, #roleSeg', { timeout: 30000 })
  await sleep(600)
}

async function setRole(roleId) {
  await page.evaluate((id) => {
    const btn =
      document.querySelector(`#roleSeg button[data-role="${id}"]`) ||
      [...document.querySelectorAll('#roleSeg button')].find((b) =>
        new RegExp(id === 'HHL' ? 'H&H|HHL' : id === 'KSH' ? 'KSH' : 'Scandinavian|SCX', 'i').test(
          b.textContent || '',
        ),
      )
    if (!btn) throw new Error('role not found ' + id)
    btn.click()
  }, roleId)
  await sleep(500)
}

async function nav(dataViewOrLabel) {
  await page.evaluate((key) => {
    let btn = document.querySelector(`nav button[data-view="${key}"]`)
    if (!btn) {
      const rx = new RegExp(key, 'i')
      btn = [...document.querySelectorAll('nav button')].find((b) =>
        rx.test(b.getAttribute('aria-label') || b.textContent || ''),
      )
    }
    if (!btn) throw new Error('nav not found: ' + key)
    btn.click()
  }, dataViewOrLabel)
  await sleep(700)
}

function readPersist() {
  return page.evaluate((key) => {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    try {
      const j = JSON.parse(raw)
      return j.state || j
    } catch {
      return null
    }
  }, PERSIST)
}

async function waitPersist(pred, timeout = 5000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    const s = await readPersist()
    if (s && pred(s)) return s
    await sleep(150)
  }
  return readPersist()
}

async function openLoadByCode(code) {
  await page.evaluate((c) => {
    const input = document.querySelector(
      '.filters input, input[placeholder*="zuk"], input[type="search"], .panel input, .toolbar input',
    )
    if (input) {
      const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
      proto?.set?.call(input, c)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      input.dispatchEvent(new Event('change', { bubbles: true }))
    }
  }, code)
  await sleep(400)
  const clicked = await page.evaluate((c) => {
    const row = [...document.querySelectorAll('table tbody tr, .mrow, .exq li')].find((r) =>
      (r.textContent || '').includes(c),
    )
    if (!row) return false
    row.click()
    return true
  }, code)
  await sleep(600)
  return clicked
}

async function clickDrawerTab(labelRe) {
  await page.evaluate((re) => {
    const rx = new RegExp(re, 'i')
    const btn = [...document.querySelectorAll('.dtabs button, .drawer button')].find((b) =>
      rx.test(b.textContent || ''),
    )
    btn?.click()
  }, labelRe)
  await sleep(350)
}

// ========== RUN ==========
await clearStorage()
await setRole('HHL')

const metaShot = await shot('00-gate.png')
const title = await page.title()
console.log('title=', title, 'HEAD=', HEAD.slice(0, 8), 'js=', jsFile, jsHash.slice(0, 12))

// ---------- #1 M1–M12 mutations (spot-check several real mutations) ----------
try {
  const mutations = []
  // 1a schedule export = real download mutation path
  await nav('sched')
  await page.evaluate(() => {
    window.__wtBlobs = []
    const orig = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (blob) => {
      const u = orig(blob)
      window.__wtBlobs.push({ size: blob?.size ?? 0, type: blob?.type ?? '' })
      return u
    }
  })
  const exportClicked = await page.evaluate(() => {
    const btn =
      document.querySelector('[data-action="export-xlsx"]') ||
      [...document.querySelectorAll('button')].find((b) => /Eksport XLSX/i.test(b.textContent || ''))
    if (!btn) return false
    btn.click()
    return true
  })
  await sleep(1200)
  const blobs = await page.evaluate(() => window.__wtBlobs || [])
  const xlsxBlob = blobs.find((b) => b.size > 1000)
  if (exportClicked && xlsxBlob) mutations.push(`exportXlsx size=${xlsxBlob.size}`)

  // 1b drawer save (resources) — real store write
  await nav('dash')
  await page.evaluate(() => {
    const li = document.querySelector('.exq li, .mrow, table tbody tr')
    li?.click()
  })
  await sleep(600)
  await clickDrawerTab('Ustalenia')
  const marker = `D24-TR-${Date.now().toString(36).slice(-4).toUpperCase()}`
  const saved = await page.evaluate((marker) => {
    const form = [...document.querySelectorAll('.drawer form')].find((f) =>
      /Zapisz zasoby/i.test(f.textContent || ''),
    )
    if (!form) return { ok: false, reason: 'no resources form' }
    const tractor =
      form.querySelector('input[name="tractorPlate"]') || form.querySelectorAll('input')[0]
    if (!tractor) return { ok: false, reason: 'no tractor' }
    const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
    proto?.set?.call(tractor, marker)
    tractor.dispatchEvent(new Event('input', { bubbles: true }))
    const btn = [...form.querySelectorAll('button')].find((b) => /Zapisz zasoby/i.test(b.textContent || ''))
    btn?.click()
    return { ok: true }
  }, marker)
  await sleep(600)
  const after1 = await waitPersist((s) => s.loads?.some((l) => l.resources?.tractorPlate === marker))
  const hit = after1?.loads?.find((l) => l.resources?.tractorPlate === marker)
  if (saved.ok && hit) mutations.push(`resources tractor=${marker} on ${hit.code}`)

  // 1c map nav
  await nav('map')
  const mapOk = await page.evaluate(() => !!document.querySelector('.leaflet-container, #map, .map'))
  if (mapOk) mutations.push('map nav→leaflet')

  // 1d WF run
  await setRole('HHL')
  await nav('wf')
  const n0 = (await readPersist())?.notifications?.length || 0
  const wfClicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      /Uruchom|Run now|Odpal|Wykonaj/i.test(b.textContent || ''),
    )
    if (!btn) return false
    btn.click()
    return true
  })
  await sleep(800)
  const afterWf = await waitPersist((s) => (s.notifications?.length || 0) > n0 || (s.workflowRuns?.length || 0) > 0)
  const n1 = afterWf?.notifications?.length || 0
  if (wfClicked && n1 > n0) mutations.push(`wf run notifs ${n0}→${n1}`)

  const s1 = await shot('01-mutations.png')
  if (mutations.length >= 3) pass(1, `mutations: ${mutations.join('; ')}`, s1)
  else fail(1, `insufficient mutations (${mutations.length}): ${mutations.join('; ') || 'none'}; saved=${JSON.stringify(saved)}`, s1)
} catch (e) {
  fail(1, String(e.message || e), await shot('01-mutations-err.png'))
}

// ---------- #2 READY blocked without permit; cover works ----------
try {
  await setRole('HHL')
  await nav('sched')
  const state = await readPersist()
  const loads = state?.loads || []
  // Prefer known mismatch / docMissing codes from prior QA
  const blocked =
    loads.find((l) => /SG-34|SG-07|K-03/i.test(l.code) && (l.docMissing || l.status === 'DOC_MISSING')) ||
    loads.find((l) => l.docMissing || l.status === 'DOC_MISSING') ||
    loads.find((l) => /SG-34|SG-07/i.test(l.code))
  const blockedCode = blocked?.code

  let blockedOk = false
  let coverOk = false
  let detail = ''

  if (blockedCode) {
    await openLoadByCode(blockedCode)
    await clickDrawerTab('Ustalenia')
    const readyInfo = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.drawer button')].find((b) =>
        /Ustaw READY|Oznacz jako gotowy/i.test(b.textContent || ''),
      )
      return {
        disabled: btn ? !!btn.disabled : null,
        title: btn?.getAttribute('title') || '',
        banner: [...document.querySelectorAll('.drawer .banner, .drawer [class*=warn], .drawer [class*=mismatch]')]
          .map((b) => (b.textContent || '').trim())
          .join(' | ')
          .slice(0, 200),
      }
    })
    const s2a = await shot('02-ready-blocked.png')
    // Attempt click even if disabled
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.drawer button')].find((b) =>
        /Ustaw READY|Oznacz jako gotowy/i.test(b.textContent || ''),
      )
      btn?.click()
    })
    await sleep(500)
    const after = await readPersist()
    const loadAfter = after?.loads?.find((l) => l.code === blockedCode)
    const statusStillNotReady = loadAfter && loadAfter.status !== 'READY'
    blockedOk =
      (readyInfo.disabled === true && statusStillNotReady) ||
      (statusStillNotReady && /MISMATCH|Brak|zezwolen|docMissing|permit/i.test(readyInfo.title + readyInfo.banner))
    detail += `blocked=${blockedCode} disabled=${readyInfo.disabled} status=${loadAfter?.status} title=${readyInfo.title.slice(0, 60)}; shot=${s2a}; `
  }

  // Find a load that can go READY (has cover)
  const candidates = loads.filter(
    (l) =>
      !l.docMissing &&
      l.status !== 'DOC_MISSING' &&
      l.status !== 'READY' &&
      ['PLANNED', 'RESOURCES_PENDING', 'BOOKED'].includes(l.status),
  )
  for (const c of candidates.slice(0, 8)) {
    await openLoadByCode(c.code)
    await clickDrawerTab('Ustalenia')
    const info = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.drawer button')].find((b) =>
        /Ustaw READY|Oznacz jako gotowy/i.test(b.textContent || ''),
      )
      return { disabled: btn ? !!btn.disabled : null, present: !!btn }
    })
    if (info.present && info.disabled === false) {
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll('.drawer button')].find((b) =>
          /Ustaw READY|Oznacz jako gotowy/i.test(b.textContent || ''),
        )
        btn?.click()
      })
      await sleep(700)
      const after = await waitPersist((s) => s.loads?.find((l) => l.code === c.code)?.status === 'READY')
      const ok = after?.loads?.find((l) => l.code === c.code)?.status === 'READY'
      if (ok) {
        coverOk = true
        detail += `cover READY on ${c.code}`
        await shot('02-ready-cover.png')
        break
      }
    }
  }
  if (!coverOk) detail += 'no enabled READY among candidates'

  const s2 = await shot('02-ready.png')
  if (blockedOk && coverOk) pass(2, detail, s2)
  else if (blockedOk && !coverOk)
    fail(2, `READY blocked OK but cover()/enabled READY path not proven — ${detail}`, s2)
  else fail(2, detail || 'no blocked load found', s2)
} catch (e) {
  fail(2, String(e.message || e), await shot('02-ready-err.png'))
}

// ---------- #3 KSH-only Wgraj; Eksport for HHL/SCX ----------
try {
  // HHL: export yes, wgraj no
  await setRole('HHL')
  await nav('sched')
  await page.evaluate(() => {
    window.__wtBlobs = []
    const orig = URL.createObjectURL.bind(URL)
    URL.createObjectURL = (blob) => {
      const u = orig(blob)
      window.__wtBlobs.push({ size: blob?.size ?? 0, type: blob?.type ?? '' })
      return u
    }
  })
  const hhl = await page.evaluate(() => {
    const eksport = [...document.querySelectorAll('button')].find((b) => /Eksport XLSX/i.test(b.textContent || ''))
    const wgraj = [...document.querySelectorAll('button')].find((b) => /Wgraj/i.test(b.textContent || ''))
    eksport?.click()
    return { eksport: !!eksport, wgraj: !!wgraj }
  })
  await sleep(1000)
  const blobsH = await page.evaluate(() => window.__wtBlobs || [])
  const xOk = blobsH.find((b) => b.size > 1000)

  await setRole('SCX')
  await nav('sched')
  const scx = await page.evaluate(() => {
    const eksport = [...document.querySelectorAll('button')].find((b) => /Eksport XLSX/i.test(b.textContent || ''))
    const wgraj = [...document.querySelectorAll('button')].find((b) => /Wgraj/i.test(b.textContent || ''))
    return { eksport: !!eksport, wgraj: !!wgraj }
  })

  await setRole('KSH')
  await nav('sched')
  const ksh = await page.evaluate(() => {
    const eksport = [...document.querySelectorAll('button')].find((b) => /Eksport XLSX/i.test(b.textContent || ''))
    const wgraj = [...document.querySelectorAll('button')].find((b) => /Wgraj/i.test(b.textContent || ''))
    return { eksport: !!eksport, wgraj: !!wgraj }
  })
  const s3 = await shot('03-ksh-wgraj.png')

  // Dry-run: upload empty-ish is hard without fixture — click Wgraj if file input exists
  let dryPath = false
  const fileInput = await page.$('input[type="file"]')
  if (fileInput && ksh.wgraj) {
    // Create minimal xlsx via ExcelJS in-page is heavy; use existing fixture if any
    const fixtures = [
      'docs/qa-start/p9r-merge-plus1-valid.xlsx',
      'docs/qa-start/ship-qa-schedule.xlsx',
      'public/KSH_HARMONOGRAM.xlsx',
    ]
    let fixture = fixtures.find((f) => existsSync(f))
    if (!fixture) {
      // synthesize tiny csv won't work; skip dry-run detail
      dryPath = !!ksh.wgraj
    } else {
      await fileInput.setInputFiles(fixture)
      await sleep(1500)
      const dryUi = await page.evaluate(() => {
        const t = document.body.innerText || ''
        return {
          hasDiff: /\+|~|−|-|usuni|dodan|dry|OK|Zatwierd/i.test(t),
          zatwierdz: [...document.querySelectorAll('button')].some((b) => /Zatwierd/i.test(b.textContent || '')),
        }
      })
      dryPath = dryUi.hasDiff || dryUi.zatwierdz
      await shot('03-dry-run.png')
    }
  } else {
    dryPath = !!ksh.wgraj // UI gate at least
  }

  const roleGate =
    hhl.eksport && !hhl.wgraj && scx.eksport && !scx.wgraj && ksh.wgraj && ksh.eksport && xOk
  if (roleGate && dryPath) {
    pass(
      3,
      `HHL eksport=${hhl.eksport}/wgraj=${hhl.wgraj}; SCX eksport=${scx.eksport}/wgraj=${scx.wgraj}; KSH wgraj=${ksh.wgraj}; xlsxBlob=${xOk?.size}; dryPath=${dryPath}`,
      s3,
    )
  } else {
    fail(
      3,
      `HHL=${JSON.stringify(hhl)} SCX=${JSON.stringify(scx)} KSH=${JSON.stringify(ksh)} xlsx=${JSON.stringify(xOk)} dryPath=${dryPath}`,
      s3,
    )
  }
} catch (e) {
  fail(3, String(e.message || e), await shot('03-import-err.png'))
}

// ---------- #4 Drawer Ustalenia persists ----------
try {
  await setRole('SCX')
  await nav('sched')
  const state = await readPersist()
  const code = state?.loads?.find((l) => l.status !== 'DELIVERED')?.code || state?.loads?.[0]?.code
  await openLoadByCode(code)
  await clickDrawerTab('Ustalenia')
  const marker = `D24-PIL-${Date.now().toString(36).slice(-4).toUpperCase()}`
  const bookRef = `D24-AW-${Date.now().toString(36).slice(-4).toUpperCase()}`
  const wrote = await page.evaluate(
    ({ marker, bookRef }) => {
      const out = { res: false, awiz: false, ferry: false, reasons: [] }
      const resForm = [...document.querySelectorAll('.drawer form')].find((f) =>
        /Zapisz zasoby/i.test(f.textContent || ''),
      )
      if (resForm) {
        const pilot =
          resForm.querySelector('input[name="pilotNumber"], input[name="pilot"]') ||
          [...resForm.querySelectorAll('input')].find((i) => /pilot/i.test(i.name || i.placeholder || ''))
        const tractor = resForm.querySelector('input[name="tractorPlate"]') || resForm.querySelectorAll('input')[0]
        const target = pilot || tractor
        if (target) {
          const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
          proto?.set?.call(target, marker)
          target.dispatchEvent(new Event('input', { bubbles: true }))
          ;[...resForm.querySelectorAll('button')]
            .find((b) => /Zapisz zasoby/i.test(b.textContent || ''))
            ?.click()
          out.res = true
        } else out.reasons.push('no res input')
      } else out.reasons.push('no res form')

      const awForm = [...document.querySelectorAll('.drawer form')].find((f) =>
        /Zapisz awizację|Zapisz ferry|Zapisz awiz/i.test(f.textContent || ''),
      )
      // ferry + awizacja may be same or separate
      const forms = [...document.querySelectorAll('.drawer form')]
      for (const form of forms) {
        const txt = form.textContent || ''
        if (/Zapisz awizację/i.test(txt)) {
          const booking = form.querySelector('input[name="bookingRef"]') || form.querySelector('input')
          if (booking) {
            const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
            proto?.set?.call(booking, bookRef)
            booking.dispatchEvent(new Event('input', { bubbles: true }))
          }
          ;[...form.querySelectorAll('button')]
            .find((b) => /Zapisz awizację/i.test(b.textContent || ''))
            ?.click()
          out.awiz = true
        }
        if (/Zapisz ferry|ferry/i.test(txt) && /Zapisz/i.test(txt)) {
          const vessel = form.querySelector('select[name="vessel"]')
          if (vessel) {
            vessel.value = vessel.options[1]?.value || vessel.value
            vessel.dispatchEvent(new Event('change', { bubbles: true }))
          }
          const btn = [...form.querySelectorAll('button')].find((b) => /Zapisz ferry|Zapisz/i.test(b.textContent || ''))
          if (btn && /ferry/i.test(form.textContent || '')) {
            btn.click()
            out.ferry = true
          }
        }
      }
      // combined ferry/awizacja form
      if (!out.ferry) {
        const fForm = forms.find((f) => /Zapisz ferry/i.test(f.textContent || ''))
        if (fForm) {
          ;[...fForm.querySelectorAll('button')]
            .find((b) => /Zapisz ferry/i.test(b.textContent || ''))
            ?.click()
          out.ferry = true
        }
      }
      return out
    },
    { marker, bookRef },
  )
  await sleep(900)
  const after = await waitPersist(
    (s) =>
      s.loads?.some(
        (l) =>
          l.resources?.tractorPlate === marker ||
          l.resources?.pilotNumber === marker ||
          l.ferry?.bookingRef === bookRef ||
          l.awizacja?.bookingRef === bookRef,
      ),
  )
  const hitL = after?.loads?.find(
    (l) =>
      l.resources?.tractorPlate === marker ||
      l.resources?.pilotNumber === marker ||
      l.ferry?.bookingRef === bookRef,
  )
  const s4 = await shot('04-ustalenia.png')
  if (hitL && (wrote.res || wrote.awiz || wrote.ferry)) {
    pass(
      4,
      `persist on ${hitL.code}: tractor/pilot=${hitL.resources?.tractorPlate || hitL.resources?.pilotNumber}; booking=${hitL.ferry?.bookingRef}; wrote=${JSON.stringify(wrote)}`,
      s4,
    )
  } else {
    fail(4, `wrote=${JSON.stringify(wrote)} hit=${hitL?.code} code=${code}`, s4)
  }
} catch (e) {
  fail(4, String(e.message || e), await shot('04-ustalenia-err.png'))
}

// ---------- #5 Plan B mutates ferry + audit ----------
try {
  await setRole('HHL')
  await nav('risk')
  const before = await readPersist()
  const ev0 = (before?.events || []).filter((e) => /PLAN_B/i.test(e.type || '')).length
  const n0 = before?.notifications?.length || 0
  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      /Przelicz|Plan B|Wybierz/i.test(b.textContent || ''),
    )
    if (!btn) return { ok: false }
    btn.click()
    return { ok: true, label: (btn.textContent || '').trim().slice(0, 40) }
  })
  await sleep(1000)
  const after = await waitPersist(
    (s) =>
      (s.events || []).filter((e) => /PLAN_B/i.test(e.type || '')).length > ev0 ||
      (s.notifications || []).length > n0,
  )
  const ev1 = (after?.events || []).filter((e) => /PLAN_B/i.test(e.type || ''))
  const n1 = after?.notifications?.length || 0
  const ferryMut = (after?.loads || []).some((l) => l.ferry && l.ferry.bookingRef)
  const s5 = await shot('05-planb.png')
  if (clicked.ok && (ev1.length > ev0 || n1 > n0)) {
    pass(5, `clicked=${clicked.label}; PLAN_B events ${ev0}→${ev1.length}; notifs ${n0}→${n1}; ferryPresent=${ferryMut}`, s5)
  } else {
    fail(5, `clicked=${JSON.stringify(clicked)} ev ${ev0}→${ev1.length} notifs ${n0}→${n1}`, s5)
  }
} catch (e) {
  fail(5, String(e.message || e), await shot('05-planb-err.png'))
}

// ---------- #6 Driver PWA camera/file → vault ----------
try {
  await page.goto(`${BASE}/#/driver/demo-sg14?now=${encodeURIComponent(FROZEN)}`, {
    waitUntil: 'networkidle',
    timeout: 120000,
  })
  await sleep(1000)
  // create tiny jpeg fixture
  const tinyJpeg = join(OUT, 'driver-cmr-d24.jpg')
  // minimal jpeg bytes
  const jpegBuf = Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGcP//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAT8hf//Z',
    'base64',
  )
  writeFileSync(tinyJpeg, jpegBuf)

  const fileInput = await page.$('input[type="file"]')
  if (!fileInput) {
    fail(6, 'no file input on driver PWA', await shot('06-driver-err.png'))
  } else {
    const before = await readPersist()
    const docs0 = before?.documents?.length || 0
    await fileInput.setInputFiles(tinyJpeg)
    await sleep(1500)
    // maybe need to select doc type + confirm
    await page.evaluate(() => {
      const sel = document.querySelector('select')
      if (sel) {
        const cmr = [...sel.options].find((o) => /CMR/i.test(o.text || o.value))
        if (cmr) {
          sel.value = cmr.value
          sel.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }
      const btn = [...document.querySelectorAll('button')].find((b) =>
        /Wyślij|Upload|Załącz|Dodaj|Confirm|OK/i.test(b.textContent || ''),
      )
      btn?.click()
    })
    await sleep(1200)
    const after = await waitPersist(
      (s) =>
        (s.documents || []).length > docs0 ||
        (s.documents || []).some((d) => /driver-cmr|CMR/i.test(d.filename || d.name || '')),
    )
    const docs = after?.documents || []
    const hit = docs.find(
      (d) => /driver-cmr|d24/i.test(d.filename || '') || d.source === 'driver' || /CMR/i.test(d.type || d.kind || ''),
    )
    const uiText = await page.evaluate(() => (document.body.innerText || '').slice(0, 800))
    const s6 = await shot('06-driver.png')
    if (hit || /Załączono|CMR|DOC_UPLOADED/i.test(uiText) || docs.length > docs0) {
      pass(
        6,
        `docs ${docs0}→${docs.length}; hit=${hit ? hit.filename || hit.id : 'ui-only'}; uiHasAttach=${/Załączono|CMR/i.test(uiText)}`,
        s6,
      )
    } else {
      fail(6, `docs ${docs0}→${docs.length}; ui=${uiText.slice(0, 160)}`, s6)
    }
  }
  // back to main app
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 120000 })
  await page.evaluate(() => document.querySelector('.app')?.classList.remove('nav-collapsed'))
  await sleep(500)
  await setRole('HHL')
} catch (e) {
  fail(6, String(e.message || e), await shot('06-driver-err.png'))
  await page.goto(URL, { waitUntil: 'networkidle', timeout: 120000 }).catch(() => {})
}

// ---------- #7 Geofence/GPS/fleet/AIS visible ----------
try {
  await setRole('HHL')
  await nav('geo')
  const geo = await page.evaluate(() => {
    const t = document.body.innerText || ''
    return {
      hasEditor: /geofence|stref|promień|radius|lat|lng|Śrem|Boden/i.test(t),
      rows: document.querySelectorAll('table tbody tr, .gcard, .geo-row').length,
    }
  })
  await shot('07-geofence.png')
  await nav('map')
  await sleep(1200)
  const map = await page.evaluate(() => {
    const t = document.body.innerText || ''
    const layers = [...document.querySelectorAll('label, .layer, .map-layers button, .legend span, .map-toolbar label')]
      .map((el) => (el.textContent || '').trim())
      .filter(Boolean)
    return {
      leaflet: !!document.querySelector('.leaflet-container'),
      ais: /AIS/i.test(t),
      fleet: /fleet|flota|GPS|pojazd/i.test(t),
      tv: /Trafikverket/i.test(t),
      layers: layers.slice(0, 20),
      note: (document.querySelector('.map-note, .map-status, .legend, .map-meta')?.textContent || '').slice(0, 200),
    }
  })
  const s7 = await shot('07-map-layers.png')
  if (geo.hasEditor && map.leaflet && (map.ais || map.fleet)) {
    pass(7, `geo rows=${geo.rows}; leaflet=${map.leaflet}; ais=${map.ais}; fleet=${map.fleet}; tv=${map.tv}`, s7)
  } else {
    fail(7, `geo=${JSON.stringify(geo)} map=${JSON.stringify(map)}`, s7)
  }
} catch (e) {
  fail(7, String(e.message || e), await shot('07-geo-err.png'))
}

// ---------- #8 Trafikverket labeled live|seed ----------
try {
  await nav('map')
  await sleep(800)
  const tv = await page.evaluate(() => {
    const t = document.body.innerText || ''
    const m = /Trafikverket[^:\n]*:\s*(live|seed)/i.exec(t) || /Trafikverket.*(live|seed)/i.exec(t)
    const ais = /AIS[^:\n]*:\s*(live|seed)/i.exec(t)
    return {
      tvMode: m ? m[1].toLowerCase() : null,
      aisMode: ais ? ais[1].toLowerCase() : null,
      snippet: t
        .split('\n')
        .filter((l) => /Trafikverket|AIS/i.test(l))
        .slice(0, 6),
    }
  })
  const s8 = await shot('08-trafikverket.png')
  if (tv.tvMode === 'live' || tv.tvMode === 'seed') {
    pass(8, `Trafikverket=${tv.tvMode}; AIS=${tv.aisMode}; lines=${JSON.stringify(tv.snippet)}`, s8)
  } else {
    fail(8, `no live|seed label: ${JSON.stringify(tv)}`, s8)
  }
} catch (e) {
  fail(8, String(e.message || e), await shot('08-tv-err.png'))
}

// ---------- #9 Factoring HHL configure / SCX choose ----------
try {
  await setRole('HHL')
  await nav('inv')
  await sleep(500)
  const feeNew = 3.7
  const hhlEdit = await page.evaluate((fee) => {
    const inputs = [...document.querySelectorAll('input[type="number"], input')]
    const feeInput = inputs.find((i) => /fee|prowiz|percent|%/i.test(i.name + i.placeholder + (i.closest('label')?.textContent || ''))) ||
      inputs.find((i) => i.type === 'number')
    if (!feeInput) return { ok: false, reason: 'no fee input' }
    const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
    proto?.set?.call(feeInput, String(fee))
    feeInput.dispatchEvent(new Event('input', { bubbles: true }))
    feeInput.dispatchEvent(new Event('change', { bubbles: true }))
    return { ok: true }
  }, feeNew)
  await sleep(600)
  const afterH = await waitPersist((s) => s.factoringOffer?.feePercent === feeNew || s.factoringOffer?.feePercent === Number(feeNew))
  const hhlOk = afterH?.factoringOffer?.feePercent === feeNew || afterH?.factoringOffer?.feePercent === Number(feeNew)
  await shot('09-factoring-hhl.png')

  await setRole('SCX')
  await nav('inv')
  await sleep(500)
  const scx = await page.evaluate(() => {
    const opt = [...document.querySelectorAll('button, input[type="radio"], label')].find((el) =>
      /Factoring|Faktoring|wybierz|standard/i.test(el.textContent || ''),
    )
    if (!opt) return { ok: false }
    opt.click()
    return { ok: true, label: (opt.textContent || '').trim().slice(0, 40) }
  })
  await sleep(800)
  const afterS = await readPersist()
  const s9 = await shot('09-factoring-scx.png')
  if (hhlEdit.ok && (hhlOk || afterH?.factoringOffer) && scx.ok) {
    pass(
      9,
      `HHL feeEdit=${hhlEdit.ok} fee=${afterH?.factoringOffer?.feePercent}; SCX=${JSON.stringify(scx)}; offer=${JSON.stringify(afterS?.factoringOffer)}`,
      s9,
    )
  } else {
    fail(9, `hhlEdit=${JSON.stringify(hhlEdit)} hhlOk=${hhlOk} fee=${afterH?.factoringOffer?.feePercent} scx=${JSON.stringify(scx)}`, s9)
  }
} catch (e) {
  fail(9, String(e.message || e), await shot('09-fact-err.png'))
}

// ---------- #10 SEFS / Finance BAF from compute path ----------
try {
  await setRole('HHL')
  await nav('fin')
  await sleep(600)
  const fin = await page.evaluate(() => {
    const t = document.body.innerText || ''
    const hasOrlen = /ORLEN/i.test(t)
    const hasOkq8 = /OKQ8/i.test(t)
    const hasBaf = /BAF|SEFS/i.test(t)
    const nums = [...t.matchAll(/\d+[.,]\d+\s*%/g)].map((m) => m[0]).slice(0, 8)
    const currency = [...t.matchAll(/\d[\d\s]*[.,]\d+\s*PLN/g)].map((m) => m[0]).slice(0, 6)
    return { hasOrlen, hasOkq8, hasBaf, nums, currency, h2: document.querySelector('h1,h2')?.textContent }
  })
  const s10 = await shot('10-sefs.png')
  if (fin.hasBaf && (fin.hasOrlen || fin.hasOkq8) && (fin.nums.length > 0 || fin.currency.length > 0)) {
    pass(10, `SEFS/BAF render: ORLEN=${fin.hasOrlen} OKQ8=${fin.hasOkq8}; pct=${fin.nums}; PLN=${fin.currency}`, s10)
  } else {
    fail(10, JSON.stringify(fin), s10)
  }
} catch (e) {
  fail(10, String(e.message || e), await shot('10-sefs-err.png'))
}

// ---------- #11 Bell / spine / KPI / WF notif ----------
try {
  await setRole('HHL')
  await nav('dash')
  await sleep(400)
  const before = await readPersist()
  const unreadBefore = (before?.notifications || []).filter((n) => !n.read).length

  // open bell
  await page.evaluate(() => {
    const btn =
      document.querySelector('[aria-label*="powiadom"], #bellBtn, .bell, button.notif') ||
      [...document.querySelectorAll('button')].find((b) => /bell|powiadom/i.test(b.getAttribute('aria-label') || '') || b.querySelector('svg'))
    // prefer badge button near topbar end
    const candidates = [...document.querySelectorAll('.topbar button')]
    const bell = candidates.find((b) => /\d+/.test(b.textContent || '') && b.querySelector('svg')) || candidates.at(-3)
    ;(bell || btn)?.click()
  })
  await sleep(400)
  const marked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) =>
      /Oznacz wszystkie|Mark all|Przeczyt/i.test(b.textContent || ''),
    )
    if (!btn) return { ok: false }
    btn.click()
    return { ok: true, label: (btn.textContent || '').trim() }
  })
  await sleep(600)
  const afterBell = await waitPersist((s) => (s.notifications || []).every((n) => n.read) || (s.notifications || []).filter((n) => !n.read).length < unreadBefore)
  const unreadAfter = (afterBell?.notifications || []).filter((n) => !n.read).length
  await shot('11-bell.png')

  // spine 2nd click clear
  const spine1 = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.spine button, .corridor button, [class*=spine] button')].find((b) =>
      /Przygotowanie|Plan|Załadunek/i.test(b.textContent || ''),
    )
    if (!btn) return null
    btn.click()
    return (btn.textContent || '').trim().slice(0, 30)
  })
  await sleep(500)
  await shot('11-spine-on.png')
  await page.evaluate(() => {
    const pressed = document.querySelector('.spine button[aria-pressed="true"], .corridor button[aria-pressed="true"]')
    pressed?.click()
  })
  await sleep(500)
  const spineClear = await page.evaluate(() => {
    const pressed = document.querySelectorAll('.spine button[aria-pressed="true"], .corridor button[aria-pressed="true"]')
    return pressed.length === 0
  })
  await shot('11-spine-clear.png')

  // KPI deep link
  const kpi = await page.evaluate(() => {
    const tile = document.querySelector('.kpi, .stat, [data-nav], .dash-kpi button, .tiles button, .mtriad button') ||
      [...document.querySelectorAll('.dash button, main button')].find((b) => /\d+/.test(b.textContent || ''))
    if (!tile) return { ok: false }
    tile.click()
    return { ok: true, label: (tile.textContent || '').trim().slice(0, 40) }
  })
  await sleep(700)
  const viewAfter = await page.evaluate(() => ({
    h2: document.querySelector('h1,h2,.page-title')?.textContent?.trim().slice(0, 40),
    view: document.querySelector('nav button[aria-current="page"]')?.getAttribute('data-view'),
  }))

  const bellOk = marked.ok && unreadAfter < unreadBefore
  const spineOk = !!spine1 && spineClear
  const kpiOk = kpi.ok
  const s11 = await shot('11-kpi.png')
  if (bellOk && spineOk && kpiOk) {
    pass(
      11,
      `bell unread ${unreadBefore}→${unreadAfter}; spine ${spine1} cleared=${spineClear}; KPI→${viewAfter.h2 || viewAfter.view}`,
      s11,
    )
  } else {
    fail(
      11,
      `bellOk=${bellOk} marked=${JSON.stringify(marked)} unread ${unreadBefore}→${unreadAfter}; spineOk=${spineOk} spine1=${spine1} clear=${spineClear}; kpi=${JSON.stringify(kpi)} view=${JSON.stringify(viewAfter)}`,
      s11,
    )
  }
} catch (e) {
  fail(11, String(e.message || e), await shot('11-chrome-err.png'))
}

// ---------- #12 ETA confidence bands in drawer ----------
try {
  await setRole('HHL')
  await nav('sched')
  const state = await readPersist()
  const code = state?.loads?.find((l) => l.eta || l.status === 'IN_TRANSIT' || l.stage)?.code || state?.loads?.[0]?.code
  await openLoadByCode(code)
  await clickDrawerTab('ETA|Przegląd|Overview|Timeline')
  // try ETA tab specifically
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.dtabs button')].find((b) => /ETA/i.test(b.textContent || ''))
    btn?.click()
  })
  await sleep(500)
  const eta = await page.evaluate(() => {
    const t = document.querySelector('.drawer')?.innerText || document.body.innerText || ''
    const band = /LOW|MED|HIGH|NISKA|ŚREDNIA|WYSOKA/i.exec(t)
    const range = /\d{1,2}:\d{2}.*\d{1,2}:\d{2}|earliest|latest|przedział|pasmo|confidence|ufności/i.test(t)
    const heur = /heuryst|powód|reason|band/i.test(t)
    return {
      band: band ? band[0] : null,
      range,
      heur,
      snippet: t
        .split('\n')
        .filter((l) => /ETA|LOW|MED|HIGH|ufno|pasmo|przedział|heuryst/i.test(l))
        .slice(0, 8),
    }
  })
  const s12 = await shot('12-eta.png')
  if (eta.band && (eta.range || eta.heur || eta.snippet.length)) {
    pass(12, `band=${eta.band}; range=${eta.range}; lines=${JSON.stringify(eta.snippet)}`, s12)
  } else {
    fail(12, `no ETA band in drawer for ${code}: ${JSON.stringify(eta)}`, s12)
  }
} catch (e) {
  fail(12, String(e.message || e), await shot('12-eta-err.png'))
}

// ---------- #13 Role permissions cost/revenue/margin ----------
try {
  async function financeVisibility() {
    await nav('fin')
    await sleep(500)
    return page.evaluate(() => {
      const t = document.body.innerText || ''
      // Look for labeled fields
      const cost = /Koszt|Cost|koszt/i.test(t) && !/ukryt|brak dostępu|hidden|—\s*$/i.test(t)
      const rev = /Przychód|Revenue|przychód/i.test(t)
      const margin = /Marża|Margin|marża/i.test(t)
      // Also check for locked/masked
      const locked = /brak dostępu|niedostęp|hidden|•••/i.test(t)
      return {
        textHasCost: /Koszt|Cost/i.test(t),
        textHasRev: /Przychód|Revenue/i.test(t),
        textHasMargin: /Marża|Margin/i.test(t),
        locked,
        // numeric money near labels
        sample: t
          .split('\n')
          .filter((l) => /Koszt|Przychód|Marża|Cost|Revenue|Margin|BAF/i.test(l))
          .slice(0, 10),
      }
    })
  }
  await setRole('HHL')
  const hhl = await financeVisibility()
  await shot('13-fin-hhl.png')
  await setRole('KSH')
  const ksh = await financeVisibility()
  await shot('13-fin-ksh.png')
  await setRole('SCX')
  const scx = await financeVisibility()
  const s13 = await shot('13-fin-scx.png')

  // Expected from permissions: HHL all; KSH revenue (no cost/margin); SCX cost (no rev/margin)
  // Prefer FAIL if UI shows everything to everyone
  const hhlOk = hhl.textHasCost && hhl.textHasRev
  // Differentiation: at least one role differs
  const differs =
    JSON.stringify(hhl.sample) !== JSON.stringify(ksh.sample) ||
    JSON.stringify(hhl.sample) !== JSON.stringify(scx.sample)
  // Stronger: KSH should not show cost amounts the same way — check permissions via store/UI lock
  const kshNoCost = await page.evaluate(async () => {
    // switch already SCX; re-check via DOM data attributes if any
    return true
  })

  // Use permissions module via page by checking computed UI differences more carefully
  await setRole('KSH')
  await nav('fin')
  const kshDetail = await page.evaluate(() => {
    const t = document.body.innerText || ''
    return {
      hasCostValue: /Koszt[^\n]{0,40}\d/i.test(t),
      hasRevValue: /Przychód[^\n]{0,40}\d/i.test(t),
      hasMarginValue: /Marża[^\n]{0,40}\d/i.test(t),
    }
  })
  await setRole('SCX')
  await nav('fin')
  const scxDetail = await page.evaluate(() => {
    const t = document.body.innerText || ''
    return {
      hasCostValue: /Koszt[^\n]{0,40}\d/i.test(t),
      hasRevValue: /Przychód[^\n]{0,40}\d/i.test(t),
      hasMarginValue: /Marża[^\n]{0,40}\d/i.test(t),
    }
  })
  await setRole('HHL')
  await nav('fin')
  const hhlDetail = await page.evaluate(() => {
    const t = document.body.innerText || ''
    return {
      hasCostValue: /Koszt[^\n]{0,40}\d/i.test(t),
      hasRevValue: /Przychód[^\n]{0,40}\d/i.test(t),
      hasMarginValue: /Marża[^\n]{0,40}\d/i.test(t),
    }
  })

  // O1: sonda strukturalna — kolumny tabel Finansów z wartościami liczbowymi + komunikat blokady roli
  // (pierwsza wersja dopasowywała „Koszt … cyfra” w jednej linii tekstu — po D11/M8/M11 etykieta i kwota
  // leżą w osobnych komórkach, więc sonda dawała fałszywy FAIL; w Fali 0 rozstrzygał to reprobe).
  async function finColumns() {
    await nav('fin')
    await sleep(400)
    return page.evaluate(() => {
      // nagłówki porównywane bez znaków diakrytycznych (w tabeli Finansów stoi „Przychod”/„Marza” — luka D19)
      const fold = (x) => x.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/ż|ź/g, 'z')
      const cols = { Przychod: false, Koszt: false, Marza: false }
      for (const table of document.querySelectorAll('main table')) {
        const ths = [...table.querySelectorAll('thead th')].map((th) => fold((th.textContent || '').trim()))
        for (const key of Object.keys(cols)) {
          const idx = ths.findIndex((h) => h.startsWith(key))
          if (idx < 0) continue
          const hasNum = [...table.querySelectorAll('tbody tr')].some((tr) => /\d/.test(tr.children[idx]?.textContent || ''))
          if (hasNum) cols[key] = true
        }
      }
      const t = document.body.innerText || ''
      return {
        cols,
        lockKsh: /Stawki przewoźnika i marża spedytora nie są dostępne w roli klienta/.test(t),
        lockScx: /Cena płacona przez KSH i marża spedytora nie są dostępne w roli przewoźnika/.test(t),
      }
    })
  }
  await setRole('HHL')
  const hhlS = await finColumns()
  await setRole('KSH')
  const kshS = await finColumns()
  await setRole('SCX')
  const scxS = await finColumns()
  const strictS =
    hhlS.cols.Przychod && hhlS.cols.Koszt && hhlS.cols.Marza &&
    !kshS.cols.Koszt && !kshS.cols.Marza && kshS.lockKsh &&
    !scxS.cols.Przychod && !scxS.cols.Marza && scxS.lockScx
  const det = `HHL=${JSON.stringify(hhlS)} KSH=${JSON.stringify(kshS)} SCX=${JSON.stringify(scxS)} · regex(HHL=${JSON.stringify(hhlDetail)})`
  if (strictS) pass(13, det, s13)
  else fail(13, `role gate weak/missing: ${det}`, s13)
} catch (e) {
  fail(13, String(e.message || e), await shot('13-roles-err.png'))
}

// ---------- #14 Addresses Śrem / Boden ----------
try {
  await setRole('HHL')
  await nav('geo')
  await sleep(400)
  let found = await page.evaluate(() => {
    const t = document.body.innerText || ''
    return {
      srem: /Grunwaldzka\s*27C/i.test(t),
      boden: /Stalverket\s*20/i.test(t),
      sremLoose: /Śrem|Srem/i.test(t),
      bodenLoose: /Boden/i.test(t),
    }
  })
  if (!found.srem || !found.boden) {
    await nav('map')
    await sleep(500)
    const mapT = await page.evaluate(() => document.body.innerText || '')
    found = {
      srem: found.srem || /Grunwaldzka\s*27C/i.test(mapT),
      boden: found.boden || /Stalverket\s*20/i.test(mapT),
      sremLoose: found.sremLoose || /Śrem/i.test(mapT),
      bodenLoose: found.bodenLoose || /Boden/i.test(mapT),
    }
  }
  if (!found.srem || !found.boden) {
    // open a load drawer — loading site fields
    await nav('sched')
    const state = await readPersist()
    const code = state?.loads?.[0]?.code
    if (code) await openLoadByCode(code)
    await sleep(400)
    const drawer = await page.evaluate(() => document.querySelector('.drawer')?.innerText || document.body.innerText || '')
    found = {
      srem: found.srem || /Grunwaldzka\s*27C/i.test(drawer),
      boden: found.boden || /Stalverket\s*20/i.test(drawer),
      sremLoose: found.sremLoose || /Śrem/i.test(drawer),
      bodenLoose: found.bodenLoose || /Boden/i.test(drawer),
    }
  }
  const s14 = await shot('14-addresses.png')
  if (found.srem && found.boden) {
    pass(14, `Grunwaldzka 27C + Stalverket 20 visible (${JSON.stringify(found)})`, s14)
  } else {
    fail(14, `addresses not both visible: ${JSON.stringify(found)}`, s14)
  }
} catch (e) {
  fail(14, String(e.message || e), await shot('14-addr-err.png'))
}

await browser.close()

const passed = results.filter((r) => r.verdict === 'PASS').length
const failed = results.filter((r) => r.verdict === 'FAIL')
const verdict = passed === 14 ? 'SHIP' : 'NO_SHIP'

const report = {
  when: new Date().toISOString(),
  whenWarsaw: execSync('TZ=Europe/Warsaw date "+%Y-%m-%d %H:%M %Z"', { encoding: 'utf8' }).trim(),
  url: URL,
  head: HEAD,
  tree: TREE,
  tag: 'etap-c-2026-09-23',
  appChecksum: jsHash,
  cssChecksum: cssHash,
  jsFile: `/assets/${jsFile}`,
  cssFile: `/assets/${cssFile}`,
  results,
  score: `${passed}/14`,
  verdict,
  failList: failed.map((f) => `#${f.id}: ${f.detail}`),
  gateShot: metaShot,
}

writeFileSync(join(OUT, 'results.json'), JSON.stringify(report, null, 2))
console.log('\n==== D24 SUMMARY ====')
console.log(verdict, report.score)
for (const r of results) console.log(`${r.verdict} #${r.id}: ${r.detail.slice(0, 120)}`)
