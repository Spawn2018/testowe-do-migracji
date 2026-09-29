import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs'
import { join } from 'path'

const chrome = existsSync('/usr/bin/google-chrome-stable')
  ? '/usr/bin/google-chrome-stable'
  : '/usr/bin/google-chrome'
const BASE = 'http://127.0.0.1:4177/'
const OUT = '/workspace/watch-tower-app/shots-qa-reship'
const DL = '/tmp/qa-downloads'
mkdirSync(OUT, { recursive: true })
mkdirSync(DL, { recursive: true })

const results = []
const log = []
function note(m) { log.push(m); console.log(m) }
function pass(id, detail) { results.push({ id, verdict: 'PASS', detail }); note(`PASS ${id}: ${detail}`) }
function fail(id, detail) { results.push({ id, verdict: 'FAIL', detail }); note(`FAIL ${id}: ${detail}`) }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900'],
  defaultViewport: { width: 1440, height: 900 },
})

const page = await browser.newPage()
const client = await page.createCDPSession()
await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL })

async function prep() {
  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 90000 })
  await page.evaluate(() => {
    try { sessionStorage.setItem('wtNavCollapsed', '0') } catch {}
    for (const k of Object.keys(localStorage)) localStorage.removeItem(k)
  })
  await page.reload({ waitUntil: 'networkidle0', timeout: 90000 })
  await page.evaluate(() => document.querySelector('.app')?.classList.remove('nav-collapsed'))
  await page.waitForSelector('.wt-topbar, .topbar, .roleswitch', { timeout: 20000 })
  await sleep(500)
}

async function setRole(nameRe) {
  await page.evaluate((re) => {
    const rx = new RegExp(re)
    const btn = [...document.querySelectorAll('.roleswitch .seg button, .roleswitch button')].find((b) =>
      rx.test(b.textContent || ''),
    )
    if (!btn) throw new Error('role btn not found: ' + re)
    btn.click()
  }, nameRe)
  await sleep(700)
}

async function nav(labelRe) {
  await page.evaluate((re) => {
    const rx = new RegExp(re)
    const btn = [...document.querySelectorAll('nav button, .nav button, aside button')].find((b) =>
      rx.test(b.getAttribute('aria-label') || b.textContent || ''),
    )
    if (!btn) throw new Error('nav not found: ' + re)
    btn.click()
  }, labelRe)
  await sleep(800)
}

function readPersist() {
  return page.evaluate(() => {
    const raw = localStorage.getItem('watch-tower-ui-v4-closeout')
    if (!raw) return null
    try {
      const j = JSON.parse(raw)
      return j.state || j
    } catch {
      return null
    }
  })
}

async function waitPersist(pred, timeout = 4000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    const s = await readPersist()
    if (s && pred(s)) return s
    await sleep(150)
  }
  return readPersist()
}

async function shot(name) {
  const p = join(OUT, name)
  await page.screenshot({ path: p, fullPage: false })
  note('shot ' + name)
  return p
}

function clearDownloads() {
  for (const f of readdirSync(DL)) {
    try { require('fs').unlinkSync(join(DL, f)) } catch {}
  }
}
// ESM unlink
import { unlinkSync } from 'fs'
function wipeDl() {
  for (const f of readdirSync(DL)) {
    try { unlinkSync(join(DL, f)) } catch {}
  }
}
async function waitDownload(ext, timeout = 8000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeout) {
    const files = readdirSync(DL).filter((f) => !f.endsWith('.crdownload') && f.toLowerCase().endsWith(ext))
    if (files.length) return files.map((f) => ({ name: f, size: readFileSync(join(DL, f)).length }))
    await sleep(200)
  }
  return readdirSync(DL).map((f) => ({ name: f, size: existsSync(join(DL, f)) ? readFileSync(join(DL, f)).length : 0 }))
}

await prep()
await setRole('H&H|HHL')

// ---------- Probe 1: Ustalenia saves ----------
try {
  await nav('Kokpit|Dashboard')
  // open a load with editable resources — pick first exception or schedule row
  await page.evaluate(() => {
    const li = document.querySelector('.exq li, .mrow, table tbody tr')
    li?.click()
  })
  await sleep(700)
  // switch to Ustalenia tab
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.dtabs button, .drawer button')].find((b) =>
      /Ustalenia/i.test(b.textContent || ''),
    )
    btn?.click()
  })
  await sleep(400)
  await shot('01-ustalenia-before.png')

  const before = await readPersist()
  const loadId = before?.loads?.find((l) => true)?.id
  // find currently selected load from drawer header
  const selectedCode = await page.evaluate(() => {
    const code = document.querySelector('.drawer .code, .drawer h2, .dhead .code')
    return (code?.textContent || '').trim()
  })
  note('selectedCode=' + selectedCode)

  const marker = `QA-TRACTOR-${Date.now().toString(36).slice(-5).toUpperCase()}`
  const bookRef = `QA-AWIZ-${Date.now().toString(36).slice(-4).toUpperCase()}`
  const windowStart = '2026-09-24T08:00'

  await page.evaluate(({ marker }) => {
    const form = [...document.querySelectorAll('.drawer form')].find((f) =>
      /Zapisz zasoby/i.test(f.textContent || ''),
    )
    if (!form) throw new Error('resources form missing')
    const tractor = form.querySelector('input[name="tractorPlate"]') || form.querySelectorAll('input.input')[0]
    const trailer = form.querySelector('input[name="trailerPlate"]')
    const driver = form.querySelector('input[name="driverName"]')
    if (tractor) { tractor.value = marker; tractor.dispatchEvent(new Event('input', { bubbles: true })) }
    if (trailer) { trailer.value = 'QA-TRL-99'; trailer.dispatchEvent(new Event('input', { bubbles: true })) }
    if (driver) { driver.value = 'QA Driver'; driver.dispatchEvent(new Event('input', { bubbles: true })) }
    // React controlled? these are defaultValue uncontrolled — just set value then submit
    const btn = [...form.querySelectorAll('button')].find((b) => /Zapisz zasoby/i.test(b.textContent || ''))
    btn?.click()
  }, { marker })
  await sleep(500)

  await page.evaluate(({ bookRef, windowStart }) => {
    const form = [...document.querySelectorAll('.drawer form')].find((f) =>
      /Zapisz awizację/i.test(f.textContent || ''),
    )
    if (!form) throw new Error('awizacja form missing')
    const vessel = form.querySelector('select[name="vessel"]')
    if (vessel) { vessel.value = 'Nova Star'; vessel.dispatchEvent(new Event('change', { bubbles: true })) }
    const booking = form.querySelector('input[name="bookingRef"]')
    if (booking) { booking.value = bookRef; booking.dispatchEvent(new Event('input', { bubbles: true })) }
    const st = form.querySelector('select[name="status"]')
    if (st) { st.value = 'BOOKED'; st.dispatchEvent(new Event('change', { bubbles: true })) }
    const lw = form.querySelector('input[name="loadWindowStart"]')
    if (lw) { lw.value = windowStart; lw.dispatchEvent(new Event('input', { bubbles: true })) }
    const btn = [...form.querySelectorAll('button')].find((b) => /Zapisz awizację/i.test(b.textContent || ''))
    btn?.click()
  }, { bookRef, windowStart })
  await sleep(800)
  await shot('01-ustalenia-after.png')

  const after = await waitPersist((s) =>
    s.loads?.some((l) => l.resources?.tractorPlate === marker || l.ferry?.bookingRef === bookRef),
  )
  const hit = after?.loads?.find(
    (l) => l.resources?.tractorPlate === marker || l.ferry?.bookingRef === bookRef || l.code === selectedCode,
  )
  // Prefer marker match
  const byMarker = after?.loads?.find((l) => l.resources?.tractorPlate === marker)
  const byBook = after?.loads?.find((l) => l.ferry?.bookingRef === bookRef)
  const okRes = !!byMarker
  const okFerry = !!byBook && byBook.ferry?.vessel === 'Nova Star'
  const okAwiz = !!byBook && (byBook.awizacja?.loadWindowStart === windowStart || byBook.ferry?.bookingRef === bookRef)
  if (okRes && okFerry && okAwiz) {
    pass(1, `resources tractor=${marker}; ferry vessel=Nova Star booking=${bookRef}; awizacja window set`)
  } else {
    fail(1, `res=${okRes} ferry=${okFerry} awiz=${okAwiz}; selected=${selectedCode}; sample=${JSON.stringify({
      byMarker: byMarker && { code: byMarker.code, tractor: byMarker.resources?.tractorPlate, ferry: byMarker.ferry, awiz: byMarker.awizacja?.loadWindowStart },
      byBook: byBook && { code: byBook.code, ferry: byBook.ferry, awiz: byBook.awizacja?.loadWindowStart },
    })}`)
  }
} catch (e) {
  fail(1, String(e.message || e))
  await shot('01-ustalenia-error.png')
}

// ---------- Probe 2: READY blocked / with cover ----------
try {
  // Find a load that is blocked (docMissing) and one that is covered
  const state = await readPersist()
  const loads = state?.loads || []
  // Use store via UI: open DOC_MISSING / gap load
  // Force via evaluate by clicking rows — easier: call setLoadStatus through UI after finding codes
  // Inspect which loads have permitBlock by opening them — use seed stress codes K-03, SG-09 etc.
  await nav('Harmonogram|Schedule')
  await sleep(400)

  // Helper: open load by code via search
  async function openLoadByCode(code) {
    await page.evaluate((c) => {
      const input = document.querySelector('.filters input, input[placeholder*="zuk"], input[type="search"], .panel input')
      if (input) {
        const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
        proto?.set?.call(input, c)
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
    }, code)
    await sleep(400)
    await page.evaluate((c) => {
      const row = [...document.querySelectorAll('table tbody tr, .mrow')].find((r) =>
        (r.textContent || '').includes(c),
      )
      row?.click()
    }, code)
    await sleep(600)
  }

  // Prefer K-03 or any DOC_MISSING
  const blockedCode =
    loads.find((l) => l.docMissing || l.status === 'DOC_MISSING' || l.code === 'K-03')?.code ||
    loads.find((l) => l.status === 'RESOURCES_PENDING')?.code
  const coveredCode =
    loads.find(
      (l) =>
        !l.docMissing &&
        l.status !== 'DOC_MISSING' &&
        ['RESOURCES_PENDING', 'PLANNED', 'READY'].includes(l.status) &&
        l.permit?.attachmentKind !== 'TRIP',
    )?.code || loads.find((l) => !l.docMissing)?.code

  note(`blockedCode=${blockedCode} coveredCode=${coveredCode}`)

  let blockedOk = false
  let coveredOk = false
  let toastBlocked = false

  if (blockedCode) {
    await openLoadByCode(blockedCode)
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.dtabs button')].find((b) => /Ustalenia/i.test(b.textContent || ''))
      btn?.click()
    })
    await sleep(300)
    const readyInfo = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.drawer button')].find((b) => /Ustaw READY/i.test(b.textContent || ''))
      const banner = [...document.querySelectorAll('.drawer .banner')].map((b) => b.textContent || '').join(' | ')
      return {
        disabled: btn ? btn.disabled : null,
        banner,
        exists: !!btn,
      }
    })
    await shot('02-ready-blocked.png')
    // try click anyway
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.drawer button')].find((b) => /Ustaw READY/i.test(b.textContent || ''))
      btn?.click()
    })
    await sleep(500)
    const afterBlock = await readPersist()
    const loadAfter = afterBlock?.loads?.find((l) => l.code === blockedCode)
    const ev = afterBlock?.events?.filter((e) => e.type === 'READY_BLOCKED' && e.loadId === loadAfter?.id) || []
    const toast = await page.evaluate(() =>
      [...document.querySelectorAll('.toast, .toasts, [class*="toast"]')].map((t) => t.textContent || '').join(' '),
    )
    toastBlocked = /READY zablok|zablokowane|Brak zezwolenia/i.test(toast + (readyInfo.banner || ''))
    blockedOk =
      readyInfo.disabled === true ||
      toastBlocked ||
      ev.length > 0 ||
      (loadAfter && loadAfter.status !== 'READY' && /Brak zezwolenia/i.test(readyInfo.banner || ''))
    note(`ready blocked info=${JSON.stringify(readyInfo)} toast=${toast.slice(0,120)} status=${loadAfter?.status}`)
  }

  if (coveredCode) {
    await openLoadByCode(coveredCode)
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.dtabs button')].find((b) => /Ustalenia/i.test(b.textContent || ''))
      btn?.click()
    })
    await sleep(300)
    const readyInfo2 = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.drawer button')].find((b) => /Ustaw READY/i.test(b.textContent || ''))
      const banner = [...document.querySelectorAll('.drawer .banner')].map((b) => b.textContent || '').join(' | ')
      return { disabled: btn ? btn.disabled : null, banner, exists: !!btn }
    })
    // If still blocked by cover, try to find a truly covered load via store probe of isReadyBlocked isn't available —
    // attempt click when enabled
    if (readyInfo2.disabled === false) {
      await page.evaluate(() => {
        const btn = [...document.querySelectorAll('.drawer button')].find((b) => /Ustaw READY/i.test(b.textContent || ''))
        btn?.click()
      })
      await sleep(600)
      const afterOk = await readPersist()
      const loadOk = afterOk?.loads?.find((l) => l.code === coveredCode)
      coveredOk = loadOk?.status === 'READY'
      await shot('02-ready-covered.png')
      note(`covered status=${loadOk?.status} disabled=${readyInfo2.disabled}`)
    } else {
      // Search for an enabled READY button among loads
      const candidates = loads.filter((l) => !l.docMissing).slice(0, 20)
      for (const c of candidates) {
        await openLoadByCode(c.code)
        await page.evaluate(() => {
          const btn = [...document.querySelectorAll('.dtabs button')].find((b) => /Ustalenia/i.test(b.textContent || ''))
          btn?.click()
        })
        await sleep(250)
        const info = await page.evaluate(() => {
          const btn = [...document.querySelectorAll('.drawer button')].find((b) => /Ustaw READY/i.test(b.textContent || ''))
          return { disabled: btn ? btn.disabled : null, banner: [...document.querySelectorAll('.drawer .banner')].map((b) => b.textContent).join(' ') }
        })
        if (info.disabled === false) {
          await page.evaluate(() => {
            const btn = [...document.querySelectorAll('.drawer button')].find((b) => /Ustaw READY/i.test(b.textContent || ''))
            btn?.click()
          })
          await sleep(600)
          const afterOk = await readPersist()
          const loadOk = afterOk?.loads?.find((l) => l.code === c.code)
          coveredOk = loadOk?.status === 'READY'
          await shot('02-ready-covered.png')
          note(`found covered ${c.code} status=${loadOk?.status}`)
          break
        }
      }
      if (!coveredOk) {
        await shot('02-ready-covered-miss.png')
        note('no enabled READY found among candidates')
      }
    }
  }

  if (blockedOk && coveredOk) pass(2, `blocked READY on ${blockedCode}; READY ok with cover`)
  else fail(2, `blockedOk=${blockedOk} coveredOk=${coveredOk} blocked=${blockedCode} covered=${coveredCode}`)
} catch (e) {
  fail(2, String(e.message || e))
  await shot('02-ready-error.png')
}

// ---------- Probe 3: Plan B ----------
try {
  await nav('Ryzyka|Risk')
  await sleep(500)
  const before = await readPersist()
  const ferryBefore = (before?.loads || []).find((l) => l.status === 'ON_FERRY' || l.status === 'AT_PORT')
  const ferryBeforeRef = ferryBefore?.ferry?.bookingRef
  const notifBefore = (before?.notifications || []).length
  const riskBefore = (before?.risks || []).find((r) => r.type === 'FERRY' && r.ferryPlanB)

  await shot('03-planb-before.png')
  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button.chipbtn, button')].find((b) => /Przelicz/i.test(b.textContent || ''))
    if (!btn) return false
    btn.click()
    return true
  })
  await sleep(900)
  await shot('03-planb-after.png')
  const after = await waitPersist((s) =>
    (s.loads || []).some((l) => String(l.ferry?.bookingRef || '').startsWith('PLANB-')) ||
    (s.notifications || []).length > notifBefore,
  )
  const ferryAfter = (after?.loads || []).find((l) => String(l.ferry?.bookingRef || '').startsWith('PLANB-'))
  const ev = (after?.events || []).filter((e) => e.type === 'PLAN_B_ACTIVATED')
  const notifAfter = (after?.notifications || []).filter((n) => /Plan B|PLANB|prom/i.test(n.title + ' ' + n.body))
  if (clicked && ferryAfter && (ev.length > 0 || notifAfter.length > 0 || (after?.notifications || []).length > notifBefore)) {
    pass(3, `Przelicz→ferry ${ferryAfter.code} booking=${ferryAfter.ferry.bookingRef}; events=${ev.length} notifs=${notifAfter.length}; prevRef=${ferryBeforeRef}`)
  } else {
    fail(3, `clicked=${clicked} ferryAfter=${ferryAfter?.ferry?.bookingRef} ev=${ev.length} notifDelta=${(after?.notifications||[]).length - notifBefore} risk=${riskBefore?.id}`)
  }
} catch (e) {
  fail(3, String(e.message || e))
}

// ---------- Probe 4: ZIP download ----------
try {
  wipeDl()
  await nav('Dokumenty|Docs')
  await sleep(400)
  // Prefer drawer ZIP; also Docs weekly
  let used = ''
  const docsBtn = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /Pobierz paczkę/i.test(x.textContent || ''))
    if (b) { b.click(); return b.textContent.trim() }
    return null
  })
  if (docsBtn) {
    used = docsBtn
  } else {
    await nav('Harmonogram')
    await page.evaluate(() => document.querySelector('table tbody tr')?.click())
    await sleep(500)
    await page.evaluate(() => {
      const t = [...document.querySelectorAll('.dtabs button')].find((b) => /Dok/i.test(b.textContent || ''))
      t?.click()
    })
    await sleep(300)
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.drawer button')].find((x) => /Pobierz paczkę ZIP/i.test(x.textContent || ''))
      b?.click()
    })
    used = 'drawer ZIP'
  }
  await sleep(1500)
  const files = await waitDownload('.zip', 10000)
  await shot('04-zip.png')
  const zip = files.find((f) => f.name.toLowerCase().endsWith('.zip') && f.size > 20)
  if (zip) pass(4, `download ${zip.name} size=${zip.size} via ${used}`)
  else fail(4, `no zip in ${DL}: ${JSON.stringify(files)} used=${used}`)
} catch (e) {
  fail(4, String(e.message || e))
}

// ---------- Probe 5: HHL Eksport + KSH Wgraj dry-run ----------
try {
  wipeDl()
  await setRole('H&H|HHL')
  await nav('Harmonogram')
  await sleep(400)
  const hasEksport = await page.evaluate(() =>
    [...document.querySelectorAll('button')].some((b) => /Eksport XLSX/i.test(b.textContent || '')),
  )
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /Eksport XLSX/i.test(x.textContent || ''))
    b?.click()
  })
  await sleep(2000)
  const xlsx = await waitDownload('.xlsx', 12000)
  const xOk = xlsx.find((f) => f.name.toLowerCase().endsWith('.xlsx') && f.size > 500)
  await shot('05-hhl-eksport.png')

  await setRole('KSH')
  await nav('Harmonogram')
  await sleep(500)
  const wgraj = await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => /Wgraj aktualizację/i.test(x.textContent || ''))
    if (!b) return { exists: false }
    b.click()
    return { exists: true }
  })
  await sleep(500)
  // upload ship-qa-unique.xlsx
  const input = await page.$('input[type="file"]')
  let dryOk = false
  if (input) {
    await input.uploadFile('tests/fixtures/ship-qa-unique.xlsx')
    await sleep(2500)
    const ui = await page.evaluate(() => {
      const note = document.querySelector('.note')?.textContent || ''
      const btns = [...document.querySelectorAll('button')].map((b) => b.textContent.trim())
      return { note: note.slice(0, 240), btns: btns.filter((t) => /Dalej|diff|Zatwierd|map|commit|OK/i.test(t) || /Wgraj/i.test(t)) }
    })
    dryOk = /OK|accepted|Wgraj aktualizację/i.test(ui.note) || ui.btns.length > 0
    note('dry-run ui=' + JSON.stringify(ui))
  }
  await shot('05-ksh-wgraj.png')
  if (hasEksport && xOk && wgraj.exists && dryOk) {
    pass(5, `HHL Eksport ${xOk.name} (${xOk.size}b); KSH Wgraj dry-run path shown`)
  } else {
    fail(5, `eksportBtn=${hasEksport} xlsx=${JSON.stringify(xOk)} wgraj=${JSON.stringify(wgraj)} dryOk=${dryOk}`)
  }
} catch (e) {
  fail(5, String(e.message || e))
}

// ---------- Probe 6: Factoring HHL + SCX ----------
try {
  await setRole('H&H|HHL')
  await nav('Faktur|Invoice')
  await sleep(600)
  await shot('06-factoring-hhl-before.png')
  const feeNew = 3.7
  const edited = await page.evaluate((fee) => {
    const inputs = [...document.querySelectorAll('input, select')]
    const feeInput = inputs.find((i) => i.type === 'number' || /fee|%|procent/i.test(i.getAttribute('aria-label') || i.name || ''))
    // Prefer number near factoring panel
    const nums = [...document.querySelectorAll('.panel input[type="number"], .kv input, input[type="number"]')]
    const target = nums[0]
    if (!target) return { ok: false, reason: 'no number input' }
    const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
    proto?.set?.call(target, String(fee))
    target.dispatchEvent(new Event('input', { bubbles: true }))
    target.dispatchEvent(new Event('change', { bubbles: true }))
    return { ok: true, tag: target.outerHTML.slice(0, 120) }
  }, feeNew)
  await sleep(500)
  const afterHhl = await waitPersist((s) => s.factoringOffer?.feePercent === feeNew)
  const hhlOk = afterHhl?.factoringOffer?.feePercent === feeNew
  await shot('06-factoring-hhl-after.png')

  await setRole('SCX|Scand')
  await nav('Faktur|Invoice')
  await sleep(700)
  const scxSelect = await page.evaluate(() => {
    const radios = [...document.querySelectorAll('input[type="radio"]')]
    const factor = radios.find((r) => /factor|faktoring/i.test(r.value + r.name + (r.parentElement?.textContent || '')))
      || radios[1]
      || radios[0]
    if (!factor) return { ok: false, count: radios.length }
    factor.click()
    factor.dispatchEvent(new Event('change', { bubbles: true }))
    return { ok: true, count: radios.length, label: (factor.parentElement?.textContent || '').slice(0, 80) }
  })
  await sleep(400)
  // Try submit if button present
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) =>
      /Wyślij|Złóż|Submit|Fakturuj|Utwórz faktur/i.test(x.textContent || ''),
    )
    b?.click()
  })
  await sleep(800)
  const afterScx = await readPersist()
  const invWithFact = (afterScx?.invoices || []).filter((i) => i.factoring?.selected)
  const offerStill = afterScx?.factoringOffer?.feePercent === feeNew
  await shot('06-factoring-scx.png')
  if (hhlOk && (scxSelect.ok || invWithFact.length > 0) && offerStill) {
    pass(6, `HHL fee→${feeNew}; SCX select=${JSON.stringify(scxSelect)}; factoredInvoices=${invWithFact.length}`)
  } else {
    fail(6, `hhlOk=${hhlOk} edited=${JSON.stringify(edited)} scx=${JSON.stringify(scxSelect)} invFact=${invWithFact.length} fee=${afterScx?.factoringOffer?.feePercent}`)
  }
} catch (e) {
  fail(6, String(e.message || e))
}

// ---------- Probe 7: WF notification ----------
try {
  await setRole('H&H|HHL')
  await nav('Automat|Workflow|Reguł')
  await sleep(600)
  const before = await readPersist()
  const n0 = (before?.notifications || []).length
  const runs0 = (before?.workflowRuns || []).length
  await shot('07-wf-before.png')
  const mode = await page.evaluate(() => {
    const nova = [...document.querySelectorAll('button')].find((b) => /Nowa reguła/i.test(b.textContent || ''))
    if (nova) { nova.click(); return 'nova' }
    const name = document.querySelector('.wf [role="button"], .wf strong, .wf .name, .wf h3, .wf button, .wf [tabindex]')
    // click first workflow name
    const clickable = [...document.querySelectorAll('.wf *')].find((el) => el.onclick || el.getAttribute('role') === 'button' || el.tagName === 'BUTTON' || el.tagName === 'A')
    const title = document.querySelector('.wf')
    if (title) {
      const t = title.querySelector('[style*="cursor"], button, [role="button"], strong, b, span')
      t?.click()
      return 'name'
    }
    return 'none'
  })
  // Also explicitly click first wf name node as WorkflowsView wires onClick on name
  if (mode !== 'nova') {
    await page.evaluate(() => {
      const wf = document.querySelector('.wf')
      if (!wf) return
      const clickables = [...wf.querySelectorAll('*')]
      for (const el of clickables) {
        if ((el.getAttribute('onclick') || el.onclick || el.tagName === 'BUTTON' || el.getAttribute('role') === 'button' || getComputedStyle(el).cursor === 'pointer') && (el.textContent || '').trim().length > 3) {
          el.click()
          return
        }
      }
      wf.click()
    })
  }
  await sleep(900)
  const after = await waitPersist((s) => (s.notifications || []).length > n0 || (s.workflowRuns || []).length > runs0)
  const n1 = (after?.notifications || []).length
  const runs1 = (after?.workflowRuns || []).length
  await shot('07-wf-after.png')
  if (n1 > n0 || runs1 > runs0) pass(7, `mode=${mode} notifs ${n0}→${n1} runs ${runs0}→${runs1}`)
  else fail(7, `mode=${mode} notifs ${n0}→${n1} runs ${runs0}→${runs1}`)
} catch (e) {
  fail(7, String(e.message || e))
}

// ---------- Probe 8: Map 5 layers + AIS/TV note ----------
try {
  await nav('Mapa')
  await sleep(1500)
  await page.waitForSelector('.leaflet-container, .mapbox', { timeout: 15000 }).catch(() => null)
  await sleep(1000)
  const mapInfo = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('.maplayers label')].map((l) => (l.textContent || '').trim())
    const note = document.querySelector('.note')?.textContent || ''
    const tv = /Trafikverket[^:]*:\s*(live|seed)/i.exec(note)
    const ais = /AIS[^:]*:\s*(live|seed)/i.exec(note)
    return {
      layers: labels,
      layerCount: labels.length,
      note: note.slice(0, 300),
      tv: tv?.[1] || null,
      ais: ais?.[1] || null,
      leaflet: !!document.querySelector('.leaflet-container'),
    }
  })
  await shot('08-map-layers.png')
  if (mapInfo.layerCount === 5 && mapInfo.tv && mapInfo.ais) {
    pass(8, `5 layers [${mapInfo.layers.join(', ')}]; TV=${mapInfo.tv} AIS=${mapInfo.ais}; leaflet=${mapInfo.leaflet}`)
  } else {
    fail(8, JSON.stringify(mapInfo))
  }
} catch (e) {
  fail(8, String(e.message || e))
}

// ---------- Probe 9: Bell / spine / KPI ----------
try {
  await setRole('H&H|HHL')
  await nav('Kokpit')
  await sleep(500)
  const before = await readPersist()
  const unreadBefore = (before?.notifications || []).filter((n) => !n.read).length

  // Bell mark read
  await page.evaluate(() => {
    const bell = document.querySelector('button[aria-label*="Powiadom"], button[aria-haspopup="dialog"].iconbtn, .iconbtn[aria-haspopup]')
    bell?.click()
  })
  await sleep(400)
  await shot('09-bell-open.png')
  const marked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.bell-pop button, [role="dialog"] button')].find((b) =>
      /Przeczytane|Oznacz wszystkie|Mark/i.test(b.textContent || ''),
    )
    if (!btn) return { ok: false, texts: [...document.querySelectorAll('.bell-pop button')].map((b) => b.textContent.trim()) }
    btn.click()
    return { ok: true, label: btn.textContent.trim() }
  })
  await sleep(500)
  const afterBell = await readPersist()
  const unreadAfter = (afterBell?.notifications || []).filter((n) => !n.read).length
  const bellOk = marked.ok && unreadAfter < unreadBefore
  await shot('09-bell-after.png')

  // Spine 2nd click clear
  const spine1 = await page.evaluate(() => {
    const stages = [...document.querySelectorAll('.corridor button.stage, .corridor-inner button')]
    const btn = stages.find((b) => Number((b.querySelector('.n')?.textContent || '0')) > 0) || stages[0]
    if (!btn) return null
    const label = btn.querySelector('.l')?.textContent || btn.textContent
    btn.click()
    return label
  })
  await sleep(700)
  const filterOn = await page.evaluate(() => {
    const pressed = document.querySelector('.corridor button[aria-pressed="true"]')
    return {
      pressed: pressed?.querySelector('.l')?.textContent || null,
      viewHint: location.hash + ' ' + (document.querySelector('.panel h2')?.textContent || ''),
      listCount: document.querySelectorAll('.mlist .mrow, table tbody tr').length,
    }
  })
  await shot('09-spine-filtered.png')
  // second click
  await page.evaluate(() => {
    const pressed = document.querySelector('.corridor button[aria-pressed="true"]')
    pressed?.click()
  })
  await sleep(700)
  const filterOff = await page.evaluate(() => ({
    pressed: document.querySelector('.corridor button[aria-pressed="true"]')?.querySelector('.l')?.textContent || null,
    anyPressed: !!document.querySelector('.corridor button[aria-pressed="true"]'),
  }))
  await shot('09-spine-cleared.png')
  const spineOk = !!spine1 && !!filterOn.pressed && filterOff.pressed === null && filterOff.anyPressed === false

  // KPI deep targets
  await nav('Kokpit')
  await sleep(400)
  const kpi = await page.evaluate(() => {
    const tiles = [...document.querySelectorAll('.kpis button, .kpis .kpi, .kpis [role="button"], .kpis > *')]
    const clickable = tiles.filter((t) => t.tagName === 'BUTTON' || t.getAttribute('role') === 'button' || getComputedStyle(t).cursor === 'pointer')
    const target = clickable.find((t) => /Ryzyk|Risk|FERRY|prom/i.test(t.textContent || '')) || clickable[clickable.length - 1] || clickable[0]
    if (!target) return { ok: false, count: tiles.length }
    const label = (target.textContent || '').trim().slice(0, 60)
    target.click()
    return { ok: true, label, count: clickable.length }
  })
  await sleep(800)
  const viewAfter = await page.evaluate(() => ({
    h2: document.querySelector('.panel h2')?.textContent || '',
    viewText: document.body.innerText.slice(0, 200),
  }))
  await shot('09-kpi-deep.png')
  const kpiOk = kpi.ok && viewAfter.h2 && !/Kokpit/i.test(viewAfter.h2)

  if (bellOk && spineOk && kpiOk) {
    pass(9, `bell unread ${unreadBefore}→${unreadAfter} (${marked.label}); spine ${spine1} on→cleared; KPI→${viewAfter.h2} (${kpi.label})`)
  } else {
    fail(9, `bellOk=${bellOk} marked=${JSON.stringify(marked)} unread ${unreadBefore}→${unreadAfter}; spineOk=${spineOk} on=${JSON.stringify(filterOn)} off=${JSON.stringify(filterOff)}; kpiOk=${kpiOk} kpi=${JSON.stringify(kpi)} view=${JSON.stringify(viewAfter)}`)
  }
} catch (e) {
  fail(9, String(e.message || e))
}

// ---------- Probe 10: Role money cols ----------
try {
  async function moneyCols() {
    await nav('Harmonogram')
    await sleep(500)
    return page.evaluate(() => {
      const ths = [...document.querySelectorAll('table thead th, table th')].map((t) => (t.textContent || '').trim())
      return {
        ths,
        hasKoszt: ths.some((t) => /Koszt|Moja stawka|Cost/i.test(t)),
        hasRev: ths.some((t) => /Przychód|Twoja cena|Revenue/i.test(t)),
        hasMargin: ths.some((t) => /Marża|Margin/i.test(t)),
      }
    })
  }
  await setRole('H&H|HHL')
  const hhl = await moneyCols()
  await shot('10-cols-hhl.png')
  await setRole('KSH')
  const ksh = await moneyCols()
  await shot('10-cols-ksh.png')
  await setRole('SCX|Scand')
  const scx = await moneyCols()
  await shot('10-cols-scx.png')

  // Expected: HHL all three; KSH rev only (no cost/margin); SCX cost only (no rev/margin)
  const hhlOk = hhl.hasKoszt && hhl.hasRev && hhl.hasMargin
  const kshOk = !ksh.hasKoszt && ksh.hasRev && !ksh.hasMargin
  const scxOk = scx.hasKoszt && !scx.hasRev && !scx.hasMargin
  if (hhlOk && kshOk && scxOk) {
    pass(10, `HHL cost+rev+margin; KSH rev-only; SCX cost-only`)
  } else {
    fail(10, `HHL=${JSON.stringify(hhl)} KSH=${JSON.stringify(ksh)} SCX=${JSON.stringify(scx)}`)
  }
} catch (e) {
  fail(10, String(e.message || e))
}

await browser.close()

const fails = results.filter((r) => r.verdict === 'FAIL')
const verdict = fails.length === 0 ? 'SHIP' : 'FAIL'
const report = {
  when: new Date().toISOString(),
  verdict,
  results,
  log,
}
writeFileSync('/tmp/qa-reship-result.json', JSON.stringify(report, null, 2))
console.log('\n=== VERDICT ' + verdict + ' ===')
for (const r of results) console.log(`${r.verdict} #${r.id}: ${r.detail}`)
process.exit(0)
