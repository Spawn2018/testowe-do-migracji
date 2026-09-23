#!/usr/bin/env node
import puppeteer from 'puppeteer-core'
import { existsSync, mkdirSync, readdirSync, writeFileSync, unlinkSync, statSync } from 'fs'
import { join } from 'path'

const BASE = 'http://127.0.0.1:4177/'
const STORE = 'watch-tower-ui-v6-ready-gate'
const OUT = '/tmp/wt-p9'
const DL = '/tmp/wt-p9-dl'
mkdirSync(OUT, { recursive: true })
mkdirSync(DL, { recursive: true })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const findings = []
const pass = (id, d) => findings.push({ id, verdict: 'PASS', detail: d })
const fail = (id, d) => findings.push({ id, verdict: 'FAIL', detail: d })
const note = (id, d) => findings.push({ id, verdict: 'NOTE', detail: d })

const browser = await puppeteer.launch({
  executablePath: existsSync('/usr/bin/google-chrome-stable') ? '/usr/bin/google-chrome-stable' : '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900'],
  defaultViewport: { width: 1440, height: 900 },
})
const page = await browser.newPage()
const client = await page.createCDPSession()
await client.send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: DL })

async function reset() {
  await page.goto(BASE + '?r=' + Date.now(), { waitUntil: 'networkidle0', timeout: 90000 })
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k)
    sessionStorage.setItem('wtNavCollapsed', '0')
  })
  await page.reload({ waitUntil: 'networkidle0', timeout: 90000 })
  await page.waitForSelector('#roleSeg', { timeout: 20000 })
  await page.evaluate(() => document.querySelector('.app')?.classList.remove('nav-collapsed'))
  await sleep(500)
}

async function setRole(role) {
  // buttons show full names
  const map = { HHL: /H&H Logistics|HHL/i, KSH: /^KSH$/i, SCX: /Scandinavian Express|SCX/i }
  const ok = await page.evaluate((reSrc) => {
    const re = new RegExp(reSrc, 'i')
    const btn = [...document.querySelectorAll('#roleSeg button')].find((b) => re.test((b.textContent || '').trim()))
    if (!btn) return { ok: false, labels: [...document.querySelectorAll('#roleSeg button')].map((b) => b.textContent) }
    btn.click()
    return { ok: true, label: btn.textContent.trim(), pressed: btn.getAttribute('aria-pressed') }
  }, map[role].source)
  await sleep(500)
  const storeRole = await page.evaluate((STORE) => {
    try { return JSON.parse(localStorage.getItem(STORE)).state.role } catch { return null }
  }, STORE)
  // also verify brand sub
  const brand = await page.evaluate(() => document.querySelector('#brandSub')?.textContent)
  return { ...ok, storeRole, brand }
}

async function nav(reSrc) {
  const r = await page.evaluate((reSrc) => {
    const re = new RegExp(reSrc, 'i')
    const items = [...document.querySelectorAll('nav button')]
    const hit = items.find((b) => re.test((b.textContent || '').replace(/\d+/g, '').trim()))
    if (!hit) return { ok: false, labels: items.map((b) => b.textContent.trim()) }
    hit.click()
    return { ok: true, label: hit.textContent.trim() }
  }, reSrc)
  await sleep(700)
  return r
}

async function getStore() {
  return page.evaluate((STORE) => {
    const raw = localStorage.getItem(STORE)
    return raw ? JSON.parse(raw).state : null
  }, STORE)
}

await reset()

// ─── NAV HHL ───
let r = await setRole('HHL')
if (r.storeRole !== 'HHL') fail('role-switch-HHL', JSON.stringify(r))
else pass('role-switch-HHL', r.brand)

const hhlExpect = [
  ['Kokpit', /Kokpit/],
  ['Mapa', /Mapa/],
  ['Harmonogram', /Harmonogram/],
  ['Ryzyka', /Ryzyka/],
  ['Dokumenty', /Dokumenty/],
  ['Finanse', /Finanse/],
  ['Faktury', /Faktury/],
  ['Automatyzacje', /Automatyzacje/],
  ['Strefy', /Strefy/],
  ['Opcje', /Opcje/],
]
const hhlLabels = await page.evaluate(() => [...document.querySelectorAll('nav button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()))
const hhlMissing = hhlExpect.filter(([, re]) => !hhlLabels.some((l) => re.test(l))).map(([n]) => n)
const hollow = []
for (const [name, re] of hhlExpect) {
  await nav(re.source)
  const v = await page.evaluate(() => {
    const h2 = document.querySelector('main h2, .panel-hd h2, h2')?.textContent?.trim()
    const body = document.querySelector('main, .content, .view')?.innerText || ''
    return { h2, stub: /wkrótce|coming soon|TODO|not implemented/i.test(body), len: body.length }
  })
  if (v.stub || v.len < 30) hollow.push({ name, ...v })
}
if (hhlMissing.length || hollow.length) fail('nav-HHL', JSON.stringify({ hhlMissing, hollow, hhlLabels }))
else pass('nav-HHL', hhlLabels.filter((l) => l !== '«').join(' · '))

// ─── NAV KSH ───
r = await setRole('KSH')
const kshLabels = await page.evaluate(() => [...document.querySelectorAll('nav button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()))
const kshExpect = ['Kokpit', 'Mapa', 'Harmonogram', 'Ryzyka', 'Dokumenty', 'Rozliczenia']
const kshMissing = kshExpect.filter((n) => !kshLabels.some((l) => l.startsWith(n)))
const kshExtraBad = kshLabels.filter((l) => /Faktury|Automatyzacje|Strefy|Opcje|Moje zadania|Zadania/i.test(l) && l !== '«')
if (r.storeRole !== 'KSH' || kshMissing.length) fail('nav-KSH', JSON.stringify({ r, kshLabels, kshMissing }))
else pass('nav-KSH', `matrix OK · ${kshLabels.filter((l)=>l!=='«').join(' · ')}` + (kshExtraBad.length ? ` · NOTE unexpected ${kshExtraBad}` : ''))

// ─── NAV SCX ───
r = await setRole('SCX')
const scxLabels = await page.evaluate(() => [...document.querySelectorAll('nav button')].map((b) => b.textContent.replace(/\s+/g, ' ').trim()))
const scxExpect = ['Kokpit', 'Mapa', 'Harmonogram', 'Ryzyka', 'Dokumenty', 'Moje stawki', 'Faktury', 'Moje zadania']
const scxMissing = scxExpect.filter((n) => !scxLabels.some((l) => l.startsWith(n)))
if (r.storeRole !== 'SCX' || scxMissing.length) fail('nav-SCX', JSON.stringify({ r, scxLabels, scxMissing }))
else {
  // visit each
  let scxHollow = []
  for (const n of scxExpect) {
    await nav('^' + n)
    const v = await page.evaluate(() => ({
      h2: document.querySelector('h2')?.textContent,
      len: (document.querySelector('main')?.innerText || '').length,
    }))
    if (v.len < 30) scxHollow.push({ n, ...v })
  }
  if (scxHollow.length) fail('nav-SCX-hollow', JSON.stringify(scxHollow))
  else pass('nav-SCX', scxLabels.filter((l)=>l!=='«').join(' · '))
}

// ─── Ustalenia save (HHL) ───
await setRole('HHL')
await nav('Harmonogram')
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.code')].find((c) => c.textContent.includes('SG-19'))
  el?.closest('tr')?.click()
})
await sleep(700)
await page.evaluate(() => {
  [...document.querySelectorAll('.dtabs button')].find((b) => /Ustalenia/i.test(b.textContent || ''))?.click()
})
await sleep(400)
const forms = await page.evaluate(() => ({
  tabs: [...document.querySelectorAll('.dtabs button')].map((b) => b.textContent),
  hasRes: [...document.querySelectorAll('form')].some((f) => /Zapisz zasoby/i.test(f.textContent || '')),
  hasAwi: [...document.querySelectorAll('form')].some((f) => /Zapisz awizację/i.test(f.textContent || '')),
  body: document.querySelector('.dbody')?.innerText?.slice(0, 300),
  role: document.querySelector('#brandSub')?.textContent,
}))
const saveRes = await page.evaluate(() => {
  const form = [...document.querySelectorAll('form')].find((f) => /Zapisz zasoby/i.test(f.textContent || ''))
  if (!form) return { ok: false }
  const set = (n, v) => {
    const i = form.querySelector(`[name="${n}"]`)
    if (!i) return
    const native = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
    native.set.call(i, v)
    i.dispatchEvent(new Event('input', { bubbles: true }))
    i.dispatchEvent(new Event('change', { bubbles: true }))
  }
  set('driverName', 'QA P9 Kierowca')
  set('driverPhone', '+48 600 999 111')
  set('tractorPlate', 'P9 TEST 01')
  set('trailerPlate', 'P9 TRAIL 01')
  form.querySelector('button[type="submit"]')?.click()
  return { ok: true }
})
await sleep(900)
let st = await getStore()
let load = st?.loads?.find((l) => l.code === 'SG-19')
if (!forms.hasRes || !saveRes.ok || load?.resources?.driverName !== 'QA P9 Kierowca') {
  fail('ustalenia-save', JSON.stringify({ forms, saveRes, driver: load?.resources?.driverName, status: load?.status }))
} else {
  pass('ustalenia-save', `driver OK · status=${load.status}`)
}

const saveAwi = await page.evaluate(() => {
  const form = [...document.querySelectorAll('form')].find((f) => /Zapisz awizację/i.test(f.textContent || ''))
  if (!form) return { ok: false }
  const set = (n, v) => {
    const i = form.querySelector(`[name="${n}"]`)
    if (!i) return
    const native = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
    native.set.call(i, v)
    i.dispatchEvent(new Event('input', { bubbles: true }))
  }
  set('loadWindowStart', '2026-10-20T08:00')
  set('loadWindowEnd', '2026-10-20T16:00')
  const c = form.querySelector('[name="confirmed"]')
  if (c && !c.checked) c.click()
  form.querySelector('button[type="submit"]')?.click()
  return { ok: true }
})
await sleep(800)
st = await getStore()
load = st?.loads?.find((l) => l.code === 'SG-19')
if (!saveAwi.ok || !load?.awizacja?.confirmed) fail('ustalenia-awi', JSON.stringify({ saveAwi, awi: load?.awizacja, status: load?.status }))
else pass('ustalenia-awi', `confirmed · status=${load.status} · window=${load.awizacja.loadWindowStart}`)
await page.screenshot({ path: join(OUT, 'ustalenia.png') })
await page.keyboard.press('Escape')

// ─── Docs upload CTA ───
await nav('Dokumenty')
const docs = await page.evaluate(() => ({
  wgraj: [...document.querySelectorAll('button')].some((b) => /Wgraj dokument/i.test(b.textContent || '')),
  file: !!document.querySelector('input[type="file"]'),
  rows: document.querySelectorAll('table tbody tr, .docrow').length,
  h2: document.querySelector('h2')?.textContent,
}))
if (!docs.wgraj || docs.rows < 1) fail('docs-view', JSON.stringify(docs))
else pass('docs-view', JSON.stringify(docs))

// ─── Opcje cennik/BAF ───
await nav('Opcje')
const opcje = await page.evaluate(() => {
  const text = document.querySelector('main')?.innerText || ''
  return {
    h2s: [...document.querySelectorAll('h2')].map((h) => h.textContent?.trim()),
    hasCennik: /cennik bazowy/i.test(text),
    hasBaf: /BAF\s*\/\s*SEFS/i.test(text),
    inputs: document.querySelectorAll('main input').length,
  }
})
await page.screenshot({ path: join(OUT, 'opcje2.png') })
if (!opcje.hasCennik || !opcje.hasBaf || opcje.inputs < 10) fail('opcje-cennik-baf', JSON.stringify(opcje))
else pass('opcje-cennik-baf', JSON.stringify(opcje))

// DOM edit rate
const edited = await page.evaluate(() => {
  const inp = [...document.querySelectorAll('main input[type="number"]')][0]
  if (!inp) return { ok: false }
  const before = inp.value
  const native = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
  native.set.call(inp, '54321')
  inp.dispatchEvent(new Event('input', { bubbles: true }))
  inp.dispatchEvent(new Event('change', { bubbles: true }))
  inp.blur()
  return { ok: true, before, after: inp.value }
})
await sleep(500)
await page.reload({ waitUntil: 'networkidle0' })
await sleep(400)
await setRole('HHL')
await nav('Opcje')
st = await getStore()
const ratePersist = JSON.stringify(st?.rateCost?.[0] || {})
if (!/54321/.test(ratePersist) && edited.ok) {
  // check DOM
  const domVal = await page.evaluate(() => document.querySelector('main input[type="number"]')?.value)
  if (domVal === '54321') pass('opcje-dom-persist', `dom=${domVal}`)
  else fail('opcje-dom-persist', JSON.stringify({ edited, ratePersist, domVal }))
} else if (/54321/.test(ratePersist)) pass('opcje-dom-persist', ratePersist.slice(0, 120))
else note('opcje-dom-persist', JSON.stringify({ edited, ratePersist }))

// ─── WF create ───
await nav('Automatyzacje')
const wfBefore = (await getStore())?.workflows?.length
const wf = await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button')].find((b) => /Nowa reguła/i.test(b.textContent || ''))
  if (!btn) return { step: 'no-btn', labels: [...document.querySelectorAll('button')].map((b)=>b.textContent.trim()).slice(0,15) }
  btn.click()
  return { step: 'opened' }
})
await sleep(400)
const wfFill = await page.evaluate(() => {
  const dlg = document.querySelector('.wf-creator')
  if (!dlg) return { ok: false, dialogs: document.querySelectorAll('[role="dialog"]').length }
  const fields = [...dlg.querySelectorAll('.form-field, label')]
  for (const f of fields) {
    const t = f.textContent || ''
    const input = f.querySelector('input:not([type=checkbox]), textarea')
    if (!input) continue
    const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    const native = Object.getOwnPropertyDescriptor(proto, 'value')
    const set = (v) => { if (native?.set) native.set.call(input, v); else input.value = v; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })) }
    if (/nazwa/i.test(t)) set('P9 QA Reguła')
    else if (/wyzwal|trigger/i.test(t)) set('manual_test')
    else if (/warunek|condition/i.test(t)) set('true')
    else if (/akcj/i.test(t)) set('notify_hhl')
  }
  const save = [...dlg.querySelectorAll('button')].find((b) => /Zapisz|Utwórz|Dodaj|Utwórz regułę/i.test(b.textContent || ''))
  save?.click()
  return { ok: true, saved: !!save, saveLabel: save?.textContent }
})
await sleep(800)
st = await getStore()
const wfNew = (st?.workflows || []).find((w) => /P9 QA/i.test(w.name || ''))
if (!wfNew) fail('wf-create', JSON.stringify({ wf, wfFill, before: wfBefore, after: st?.workflows?.length, names: st?.workflows?.map(w=>w.name).slice(-4) }))
else pass('wf-create', `${wfBefore}→${st.workflows.length} · ${wfNew.name}`)

const ran = await page.evaluate(() => {
  const btn = document.querySelector('button.wf-run') || [...document.querySelectorAll('button')].find((b) => /Uruchom/i.test(b.textContent || ''))
  btn?.click()
  return !!btn
})
await sleep(600)
st = await getStore()
const notifBump = (st?.notifications || []).some((n) => /P9|workflow|reguł|automat/i.test((n.title || '') + (n.body || '')) || !n.read)
if (!ran) fail('wf-run', 'no button')
else pass('wf-run', `clicked · notifs=${st?.notifications?.length} bump=${notifBump}`)
await page.screenshot({ path: join(OUT, 'wf2.png') })

// ─── Plan B ───
await nav('Ryzyka')
await sleep(500)
const plan = await page.evaluate(() => {
  const text = document.querySelector('main')?.innerText || ''
  const btns = [...document.querySelectorAll('button.chipbtn, button')].filter((b) => /Przelicz/i.test(b.textContent || ''))
  const beforeRisk = null
  btns[0]?.click()
  return {
    hasAlt: /Alternatywy dla rejsu/i.test(text),
    hasPlanPanel: /Plan B|Alternatywy/i.test(text),
    przelicz: btns.length,
    clicked: btns[0]?.closest('tr')?.innerText?.slice(0, 80),
  }
})
await sleep(800)
st = await getStore()
const planEvidence = (st?.risks || []).some((r) => /Plan B aktywny/i.test(r.nextAction || '') || /Plan B aktywny/i.test(r.meta || ''))
const toast = await page.evaluate(() => [...document.querySelectorAll('.toast, .toasts li, [class*="toast"]')].map((t) => t.textContent?.trim()).slice(0, 5))
await page.screenshot({ path: join(OUT, 'planb2.png') })
if (!plan.hasPlanPanel || plan.przelicz < 1) fail('plan-b', JSON.stringify({ plan, toast }))
else if (!planEvidence && !toast.some((t) => /Plan B/i.test(t || ''))) {
  // check events
  const ev = (st?.events || []).filter((e) => /Plan B|FERRY|ferry/i.test(e.type + (e.note || ''))).slice(0, 3)
  if (ev.length) pass('plan-b', `events=${JSON.stringify(ev)} · ${plan.clicked}`)
  else fail('plan-b-mutate', JSON.stringify({ plan, toast, ferryRisks: (st?.risks||[]).filter(r=>r.type==='FERRY').map(r=>({id:r.id,next:r.nextAction,meta:r.meta})) }))
} else pass('plan-b', `applied=${planEvidence} toast=${toast[0]} · ${plan.clicked}`)

// ─── Factoring HHL ───
await nav('Faktury')
const factH = await page.evaluate(() => {
  const text = document.querySelector('main')?.innerText || ''
  return {
    has: /factoring/i.test(text),
    fee: /prowizja|%/i.test(text),
    h2: [...document.querySelectorAll('h2')].map((h) => h.textContent),
  }
})
if (!factH.has) fail('factoring-HHL', JSON.stringify(factH))
else pass('factoring-HHL', JSON.stringify(factH))

await setRole('SCX')
await nav('Faktury')
const factS = await page.evaluate(() => {
  const text = document.querySelector('main')?.innerText || ''
  return {
    has: /factoring/i.test(text),
    mode: /tryb płatności|płatność|standard/i.test(text),
    h2: [...document.querySelectorAll('h2')].map((h) => h.textContent),
  }
})
if (!factS.has && !factS.mode) fail('factoring-SCX', JSON.stringify(factS))
else pass('factoring-SCX', JSON.stringify(factS))

await page.screenshot({ path: join(OUT, 'factoring.png') })

// ─── Bell ───
await setRole('HHL')
const bell = await page.evaluate(() => {
  const btn = document.querySelector('button[aria-label*="owiadom"], button[aria-label*="otif"], button[aria-haspopup="dialog"]')
  // prefer the one with svg bell path
  const all = [...document.querySelectorAll('button.iconbtn')]
  const bellBtn = all.find((b) => b.querySelector('svg path[d*="M6 8a6"]')) || btn
  const unreadBefore = bellBtn?.querySelector('span')?.textContent
  bellBtn?.click()
  return { has: !!bellBtn, unreadBefore, opened: !!document.querySelector('.bell-pop') }
})
await sleep(300)
const mark = await page.evaluate(() => {
  const pop = document.querySelector('.bell-pop')
  const btn = [...(pop?.querySelectorAll('button') || [])].find((b) => /Przeczyt|Oznacz|wszyst/i.test(b.textContent || ''))
  btn?.click()
  return { hasPop: !!pop, markLabel: btn?.textContent?.trim() }
})
await sleep(400)
st = await getStore()
const unread = (st?.notifications || []).filter((n) => !n.read && (!n.roleScope || n.roleScope.includes('HHL'))).length
if (!bell.has || !bell.opened) fail('bell', JSON.stringify({ bell, mark }))
else if (mark.markLabel && unread > 0) fail('bell-mark', `unread left ${unread} · ${JSON.stringify(mark)}`)
else pass('bell', `opened · mark=${mark.markLabel} · unread=${unread} · was ${bell.unreadBefore}`)
await page.keyboard.press('Escape')

// ─── Spine ───
await nav('Kokpit')
await sleep(400)
const spine = await page.evaluate(() => {
  const stages = [...document.querySelectorAll('button.stage, .spine .stage, .stage')]
  // pick one with count > 0
  const hit = stages.find((s) => {
    const n = parseInt(s.querySelector('.n')?.textContent || '0', 10)
    return n > 0
  }) || stages[2]
  const label = hit?.querySelector('.l')?.textContent
  hit?.click()
  return { count: stages.length, label, hasKb: !!document.querySelector('.stage .kb') }
})
await sleep(600)
st = await getStore()
const stageOn = st?.stageFilter
const viewOn = st?.view
// second click clear — go back may be on map; find pressed
await page.evaluate(() => {
  const pressed = document.querySelector('.stage[aria-pressed="true"]') || document.querySelector('button.stage[aria-pressed="true"]')
  pressed?.click()
})
await sleep(500)
st = await getStore()
const stageOff = st?.stageFilter
if (spine.count < 5 || !spine.hasKb) fail('spine', JSON.stringify({ spine, stageOn, stageOff, viewOn }))
else if (!stageOn) fail('spine-filter', JSON.stringify({ spine, stageOn, viewOn }))
else if (stageOff != null && stageOff === stageOn) fail('spine-clear', JSON.stringify({ stageOn, stageOff }))
else pass('spine', `filter ${stageOn}→${JSON.stringify(stageOff)} view=${viewOn} · ${spine.label}`)

// ─── READY gate stricter ───
await reset()
await setRole('HHL')
await nav('Harmonogram')
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.code')].find((c) => c.textContent.includes('SG-34'))
  el?.closest('tr')?.click()
})
await sleep(700)
const gate = await page.evaluate(() => {
  const body = document.querySelector('.drawer')?.innerText || ''
  const btn = [...document.querySelectorAll('.drawer button')].find((b) => /Ustaw READY/i.test(b.textContent || ''))
  const status = document.querySelector('.drawer .pill, .drawer .wb-code')?.parentElement?.innerText
  btn?.click()
  return { hasBtn: !!btn, bodyHasBlock: /zablok|cover|mismatch|zezwolen|permit|READY/i.test(body), snippet: body.slice(0, 250) }
})
await sleep(500)
st = await getStore()
const sg34 = st?.loads?.find((l) => l.code === 'SG-34')
const blockedEv = (st?.events || []).some((e) => e.type === 'READY_BLOCKED')
const toast2 = await page.evaluate(() => [...document.querySelectorAll('[class*="toast"]')].map((t) => t.textContent?.trim()))
if (sg34?.status === 'READY') fail('ready-gate-SG34', `became READY · ${JSON.stringify({ gate, toast2 })}`)
else if (blockedEv || toast2.some((t) => /zablok/i.test(t || '')) || gate.bodyHasBlock) {
  pass('ready-gate-SG34', `status=${sg34?.status} permitFits=${sg34?.permitFits} · blocked ok`)
} else fail('ready-gate-SG34', JSON.stringify({ gate, status: sg34?.status, permitFits: sg34?.permitFits, toast2, blockedEv }))

await browser.close()

const summary = {
  pass: findings.filter((f) => f.verdict === 'PASS').length,
  fail: findings.filter((f) => f.verdict === 'FAIL').length,
  note: findings.filter((f) => f.verdict === 'NOTE').length,
  findings,
}
writeFileSync('/tmp/wt-p9-retest.json', JSON.stringify(summary, null, 2))
console.log(JSON.stringify({ pass: summary.pass, fail: summary.fail, note: summary.note }, null, 2))
for (const f of findings) console.log(f.verdict, f.id, '—', String(f.detail).slice(0, 200))
