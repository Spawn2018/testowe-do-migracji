/**
 * Brama E8 na telefonie (E8 pkt 1–4, 6 i 7).
 * P2-wyglad V3 (D-20261013-1535-01); uszczelnienie wyglad/P2-2 W6 (D-20261013-1815-01)
 * i wyglad/P2-2-popr (niezależne sprawdzenie koordynatora 13.10: 6 wstrzykniętych usterek przechodziło).
 *
 * 9 widoków × konta HHL, SCX i KSH × 360 / 390 / 430 px, a także otwarte menu konta i lista promów
 * z paska górnego (wyglad/P3, E37 pkt 2). Każda liczba = 0:
 * - „poza”: element wystaje poza okno; zwalnia go tylko pasek przewijany z listy tests/fixtures/e8-strips.txt
 *   (strona, `main` i `.app` nigdy); szerszy `main` albo strona = błąd;
 * - „uciete”: treść ucięta przez `overflow:hidden|clip` albo wielokropek (scrollWidth > clientWidth),
 *   wartość kafelka Kokpitu szersza od kafelka, tekst wybranej opcji pola wyboru szerszy od pola;
 * - „cel”: cel dotyku < 44 × 44 px (pole wyboru mierzone wierszem: label / tr / li);
 * - „tekst”: tekst < 12 px, także w pseudoelementach ::before / ::after;
 * - „liczba-lamana”: wartość kafelka Kokpitu w więcej niż jednej linii (E8 pkt 6);
 * - „etykieta”: etykieta karty tabeli (td::before) nie stoi pierwsza przy lewej krawędzi.
 * Wyjątki elementów: tests/fixtures/e8-exceptions.txt.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const FROZEN_URL = `/#/?now=${encodeURIComponent('2026-09-23T14:32:00Z')}`;
const VIEWS = ['dash', 'map', 'sched', 'risk', 'docs', 'fin', 'inv', 'geo', 'options'] as const;
const WIDTHS = [360, 390, 430] as const;
const ROLES = ['HHL', 'SCX', 'KSH'] as const;

function selectorList(file: string): string[] {
  return readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*$/, '').trim())
    .filter(Boolean)
    .map((line) => line.split('|')[0].trim())
    .filter(Boolean);
}
const EXCEPTIONS = selectorList('tests/fixtures/e8-exceptions.txt');
const STRIPS = selectorList('tests/fixtures/e8-strips.txt');

type Hit = { kind: string; view: string; width: number; role: string; n: number; sample: string[] };

async function boot(page: Page, role: string = 'HHL', navCollapsed = false) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(FROZEN_URL, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.evaluate((collapsed) => {
    try {
      sessionStorage.setItem('wtNavCollapsed', collapsed ? '1' : '0');
      sessionStorage.removeItem('wt-persist-wipe-notice');
    } catch { /* ignore */ }
    try {
      for (const k of Object.keys(localStorage)) {
        if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k);
      }
    } catch { /* ignore */ }
  }, navCollapsed);
  await page.reload({ waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForSelector(`#roleSeg button[data-role="${role}"]`, { state: 'attached', timeout: 30_000 });
  await page.evaluate((r) => {
    (document.querySelector(`#roleSeg button[data-role="${r}"]`) as HTMLButtonElement).click();
  }, role);
  await page.waitForTimeout(300);
}

/** Otwiera widok; false, gdy rola go nie ma (np. Opcje u KSH). */
async function openView(page: Page, view: string, required = true): Promise<boolean> {
  const ok = await page.evaluate((key) => {
    const btn = document.querySelector(`nav button[data-view="${key}"]`);
    if (!btn) return false;
    (btn as HTMLButtonElement).click();
    return true;
  }, view);
  if (!ok && required) throw new Error('brak widoku ' + view);
  await page.waitForTimeout(view === 'map' ? 1200 : 500);
  return ok;
}

async function measure(page: Page, view: string, width: number, role: string): Promise<Hit[]> {
  const raw = await page.evaluate(([selectors, strips]) => {
    const matchesAny = (el: Element, list: string[]) => list.some((s) => {
      try { return el.matches(s); } catch { return false; }
    });
    const skip = (el: Element) => matchesAny(el, selectors);
    const visible = (el: Element) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width >= 1 && r.height >= 1;
    };
    const name = (el: Element) => {
      const id = (el as HTMLElement).id ? '#' + (el as HTMLElement).id : '';
      const cls = typeof (el as HTMLElement).className === 'string'
        ? (el as HTMLElement).className.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((c) => '.' + c).join('')
        : '';
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 36);
      return `${el.tagName}${id}${cls} ${text}`;
    };
    const vw = window.innerWidth;
    const page = (n: Element) => n === document.body || n === document.documentElement || n.tagName === 'MAIN' || n.classList.contains('app');
    const outside = (el: Element) => {
      const r = el.getBoundingClientRect();
      if (r.right <= vw + 1 && r.left >= -1) return false;
      // zwalnia tylko pasek przewijany z listy e8-strips.txt, mieszczący się w oknie
      let n: Element | null = el.parentElement;
      while (n && !page(n)) {
        const ox = getComputedStyle(n).overflowX;
        if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth + 1 && matchesAny(n, strips)) {
          const nr = n.getBoundingClientRect();
          if (nr.left >= -1 && nr.right <= vw + 1) return false;
        }
        n = n.parentElement;
      }
      return true;
    };
    const out: string[] = [];
    const small: string[] = [];
    const tight: string[] = [];
    const cut: string[] = [];
    const pseudoPx = (el: Element, which: '::before' | '::after') => {
      const ps = getComputedStyle(el, which);
      const c = ps.content;
      if (!c || c === 'none' || c === 'normal' || c === '""' || c.startsWith('url(')) return null;
      return parseFloat(ps.fontSize);
    };
    document.querySelectorAll('body *').forEach((el) => {
      if (skip(el) || !visible(el) || el.closest('.leaflet-tile-pane, .leaflet-overlay-pane')) return;
      const cs = getComputedStyle(el);
      if (outside(el)) out.push(name(el));
      const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0);
      if (own && parseFloat(cs.fontSize) < 12) small.push(name(el));
      for (const which of ['::before', '::after'] as const) {
        const px = pseudoPx(el, which);
        if (px !== null && px < 12) small.push(`${name(el)} ${which}`);
      }
      const clips = cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.textOverflow === 'ellipsis';
      if (clips && !el.closest('.leaflet-container') && el.scrollWidth > el.clientWidth + 1) cut.push(name(el));
      // ucięcie w pionie: overflow-y hidden/clip albo -webkit-line-clamp przy tekście dłuższym niż pole
      const lineClamp = (cs as CSSStyleDeclaration & { webkitLineClamp?: string }).webkitLineClamp;
      const clipsY = cs.overflowY === 'hidden' || cs.overflowY === 'clip' || (!!lineClamp && lineClamp !== 'none');
      if (clipsY && own && !el.closest('.leaflet-container') && el.scrollHeight > el.clientHeight + 1) cut.push(`pion ${name(el)}`);
    });
    // wartość kafelka szersza od kafelka (np. ucięta przez overflow kafelka)
    document.querySelectorAll('.kpi .v').forEach((el) => {
      if (!visible(el)) return;
      const tile = el.closest('.kpi');
      const r = el.getBoundingClientRect();
      const tr = tile ? tile.getBoundingClientRect() : r;
      if (el.scrollWidth > el.clientWidth + 1 || r.right > tr.right + 1) cut.push(`kafelek ${name(el)}`);
    });
    // tekst wybranej opcji pola wyboru mieści się w polu (strzałka ok. 20 px)
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    document.querySelectorAll('select').forEach((sel) => {
      if (skip(sel) || !visible(sel) || !ctx) return;
      const s = sel as HTMLSelectElement;
      const cs = getComputedStyle(s);
      ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      const text = s.selectedOptions[0]?.textContent ?? '';
      const room = s.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 20;
      if (ctx.measureText(text).width > room + 1) cut.push(`pole wyboru «${text}» ${Math.round(ctx.measureText(text).width)} > ${Math.round(room)}`);
    });
    const targetSel = 'button, a, summary, input, select, textarea, label, [role="button"], [role="tab"], [tabindex="0"]';
    document.querySelectorAll(targetSel).forEach((el) => {
      if (skip(el) || !visible(el)) return;
      if (el.matches('input[type="checkbox"], input[type="radio"]')) {
        const host = el.closest('label, tr, li') ?? el;
        if (!visible(host)) return;
        const r = host.getBoundingClientRect();
        if (r.width < 44 || r.height < 44) tight.push(name(host));
        return;
      }
      const r = el.getBoundingClientRect();
      if (r.width < 44 || r.height < 44) tight.push(name(el));
    });
    const pageWide = document.documentElement.scrollWidth > vw + 1;
    const main = document.querySelector('main');
    const mainWide = !!main && main.scrollWidth > main.clientWidth + 1;
    // E8 pkt 6 — wartość kafelka Kokpitu nie łamie się (wysokość ≤ 1,4 × wysokość linii)
    const broken: string[] = [];
    document.querySelectorAll('.kpi .v').forEach((el) => {
      if (!visible(el)) return;
      const cs = getComputedStyle(el);
      const lh = cs.lineHeight === 'normal' ? parseFloat(cs.fontSize) * 1.2 : parseFloat(cs.lineHeight);
      if (el.getBoundingClientRect().height > lh * 1.4 + 0.5) broken.push(name(el));
    });
    // E8 pkt 6 — etykiety kafelków stoją równo: odstęp etykiety od góry kafelka taki sam (± 2 px) we wszystkich kafelkach
    const tileOffsets = Array.from(document.querySelectorAll('.kpis .kpi')).filter(visible).map((tile) => {
      const k = tile.querySelector('.k');
      return k ? k.getBoundingClientRect().top - tile.getBoundingClientRect().top : null;
    }).filter((x): x is number => x !== null);
    if (tileOffsets.length > 1 && Math.max(...tileOffsets) - Math.min(...tileOffsets) > 2) {
      broken.push(`etykiety kafelków nierówno: ${tileOffsets.map((x) => Math.round(x)).join(', ')} px od góry`);
    }
    // etykieta karty (td::before): pierwsza w rzędzie, przy lewej krawędzi, ≥ 12 px
    const misaligned: string[] = [];
    document.querySelectorAll('.app td[data-label]').forEach((td) => {
      if (!visible(td) || !td.getAttribute('data-label')) return;
      const b = getComputedStyle(td, '::before');
      if (b.content === 'none' || b.content === 'normal') return;
      const cs = getComputedStyle(td);
      const rowOk = cs.display.includes('flex') ? (cs.flexDirection === 'row' && !['flex-end', 'end', 'right', 'center'].includes(cs.justifyContent)) : true;
      const orderOk = Array.from(td.children).every((c) => Number(getComputedStyle(c).order) >= Number(b.order));
      const shift = parseFloat(b.paddingLeft) + parseFloat(b.marginLeft) + parseFloat(b.textIndent || '0');
      if (!rowOk || !orderOk || shift > 1 || (b.textAlign !== 'left' && b.textAlign !== 'start')) misaligned.push(name(td));
    });
    return {
      out: [
        ...(pageWide ? ['STRONA szersza od okna'] : []),
        ...(mainWide ? ['MAIN szerszy od okna'] : []),
        ...out,
      ],
      small,
      tight,
      cut,
      broken,
      misaligned,
    };
  }, [EXCEPTIONS, STRIPS] as const);
  const pack = (kind: string, list: string[]): Hit | null =>
    list.length ? { kind, view, width, role, n: list.length, sample: list.slice(0, 8) } : null;
  return [
    pack('poza', raw.out),
    pack('uciete', raw.cut),
    pack('tekst', raw.small),
    pack('cel', raw.tight),
    pack('liczba-lamana', raw.broken),
    pack('etykieta', raw.misaligned),
  ].filter((x): x is Hit => x !== null);
}

test.describe('brama E8 telefon', () => {
  test.describe.configure({ mode: 'serial', timeout: 600_000 });
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  for (const role of ROLES) {
    test(`${role}: 0 poza ekranem, 0 uciętych, 0 celów poniżej 44 px, 0 tekstu poniżej 12 px`, async ({ page }) => {
      await boot(page, role);
      const hits: Hit[] = [];
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 844 });
        for (const view of VIEWS) {
          if (!(await openView(page, view, false))) continue;
          hits.push(...await measure(page, view, width, role));
        }
        // wyglad/P3 (E37 pkt 2): otwarte menu konta (z „Podglądem”, gdy jest) i lista promów w pasku
        await openView(page, 'dash');
        await page.click('#accountBtn');
        const preview = page.locator('[data-acc="preview"] > .acc-row');
        if (await preview.count()) await preview.click();
        hits.push(...await measure(page, 'menu-konta', width, role));
        await page.click('#accountBtn');
        await page.click('[data-ferry-chip]');
        hits.push(...await measure(page, 'promy', width, role));
        await page.click('[data-ferry-chip]');
        // wyglad/P4 (E8, E28): Harmonogram — otwarte „⋯” (działania) i „Filtry ▾” (daty, Bez kierowcy, Bez ciągnika)
        await openView(page, 'sched');
        await page.click('.sched-more');
        hits.push(...await measure(page, 'harmonogram-dzialania', width, role));
        await page.click('.sched-more');
        await page.click('[data-sched-more-filters]');
        hits.push(...await measure(page, 'harmonogram-filtry', width, role));
        await page.click('[data-sched-more-filters]');
      }
      const report = hits.map((h) => `${h.role} ${h.width} ${h.view} ${h.kind}=${h.n}: ${h.sample.join(' | ')}`).join('\n');
      expect(hits, report).toEqual([]);
    });
  }
});

test.describe('P2-wyglad V1 i V2', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });

  test('Harmonogram: Wysyłka to sam kod, liczba tylko przy Ryzykach na telefonie', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page);
    await openView(page, 'sched');
    const row = page.locator('table.sched-table tbody tr[data-code]').first();
    const code = await row.getAttribute('data-code');
    expect(code).toBeTruthy();
    await expect(row.locator('td[data-col="code"] .code')).toHaveText(code!);
    await expect(row.locator('td[data-col="code"]')).not.toContainText('·');
    const pill = row.locator('td[data-col="status"] .pill');
    const fit = await pill.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
    expect(fit).toBe(true);
    /* Przepisane w wyglad/P3-b — E9 „Liczby w menu” (decyzja 07.10 19:11): liczba tylko przy działaniu do wykonania,
       bez liczb przy Harmonogramie, Strefach i Automatyzacjach — także w menu bocznym na komputerze (V2 dotyczyło P2). */
    await expect(page.locator('nav button[data-view="sched"] .count')).toHaveCount(0);
    await expect(page.locator('nav button[data-view="geo"] .count')).toHaveCount(0);
    await expect(page.locator('nav button[data-view="wf"] .count')).toHaveCount(0);
    await expect(page.locator('nav button[data-view="risk"] .count')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    await expect(page.locator('nav button.nav-pin[data-view="sched"] .count')).toBeHidden();
    await expect(page.locator('nav button.nav-pin[data-view="risk"] .count')).toBeVisible();
  });
});

test.describe('wyglad/P2-2 W3 i W4 (img/e8-after)', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 });
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('telefon: karty typu w Finansach i karty kategorii w Dokumentach; komputer: tabele', async ({ page }) => {
    await boot(page);
    await openView(page, 'fin');
    const finCards = page.locator('[data-fin-type-cards] [data-fin-type-card]');
    expect(await finCards.count()).toBeGreaterThan(0);
    await expect(finCards.first().locator('.mcard-kv dt')).toHaveCount(3);
    await expect(page.locator('[data-fin-type-count]')).toBeVisible();

    await openView(page, 'docs');
    const docCards = page.locator('[data-docreq-cards] [data-docreq-card]');
    expect(await docCards.count()).toBeGreaterThan(0);
    await expect(docCards.first().locator('.mcard-foot')).toContainText('Komplet');
    await expect(page.locator('[data-docreq]')).toHaveCount(0);
    const upload = await page.locator('[data-page="docs"] > .panel-hd > .btn:not(.ghost)').boundingBox();
    const hd = await page.locator('[data-page="docs"] > .panel-hd').boundingBox();
    expect(upload && hd && upload.width).toBeGreaterThan((hd?.width ?? 0) - 40);

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(300);
    await openView(page, 'docs');
    await expect(page.locator('[data-docreq-cards]')).toHaveCount(0);
    expect(await page.locator('[data-docreq]').count()).toBeGreaterThan(0);
    await openView(page, 'fin');
    await expect(page.locator('[data-fin-type-cards]')).toHaveCount(0);
  });
});

/** Kopia znaczników PreviewBanner, ImpersonationBanner i SystemBroadcastBanner — w demo ich nie ma (zależą od logowania). */
const SUBBARS_HTML = `
<div class="subbar subbar-preview" data-banner="preview" role="status"><p class="subbar-tx"><b>Podgląd: tak widzi KSH Użytkownik.</b> Nic tu nie zapiszesz.</p><button class="subbar-btn" type="button">Wróć do HHL</button></div>
<div class="subbar subbar-actas" data-banner="impersonation" role="status"><p class="subbar-tx"><b>Działasz jako: dyspozytor SCX (Przemysław Szczepański-Kowalczyk)</b> Każda zmiana zapisze się w historii jako „administrator.hhl@przyklad.pl (HHL) jako dyspozytor SCX”.</p><button class="subbar-btn" type="button">Zakończ</button></div>
<div class="subbar subbar-bcast" data-banner="system-broadcast" role="status"><p class="subbar-tx"><span class="subbar-tag">KOMUNIKAT HHL</span><b class="subbar-tag-ph">Komunikat HHL:</b> <b class="subbar-body">Prom Stena Estelle 09.10 wypływa o 10:00 zamiast 08:00. Awizacje bez zmian.</b><span class="subbar-until"> · do 09.10, 12:00</span></p></div>`;
const LONG_NAME = 'Przemysław Szczepański-Kowalczyk';

test.describe('wyglad/P3 pasek górny (E37 pkt 1–2, img/e37-after)', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  test('komputer 800–1440 px: długie imię i nazwisko, wszystko w pasku 52 px, nic na sobie', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page);
    const bad: string[] = [];
    for (const [width, name] of [[1440, LONG_NAME], [1366, LONG_NAME], [1280, LONG_NAME], [1241, LONG_NAME], [1241, `${LONG_NAME} z Wiśniewskich`], [1100, LONG_NAME], [1024, LONG_NAME], [900, LONG_NAME], [800, LONG_NAME]] as const) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(150);
      const res = await page.evaluate((name) => {
        const b = document.querySelector('#accountBtn .acc-who b');
        if (b) b.textContent = name;
        const bar = document.querySelector('.topbar') as HTMLElement;
        const br = bar.getBoundingClientRect();
        const out: string[] = [];
        if (bar.scrollWidth > bar.clientWidth + 1) out.push(`pasek przewija się w poziomie (${bar.scrollWidth} > ${bar.clientWidth})`);
        if (document.documentElement.scrollWidth > window.innerWidth + 1) out.push('strona szersza od okna');
        const kids = [...bar.children].filter((e) => getComputedStyle(e).display !== 'none' && (e as HTMLElement).offsetWidth > 0 && !e.classList.contains('kbdpanel'));
        let prevRight = -1;
        for (const k of kids) {
          const r = k.getBoundingClientRect();
          const tag = (k as HTMLElement).className || k.id;
          if (r.top < br.top - 1 || r.bottom > br.bottom + 1) out.push(`${tag} wystaje z paska (${Math.round(r.top)}–${Math.round(r.bottom)})`);
          if (r.left < prevRight - 1) out.push(`${tag} nachodzi na poprzedni element`);
          if (r.right > window.innerWidth + 1) out.push(`${tag} poza oknem`);
          if (r.width > 0) prevRight = r.right;
        }
        const brand = document.querySelector('.topbar .brand b') as HTMLElement;
        const lh = parseFloat(getComputedStyle(brand).lineHeight) || parseFloat(getComputedStyle(brand).fontSize) * 1.3;
        if (brand.getBoundingClientRect().height > lh * 1.4) out.push('„WATCH TOWER” w dwóch liniach');
        return out;
      }, name);
      bad.push(...res.map((x) => `${width} (${name.length} znaków): ${x}`));
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  test('telefon: paski pod paskiem; menu konta, prom i dzwonek pod nimi i nad dolnym paskiem — 0 uciętych, 0 celów < 44 px, 0 tekstu < 12 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page);
    const hits: Hit[] = [];
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 640 }); // niski telefon: listy muszą się zmieścić nad dolnym paskiem
      await page.evaluate((html) => {
        document.querySelectorAll('.topstack .subbar').forEach((e) => e.remove());
        document.querySelector('.topstack')!.insertAdjacentHTML('beforeend', html);
      }, SUBBARS_HTML);
      hits.push(...await measure(page, 'paski', width, 'HHL'));
      // menu konta, lista promów i lista dzwonka: pod paskami, nad dolnym paskiem E8, dół listy widoczny
      for (const [open, sel] of [['#accountBtn', '#accountMenu'], ['[data-ferry-chip]', '[data-ferry-pop]'], ['.bell-trigger', '.bell-pop']] as const) {
        await page.click(open);
        const res = await page.evaluate((q) => {
          const last = [...document.querySelectorAll('.topstack .subbar')].pop()!.getBoundingClientRect();
          const pop = document.querySelector(q) as HTMLElement;
          const r = pop.getBoundingClientRect();
          const nav = document.querySelector('nav.tower-nav')!.getBoundingClientRect();
          const low = document.elementFromPoint(r.left + r.width / 2, r.bottom - 4);
          const out: string[] = [];
          if (r.top < last.bottom - 1) out.push(`${q} zasłania paski`);
          if (r.bottom > Math.min(window.innerHeight, nav.top) + 1) out.push(`${q} schodzi pod dolny pasek albo poza okno (${Math.round(r.bottom)} > ${Math.round(Math.min(window.innerHeight, nav.top))})`);
          if (!low || !pop.contains(low)) out.push(`${q}: dół listy przykryty`);
          return out;
        }, sel);
        if (res.length) hits.push({ kind: 'lista-pod-paskami', view: 'paski', width, role: 'HHL', n: res.length, sample: res });
        await page.click(open);
      }
    }
    await page.evaluate(() => document.querySelectorAll('.topstack .subbar').forEach((e) => e.remove()));
    const report = hits.map((h) => `${h.width} ${h.kind}=${h.n}: ${h.sample.join(' | ')}`).join('\n');
    expect(hits, report).toEqual([]);
  });

  test('E13 telefon: lista dzwonka pod paskiem na całą szerokość, widoczna w środku, przewijana w środku', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page);
    const bad: string[] = [];
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 844 });
      await page.click('.bell-trigger');
      const r = await page.evaluate(() => {
        const pop = document.querySelector('.bell-pop') as HTMLElement;
        const bar = document.querySelector('.topbar')!.getBoundingClientRect();
        const pr = pop.getBoundingClientRect();
        const mid = document.elementFromPoint(pr.left + pr.width / 2, pr.top + Math.min(pr.height - 4, 150));
        const scroller = pop.querySelector(':scope > div:last-child') as HTMLElement | null;
        return {
          left: pr.left, right: pr.right, top: pr.top, bottom: pr.bottom, barBottom: bar.bottom, w: window.innerWidth, h: window.innerHeight,
          inside: !!mid && pop.contains(mid),
          scroll: scroller ? getComputedStyle(scroller).overflowY : 'brak',
        };
      });
      if (!(r.left >= 0 && r.left <= 16 && r.right >= r.w - 16 && r.right <= r.w)) bad.push(`${width}: lista nie na całą szerokość (${Math.round(r.left)}–${Math.round(r.right)})`);
      if (r.top < r.barBottom - 1) bad.push(`${width}: lista zaczyna się w pasku`);
      if (r.bottom > r.h) bad.push(`${width}: lista wychodzi poza okno`);
      if (!r.inside) bad.push(`${width}: w środku listy jest inny element (lista pod spodem)`);
      if (r.scroll !== 'auto') bad.push(`${width}: lista bez przewijania w środku`);
      await page.mouse.click(5, 820);
      if (await page.locator('.bell-pop').count()) bad.push(`${width}: dotknięcie obok nie zamyka listy`);
    }
    expect(bad, bad.join('\n')).toEqual([]);
  });

  test('komputer: Podgląd, tydzień i rejsy, data, ?, dzwonek, konto z menu; bez sesji w lewym menu', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page);
    await expect(page.locator('#brandSub')).toHaveText('Stegra Boden');
    await expect(page.locator('#roleLbl')).toHaveText('Podgląd');
    await expect(page.locator('#roleSeg button')).toHaveText(['HHL', 'KSH', 'SCX']);
    await expect(page.locator('#ops .wk')).toBeVisible();
    await expect(page.locator('#ops [data-ferry-row]').first()).toContainText('→');
    await expect(page.locator('#ops [data-ops-date]')).toHaveText(/^\d{2}\.\d{2}\.\d{4}$/);
    await expect(page.locator('#helpBtn')).toBeVisible();
    await expect(page.locator('#accountBtn .acc-who b')).toBeVisible();
    await expect(page.locator('#themeBtn')).toBeHidden();
    await expect(page.locator('nav .nav-session')).toHaveCount(0);
    await expect(page.locator('[data-ferry-chip]')).toBeHidden();

    await page.click('#accountBtn');
    await expect(page.locator('#accountMenu .acc-row:visible .acc-lbl')).toHaveText(['Moje konto', 'Dla mnie', 'Pomoc', 'Jasny / ciemny']);
    const before = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    await page.click('#themeBtn');
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).not.toBe(before);
    await page.click('[data-acc="my-account"]');
    await expect(page.locator('#accountMenu')).toBeHidden();
    /* wyglad/P3-c (E11, E37): „Moje konto” otwiera ekran z menu bocznego Opcji */
    await expect(page.locator('[data-opt-screen="account"]')).toBeVisible();
    await expect(page.locator('[data-opt-nav="account"]')).toHaveAttribute('aria-current', 'page');
  });

  test('telefon: logo, najbliższy prom, dzwonek, konto; ?, motyw i Podgląd w menu konta', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page);
    await expect(page.locator('[data-ferry-chip]')).toBeVisible();
    await expect(page.locator('#helpBtn')).toBeHidden();
    await expect(page.locator('.topbar .roleswitch')).toBeHidden();
    await expect(page.locator('#ops')).toBeHidden();
    await expect(page.locator('#accountBtn .acc-who')).toBeHidden();
    await page.click('[data-ferry-chip]');
    await expect(page.locator('[data-ferry-pop] .ferry-pop-ft b').first()).toHaveText(/^t\d+$/);
    await page.click('[data-ferry-chip]');
    await page.click('#accountBtn');
    await expect(page.locator('#accountMenu .acc-row:visible .acc-lbl')).toHaveText(['Moje konto', 'Pomoc', 'Podgląd: HHL · KSH · SCX', 'Jasny / ciemny']);
    await page.click('[data-acc="preview"] > .acc-row');
    await page.click('[data-preview-seg] button[data-role="KSH"]');
    await expect(page.locator('#roleSeg button[data-role="KSH"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#accountMenu')).toBeHidden();
  });
});

test.describe('wyglad/P3-b Kokpit (E9, img/e9-after; telefon: E8 pkt 6, V5)', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });
  const IDS: Record<string, string[]> = {
    HHL: ['in-transit', 'todo', 'loads7', 'permits7', 'delivered', 'margin'],
    KSH: ['delivered', 'in-transit', 'plan72', 'otif', 'ferry', 'bills'],
    SCX: ['todo', 'in-transit', 'loads7', 'to-invoice', 'ferry', 'otif'],
  };

  for (const role of ['HHL', 'KSH', 'SCX']) {
    test(`${role}: komputer — nagłówek firma · rodzaj · data, 6 kafelków w 2 kolumnach, „Strona ›”`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await boot(page, role);
      await openView(page, 'dash');
      const card = page.locator(`[data-cockpit="${role}"]`);
      await expect(card).toBeVisible();
      await expect(card.locator('.ck-hd h2 .ck-desk')).toHaveText({ HHL: 'H&H Logistics', KSH: 'KSH', SCX: 'Scandinavian Express' }[role]!);
      await expect(card.locator('.ck-hd .sub .ck-desk')).toHaveText(/ · \d{2}\.\d{2}\.\d{4}$/);
      const ids = await card.locator('[data-ck]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.ck));
      expect(ids).toEqual(IDS[role]);
      const boxes = await card.locator('[data-ck]').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width)]; }));
      expect(new Set(boxes.map((b) => b[0])).size).toBe(2);
      expect(Math.max(...boxes.map((b) => b[1])) - Math.min(...boxes.map((b) => b[1]))).toBeLessThanOrEqual(1);
      await expect(card.locator('[data-ck] .ck-go').first()).toBeVisible();
      await expect(card.locator('[data-ck] .ck-go').first()).toHaveText(/ ›$/);
      // stopka „Czas wykrycia odchylenia” tylko u HHL (E9 B6)
      await expect(card.locator('.ck-ft')).toHaveCount(role === 'HHL' ? 1 : 0);
      // KSH: bez „Do zrobienia” i bez liczby przy „Ryzyka” (decyzja 19:11); HHL i SCX: kafelek = liczba w menu
      if (role === 'KSH') {
        await expect(page.locator('nav button[data-view="risk"] .count')).toHaveCount(0);
      } else {
        const tile = (await card.locator('[data-ck="todo"] .v').innerText()).trim();
        const menu = (await page.locator('nav button[data-view="risk"] .count').innerText().catch(() => '0')).trim();
        expect(tile).toBe(menu);
      }
    });
  }

  for (const width of [360, 390, 430]) {
    test(`telefon ${width}: „Kokpit · firma · rodzaj”, kafelki 2 × 3 równej szerokości, bez „Strona ›”, 3 najpilniejsze`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      for (const role of ['HHL', 'KSH', 'SCX']) {
        await boot(page, role, true);
        await openView(page, 'dash');
        const card = page.locator(`[data-cockpit="${role}"]`);
        await expect(card.locator('.ck-hd h2 .ck-phone')).toHaveText('Kokpit');
        await expect(card.locator('.ck-hd h2 .ck-desk')).toBeHidden();
        const boxes = await card.locator('[data-ck]').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width), Math.round(r.right)]; }));
        expect(boxes).toHaveLength(6);
        expect(new Set(boxes.map((b) => b[0])).size, role).toBe(2);
        expect(Math.max(...boxes.map((b) => b[1])) - Math.min(...boxes.map((b) => b[1]))).toBeLessThanOrEqual(1);
        expect(Math.max(...boxes.map((b) => b[2]))).toBeLessThanOrEqual(width);
        await expect(card.locator('[data-ck] .ck-go').first()).toBeHidden();
        // liczba w jednej linii i w kafelku (E8 pkt 6)
        const values = await card.locator('[data-ck] .v').evaluateAll((els) => els.map((e) => {
          const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); const t = (e.closest('[data-ck]') as HTMLElement).getBoundingClientRect();
          return { one: r.height <= parseFloat(cs.lineHeight) * 1.4 + 0.5, inside: r.right <= t.right + 1 && e.scrollWidth <= e.clientWidth + 1 };
        }));
        expect(values.every((v) => v.one && v.inside), `${role} ${JSON.stringify(values)}`).toBe(true);
        const urgent = await page.locator('ul.ck-urgent > li').evaluateAll((els) => els.filter((e) => getComputedStyle(e).display !== 'none').length);
        expect(urgent).toBeLessThanOrEqual(3);
        await expect(card.locator('.ck-ft')).toBeHidden();
      }
    });
  }
});

test.describe('wyglad/P4 pasek etapów (E28, img/e28-after) i Mapa (E27)', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });
  const TILES = ['PREP', 'LOADING', 'ROAD_PL', 'PORT_PL', 'FERRY', 'PORT_SE', 'ROAD_SE', 'SITE', 'DELIVERED', 'SETTLE'];

  test('komputer: 10 kafelków z liczbą w 3 grupach; klik z Kokpitu → Mapa z chipem; w Harmonogramie filtr na miejscu; Escape zdejmuje', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL');
    const bar = page.locator('[data-stage-bar="global"]');
    await expect(bar).toBeVisible();
    await expect(bar.locator('.sbar-grp span')).toHaveText(['PRZYGOTOWANIE', 'W TRASIE · ŚLEDZENIE', 'PO DOSTAWIE']);
    const ids = await bar.locator('[data-tile]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.tile));
    expect(ids).toEqual(TILES);
    for (const n of await bar.locator('[data-tile] .n').allInnerTexts()) expect(n).toMatch(/^\d+$/);
    // z Kokpitu na Mapę z filtrem
    await openView(page, 'dash');
    await bar.locator('[data-tile="ROAD_SE"]').click();
    await expect(page.locator('[data-page="map"]')).toBeVisible();
    await expect(page.locator('[data-stage-chip="ROAD_SE"]')).toHaveText('Etap: Droga SE ✕');
    await expect(bar.locator('[data-tile="ROAD_SE"]')).toHaveAttribute('aria-pressed', 'true');
    // drugi klik zdejmuje
    await bar.locator('[data-tile="ROAD_SE"]').click();
    await expect(page.locator('[data-stage-chip]')).toHaveCount(0);
    // w Harmonogramie filtr na miejscu; licznik „N z M” = wiersze; liczba na kafelku = wiersze
    await openView(page, 'sched');
    await bar.locator('[data-tile="PREP"]').click();
    await expect(page.locator('[data-page="schedule"]')).toBeVisible();
    const tileN = Number(await bar.locator('[data-tile="PREP"] .n').innerText());
    await expect(page.locator('table.sched-table tbody tr[data-load]')).toHaveCount(tileN);
    await expect(page.locator('.sched-count')).toHaveText(new RegExp(`^${tileN} z \\d+$`));
    // Harmonogram: tylko filtry stanu (E28 pkt 2)
    const quick = await page.locator('[data-sched-filters] [data-quick]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.quick));
    expect(quick).toEqual(['late', 'nodocs', 'nodriver', 'notractor']);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-stage-chip]')).toHaveCount(0);
  });

  test('komputer: Mapa — W trasie · Opóźnione · Brak GPS; „W trasie: 0” przy etapie bez aut; najbliższe włączenia śledzenia', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL');
    await openView(page, 'map');
    const timing = await page.locator('[data-map-filters] [data-timing]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.timing));
    expect(timing).toEqual(['all', 'late', 'nogps']);
    await expect(page.locator('[data-map-next] .map-next-hd')).toHaveText('Najbliższe włączenia śledzenia');
    await page.locator('[data-stage-bar="global"] [data-tile="PREP"]').click();
    await expect(page.locator('[data-map-empty]')).toContainText('W trasie: 0');
  });

  test('komputer: Mapa z filtrem etapu — liczba przy chipie = wiersze po kliknięciu; bez chipa „W trasie”', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL');
    await openView(page, 'map');
    const bar = page.locator('[data-stage-bar="global"]');
    const rows = page.locator('table.map-loads-table tbody tr[data-load]');
    for (const tile of TILES) {
      const n = Number(await bar.locator(`[data-tile="${tile}"] .n`).innerText());
      if (n === 0) continue;
      await bar.locator(`[data-tile="${tile}"]`).click();
      await expect(page.locator(`[data-stage-chip="${tile}"]`)).toBeVisible();
      await expect(page.locator('[data-map-filters] [data-timing="all"]')).toHaveCount(0);
      await expect(rows).toHaveCount(n);
      for (const k of ['late', 'nogps']) {
        const chip = page.locator(`[data-map-filters] [data-timing="${k}"]`);
        const c = Number((await chip.innerText()).replace(/\D+/g, ''));
        await chip.click();
        await expect(rows, `${tile} ${k}`).toHaveCount(c);
        await chip.click();
      }
      await bar.locator(`[data-tile="${tile}"]`).click();
    }
  });

  test('telefon 390: włączony filtr stanu widać w rzędzie także z filtrem etapu; „⋯” — Escape i dotknięcie obok zamykają tylko menu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page, 'HHL', true);
    await openView(page, 'sched');
    const sched = page.locator('[data-page="schedule"]');
    const row = sched.locator('[data-sched-filters]');
    // filtr spod „Filtry ▾” po włączeniu jest w rzędzie
    await sched.locator('[data-sched-more-filters]').click();
    await sched.locator('.sched-more-filters [data-quick="nodriver"]').click();
    await expect(row.locator('[data-quick="nodriver"]')).toBeVisible();
    await expect(row.locator('[data-quick="nodriver"]')).toHaveAttribute('aria-pressed', 'true');
    // z filtrem etapu: w rzędzie chip etapu, włączony filtr stanu i „Filtry ▾”
    await sched.locator('[data-stage-bar="page"] [data-tile="PREP"]').click();
    await expect(row.locator('[data-stage-chip="PREP"]')).toBeVisible();
    await expect(row.locator('[data-quick="nodriver"]')).toBeVisible();
    await expect(row.locator('[data-quick="late"]')).toHaveCount(0);
    // „⋯”: Escape zamyka menu, filtr etapu zostaje
    const more = sched.locator('.sched-more');
    await more.click();
    await expect(sched.locator('.sched-actions-pop')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sched.locator('.sched-actions-pop')).toHaveCount(0);
    await expect(row.locator('[data-stage-chip="PREP"]')).toBeVisible();
    // dotknięcie obok (karta transportu) zamyka menu i nie otwiera transportu
    await more.click();
    await expect(sched.locator('.sched-actions-pop')).toBeVisible();
    const card = sched.locator('[data-sched-cards] [data-load]').first();
    await expect(card).toBeVisible();
    await card.click({ position: { x: 8, y: 8 } });
    await expect(sched.locator('.sched-actions-pop')).toHaveCount(0);
    await page.waitForTimeout(300);
    await expect(page.locator('aside.drawer')).toHaveCount(0);
    // następne dotknięcie karty otwiera transport jak zwykle
    await card.click({ position: { x: 8, y: 8 } });
    await expect(page.locator('aside.drawer')).toHaveCount(1);
  });

  for (const width of [360, 390, 430]) {
    test(`telefon ${width}: pasek tylko w Harmonogramie i na Mapie, przewijany w bok; kafelki ≥ 44 px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await boot(page, 'HHL', true);
      await expect(page.locator('[data-stage-bar="global"]')).toBeHidden();
      for (const view of ['sched', 'map']) {
        await openView(page, view);
        const strip = page.locator(`[data-page="${view === 'sched' ? 'schedule' : 'map'}"] [data-stage-bar="page"]`);
        await expect(strip).toBeVisible();
        const boxes = await strip.locator('[data-tile]').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.width, r.height]; }));
        expect(boxes).toHaveLength(10);
        expect(boxes.every(([w, h]) => w >= 44 && h >= 44)).toBe(true);
        expect(await strip.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
      }
      await openView(page, 'dash');
      await expect(page.locator('[data-stage-bar="page"]')).toHaveCount(0);
    });
  }
});

/**
 * wyglad/P3-c — Opcje (HHL) i Ustawienia (KSH, SCX) według E11 i E12 na telefonie: kafelki grup → lista ekranów → ekran.
 * Każdy ekran dostępny dla konta przy 360 / 390 / 430 px przechodzi tę samą bramę E8 (0 w każdej kolumnie).
 */
async function phoneScreens(page: Page): Promise<Array<{ group: string; screen: string }>> {
  const groups = await page.evaluate(() => Array.from(document.querySelectorAll('.ox-tiles [data-opt-group]')).map((b) => b.getAttribute('data-opt-group') ?? ''));
  const out: Array<{ group: string; screen: string }> = [];
  for (const group of groups) {
    await page.click(`.ox-tiles [data-opt-group="${group}"]`);
    await page.waitForTimeout(150);
    const screens = await page.evaluate(() => Array.from(document.querySelectorAll('.ox-tiles [data-opt-nav]')).map((b) => b.getAttribute('data-opt-nav') ?? ''));
    if (screens.length) {
      for (const screen of screens) out.push({ group, screen });
      await page.click('.ox-backbtn');
    } else {
      const one = await page.getAttribute('[data-opt-screen]', 'data-opt-screen');
      out.push({ group, screen: one ?? '' });
      await page.click('.ox-backbtn');
    }
    await page.waitForTimeout(100);
  }
  return out;
}

async function openPhoneScreen(page: Page, group: string, screen: string) {
  while (await page.locator('.ox-backbtn').count()) {
    await page.click('.ox-backbtn');
    await page.waitForTimeout(80);
  }
  await page.click(`.ox-tiles [data-opt-group="${group}"]`);
  await page.waitForTimeout(120);
  if (await page.locator(`.ox-tiles [data-opt-nav="${screen}"]`).count()) await page.click(`.ox-tiles [data-opt-nav="${screen}"]`);
  await page.waitForSelector(`[data-opt-screen="${screen}"]`);
  await page.waitForTimeout(250);
}

test.describe('wyglad/P3-c Opcje i Ustawienia', () => {
  test.describe.configure({ mode: 'serial', timeout: 600_000 });
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  for (const role of ROLES) {
    test(`${role}: każdy ekran Opcji / Ustawień na telefonie — 0 w bramie E8`, async ({ page }) => {
      await boot(page, role);
      await openView(page, role === 'HHL' ? 'options' : 'settings');
      await page.waitForSelector('.ox-tiles');
      const list = await phoneScreens(page);
      expect(list.length).toBeGreaterThan(role === 'HHL' ? 15 : 2);
      const hits: Hit[] = [];
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 844 });
        for (const { group, screen } of list) {
          await openPhoneScreen(page, group, screen);
          hits.push(...await measure(page, `opcje/${screen}`, width, role));
          /* stany otwarte: edycja progu, działania przy osobie */
          const open = screen === 'thr' ? '[data-threshold] .ox-btn' : screen === 'users' ? '.ox-morebtn' : null;
          if (open && await page.locator(open).count()) {
            await page.locator(open).first().click();
            await page.waitForTimeout(150);
            hits.push(...await measure(page, `opcje/${screen}/otwarte`, width, role));
          }
        }
      }
      const report = hits.map((h) => `${h.role} ${h.width} ${h.view} ${h.kind}=${h.n}: ${h.sample.join(' | ')}`).join('\n');
      expect(hits, report).toEqual([]);
    });
  }

  test('komputer: menu boczne z 6 grupami (E11, E12) i ekran z nagłówkiem; KSH i SCX tylko „Dla mnie”', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL');
    await openView(page, 'options');
    await expect(page.locator('.ox-side-group h2')).toHaveText(['LUDZIE I DOSTĘP', 'POWIADOMIENIA', 'PIENIĄDZE', 'ZASADY TRANSPORTU', 'SYSTEM', 'DLA MNIE']);
    await expect(page.locator('.ox-side [data-opt-group="notify"] [data-opt-nav]')).toHaveText(['Kto co dostaje', 'SMS przy miejscachBoden: brak', 'Komunikat dla wszystkich']);
    await page.click('[data-opt-nav="flags"]');
    await expect(page.locator('[data-opt-screen="flags"] .ox-crumb')).toHaveText('Opcje › System');
    await expect(page.locator('[data-opt-screen="flags"] tbody tr')).toHaveCount(13);
    /* każdy ekran przy 1440 i 1280 px: strona i `main` bez przewijania w bok (macierz „Kto co dostaje” ma własny pasek) */
    const ids = await page.evaluate(() => Array.from(document.querySelectorAll('.ox-side [data-opt-nav]')).map((b) => b.getAttribute('data-opt-nav') ?? ''));
    const wide: string[] = [];
    for (const w of [1440, 1280]) {
      await page.setViewportSize({ width: w, height: 900 });
      for (const id of ids) {
        await page.click(`[data-opt-nav="${id}"]`);
        await page.waitForTimeout(150);
        const bad = await page.evaluate(() => {
          const m = document.querySelector('main');
          return document.documentElement.scrollWidth > window.innerWidth + 1 || (!!m && m.scrollWidth > m.clientWidth + 1);
        });
        if (bad) wide.push(`${w} ${id}`);
      }
    }
    expect(wide).toEqual([]);
    for (const r of ['KSH', 'SCX'] as const) {
      await boot(page, r);
      await openView(page, 'settings');
      await expect(page.locator('.ox-side-group h2')).toHaveText(['DLA MNIE']);
      await expect(page.locator('.ox-side [data-opt-nav]')).toHaveText(['Moje konto', 'Co dostaję', 'Wygląd i waluta']);
    }
  });
});
