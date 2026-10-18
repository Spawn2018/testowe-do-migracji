/**
 * wyglad/W-bramy-P11 — PLAN §4 P11 pkt 3 „Bramy na stałe” (koordynator; poprawki po F7 #301).
 * - E20: komputer 1280 / 1366 / 1440 / 1920 — bez nakładania (kolumny tabel, kafelki i panele w siatce), bez uciętego
 *   i wylanego tekstu, treść nie szersza od okna, pasek górny w jednej linii; Harmonogram „Widok skrócony” bez
 *   przewijania w bok przy 1280 i 1366 (E20 pkt 5, E30; układ pliku KSH przewija się — E38 1A).
 * - E21: strażnik tekstów — 5 rodzajów kont, strony, ekrany Opcji, dzwonek, rozwinięte sprawy Ryzyk, panel transportu.
 * - E10: kontrast (axe-core, `color-contrast`, WCAG AA) — 3 firmy × 2 motywy, komputer i telefon, ekrany Opcji (także
 *   Operacje HHL i Użytkownik SCX), panel, dzwonek, okna, rozwinięte sprawy Ryzyk, najechany wiersz Mapy.
 * Każdy ekran sprawdzany dopiero po dorysowaniu (tekst bez zmian przez 300 ms). Dane demo, zegar zamrożony.
 * CI: `scripts/ci/fresh-smoke.sh` (2 wątki).
 */
import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

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
async function boot(page: Page, o: { role?: Role; clock?: string; konto?: string; width?: number; height?: number; theme?: 'light' | 'dark' } = {}) {
  const { role = 'HHL', clock = NOW, konto = '', width = 1440, height = 900 } = o
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

/** Czeka, aż treść się dorysuje: tekst `sel` niepusty i bez zmian przez 300 ms (najwyżej 6 s). */
async function settle(page: Page, sel = 'main') {
  await page.evaluate(async (s) => {
    await document.fonts?.ready
    const len = () => (document.querySelector(s) as HTMLElement | null)?.innerText.length ?? 0
    let last = len(), stable = 0
    const t0 = performance.now()
    while (performance.now() - t0 < 6000) {
      await new Promise((r) => setTimeout(r, 100))
      const n = len()
      if (n > 0 && n === last) { stable += 100; if (stable >= 300) return } else { stable = 0; last = n }
    }
  }, sel)
}

async function go(page: Page, url: string, sel = 'main') {
  await page.goto(url)
  await settle(page, sel)
}

/** Otwiera transport w panelu (musi się otworzyć) — zawsze od zakładki Przegląd (panel pamięta ostatnią zakładkę). */
async function openLoad(page: Page, url: string) {
  await page.goto(url)
  await page.waitForSelector('aside.drawer #dtab-overview', { timeout: 15_000 })
  await page.evaluate(() => (document.getElementById('dtab-overview') as HTMLButtonElement).click())
  await page.waitForSelector('aside.drawer [data-overview]', { timeout: 15_000 })
  await settle(page, 'aside.drawer')
}

/** Zakładka panelu — musi istnieć; czeka na dorysowanie. */
async function openTab(page: Page, id: (typeof TABS)[number]) {
  const btn = page.locator(`#dtab-${id}`)
  await expect(btn, `zakładka ${id}`).toHaveCount(1)
  await page.evaluate((x) => (document.getElementById(x) as HTMLButtonElement).click(), `dtab-${id}`)
  await expect(btn).toHaveAttribute('aria-selected', 'true')
  await settle(page, 'aside.drawer')
}

/** Ryzyka: wszystkie sprawy widoczne i rozwinięte (lista „pokaż resztę”, karty). */
async function expandRisks(page: Page) {
  const rest = page.locator('[data-rk-rest]')
  if (await rest.count()) { await rest.first().click(); await settle(page) }
  /* klik w DOM: zwinięte nagłówki bywają poza ekranem albo przykryte — Playwright czekałby na nie do końca testu */
  await page.evaluate(() => { for (const hd of document.querySelectorAll<HTMLElement>('.rk-card-hd[aria-expanded="false"]')) hd.click() })
  await settle(page)
}

async function optNavs(page: Page): Promise<string[]> {
  return page.locator('[data-opt-nav]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('data-opt-nav') ?? ''))].filter(Boolean))
}

async function openOpt(page: Page, n: string) {
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

/** Odmiana po liczbie (E21 pkt 2): 1 — pierwsza forma, 2–4 (bez 12–14) — druga, reszta — trzecia. */
const FORMS: string[][] = [
  ['pojazd', 'pojazdy', 'pojazdów'], ['transport', 'transporty', 'transportów'], ['sprawa', 'sprawy', 'spraw'],
  ['plik', 'pliki', 'plików'], ['wiersz', 'wiersze', 'wierszy'], ['minuta', 'minuty', 'minut'], ['godzina', 'godziny', 'godzin'],
  ['faktura', 'faktury', 'faktur'], ['dokument', 'dokumenty', 'dokumentów'], ['rejs', 'rejsy', 'rejsów'], ['strefa', 'strefy', 'stref'],
  ['kierowca', 'kierowcy', 'kierowców'], ['dopłata', 'dopłaty', 'dopłat'], ['zdarzenie', 'zdarzenia', 'zdarzeń'], ['konto', 'konta', 'kont'],
]
const FORM_OF = new Map<string, string[]>(FORMS.flatMap((f) => f.map((w) => [w, f] as [string, string[]])))
const formFor = (n: number, f: string[]) => (n === 1 ? f[0] : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? f[1] : f[2])
/* przyimki z dopełniaczem („z 3 transportów”, „dla 2 spraw”) — tam druga forma jest poprawna inaczej */
const GEN_PREP = /(?:^|[\s(„])(?:z|ze|do|od|dla|bez|około|ok\.|u|wśród|spośród|zamiast|według|wobec|ponad)\s+$/i

const RULES: [string, RegExp][] = [
  ['kod', /\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/g],
  ['klucz', /\b[a-z][a-z0-9]*(?:_[A-Za-z0-9]+)+\b|(?<![@/\w.-])[a-z]+(?:\.[a-z_]+){2,}(?![\w.-]*@)/g],
  ['numer wewnętrzny', /\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{8}\b|\b(?=[0-9A-F]*\d)(?=[0-9A-F]*[A-F])[0-9A-F]{8}\b/g],
  ['data ISO', /\b\d{4}-\d{2}-\d{2}(?=T|\b)/g],
  ['sekundy', /(?<!\d)\d{1,2}:\d{2}:\d{2}(?!\d)/g],
  ['data bez zera', /(?<![\d.])\d\.\d{1,2}\.\d{4}\b|(?<![\d.])\d{1,2}\.\d\.\d{4}\b/g],
  ['szwedzki', /(?<![\p{L}])(från|till|mellan|båda|riktningarna|riktning|län|kommun|vägarbete|olycka|körfält|avstängd)(?![\p{L}])/giu],
  ['pusta wartość', /\b(undefined|null|NaN|Invalid Date)\b|\[object Object\]/g],
  ['kwota bez odstępu tysięcy', /(?<![\d/., -])\d{4,},\d{1,2}(?!\d)|(?<![\d/.,-])\d{5,}(?=[  ](?:PLN|EUR|SEK|km|kg)\b)/g],
]
/* E21 pkt 7: wyjątki — nazwy plików z rozszerzeniem (wielkość liter dowolna, także z łącznikiem), licencja „CC BY 4.0” */
const EXCEPT = [/[\p{L}\p{N}_.-]+\.(?:pdf|xlsx|xls|csv|zip|png|jpe?g|webp|heic|docx?)\b/giu, /\bCC BY(?:-SA)? \d\.\d\b/g]

function textHits(raw: string, where: string, o: { codesAllowed?: boolean } = {}): string[] {
  const out: string[] = []
  let text = raw
  for (const re of EXCEPT) text = text.replace(re, ' ')
  for (const line of text.split('\n')) {
    for (const [k, re] of RULES) {
      if (o.codesAllowed && (k === 'kod' || k === 'klucz' || k === 'numer wewnętrzny')) continue /* E21 pkt 3: kody tylko w Stanie systemu */
      re.lastIndex = 0
      for (const m of line.matchAll(re)) out.push(`${where} — ${k}: «${m[0]}» w «${line.trim().slice(0, 90)}»`)
    }
    /* kropka dziesiętna; „07.10” (dzień i miesiąc) to data — chyba że stoi przed walutą lub jednostką */
    for (const m of line.matchAll(/(?<![\d.])(\d+)\.(\d+)(?![\d.])/g)) {
      const [a, b] = [m[1], m[2]]
      const dateLike = a.length === 2 && b.length === 2 && +a >= 1 && +a <= 31 && +b >= 1 && +b <= 12
      const unit = /^[  ]?(?:PLN|EUR|SEK|%|km|kg|m\/s|m|t|h|min|l)(?![\p{L}])/u.test(line.slice((m.index ?? 0) + m[0].length))
      if (!dateLike || unit) out.push(`${where} — kropka dziesiętna: «${m[0]}» w «${line.trim().slice(0, 90)}»`)
    }
    /* odmiana */
    for (const m of line.matchAll(/(?<![\d,.])(\d+)[  ]([\p{L}]+)/gu)) {
      const f = FORM_OF.get(m[2].toLowerCase())
      if (!f) continue
      if (GEN_PREP.test(line.slice(0, m.index ?? 0))) continue
      const want = formFor(Number(m[1]), f)
      if (m[2].toLowerCase() !== want) out.push(`${where} — odmiana: «${m[0]}» (ma być „${m[1]} ${want}”) w «${line.trim().slice(0, 90)}»`)
    }
    if (!o.codesAllowed && /Nieznany kod/.test(line)) out.push(`${where} — „Nieznany kod…” poza Stanem systemu: «${line.trim().slice(0, 90)}»`)
  }
  return out
}

const innerText = (page: Page, sel: string) => page.evaluate((s) => (document.querySelector(s) as HTMLElement | null)?.innerText ?? '', sel)

test.describe('P11 pkt 3 — E21 strażnik tekstów', () => {
  const KINDS = [['HHL', ''], ['HHL', '&konto=operacje'], ['KSH', ''], ['SCX', ''], ['SCX', '&konto=uzytkownik']] as const
  const LOADS_NOW = ['SG-03', 'SG-07', 'SG-08', 'SG-09', 'SG-10', 'SG-15', 'SG-22', 'SG-32', 'SG-36', 'T-01', 'T-05', 'T-17', 'K-03']
  const LOADS_LATE = ['SG-03', 'SG-32', 'T-01']
  for (const [role, konto] of KINDS) {
    for (const clock of [NOW, LATE]) {
      test(`${role}${konto ? ` ${konto.slice(7)}` : ''}, zegar ${clock.slice(5, 10)}: strony, Opcje, dzwonek, Ryzyka, panel — 0 trafień`, async ({ page }) => {
        test.setTimeout(300_000)
        const at = await boot(page, { role, clock, konto })
        const hits: string[] = []
        for (const p of PAGES) {
          await go(page, at(p))
          if (p === '/ryzyka') await expandRisks(page)
          hits.push(...textHits(await innerText(page, 'main'), p, { codesAllowed: p === '/opcje/stan-systemu' }))
          if (p === '/opcje') {
            for (const n of await optNavs(page)) {
              await openOpt(page, n)
              hits.push(...textHits(await innerText(page, 'main'), `/opcje › ${n}`, { codesAllowed: n === 'status' }))
            }
          }
        }
        await go(page, at('/kokpit'))
        await page.locator('.bell-trigger').first().click()
        await settle(page, '.bell-wrap')
        hits.push(...textHits(await innerText(page, '.bell-wrap'), 'dzwonek'))
        if (konto !== '&konto=operacje') {
          for (const c of clock === NOW ? LOADS_NOW : LOADS_LATE) {
            await openLoad(page, at(`/transport/${c}`))
            for (const tab of TABS) {
              await openTab(page, tab)
              hits.push(...textHits(await innerText(page, 'aside.drawer'), `panel ${c} › ${tab}`))
            }
          }
        }
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
    ]
    for (const s of bad) expect(textHits(s, 't').length, s).toBeGreaterThan(0)
    const ok = [
      'termin 07.10, 12:00', '31.12.2026', 'HHL_FV_2026_0902.pdf', 'WATCH_TOWER_SG-07.PDF', 'Źródło: SMHI (CC BY 4.0)',
      '1 726,59 PLN', '1 pojazd w ruchu', '22 pojazdy', '5 pojazdów', 'z 3 transportów', 'decade effaced deadbeef',
      'SG-03 · HHL/2026/1304', '+1 h 35 min po oknie', '4,8%', 'biuro@h-h.pl', 'tower.log-mar.pl', '2 minuty temu',
    ]
    for (const s of ok) expect(textHits(s, 't'), s).toEqual([])
    /* w Stanie systemu kody są dozwolone (E21 pkt 3) */
    expect(textHits('SOURCE_DOWN:EMTRACK_WEB', 't', { codesAllowed: true })).toEqual([])
  })
})

/* ---------- E10 — kontrast ---------- */

const AXE = readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8')

async function contrast(page: Page, where: string, out: string[], sel = 'main') {
  if (!(await page.evaluate(() => 'axe' in window))) await page.addScriptTag({ content: AXE })
  const r = await page.evaluate(async (s) => {
    const w = window as unknown as { axe: { run: (c: unknown, o: unknown) => Promise<{ violations: { nodes: { target: string[]; any: { message: string }[] }[] }[]; incomplete: unknown[] }> } }
    const root = document.querySelector(s)
    if (!root) return { v: [`brak ${s}`], inc: 0 }
    const res = await w.axe.run(root, { runOnly: { type: 'rule', values: ['color-contrast'] }, resultTypes: ['violations', 'incomplete'] })
    return { v: res.violations.flatMap((x) => x.nodes.map((n) => `${n.target.join(' ')} — ${n.any[0]?.message ?? ''}`.slice(0, 220))), inc: res.incomplete.length }
  }, sel)
  out.push(...r.v.map((x) => `${where}: ${x}`))
  if (r.inc) test.info().annotations.push({ type: 'axe incomplete', description: `${where}: ${r.inc}` })
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
          if (p === '/ryzyka') { await expandRisks(page); await contrast(page, '/ryzyka (rozwinięte)', bad) }
          if (p === '/mapa') {
            const row = page.locator('.map-loads-table tbody tr[data-load]').first()
            if (await row.count()) { await row.hover(); await page.waitForTimeout(150); await contrast(page, '/mapa (najechany wiersz)', bad, '.map-loads-table') }
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
          const d = page.locator('[role="dialog"]').last()
          await expect(d, name).toBeVisible()
          await page.waitForTimeout(200)
          await contrast(page, `okno ${name}`, bad, '[role="dialog"]:last-of-type')
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
