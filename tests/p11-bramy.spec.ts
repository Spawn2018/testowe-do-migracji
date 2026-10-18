/**
 * wyglad/W-bramy-P11 — PLAN §4 P11 pkt 3 „Bramy na stałe” (koordynator; poprawki po F7 #301).
 * - E20: komputer 1280 / 1366 / 1440 / 1920 — bez nakładania (kolumny tabel, kafelki i panele w siatce), bez uciętego
 *   i wylanego tekstu, treść nie szersza od okna, pasek górny w jednej linii; Harmonogram „Widok skrócony” bez
 *   przewijania w bok przy 1280 i 1366 (E20 pkt 5, E30; układ pliku KSH przewija się — E38 1A).
 * - E21: strażnik tekstów — 5 rodzajów kont, strony, ekrany Opcji, dzwonek, rozwinięte sprawy Ryzyk, panel transportu.
 * - E10: kontrast (axe-core, `color-contrast`, WCAG AA) — 3 firmy × 2 motywy, komputer i telefon, ekrany Opcji (także
 *   Operacje HHL i Użytkownik SCX), panel, dzwonek, okna, rozwinięte sprawy Ryzyk, najechany wiersz Mapy.
 * Każdy ekran sprawdzany dopiero po dorysowaniu: korzeń widoku albo zakładki panelu z treścią i bez zmian w drzewie przez
 * 400 ms (MutationObserver); strażnik tekstów czyta drugi raz po 0,8 s (treść dopisana później). Dane demo, zegar zamrożony.
 * CI: `scripts/ci/fresh-smoke.sh` (4 wątki). F7 #301 r2: lokalnie Chromium 141, w CI 153 — zielone lokalnie ≠ zielone w CI.
 */
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { textHits } from './e21Rules'

test.describe.configure({ mode: 'parallel' })

const NOW = '2026-09-23T14%3A32%3A00Z'
const LATE = '2026-11-20T10%3A00%3A00Z'
const PAGES = ['/kokpit', '/mapa', '/harmonogram', '/ryzyka', '/dokumenty', '/finanse', '/faktury', '/automatyzacje', '/strefy', '/opcje', '/ustawienia', '/opcje/stan-systemu']
const TABS = ['overview', 'timeline', 'docs', 'pricing', 'chat', 'history'] as const
type Role = 'HHL' | 'KSH' | 'SCX'

/* ---------- wspólne ---------- */

/** Podkład mapy bez sieci: tylko obrazy z hostów kafelków (nie pliki aplikacji). */
async function blockTiles(page: Page) {
  await page.route(
    (u) => /(^|\.)(arcgisonline\.com|openstreetmap\.org|cartocdn\.com|stadiamaps\.com|mapbox\.com|hereapi\.com|here\.com)$/i.test(u.hostname),
    (r) => r.abort(),
  )
}

/** Czyste dane demo, rola, konto i motyw; zwraca budowanie adresu z tym samym zegarem i kontem. */
/**
 * F7 #301 r3 B1: treść, która przychodzi później niż odczyty strażnika (np. po 2 s), też jest sprawdzana — obserwator
 * zmian w DOM zbiera widoczny tekst każdego dodanego albo zmienionego węzła od wejścia na ekran (`takeSeen`).
 */
const SEEN_INIT = `(() => {
  const w = window; w.__wtSeen = new Set();
  const vis = (el) => !!el && el.isConnected && !el.closest('script,style,noscript,template,.sr-only,.sronly,.leaflet-container')
    && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const add = (el) => { if (vis(el)) { const t = (el.innerText || '').trim(); if (t) w.__wtSeen.add(t); } };
  const start = () => new MutationObserver((ms) => {
    for (const m of ms) {
      if (m.type === 'characterData') add(m.target.parentElement);
      else for (const n of m.addedNodes) add(n.nodeType === 1 ? n : n.parentElement);
    }
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start);
})()`
const takeSeen = (page: Page): Promise<string[]> => page.evaluate(() => {
  const w = window as unknown as { __wtSeen?: Set<string> }
  const out = [...(w.__wtSeen ?? [])]
  w.__wtSeen?.clear()
  return out
})
/** Najkrótszy pobyt na ekranie przed ostatnim odczytem (od `go`, `openOpt`, `openTab`): strony 3 s, panel i Opcje 1,6 s. */
const entered = new WeakMap<Page, number>()
/* F7 #301 r4 B1: tekst, który przyszedł po odczycie `scan()`, a przed wyjściem z ekranu, jest sprawdzany przy wyjściu
   (`enter` następnego ekranu albo `lateHits` na końcu testu) — z nazwą i wyjątkami ostatniego `scan()` */
const lastScan = new WeakMap<Page, { where: string; o: { codesAllowed?: boolean } }>()
const lateOut = new WeakMap<Page, string[]>()
const enter = async (page: Page) => {
  entered.set(page, Date.now())
  const seen = await takeSeen(page).catch(() => [] as string[])
  const ctx = lastScan.get(page)
  if (ctx && seen.length) lateOut.set(page, [...(lateOut.get(page) ?? []), ...seen.flatMap((x) => textHits(x, `${ctx.where} (po odczycie)`, ctx.o))])
  lastScan.delete(page)
}
async function lateHits(page: Page): Promise<string[]> {
  await enter(page)
  const out = lateOut.get(page) ?? []
  lateOut.delete(page)
  return out
}
async function dwell(page: Page, ms: number) {
  const left = (entered.get(page) ?? 0) + ms - Date.now()
  if (left > 0) await page.waitForTimeout(left)
}

async function boot(page: Page, o: { role?: Role; clock?: string; konto?: string; width?: number; height?: number; theme?: 'light' | 'dark' } = {}) {
  const { role = 'HHL', clock = NOW, konto = '', width = 1440, height = 900 } = o
  await page.addInitScript(SEEN_INIT)
  await blockTiles(page)
  await page.setViewportSize({ width, height })
  const at = (path: string) => `/#${path}?now=${clock}${konto}`
  await page.goto(at('/kokpit'), { waitUntil: 'networkidle', timeout: 120_000 })
  await page.evaluate(() => { for (const k of Object.keys(localStorage)) if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k) })
  await page.reload({ waitUntil: 'networkidle', timeout: 120_000 })
  await page.waitForSelector('#roleSeg', { state: 'attached', timeout: 30_000 })
  if (role !== 'HHL') {
    await page.evaluate((r) => (document.querySelector(`#roleSeg button[data-role="${r}"]`) as HTMLButtonElement).click(), role)
    await page.waitForTimeout(200)
  }
  if (o.theme) {
    const cur = await page.evaluate(() => (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'))
    if (cur !== o.theme) {
      await page.evaluate(() => (document.querySelector('#themeBtn') as HTMLButtonElement).click())
      await page.waitForTimeout(200)
    }
    expect(await page.evaluate(() => (document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'))).toBe(o.theme)
  }
  return at
}

/**
 * Czeka, aż treść się dorysuje (F7 #301 B3): korzeń `sel` istnieje i ma tekst, potem drzewo bez zmian (węzły, tekst)
 * przez `quietMs` — liczone przez MutationObserver; najwyżej 8 s.
 */
async function settle(page: Page, sel = 'main', quietMs = 400) {
  await page.evaluate(async ({ s, q }) => {
    await document.fonts?.ready
    const t0 = performance.now()
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
    const root = () => document.querySelector(s) as HTMLElement | null
    while (performance.now() - t0 < 8000 && !((root()?.innerText.trim().length ?? 0) > 0)) await sleep(50)
    const r = root()
    if (!r) return
    let last = performance.now()
    const mo = new MutationObserver(() => { last = performance.now() })
    mo.observe(r, { subtree: true, childList: true, characterData: true })
    while (performance.now() - t0 < 8000 && performance.now() - last < q) await sleep(50)
    mo.disconnect()
  }, { s: sel, q: quietMs })
}

/** Strona: widok z `data-page` musi się wczytać (leniwe części aplikacji), potem cisza w `main`. Kursor poza treścią (F7 D10). */
async function go(page: Page, url: string, sel = 'main') {
  await page.mouse.move(0, 0)
  await enter(page)
  await page.goto(url)
  await page.waitForSelector('main [data-page]', { timeout: 15_000 })
  await settle(page, sel)
}

/** Otwiera transport w panelu (musi się otworzyć) — zawsze od zakładki Przegląd (panel pamięta ostatnią zakładkę). */
async function openLoad(page: Page, url: string) {
  await enter(page)
  await page.goto(url)
  await page.waitForSelector('aside.drawer #dtab-overview', { timeout: 15_000 })
  await page.evaluate(() => (document.getElementById('dtab-overview') as HTMLButtonElement).click())
  await page.waitForSelector('aside.drawer [data-overview]', { timeout: 15_000 })
  await settle(page, 'aside.drawer #dpanel')
}

/**
 * Zakładka panelu — musi istnieć; czeka na treść samej zakładki (`#dpanel`): zakładki wczytują się osobno i do tego czasu
 * pole jest puste, a nagłówek panelu ma tekst (F7 #301 B3 pkt 2). Potem cisza w zakładce.
 */
async function openTab(page: Page, id: (typeof TABS)[number]) {
  const btn = page.locator(`#dtab-${id}`)
  await expect(btn, `zakładka ${id}`).toHaveCount(1)
  await enter(page)
  await page.evaluate((x) => (document.getElementById(x) as HTMLButtonElement).click(), `dtab-${id}`)
  await expect(btn).toHaveAttribute('aria-selected', 'true')
  await expect.poll(() => page.evaluate(() => (document.querySelector('aside.drawer #dpanel') as HTMLElement | null)?.innerText.trim().length ?? 0), { timeout: 15_000, message: `treść zakładki ${id}` }).toBeGreaterThan(0)
  await settle(page, 'aside.drawer #dpanel')
}

/**
 * Ryzyka: cała lista („pokaż resztę”), potem każda karta po kolei — karty działają jak akordeon (otwarcie jednej zamyka
 * poprzednią), więc sprawdzenie idzie kartą po karcie (F7 #301 B4 pkt 2). `fn` dostaje kartę oznaczoną `[data-axe-target]`.
 */
async function eachRiskCard(page: Page, fn: (i: number) => Promise<void>) {
  const rest = page.locator('[data-rk-rest]')
  if (await rest.count()) { await rest.first().click(); await settle(page) }
  const n = await page.locator('.rk-card-hd').count()
  for (let i = 0; i < n; i++) {
    const ok = await page.evaluate((k) => {
      const hd = document.querySelectorAll<HTMLElement>('.rk-card-hd')[k]
      if (!hd) return false
      /* klik w DOM: nagłówek bywa poza ekranem albo przykryty */
      if (hd.getAttribute('aria-expanded') === 'false') hd.click()
      for (const e of document.querySelectorAll('[data-axe-target]')) e.removeAttribute('data-axe-target')
      ;(hd.closest('[data-rk-card]') ?? hd.parentElement)?.setAttribute('data-axe-target', '')
      return true
    }, i)
    if (!ok) continue
    await settle(page, '[data-axe-target]', 250)
    await fn(i)
  }
}

/** Ostatnie okno modalne (`aria-modal`) jako cel sprawdzenia — panel transportu też ma `role="dialog"` (F7 #301 B4 pkt 1). */
async function markLastModal(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    for (const e of document.querySelectorAll('[data-axe-target]')) e.removeAttribute('data-axe-target')
    const all = [...document.querySelectorAll('[aria-modal="true"]')]
    const el = all[all.length - 1]
    if (!el) return false
    el.setAttribute('data-axe-target', '')
    return true
  })
}

async function optNavs(page: Page): Promise<string[]> {
  return page.locator('[data-opt-nav]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('data-opt-nav') ?? ''))].filter(Boolean))
}

async function openOpt(page: Page, n: string) {
  await enter(page)
  await page.locator(`[data-opt-nav="${n}"]`).first().click()
  await settle(page)
}

/* ---------- E20 — szerokości komputera ---------- */

const layoutHits = (rootSel: string) => {
  const out: string[] = []
  const t = (el: Element) => (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 40)
  const shown = (el: Element) => {
    if (el.closest('.sr-only,.leaflet-container')) return false
    const r = el.getBoundingClientRect()
    return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== 'hidden'
  }
  const over = (a: DOMRect, b: DOMRect) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2
  for (const root of document.querySelectorAll(rootSel)) {
    /* treść szersza niż okno — `main` i panel ucinają nadmiar (`overflow-x: hidden`) */
    const rcs = getComputedStyle(root)
    if ((rcs.overflowX === 'hidden' || rcs.overflowX === 'clip') && root.scrollWidth > root.clientWidth + 1) out.push(`treść szersza: ${root.scrollWidth} > ${root.clientWidth}`)
    /* F7 #301 B1: przewijanie w bok w środku (panel: `.dbody`) — dozwolone tylko w opakowaniu tabeli */
    for (const sc of [root, ...root.querySelectorAll('*')]) {
      const cs = getComputedStyle(sc)
      if (!/auto|scroll/.test(cs.overflowX) || sc.closest('.leaflet-container')) continue
      if (sc.scrollWidth <= sc.clientWidth + 1 || sc.clientWidth === 0) continue
      /* F7 #301 r3 P1: zwolnione tylko opakowanie tabeli (tabela bezpośrednio w środku), nie każdy obszar z tabelą głębiej */
      const wide = [...sc.children].some((tb) => tb.tagName === 'TABLE' && tb.getBoundingClientRect().width > sc.clientWidth + 1)
      if (!wide) out.push(`przewijanie w bok ${sc.tagName.toLowerCase()}.${[...sc.classList].join('.')}: ${sc.scrollWidth} > ${sc.clientWidth}`)
    }
    for (const tr of root.querySelectorAll('tr')) {
      const cells = [...tr.children].filter((c) => c.getBoundingClientRect().width > 0)
      for (let i = 0; i < cells.length; i++) for (let j = i + 1; j < cells.length; j++) {
        if (over(cells[i].getBoundingClientRect(), cells[j].getBoundingClientRect())) out.push(`kolumny: «${t(cells[i]).slice(0, 20)}» × «${t(cells[j]).slice(0, 20)}»`)
      }
      for (const c of cells) {
        if (getComputedStyle(c).overflowX === 'visible' && c.scrollWidth > c.clientWidth + 2 && t(c)) out.push(`wylany tekst ${c.tagName.toLowerCase()}: «${t(c)}»`)
      }
    }
    for (const el of root.querySelectorAll('*')) {
      if (!shown(el)) continue
      const cs = getComputedStyle(el)
      if ((cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1 && el.clientWidth > 0 && t(el)) {
        out.push(`ucięte ${el.tagName.toLowerCase()}.${[...el.classList].join('.')}: «${t(el)}»`)
      }
      if (/grid|flex/.test(cs.display)) {
        const kids = [...el.children].filter((k) => { const s = getComputedStyle(k); return shown(k) && s.position !== 'absolute' && s.position !== 'fixed' && s.position !== 'sticky' })
        for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) {
          if (over(kids[i].getBoundingClientRect(), kids[j].getBoundingClientRect())) out.push(`nakładanie w ${el.tagName.toLowerCase()}.${[...el.classList].join('.')}: «${t(kids[i]).slice(0, 20)}» × «${t(kids[j]).slice(0, 20)}»`)
        }
      }
    }
  }
  const se = document.scrollingElement!
  if (se.scrollWidth > innerWidth + 1) out.push(`dokument szerszy: ${se.scrollWidth} > ${innerWidth}`)
  /* E20 pkt 2 i 5: pasek górny w jednej linii — treść nie wyższa od paska (52 px) */
  const top = document.querySelector('header.topbar') as HTMLElement | null
  if (top) {
    if (top.scrollHeight > top.clientHeight + 1) out.push(`pasek górny: treść ${top.scrollHeight} px > ${top.clientHeight} px`)
    /* F7 #301 D11: napis w pasku w dwóch liniach, nawet gdy mieści się w 52 px */
    const walker = document.createTreeWalker(top, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!(n.textContent ?? '').trim() || (n.parentElement && n.parentElement.closest('[role="menu"],[role="dialog"]'))) continue
      const rg = document.createRange()
      rg.selectNodeContents(n)
      const tops = new Set([...rg.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top)))
      if (tops.size > 1) out.push(`pasek górny: tekst w ${tops.size} liniach «${(n.textContent ?? '').trim().slice(0, 30)}»`)
    }
    for (const el of top.querySelectorAll('*')) {
      const r = el.getBoundingClientRect()
      if (r.height > top.clientHeight + 1 && getComputedStyle(el).position !== 'fixed' && !el.closest('[role="menu"],[role="dialog"]')) out.push(`pasek górny: ${el.tagName.toLowerCase()}.${[...el.classList].join('.')} ${Math.round(r.height)} px`)
    }
  }
  return [...new Set(out)]
}

const WIDTHS = [[1280, 800], [1366, 768], [1440, 900], [1920, 1080]] as const

test.describe('P11 pkt 3 — E20 szerokości komputera', () => {
  for (const role of ['HHL', 'KSH', 'SCX'] as const) {
    for (const [clock, pages] of [[NOW, PAGES], [LATE, ['/kokpit', '/harmonogram', '/finanse', '/faktury']]] as const) {
      test(`${role}, zegar ${clock.slice(5, 10)}: strony i panel przy 1280–1920`, async ({ page }) => {
        test.setTimeout(240_000)
        const at = await boot(page, { role, clock })
        const bad: string[] = []
        for (const p of pages) {
          await page.setViewportSize({ width: 1440, height: 900 })
          await go(page, at(p))
          for (const [w, h] of WIDTHS) {
            await page.setViewportSize({ width: w, height: h })
            await settle(page)
            bad.push(...(await page.evaluate(layoutHits, 'main')).map((x) => `${p} @${w}: ${x}`))
          }
        }
        if (clock === NOW) {
          for (const c of ['SG-03', 'SG-32', 'T-01']) {
            await page.setViewportSize({ width: 1280, height: 800 })
            await openLoad(page, at(`/transport/${c}`))
            for (const tab of TABS) {
              await openTab(page, tab)
              bad.push(...(await page.evaluate(layoutHits, 'aside.drawer')).map((x) => `panel ${c} › ${tab} @1280: ${x}`))
            }
          }
        }
        expect(bad, bad.join('\n')).toEqual([])
      })
    }
  }

  test('Harmonogram „Widok skrócony” (8 kolumn) bez przewijania w bok przy 1280 i 1366 — HHL, KSH, SCX', async ({ page }) => {
    test.setTimeout(120_000)
    const bad: string[] = []
    for (const role of ['HHL', 'KSH', 'SCX'] as const) {
      const at = await boot(page, { role })
      await go(page, at('/harmonogram'))
      await page.locator('[data-sched-short]').click()
      await expect(page.locator('[data-sched-short]')).toHaveAttribute('aria-pressed', 'true')
      for (const [w, h] of WIDTHS.slice(0, 2)) {
        await page.setViewportSize({ width: w, height: h })
        await settle(page)
        const s = await page.evaluate(() => [...document.querySelectorAll('main *')]
          .filter((e) => e.querySelector(':scope > table') && /auto|scroll/.test(getComputedStyle(e).overflowX))
          .map((e) => ({ over: e.scrollWidth - e.clientWidth, cols: e.querySelector('table thead tr:last-child')?.children.length ?? 0 })))
        expect(s.length, `${role} @${w}: tabela Harmonogramu`).toBeGreaterThan(0)
        for (const x of s) if (x.over > 1) bad.push(`${role} @${w}: ${x.over} px przewijania przy ${x.cols} kolumnach`)
      }
    }
    expect(bad, bad.join('\n')).toEqual([])
  })
})

/* ---------- E21 — strażnik tekstów ---------- */

/* reguły i wyjątki — `tests/e21Rules.ts` (wspólne z testem treści wiadomości) */
const innerText = (page: Page, sel: string) => page.evaluate((s) => (document.querySelector(s) as HTMLElement | null)?.innerText ?? '', sel)

/**
 * Strażnik czyta dwa razy: po dorysowaniu i po pobycie na ekranie (strona 3 s, panel i Opcje 1,6 s, najmniej 0,8 s
 * między odczytami), a do tego cały widoczny tekst dodany w tym czasie gdziekolwiek na stronie (`takeSeen`) — także
 * komunikat, który pojawił się i zniknął (F7 #301 B3, r3 B1).
 */
async function scan(page: Page, sel: string, where: string, o: { codesAllowed?: boolean; dwellMs?: number } = {}): Promise<string[]> {
  const a = await innerText(page, sel)
  await page.waitForTimeout(800)
  await dwell(page, o.dwellMs ?? 1600)
  const b = await innerText(page, sel)
  const seen = await takeSeen(page)
  lastScan.set(page, { where, o: { codesAllowed: o.codesAllowed } })
  return [...new Set([...textHits(a, where, o), ...textHits(b, where, o), ...seen.flatMap((x) => textHits(x, `${where} (dopisane później)`, o))])]
}

test.describe('P11 pkt 3 — E21 strażnik tekstów', () => {
  const KINDS = [['HHL', ''], ['HHL', '&konto=operacje'], ['KSH', ''], ['SCX', ''], ['SCX', '&konto=uzytkownik']] as const
  const LOADS_NOW = ['SG-03', 'SG-07', 'SG-08', 'SG-09', 'SG-10', 'SG-15', 'SG-22', 'SG-32', 'SG-36', 'T-01', 'T-05', 'T-17', 'K-03']
  const LOADS_LATE = ['SG-03', 'SG-32', 'T-01']
  for (const [role, konto] of KINDS) {
    for (const clock of [NOW, LATE]) {
      test(`${role}${konto ? ` ${konto.slice(7)}` : ''}, zegar ${clock.slice(5, 10)}: strony, Opcje, dzwonek, Ryzyka, panel — 0 trafień`, async ({ page }) => {
        test.setTimeout(480_000)
        const at = await boot(page, { role, clock, konto })
        const hits: string[] = []
        for (const p of PAGES) {
          await go(page, at(p))
          hits.push(...await scan(page, 'main', p, { codesAllowed: p === '/opcje/stan-systemu', dwellMs: 3000 }))
          if (p === '/ryzyka') await eachRiskCard(page, async (i) => { hits.push(...textHits(await innerText(page, '[data-axe-target]'), `/ryzyka › karta ${i + 1}`)) })
          if (p === '/opcje') {
            for (const n of await optNavs(page)) {
              await openOpt(page, n)
              hits.push(...await scan(page, 'main', `/opcje › ${n}`, { codesAllowed: n === 'status' }))
            }
          }
        }
        await go(page, at('/kokpit'))
        /* F7 #301 r3 B1: Kokpit jeszcze raz w całości (późny komunikat o podkładzie), potem dzwonek */
        hits.push(...await scan(page, 'main', '/kokpit (powrót)', { dwellMs: 3000 }))
        await enter(page)
        await page.locator('.bell-trigger').first().click()
        await settle(page, '.bell-wrap')
        hits.push(...await scan(page, '.bell-wrap', 'dzwonek'))
        if (konto !== '&konto=operacje') {
          for (const c of clock === NOW ? LOADS_NOW : LOADS_LATE) {
            await openLoad(page, at(`/transport/${c}`))
            for (const tab of TABS) {
              await openTab(page, tab)
              hits.push(...await scan(page, 'aside.drawer', `panel ${c} › ${tab}`))
            }
          }
        }
        hits.push(...await lateHits(page))
        const u = [...new Set(hits)]
        expect(u, u.join('\n')).toEqual([])
      })
    }
  }

  test('reguły strażnika: łapią przykłady z audytu i przepuszczają daty, pliki i licencję', () => {
    const bad = [
      'NO_AWIZACJA · 2.10.2026, 12:00:00 · po terminie', 'Zakaz czasowy SE: plan 2026-10-10', '2026-10-01T12:00:00Z',
      'mnożnik SEK 1.120', 'Realizacja 4.8% · 1726,59 PLN', '22.49 SEK/l', '12.10 PLN', '5c77d4d7: brak awizacji', '5C77D4D7',
      'sail_src_STENA', 'risk.kind.no_awizacja', '1 pojazdów w ruchu', '22 pojazdów', '5 pojazdy', 'kwota 8239,15', 'fala 3.4 m',
      'E4: från Backen till Gärde', 'Nieznany kod źródła drogowego', 'undefined',
      '-8239,15 PLN', 'razem\u00a08239,15 PLN', '4500 PLN', 'Mon Oct 12 2026 12:00 GMT+0200', '12345 km', '40000 kg',
      'SMS według zasad (E42)', 'jak w E41', 'obowiązkowy (W12)', 'przed załadunkiem (III-4)', 'w systemie (I-21)', 'decyzji (E5-2)', '(E35 pkt 2)', 'marża 14,27 %', '10 (83\u00a0%)',
    ]
    for (const s of bad) expect(textHits(s, 't').length, s).toBeGreaterThan(0)
    const ok = [
      'termin 07.10, 12:00', '31.12.2026', 'HHL_FV_2026_0902.pdf', 'WATCH_TOWER_SG-07.PDF', 'Źródło: SMHI (CC BY 4.0)',
      '1 726,59 PLN', '1 pojazd w ruchu', '22 pojazdy', '5 pojazdów', 'z 3 transportów', 'decade effaced deadbeef',
      'SG-03 · HHL/2026/1304', '+1 h 35 min po oknie', '4,8%', 'biuro@h-h.pl', 'tower.log-mar.pl', '2 minuty temu',
      '1050 km do placu', 'Brak 2 dokumentów', 'Dotyczy 3 transportów', 'w ciągu 2 godzin', 'sprzed 2 godzin', 'brakuje 3 plików',
      'api.trafikinfo.trafikverket.se', 'jan_kowalski@firma.pl', 'kolor #1a2b3c4d', '−8 239,15 PLN', 'Högakustenbron (E4)',
      'zamknięcie (E22)', 'Inlandsvägen (E45)', 'marża 14,27%', '10 (83%)', 'Tydzień (t43)',
    ]
    for (const s of ok) expect(textHits(s, 't'), s).toEqual([])
    /* w Stanie systemu kody są dozwolone (E21 pkt 3) */
    expect(textHits('SOURCE_DOWN:EMTRACK_WEB', 't', { codesAllowed: true })).toEqual([])
  })
})

/* ---------- E10 — kontrast ---------- */

const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')

/* F7 #301 r2 P6: węzły, których axe nie ocenia („incomplete”: zasłonięte przez przyklejone kolumny, nakryte, poza oknem),
   mierzymy sami — kolor tekstu (z przezroczystością) na złożonym tle przodków. Pomijamy tylko podkład mapy (obraz)
   oraz pojedyncze znaki i ikony (axe: shortTextContent, nonBmp, pseudoContent, imgNode). */
async function contrast(page: Page, where: string, out: string[], sel = 'main') {
  /* F7 #301 r3 B1: strona — dopiero po 3 s od wejścia (późne komunikaty, np. o podkładzie na Kokpicie) */
  if (sel === 'main') { await dwell(page, 3000); await settle(page) }
  if (!(await page.evaluate(() => 'axe' in window))) await page.addScriptTag({ content: AXE })
  const r = await page.evaluate(async (s) => {
    type AxeNode = { target: string[]; element?: Element; any: { message: string; data?: { messageKey?: string } | null }[] }
    const w = window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { nodes: AxeNode[] }[]; incomplete: { id: string; nodes: AxeNode[] }[] }> } }
    const root = document.querySelector(s)
    if (!root) return { v: [`brak ${s}`], inc: 0, own: 0, skip: 0 }
    const res = await w.axe.run(root, { runOnly: { type: 'rule', values: ['color-contrast'] }, resultTypes: ['violations', 'incomplete'], elementRef: true })
    const v = res.violations.flatMap((x) => x.nodes.map((n) => `${n.target.join(' ')} — ${n.any[0]?.message ?? ''}`.slice(0, 220)))
    const parse = (c: string): number[] | null => {
      let m = c.match(/^rgba?\(([^)]+)\)$/)
      if (m) { const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1] }
      m = c.match(/^color\(srgb ([^)]+)\)$/)
      if (m) { const p = m[1].split(/[\s/]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] ?? 1] }
      return null
    }
    const over = (a: number[], b: number[]) => [0, 1, 2].map((k) => a[k] * a[3] + b[k] * (1 - a[3])).concat(1)
    const lum = (c: number[]) => { const f = (x: number) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4 }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]) }
    const SKIP = new Set(['shortTextContent', 'nonBmp', 'pseudoContent', 'imgNode', 'bgImage'])
    let own = 0, skip = 0
    for (const n of res.incomplete.filter((x) => x.id === 'color-contrast').flatMap((x) => x.nodes)) {
      const el = n.element as HTMLElement | undefined
      const key = n.any[0]?.data?.messageKey ?? ''
      if (!el || SKIP.has(key) || el.closest('.leaflet-container')) { skip++; continue }
      const cs = getComputedStyle(el)
      const fg0 = parse(cs.color)
      const layers: number[][] = []
      let opacity = 1
      for (let e: Element | null = el; e; e = e.parentElement) {
        const st = getComputedStyle(e)
        opacity *= Number(st.opacity)
        const bg = parse(st.backgroundColor)
        if (bg === null) { layers.length = 0; break }
        if (bg[3] > 0) { layers.push(bg); if (bg[3] >= 1) break }
      }
      if (!fg0 || !layers.length || layers[layers.length - 1][3] < 1) { skip++; continue }
      let bg = layers[layers.length - 1]
      for (let k = layers.length - 2; k >= 0; k--) bg = over(layers[k], bg)
      const fg = over([fg0[0], fg0[1], fg0[2], fg0[3] * opacity], bg)
      const [hi, lo] = [lum(fg), lum(bg)].sort((a, b) => b - a)
      const ratio = (hi + 0.05) / (lo + 0.05)
      const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700
      const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5
      own++
      if (ratio < need - 0.005) v.push(`${n.target.join(' ')} — pomiar własny (axe: ${key || 'incomplete'}): ${ratio.toFixed(2)} < ${need} — «${(el.textContent ?? '').trim().slice(0, 40)}»`.slice(0, 260))
    }
    return { v, inc: own + skip, own, skip }
  }, sel)
  out.push(...r.v.map((x) => `${where}: ${x}`))
  if (r.inc) test.info().annotations.push({ type: 'axe incomplete', description: `${where}: ${r.inc} (zmierzone osobno ${r.own}, pominięte ${r.skip})` })
}

test.describe('P11 pkt 3 — E10 kontrast', () => {
  for (const role of ['HHL', 'KSH', 'SCX'] as const) {
    for (const theme of ['light', 'dark'] as const) {
      test(`${role}, ${theme === 'light' ? 'jasny' : 'ciemny'}, komputer: strony, stany, Opcje, panel, dzwonek, okna — 0 węzłów`, async ({ page }) => {
        test.setTimeout(300_000)
        const at = await boot(page, { role, theme })
        const bad: string[] = []
        for (const p of PAGES) {
          await go(page, at(p))
          await contrast(page, p, bad)
          if (p === '/ryzyka') await eachRiskCard(page, async (i) => { await contrast(page, `/ryzyka › karta ${i + 1}`, bad, '[data-axe-target]') })
          if (p === '/mapa') {
            const row = page.locator('.map-loads-table tbody tr[data-load]').first()
            if (await row.count()) { await row.hover(); await page.waitForTimeout(150); await contrast(page, '/mapa (najechany wiersz)', bad, '.map-loads-table') }
          }
          /* F7 #301 D10: najechany wiersz Harmonogramu wprost — zwykły i „Dostarczone” (przygaszony) */
          if (p === '/harmonogram') {
            for (const [name, sel] of [['wiersz', 'tbody tr[data-load]:not(.done)'], ['wiersz dostarczony', 'tbody tr.done[data-load]']] as const) {
              const row = page.locator(`main ${sel}`).first()
              if (!(await row.count())) continue
              await row.hover()
              await page.waitForTimeout(150)
              await page.evaluate((q) => {
                for (const e of document.querySelectorAll('[data-axe-target]')) e.removeAttribute('data-axe-target')
                document.querySelector(`main ${q}`)?.setAttribute('data-axe-target', '')
              }, sel)
              await contrast(page, `/harmonogram (najechany ${name})`, bad, '[data-axe-target]')
            }
            await page.mouse.move(0, 0)
          }
          if (p === '/opcje') {
            for (const n of await optNavs(page)) { await openOpt(page, n); await contrast(page, `/opcje › ${n}`, bad) }
          }
        }
        await go(page, at('/kokpit'))
        await page.locator('.bell-trigger').first().click()
        await settle(page, '.bell-wrap')
        await contrast(page, 'dzwonek', bad, '.bell-wrap')
        await page.keyboard.press('Escape')
        for (const c of ['SG-03', 'SG-32', 'T-01']) {
          await openLoad(page, at(`/transport/${c}`))
          for (const tab of TABS) { await openTab(page, tab); await contrast(page, `panel ${c} › ${tab}`, bad, 'aside.drawer') }
        }
        /* okna: Dopłata (HHL), Awizacja (SCX), daty KSH (KSH) — z panelu SG-19 / SG-03 */
        const dialog = async (name: string, open: () => Promise<void>) => {
          await open()
          await expect(page.locator('[aria-modal="true"]').last(), name).toBeVisible()
          expect(await markLastModal(page), `okno ${name}`).toBe(true)
          await settle(page, '[data-axe-target]', 250)
          await contrast(page, `okno ${name}`, bad, '[data-axe-target]')
          await page.keyboard.press('Escape')
        }
        if (role === 'HHL') {
          await openLoad(page, at('/transport/SG-03'))
          await openTab(page, 'pricing')
          await dialog('Dopłata', () => page.locator('.drawer [data-fee-add]').click())
        }
        if (role === 'SCX') {
          await openLoad(page, at('/transport/SG-19'))
          await dialog('Awizacja', () => page.locator('.drawer [data-awiz-open]').click())
        }
        if (role === 'KSH') {
          await openLoad(page, at('/transport/SG-19'))
          await dialog('Daty KSH', () => page.locator('.drawer [data-ksh-edit]').click())
        }
        expect(bad, bad.join('\n')).toEqual([])
      })

      test(`${role}, ${theme === 'light' ? 'jasny' : 'ciemny'}, telefon 390: strony i panel — 0 węzłów`, async ({ page }) => {
        test.setTimeout(180_000)
        const at = await boot(page, { role, theme, width: 390, height: 844 })
        const bad: string[] = []
        for (const p of PAGES) { await go(page, at(p)); await contrast(page, `${p} @390`, bad) }
        await openLoad(page, at('/transport/SG-32'))
        for (const tab of TABS) { await openTab(page, tab); await contrast(page, `panel SG-32 › ${tab} @390`, bad, 'aside.drawer') }
        expect(bad, bad.join('\n')).toEqual([])
      })
    }
  }

  for (const [label, role, konto] of [['Operacje HHL', 'HHL', '&konto=operacje'], ['Użytkownik SCX', 'SCX', '&konto=uzytkownik']] as const) {
    test(`${label}: każdy ekran Opcji, oba motywy — 0 węzłów`, async ({ page }) => {
      test.setTimeout(180_000)
      const bad: string[] = []
      for (const theme of ['light', 'dark'] as const) {
        const at = await boot(page, { role, konto, theme })
        await go(page, at('/opcje'))
        await contrast(page, `/opcje (${theme})`, bad)
        for (const n of await optNavs(page)) { await openOpt(page, n); await contrast(page, `/opcje › ${n} (${theme})`, bad) }
      }
      expect(bad, bad.join('\n')).toEqual([])
    })
  }
})
