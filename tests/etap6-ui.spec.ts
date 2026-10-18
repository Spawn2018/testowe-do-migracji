/**
 * Etap 6 — odbiór końcowy (UI, DemoProvider).
 * O4: oznaczenie danych demonstracyjnych ZOSTAJE (do potwierdzenia przez właściciela prawdziwych stawek
 *     i parametrów opłaty paliwowej); panel warunków drogowych SE zostaje demonstracyjny do czasu klucza
 *     Trafikverket. Oznaczenia domyślnie włączone; przełącznik w Opcjach je ukrywa (i przywraca).
 */
import { expect, test, type Page } from '@playwright/test'

const url = (path: string) => `/#${path}?now=2026-09-23T14%3A32%3A00Z`

async function fresh(page: Page) {
  await page.setViewportSize({ width: 1440, height: 1080 })
  await page.goto(url('/'), { waitUntil: 'networkidle', timeout: 120_000 })
  await page.evaluate(() => {
    for (const k of Object.keys(localStorage)) if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k)
  })
  await page.reload({ waitUntil: 'networkidle', timeout: 120_000 })
  await page.waitForSelector('#roleSeg', { timeout: 30_000 })
  /* B-SMOKE-LANG: bez #langSeg — PL domyślny */
}

test.describe('O4 — oznaczenie demo zostaje', () => {
  test('stawki i opłata paliwowa (Opcje, Finanse) oraz SE drogi (Ryzyka) oznaczone jako demo; przełącznik działa', async ({ page }) => {
    await fresh(page)
    /* wyglad/P3-c (E11, E12): stawki i opłata paliwowa to osobne ekrany menu bocznego, każdy z jednym oznaczeniem */
    await page.goto(url('/opcje'), { waitUntil: 'networkidle' })
    await page.click('[data-opt-nav="rates"]')
    await expect(page.locator('[data-opt-screen="rates"] [data-demo-mark]')).toHaveCount(1)
    await page.click('[data-opt-nav="fuel"]')
    await expect(page.locator('[data-opt-screen="fuel"] [data-demo-mark]')).toHaveCount(1)
    await page.goto(url('/finanse'), { waitUntil: 'networkidle' })
    await expect(page.locator('[data-demo-mark]')).toHaveCount(1)
    await page.goto(url('/ryzyka'), { waitUntil: 'networkidle' })
    const se = page.locator('[data-panel="road-se"]')
    await expect(se).toHaveAttribute('data-demo', 'trafikverket')
    await expect(se.locator('[data-demo-mark]')).toHaveCount(1)
    await expect(se.locator('.note')).toContainText('demonstracyjne')
    // przełącznik w Opcjach ukrywa oznaczenia, ponowne włączenie przywraca
    await page.goto(url('/opcje'), { waitUntil: 'networkidle' })
    /* wyglad/P3-c: przełącznik w Dla mnie › Wygląd i waluta */
    await page.click('[data-opt-nav="look"]')
    const sw = page.locator('xpath=//dt[normalize-space()="Oznaczenia demonstracyjne"]/following-sibling::dd[1]//input[@type="checkbox"]')
    await sw.uncheck()
    await page.click('[data-opt-nav="rates"]')
    await expect(page.locator('[data-demo-mark]')).toHaveCount(0)
    await page.click('[data-opt-nav="look"]')
    await sw.check()
    await page.click('[data-opt-nav="rates"]')
    await expect(page.locator('[data-demo-mark]')).toHaveCount(1)
  })
})

/* wyglad/W-faktura-termin — A4 (D-20261017-2130-01): faktura nieopłacona po terminie → sprawa HHL; „Otwórz fakturę”
   otwiera ją w Fakturach; „Opłacona” zamyka sprawę. Zegar 20.11.2026 — trzy faktury demo po terminie. */
test.describe('A4 — faktura po terminie', () => {
  const late = (path: string, extra = '') => `/#${path}?now=2026-11-20T10%3A00%3A00Z${extra}`
  /* dane demo powstają przy pierwszym wczytaniu (bez zapisanego stanu) — od razu z zegarem 20.11; potem adres docelowy
     (link do faktury jest jednorazowy: po otwarciu adres wraca do #/faktury, więc nie wchodzi przez przeładowanie) */
  async function freshLate(page: Page, path: string, extra = '') {
    await page.setViewportSize({ width: 1440, height: 1080 })
    await page.goto(late('/', extra), { waitUntil: 'networkidle', timeout: 120_000 })
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k)
    })
    await page.reload({ waitUntil: 'networkidle', timeout: 120_000 })
    await page.waitForSelector('#roleSeg', { timeout: 30_000 })
    if (path !== '/') await page.goto(late(path, extra), { waitUntil: 'networkidle' })
  }
  test('sprawa w „Do zrobienia”, przejście do faktury, „Opłacona” zamyka sprawę; liczba w menu = lista', async ({ page }) => {
    await freshLate(page, '/ryzyka')
    const more = page.locator('[data-rk-rest]')
    /* przy 20.11 kart jest więcej niż na pierwszym ekranie — „… jeszcze N kart” */
    await more.first().click({ timeout: 15_000 })
    const card = page.locator('[data-rk-card]').filter({ hasText: /Faktura HHL\/FV\/2026\/0901 \(HHL\s→\sKSH\) nieopłacona po terminie 15\.10\.2026/ })
    await expect(card).toHaveCount(1)
    await expect(card).toContainText('sprawdza płatność H&H Logistics')
    const menuBefore = Number((await page.locator('nav button[data-view="risk"] .count').first().innerText()).trim())
    await card.locator('[data-rk-go="invoice"]').click()
    await expect(page.locator('[data-inv-tab="PRZYCHOD"]')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[data-bill-detail="bill-p-2026-W37"]')).toBeVisible()
    await expect(page.locator('tr[data-bill="bill-p-2026-W37"]')).toBeFocused()
    /* F7: przewija się tylko obszar treści — pasek górny zostaje */
    expect(await page.evaluate(() => document.scrollingElement!.scrollTop)).toBe(0)
    await expect(page.locator('#roleSeg')).toBeInViewport()
    await page.locator('[data-bill-detail="bill-p-2026-W37"] button', { hasText: 'Opłacona' }).click()
    await page.goto(late('/ryzyka'), { waitUntil: 'networkidle' })
    if (await more.count()) await more.first().click()
    await expect(page.locator('[data-rk-card]').filter({ hasText: 'HHL/FV/2026/0901' })).toHaveCount(0)
    await expect(page.locator('[data-rk-card]').filter({ hasText: 'HHL/FV/2026/0902' })).toHaveCount(1)
    const menuAfter = Number((await page.locator('nav button[data-view="risk"] .count').first().innerText()).trim())
    expect(menuAfter).toBe(menuBefore - 1)
  })

  test('link /finanse/faktury/<id> (dzwonek, e-mail) otwiera fakturę kosztową w zakładce kosztów', async ({ page }) => {
    await freshLate(page, '/finanse/faktury/bill-k-2026-W38')
    await expect(page.locator('[data-inv-tab="KOSZT"]')).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[data-bill-detail="bill-k-2026-W38"]')).toBeVisible()
    /* F7: po otwarciu adres wraca do Faktur — przeładowanie nie otwiera faktury drugi raz, ten sam link działa ponownie */
    await expect(page).toHaveURL(/#\/faktury\?now=/)
    await page.click('nav button[data-view="risk"]')
    await page.goto(late('/finanse/faktury/bill-k-2026-W38'), { waitUntil: 'networkidle' })
    await expect(page.locator('[data-bill-detail="bill-k-2026-W38"]')).toBeVisible()
  })

  test('martwy link do faktury i szybkie przejście z menu — adres idzie za widokiem, link nie wraca', async ({ page }) => {
    await freshLate(page, '/')
    await page.goto(late('/finanse/faktury/nie-ma-takiej'), { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    await page.click('nav button[data-view="risk"]')
    await expect(page).toHaveURL(/#\/ryzyka\?now=/)
    await page.click('nav button[data-view="inv"]')
    await page.waitForTimeout(2000)
    await expect(page.getByText('Brak dostępu')).toHaveCount(0)
    await expect(page).toHaveURL(/#\/faktury\?now=/)
  })

  test('KSH: link do faktury kosztowej — „Brak dostępu”, nic się nie otwiera', async ({ page }) => {
    await freshLate(page, '/')
    await page.click('#roleSeg button[data-role="KSH"]')
    await page.goto(late('/finanse/faktury/bill-k-2026-W38'), { waitUntil: 'networkidle' })
    await expect(page.getByText('Brak dostępu')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('[data-bill-detail]')).toHaveCount(0)
  })

  test('Operacje HHL: wiersz faktury w Kokpicie „Najpilniejsze” otwiera fakturę', async ({ page }) => {
    await freshLate(page, '/', '&konto=operacje')
    const row = page.locator('.ck-urgent li').filter({ hasText: 'nieopłacona po terminie' }).first()
    await expect(row).toBeVisible()
    await row.click()
    await expect(page.locator('[data-bill-detail]')).toHaveCount(1)
  })
})

/* wyglad/W-przed-wydaniem-1 — odbiór wyglądu przed wydaniem (ODBIOR_WYGLADU_PRZED_WYDANIEM, „Do poprawy przed wydaniem”). */
test.describe('Przed wydaniem — dokument nie wyższy od okna, numer transportu w całości', () => {
  const PAGES = ['/kokpit', '/mapa', '/harmonogram', '/ryzyka', '/dokumenty', '/finanse', '/faktury', '/automatyzacje', '/strefy', '/opcje', '/ustawienia', '/opcje/stan-systemu']
  const late = (path: string) => `/#${path}?now=2026-11-20T10%3A00%3A00Z`
  /* zamrożony zegar 20.11 (faktury wystawione) — dane demo budowane od nowa, bez stanu z poprzedniego testu */
  async function freshAt20Nov(page: Page) {
    await page.setViewportSize({ width: 1440, height: 1080 })
    await page.goto(late('/'), { waitUntil: 'networkidle', timeout: 120_000 })
    await page.evaluate(() => {
      for (const k of Object.keys(localStorage)) if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k)
    })
    await page.reload({ waitUntil: 'networkidle', timeout: 120_000 })
    await page.waitForSelector('#roleSeg', { timeout: 30_000 })
  }
  /* F7: mierzyć dopiero po ułożeniu strony — historia strefy wczytuje się z opóźnieniem („…”), układ kart telefonu ustala się po ~50 ms */
  async function settled(page: Page) {
    await expect(page.locator('.zv-hint', { hasText: /^…$/ })).toHaveCount(0, { timeout: 10_000 })
    await page.waitForTimeout(300)
  }

  test('HHL: żadna strona nie wydłuża ani nie poszerza dokumentu (1440, 1280, 390)', async ({ page }) => {
    test.setTimeout(180_000)
    await freshAt20Nov(page)
    const bad: string[] = []
    for (const [width, height] of [[1440, 900], [1280, 800], [390, 844]] as const) {
      await page.setViewportSize({ width, height })
      for (const p of PAGES) {
        await page.goto(late(p), { waitUntil: 'networkidle' })
        await settled(page)
        await measure(`${width} ${p}`)
      }
    }
    /* Strefy na telefonie: karta każdej strefy (historia zmian z ukrytymi tekstami dla czytników) */
    for (const [width, height] of [[390, 844], [360, 740]] as const) {
      await page.setViewportSize({ width, height })
      await page.goto(late('/strefy'), { waitUntil: 'networkidle' })
      const count = await page.locator('.zv-item').count()
      expect(count).toBeGreaterThan(0)
      for (let i = 0; i < count; i++) {
        const item = page.locator('.zv-item').nth(i)
        const name = (await item.locator('b').first().textContent())?.trim() ?? String(i)
        await item.click()
        await expect(page.locator('[data-zone-card]')).toBeVisible()
        await settled(page)
        await measure(`${width} /strefy › ${name}`)
        await page.locator('[data-zone-card] .zv-back').click()
        await expect(page.locator('.zv-item').first()).toBeVisible()
      }
    }
    expect(bad).toEqual([])

    async function measure(where: string) {
      const m = await page.evaluate(() => {
        const se = document.scrollingElement as HTMLElement
        return { sh: se.scrollHeight, sw: se.scrollWidth, ih: innerHeight, iw: innerWidth }
      })
      if (m.sh > m.ih + 1 || m.sw > m.iw + 1) bad.push(`${where}: ${m.sw}×${m.sh} przy oknie ${m.iw}×${m.ih}`)
    }
  })

  /* wyglad/W-przed-wydaniem-2: liczba nie łamie się na separatorze tysięcy („18” / „245,92”), nie odrywa się od jednostki („24” / „h”), kod transportu nie łamie się na łączniku („SG-” / „13”) */
  test('HHL, SCX, KSH: liczba w całości, z jednostką, i kod transportu w jednej linii (12 stron × 1440, 1280, 390, 360)', async ({ page }) => {
    test.setTimeout(420_000)
    const bad = new Set<string>()
    for (const role of ['HHL', 'SCX', 'KSH'] as const) {
      await freshAt20Nov(page)
      await page.click(`#roleSeg button[data-role="${role}"]`)
      for (const [width, height] of [[1440, 900], [1280, 800], [390, 844], [360, 740]] as const) {
        await page.setViewportSize({ width, height })
        for (const p of PAGES) {
          await page.goto(late(p), { waitUntil: 'networkidle' })
          await settled(page)
          const split = await page.evaluate(() => {
            const out: string[] = []
            const root = document.querySelector('main') ?? document.body
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
            const re = /\b(?:SG|T|SCX)-\d[\d-]*|HHL\/\d{4}\/\d+|\d{1,3}(?:[ \u00a0]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?[ \u00a0](?:h|min|km|dni|%|PLN|EUR|SEK|m\/s)(?![\p{L}])/gu
            let node: Node | null
            while ((node = walker.nextNode())) {
              const s = node.textContent ?? ''
              re.lastIndex = 0
              let m: RegExpExecArray | null
              while ((m = re.exec(s))) {
                const r = document.createRange()
                r.setStart(node, m.index)
                r.setEnd(node, m.index + m[0].length)
                const rects = [...r.getClientRects()].filter((x) => x.width > 0 && x.height > 0)
                if (new Set(rects.map((x) => Math.round(x.top))).size > 1) out.push(m[0])
              }
            }
            return out
          })
          for (const x of split) bad.add(`${role} ${width} ${p}: „${x}”`)
        }
      }
    }
    expect([...bad]).toEqual([])
  })

  for (const role of ['HHL', 'SCX', 'KSH'] as const) {
    test(`${role}, telefon 390: szczegóły faktury — nazwa transportu nie łamie się w środku członu`, async ({ page }) => {
      await freshAt20Nov(page)
      await page.click(`#roleSeg button[data-role="${role}"]`)
      await page.setViewportSize({ width: 390, height: 844 })
      await page.goto(late('/faktury'), { waitUntil: 'networkidle' })
      const hd = page.locator('[data-bill] .inv-card-hd:visible')
      await expect(hd.first()).toBeVisible({ timeout: 10_000 })
      const n = await hd.count()
      expect(n).toBeGreaterThan(0)
      /* szczegóły działają jak akordeon (otwarta jedna faktura) — sprawdzamy każdą po kolei, po ułożeniu karty */
      const broken: string[] = []
      let checked = 0
      for (let i = 0; i < n; i++) {
        await hd.nth(i).click()
        const names = page.locator('[data-bill-detail] tbody td .code[data-content]')
        await expect(names.first()).toBeVisible()
        await settled(page)
        checked += await names.count()
        broken.push(...(await names.evaluateAll((els) => {
          const out: string[] = []
          for (const el of els) {
            const node = el.firstChild
            if (!node || node.nodeType !== Node.TEXT_NODE) continue
            const s = node.textContent ?? ''
            const re = /\S+/g
            let m: RegExpExecArray | null
            while ((m = re.exec(s))) {
              const r = document.createRange()
              r.setStart(node, m.index)
              r.setEnd(node, m.index + m[0].length)
              const tops = new Set([...r.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top)))
              if (tops.size > 1) out.push(`${s}: „${m[0]}”`)
            }
          }
          return out
        })))
      }
      expect(checked).toBeGreaterThan(1)
      expect(broken).toEqual([])
    })
  }
})

/* wyglad/W-panel-do-zrobienia — właściciel 18.10.2026, 11:35 i 11:46: sekcja „Do zrobienia” w panelu transportu › Przegląd
   pokazuje tylko aktualny stan (bez spraw już zrobionych); na telefonie zwija się (tylko ta sekcja), komputer bez zmian. */
test.describe('Panel › Przegląd › Do zrobienia — aktualny stan, zwijana na telefonie', () => {
  async function openLoad(page: Page, code: string) {
    await page.evaluate((c) => { window.location.hash = `#/transport/${c}?now=2026-09-23T14%3A32%3A00Z`; }, code);
    await page.waitForSelector('aside.drawer [data-overview]', { timeout: 10_000 });
    await page.waitForTimeout(300);
  }

  test('SG-09 i SG-18: awizacja kompletna — bez „Brak kierowcy…” i „Awizacja…”; zostaje brak zezwolenia (HHL, SCX)', async ({ page }) => {
    await fresh(page);
    for (const role of ['HHL', 'SCX'] as const) {
      /* panel otwarty zasłania pasek — przełącznik roli przez DOM (jak e8-phone-gate) */
      await page.evaluate((r) => (document.querySelector(`#roleSeg button[data-role="${r}"]`) as HTMLButtonElement).click(), role);
      await page.waitForTimeout(300);
      for (const code of ['SG-09', 'SG-18']) {
        await openLoad(page, code);
        await expect(page.locator('.drawer [data-awiz-state]')).toHaveAttribute('data-awiz-state', 'ok');
        const items = page.locator('.drawer .po-todo-i b');
        await expect(items).toHaveCount(1);
        await expect(items.first()).toContainText('Brak zezwolenia');
        await expect(page.locator('.drawer [data-po-todo]')).not.toContainText(/Brak kierowcy|Awizacja/);
        /* komputer bez zmian: sekcja otwarta z nagłówkiem */
        await expect(page.locator('.drawer section.po-todo .po-todo-hd')).toContainText('Do zrobienia przy tym transporcie · 1');
      }
    }
  });

  test('telefon: „Do zrobienia” zwinięte z pierwszą sprawą i liczbą pozostałych, rozwija się; inne sekcje bez zmian', async ({ page }) => {
    await fresh(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await openLoad(page, 'T-01');
    const box = page.locator('.drawer details.po-todo[data-po="todo"]');
    await expect(box).toHaveCount(1);
    await expect(box).toHaveAttribute('data-po-todo', '3');
    expect(await box.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(false);
    const sum = box.locator('> summary');
    await expect(sum).toContainText('Do zrobienia · 3');
    await expect(sum.locator('.po-todo-s')).toContainText('i jeszcze 2 sprawy');
    expect((await sum.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(box.locator('.po-todo-i').first()).toBeHidden();
    await sum.click();
    await expect(box.locator('.po-todo-i')).toHaveCount(3);
    await expect(box.locator('.po-todo-i').first()).toBeVisible();
    await expect(sum.locator('.po-todo-s')).toBeHidden();
    /* pozostałe sekcje Przeglądu jak dotąd: 5 zwiniętych sekcji pod mapą */
    await expect(page.locator('.drawer details.po-fold:not([data-po="todo"])')).toHaveCount(5);
    /* „Do zrobienia” zostaje na górze, nad mapą */
    const first = await page.locator('.drawer [data-overview] > *').first().getAttribute('data-po');
    expect(first).toBe('todo');
  });
});
