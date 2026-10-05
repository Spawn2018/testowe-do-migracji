/**
 * A6-T2 — test pseudo-lokalizacji. Build: VITE_AUTH_MODE=demo VITE_PSEUDO=1 vite build; adres z `pseudo=1`
 * → każda wartość słownika w ⟦…⟧. Skrypt przechodzi wszystkie widoki (3 role × 3 języki bazowe, 1440),
 * szufladę transportu, powiadomienia i pomoc klawiatury, zbiera widoczny tekst (+ placeholder/title/aria-label)
 * i zgłasza każdy fragment poza ⟦…⟧, który nie jest daną (kody, statki, liczby, daty, nazwy własne z danych).
 * Użycie: BASE_URL=http://127.0.0.1:4187/ REPORT=/tmp/pseudo.json node scripts/pseudo-l10n.mjs
 * Wynik: liczba napisów spoza słownika; kod wyjścia 1, gdy > 0.
 */
import puppeteer from 'puppeteer-core'
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const chrome = ['/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium'].find(existsSync)
const BASE = (process.env.BASE_URL || 'http://127.0.0.1:4187/').replace(/\/?$/, '/')
const NOW = process.env.FROZEN_NOW || '2026-09-23T14:32:00Z'
const REPORT = process.env.REPORT || ''
const LANGS = (process.env.LANGS || 'pl').split(',')
const VIEWS = {
  HHL: ['dash', 'map', 'sched', 'risk', 'docs', 'fin', 'inv', 'wf', 'geo', 'options'],
  KSH: ['dash', 'map', 'sched', 'risk', 'docs', 'fin', 'inv', 'settings'],
  SCX: ['dash', 'map', 'sched', 'risk', 'docs', 'inv', 'tasks', 'fin', 'settings'],
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Dane (nie tekst interfejsu): kody, liczby, daty, jednostki, waluty, statki, rejestracje, e-maile, nazwy własne. */
const DATA = [
  /^[\s\d.,:;/%+\-−–—·×()[\]#|→←↑↓…'"°±≈<>=*!?&@]*$/u,
  /^(SG|T|R|KSH|HHL|SCX|FV|F|PLANB|WZ|CMR|PO|SE|PL)[-/ ]?[\w\-/]*\d[\w\-/.]*$/i,
  /^(PLN|EUR|SEK|t|km|h|min|m|m\/s|kg|km\/h|MB|KB|GB|%|d)$/,
  /^(M\/F|MF)\s/, /^(Nova Star|Wawel|Mazovia|Baltivia|Cracovia|Polonia|Finnlady|Finnswan)\b/,
  /^[A-Z]{2,3}\s?\d{3,5}[A-Z]{0,2}$/, /\S+@\S+\.\S+/, /^https?:\/\//, /^[A-Z]{1,3}$/,
  /^\d{1,2}[.:]\d{2}([.:]\d{2,4})?(\s\d{1,2}:\d{2})?$/, /^W\d{1,2}$/, /^\d{4}-W\d{2}$/,
]
const PROPER = new Set((process.env.PROPER_EXTRA || '').split('|').filter(Boolean))
const isData = (s) => DATA.some((re) => re.test(s)) || PROPER.has(s)

/**
 * A6 (27.09) — reguła twarda, niezależna od DATA/PROPER: widoczny tekst (albo jego segment między „·”, „|”, „→”)
 * równy kluczowi słownika albo w postaci klucza (^[a-z]+(_[a-z0-9]+)+$) = test czerwony.
 */
const I18N_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n')
const KEYS = new Set()
for (const f of readdirSync(I18N_DIR).filter((x) => x.endsWith('.ts'))) {
  for (const m of readFileSync(join(I18N_DIR, f), 'utf8').matchAll(/^\s+'?([A-Za-z_]\w*)'?\s*:/gm)) KEYS.add(m[1])
}
const KEY_SHAPE = /^[a-z]+(_[a-z0-9]+)+$/
const keyLeaks = new Map() // segment → Set(where)
function checkKeyLeak(text, where) {
  const segs = [text.trim(), ...text.split(/\s*[·|→←]\s*|\s{2,}|\n/).map((x) => x.trim())]
  for (const seg of segs) {
    if (!seg || !(KEYS.has(seg) || KEY_SHAPE.test(seg))) continue
    if (!keyLeaks.has(seg)) keyLeaks.set(seg, new Set())
    keyLeaks.get(seg).add(where)
  }
}

const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1000 })
const found = new Map() // text → Set(where)

async function collect(where) {
  const texts = await page.evaluate(() => {
    const out = []
    const vis = (el) => { if (!el) return false; const r = el.getClientRects(); if (!r.length) return false; const cs = getComputedStyle(el); return cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0' }
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
    let n
    while ((n = w.nextNode())) { const s = n.nodeValue; if (s && s.trim() && vis(n.parentElement) && !n.parentElement.closest('script,style,svg,.maplibregl-ctrl-attrib,.leaflet-control-attribution')) out.push(s) }
    for (const el of document.querySelectorAll('[placeholder],[title],[aria-label]')) {
      if (!vis(el)) continue
      for (const a of ['placeholder', 'title', 'aria-label']) { const v = el.getAttribute(a); if (v && v.trim()) out.push(v) }
    }
    return out
  })
  for (const raw of texts) {
    let s = raw
    // zdejmij ⟦…⟧ (także zagnieżdżone)
    for (let i = 0; i < 6 && /⟦[^⟦⟧]*⟧/.test(s); i++) s = s.replace(/⟦[^⟦⟧]*⟧/g, ' ')
    checkKeyLeak(s.replace(/[⟦⟧]/g, ''), where)
    for (const frag of s.split(/\s{2,}|\n/)) {
      const f = frag.replace(/[⟦⟧]/g, '').trim()
      if (!f || isData(f)) continue
      if (!found.has(f)) found.set(f, new Set())
      found.get(f).add(where)
    }
  }
}

async function boot(role, lang) {
  await page.goto(`${BASE}#/?now=${encodeURIComponent(NOW)}&pseudo=1`, { waitUntil: 'networkidle0', timeout: 120000 })
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k) })
  await page.reload({ waitUntil: 'networkidle0', timeout: 120000 })
  await page.waitForSelector('#roleSeg', { timeout: 30000 })
  await page.evaluate((id) => document.querySelector(`#roleSeg button[data-role="${id}"]`)?.click(), role); await sleep(400)
  /* B-SMOKE-LANG: brak #langSeg — PL-only; skip click */
  if (lang !== "pl") throw new Error("B-SMOKE-LANG: tylko pl"); await sleep(50)
}

for (const lang of LANGS) {
  for (const role of Object.keys(VIEWS)) {
    await boot(role, lang)
    for (const v of VIEWS[role]) {
      const ok = await page.evaluate((k) => { const b = document.querySelector(`nav button[data-view="${k}"]`); if (b) b.click(); return !!b }, v)
      if (!ok) continue
      await sleep(700)
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 800) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)) } window.scrollTo(0, 0) })
      await collect(`${v}/${role}/${lang}`)
      if (v === 'sched' || v === 'dash') {
        // szuflada transportu: pierwszy wiersz z data-load, potem wszystkie zakładki
        const opened = await page.evaluate(() => { const r = document.querySelector('[data-load]'); if (r) { r.click(); return true } return false })
        if (opened) {
          await sleep(700)
          const nTabs = await page.evaluate(() => document.querySelectorAll('.dtabs button').length)
          for (let i = 0; i < Math.max(1, nTabs); i++) {
            await page.evaluate((j) => document.querySelectorAll('.dtabs button')[j]?.click(), i); await sleep(350)
            await collect(`drawer${i}/${role}/${lang}`)
          }
          await page.keyboard.press('Escape'); await sleep(300)
        }
      }
    }
    const bell = await page.evaluate(() => { const b = document.querySelector('.bell, [data-bell], #bellBtn, button[aria-haspopup]'); if (b) { b.click(); return true } return false })
    if (bell) { await sleep(400); await collect(`bell/${role}/${lang}`); await page.keyboard.press('Escape') }
    await page.keyboard.press('?'); await sleep(300); await collect(`help/${role}/${lang}`); await page.keyboard.press('Escape')
  }
}
await browser.close()
const list = [...found.entries()].map(([text, w]) => ({ text, where: [...w].slice(0, 6), n: w.size })).sort((a, b) => a.text.localeCompare(b.text))
const leaks = [...keyLeaks.entries()].map(([text, w]) => ({ text, where: [...w].slice(0, 6), n: w.size }))
if (REPORT) writeFileSync(REPORT, JSON.stringify({ count: list.length, keyLeaks: leaks, items: list }, null, 1))
console.log(`pseudo-l10n: ${list.length} napisów spoza słownika; klucze/identyfikatory widoczne: ${leaks.length} (reguła twarda)`)
for (const l of leaks) console.log(`  KLUCZ ${JSON.stringify(l.text)}  ← ${l.where.join(', ')}`)
for (const i of list.slice(0, Number(process.env.SHOW || 60))) console.log(`  ${JSON.stringify(i.text)}  ← ${i.where.join(', ')}`)
process.exit(leaks.length || list.length ? 1 : 0)
