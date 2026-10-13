/**
 * Brama E8 na telefonie (E8 pkt 1–4, 6 i 7).
 * P2-wyglad V3 (D-20261013-1535-01); uszczelnienie wyglad/P2-2 W6 (D-20261013-1815-01)
 * i wyglad/P2-2-popr (niezależne sprawdzenie koordynatora 13.10: 6 wstrzykniętych usterek przechodziło).
 *
 * 9 widoków × konta HHL, SCX i KSH × 360 / 390 / 430 px. Każda liczba = 0:
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
    await expect(page.locator('nav button[data-view="sched"] .count')).toBeVisible();

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
