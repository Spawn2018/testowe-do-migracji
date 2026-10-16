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

async function boot(page: Page, role: string = 'HHL', navCollapsed = false, url: string = FROZEN_URL) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 120_000 });
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
        // wyglad/P4 (E8, E28), P7-c (E30 pkt 8): Harmonogram — otwarte „⋯” (Więcej) i arkusz „Filtry” (tygodnie, stan)
        await openView(page, 'sched');
        await page.click('.sched-more');
        hits.push(...await measure(page, 'harmonogram-dzialania', width, role));
        await page.click('.sched-more');
        await page.click('[data-sched-more-filters]');
        hits.push(...await measure(page, 'harmonogram-filtry', width, role));
        await page.click('[data-sched-sheet] [data-sheet-show]');
      }
      const report = hits.map((h) => `${h.role} ${h.width} ${h.view} ${h.kind}=${h.n}: ${h.sample.join(' | ')}`).join('\n');
      expect(hits, report).toEqual([]);
    });
  }
});

/* wyglad/P10b-a (E37 pkt 4, makieta E37 „Komunikat HHL”) — komunikat HHL z „Zamknij” (telefon: „✕” 44 px);
   demo: przykład przy `komunikat-hhl=1`. Zamknięty nie wraca po przeładowaniu. */
test.describe('wyglad/P10b-a komunikat HHL z „Zamknij” (E37 pkt 4)', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });
  const URL_BC = `${FROZEN_URL}&komunikat-hhl=1`;

  test('komputer: treść, data końca, „Zamknij”; po zamknięciu i przeładowaniu nie wraca', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL', false, URL_BC);
    const bar = page.locator('[data-banner="system-broadcast"]');
    await expect(bar).toBeVisible();
    await expect(bar.locator('.subbar-tag')).toHaveText('KOMUNIKAT HHL');
    await expect(bar.locator('.subbar-body')).toHaveText('Prom Stena Estelle wypływa o 10:00 zamiast 08:00. Awizacje bez zmian.');
    await expect(bar.locator('.subbar-until')).toHaveText(/^ · do \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/);
    const close = bar.locator('[data-bcast-close]');
    await expect(close.locator('.subbar-close-tx')).toHaveText('Zamknij');
    await expect(close.locator('.subbar-close-tx')).toBeVisible();
    await expect(close.locator('.subbar-close-x')).toBeHidden();
    await expect(close).toHaveAttribute('aria-label', 'Zamknij komunikat HHL');
    const tb = await page.locator('.topbar').boundingBox();
    const bb = await bar.boundingBox();
    expect(bb && tb && bb.y >= tb.y + tb.height - 1, 'komunikat pod paskiem górnym').toBeTruthy();
    await close.click();
    await expect(bar).toHaveCount(0);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#roleSeg button[data-role="HHL"]', { state: 'attached' });
    await page.waitForTimeout(300);
    await expect(page.locator('[data-banner="system-broadcast"]')).toHaveCount(0);
  });

  for (const width of [360, 390, 430]) {
    test(`telefon ${width}: „Komunikat HHL:” i „✕” 44 × 44 px; nic uciętego, tekst ≥ 12 px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await boot(page, 'HHL', false, URL_BC);
      const bar = page.locator('[data-banner="system-broadcast"]');
      await expect(bar).toBeVisible();
      await expect(bar.locator('.subbar-tag-ph')).toHaveText('Komunikat HHL:');
      const m = await bar.evaluate((el) => {
        const out: string[] = [];
        const r = el.getBoundingClientRect();
        if (r.left < 0 || r.right > window.innerWidth + 0.5) out.push('pasek poza oknem');
        for (const n of el.querySelectorAll<HTMLElement>('b, span, button')) {
          const cs = getComputedStyle(n);
          if (cs.display === 'none' || !n.textContent?.trim()) continue;
          if (parseFloat(cs.fontSize) < 12) out.push(`tekst < 12 px: ${n.textContent}`);
          if (n.scrollWidth > n.clientWidth + 1 && cs.overflow !== 'visible') out.push(`ucięte: ${n.textContent}`);
        }
        const b = el.querySelector('[data-bcast-close]')!.getBoundingClientRect();
        if (b.width < 44 || b.height < 44) out.push(`„✕” ${Math.round(b.width)}×${Math.round(b.height)}`);
        const x = el.querySelector('.subbar-close-x') as HTMLElement;
        const tx = el.querySelector('.subbar-close-tx') as HTMLElement;
        if (getComputedStyle(x).display === 'none') out.push('brak „✕”');
        if (getComputedStyle(tx).display !== 'none') out.push('„Zamknij” zamiast „✕”');
        return out;
      });
      expect(m).toEqual([]);
      await bar.locator('[data-bcast-close]').click();
      await expect(bar).toHaveCount(0);
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

/* wyglad/P9-c — strona Mapa według E29 (zdecydowane 08.10 12:14, pyt. 1 A; L20, L22) i E45 pkt 2–3 (img/e29-after) */
test.describe('wyglad/P9-c Mapa (E29, img/e29-after)', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });
  const tableWithin = (page: Page) => page.locator('[data-map-table]').evaluate((t) => t.scrollWidth <= (t.parentElement as HTMLElement).clientWidth + 1);

  test('komputer: nagłówek bez częstotliwości, 4 kolumny, warstwy, legenda, źródła; dymek znacznika; 1366 px bez przewijania w bok', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL');
    await openView(page, 'map');
    const head = page.locator('[data-map-head]');
    await expect(head).toHaveText(/^W oknie śledzenia \d+ · z pozycją \d+ · bez pozycji \d+ — od 03:00 w dniu załadunku do „Dostarczone”$/);
    await expect(page.locator('[data-page="map"] .panel-hd')).not.toContainText('pozycje co');
    await expect(page.locator('[data-map-table] thead th')).toHaveText(['Transport', 'Etap', 'Pozycja', 'ETA Boden']);
    await expect(page.locator('.maplayers label')).toHaveText(['Pojazdy i statki', 'Trasa (droga i prom)', 'Strefy', 'Utrudnienia drogowe', 'Przebieg wybranego'].map((x) => new RegExp(x.replace(/[()]/g, '\\$&'))));
    /* P9-e (R5): + „kilka aut w jednej strefie” */
    await expect(page.locator('[data-mapkey="e29"] > span')).toHaveText(['załadunek', 'w drodze (PL, port, prom, SE)', 'na placu', 'opóźniony', 'brak GPS', 'statek (AIS) z liczbą aut', 'kilka aut w jednej strefie']);
    await expect(page.locator('[data-map-note]')).toHaveText(/^Podkład i trasy: HERE · utrudnienia: Trafikverket \(SE\), HERE \(PL\) · statki: AIS Fintraffic \/ digitraffic\.fi, CC BY 4\.0/);
    await expect(page.locator('[data-map-zones]')).toBeVisible();
    const n = Number((await page.locator('[data-map-filters] [data-timing="all"]').innerText()).replace(/\D+/g, ''));
    await expect(page.locator('[data-map-table] tbody tr[data-load]')).toHaveCount(n);
    await expect(page.locator('[data-map-filters] .map-search')).toHaveAttribute('placeholder', 'Szukaj: kod, nr zlecenia, tablice');
    /* znacznik: etap, opóźnienie, ostatnia pozycja, odcinek, kliknięcie */
    await expect(page.locator('.wt-mk').first()).toBeAttached();
    await page.locator('.leaflet-marker-icon.wt-marker:not(:has(.is-grp))').first().dispatchEvent('mouseover');
    await expect(page.locator('.leaflet-tooltip.wt-mk-tip').first()).toContainText('kliknij: panel transportu');
    await expect(page.locator('.leaflet-tooltip.wt-mk-tip').first()).toContainText(/kierowca odcinka (PL|SE)/);
    expect(await tableWithin(page)).toBe(true);
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.waitForTimeout(300);
    expect(await tableWithin(page), '1366 px: tabela bez przewijania w bok').toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366);
  });

  test('komputer: „Trasa” chowa drogę i prom, „Pojazdy” chowa auta i statki; bez kropek (E45 pkt 2–3)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL');
    await openView(page, 'map');
    const paths = page.locator('[data-page="map"] .leaflet-overlay-pane path');
    await expect(paths.first()).toBeAttached();
    /* kropki miejsc (załadunek, porty, plac) były kółkami z wypełnieniem; linie trasy mają fill="none" */
    expect(await page.locator('[data-page="map"] .leaflet-overlay-pane path:not([fill="none"])').count(), 'bez kropek miejsc').toBe(0);
    await page.locator('.maplayers label', { hasText: 'Trasa (droga i prom)' }).locator('input').uncheck();
    await expect(paths).toHaveCount(0);
    await page.locator('.maplayers label', { hasText: 'Pojazdy i statki' }).locator('input').uncheck();
    await expect(page.locator('[data-page="map"] .wt-mk')).toHaveCount(0);
    await expect(page.locator('[data-page="map"] .wt-marker-ferry')).toHaveCount(0);
  });

  test('komputer: najechanie na wiersz tabeli podświetla znacznik (E29, audyt D-03)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL');
    await openView(page, 'map');
    const lit = page.locator('[data-page="map"] .leaflet-marker-icon.is-hover');
    await expect(page.locator('[data-page="map"] .wt-mk').first()).toBeAttached();
    await expect(lit).toHaveCount(0);
    /* wiersz z pozycją GPS ma znacznik (sam albo w grupie strefy) */
    await page.locator('[data-map-table] tbody tr[data-load]:has(td[data-map-pos="fix"])').first().hover();
    await expect(lit).toHaveCount(1);
    await page.mouse.move(4, 4);
    await expect(lit).toHaveCount(0);
  });

  test('KSH: bez przycisku „Strefy”, nazwa transportu to sam kod (E41)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'KSH');
    await openView(page, 'map');
    await expect(page.locator('[data-map-zones]')).toHaveCount(0);
    const names = await page.locator('[data-map-table] tbody tr[data-load] td[data-map-name]').allInnerTexts();
    expect(names.length).toBeGreaterThan(0);
    expect(names.every((x) => /^[A-Z]+-\d+$/.test(x.trim()))).toBe(true);
    /* audyt D-04 (E41, 08.10): KSH szuka tylko po kodzie i tablicach — numer zlecenia HHL ani SCX nie jest kluczem */
    const search = page.locator('[data-map-filters] .map-search');
    await expect(search).toHaveAttribute('placeholder', 'Szukaj: kod, tablice');
    const rows = page.locator('[data-map-table] tbody tr[data-load]');
    await search.fill('HHL/2026');
    await expect(rows).toHaveCount(0);
    await search.fill('SCX-26');
    await expect(rows).toHaveCount(0);
    await search.fill(names[0].trim());
    expect(await rows.count()).toBeGreaterThan(0);
    await search.fill('');
  });

  test('telefon 390: „Warstwy ▾” → arkusz z warstwami i legendą; lista jako karty; znacznik → arkusz z „Otwórz panel transportu”', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page, 'HHL', true);
    await openView(page, 'map');
    await expect(page.locator('[data-map-head]')).toHaveText(/^w oknie \d+ · bez pozycji \d+$/);
    const btn = page.locator('[data-map-layers-btn]');
    const b = await btn.boundingBox();
    expect(b && b.height >= 44).toBeTruthy();
    await btn.click();
    const sheet = page.locator('[data-map-layers-sheet] .mapsheet');
    await expect(sheet.locator('input[type="checkbox"]')).toHaveCount(5);
    await expect(sheet.locator('label').last()).toContainText('Przebieg wybranego transportu');
    await expect(sheet.locator('[data-sheet-legend] > span')).toHaveCount(7);
    const bad = await sheet.evaluate((el) => {
      const out: string[] = [];
      for (const n of el.querySelectorAll<HTMLElement>('label, button')) {
        const r = n.getBoundingClientRect();
        if (r.height < 44 || r.width < 44) out.push(`${n.textContent} ${Math.round(r.width)}×${Math.round(r.height)}`);
      }
      for (const n of el.querySelectorAll<HTMLElement>('span, b, label')) if (parseFloat(getComputedStyle(n).fontSize) < 12) out.push(`tekst < 12 px: ${n.textContent}`);
      return out;
    });
    expect(bad).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-map-layers-sheet]')).toHaveCount(0);
    const n = Number((await page.locator('[data-map-filters] [data-timing="all"]').innerText()).replace(/\D+/g, ''));
    await expect(page.locator('[data-map-cards] .map-card')).toHaveCount(n);
    await page.locator('.leaflet-marker-icon.wt-marker:not(:has(.is-grp))').first().dispatchEvent('click');
    const ls = page.locator('[data-map-load-sheet] .mapsheet');
    await expect(ls.locator('[data-sheet-open]')).toHaveText('Otwórz panel transportu');
    await expect(ls.locator('[data-sheet-trail]')).toHaveText('Pokaż przebieg na mapie');
    await ls.locator('[data-sheet-open]').click();
    await expect(page.locator('aside.drawer')).toHaveCount(1);
  });
});

/* wyglad/P9-d — E1 (zdecydowane 07.10): Kokpit i Mapa w kadrze całej trasy, bez zapamiętywania przesunięcia;
   Przegląd w panelu: przybliżenie 11 na ostatniej pozycji. Kokpit: te same transporty co Mapa (okno śledzenia). */
test.describe('wyglad/P9-d kadr całej trasy (E1)', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });
  const routeBox = (page: Page, sel: string) => page.evaluate((s) => {
    const root = document.querySelector(s) as HTMLElement;
    const c = (root.querySelector('.leaflet-container') as HTMLElement).getBoundingClientRect();
    const rs = [...root.querySelectorAll('.leaflet-overlay-pane path')].map((x) => x.getBoundingClientRect()).filter((r) => r.width > 0);
    const u = rs.reduce((a, r) => ({ l: Math.min(a.l, r.left), t: Math.min(a.t, r.top), r: Math.max(a.r, r.right), b: Math.max(a.b, r.bottom) }), { l: 1e9, t: 1e9, r: -1e9, b: -1e9 });
    return { inside: u.l >= c.left + 20 && u.t >= c.top + 20 && u.r <= c.right - 20 && u.b <= c.bottom - 20, u, c: { l: c.left, t: c.top, r: c.right, b: c.bottom } };
  }, sel);

  test('komputer: Mapa i Kokpit — cała trasa w kadrze z marginesem; po przesunięciu i powrocie znów cała trasa', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL');
    await openView(page, 'map');
    await page.waitForTimeout(600);
    const a = await routeBox(page, '[data-page="map"] .mapbox');
    expect(a.inside, JSON.stringify(a)).toBe(true);
    /* legenda leży na mapie — trasa (także Śrem) nad nią, z marginesem */
    const lg = (await page.locator('[data-page="map"] .mapkey').boundingBox())!;
    expect(a.u.b, 'trasa nad legendą').toBeLessThanOrEqual(lg.y - 20);
    const box = (await page.locator('[data-page="map"] .leaflet-container').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 260, box.y + box.height / 2 + 140, { steps: 6 });
    await page.mouse.up();
    expect((await routeBox(page, '[data-page="map"] .mapbox')).inside).toBe(false);
    await openView(page, 'dash');
    await page.evaluate(() => document.querySelector('.grid2-map-body')?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(600);
    const k = await routeBox(page, '.grid2-map-body');
    expect(k.inside, JSON.stringify(k)).toBe(true);
    await openView(page, 'map');
    await page.waitForTimeout(600);
    const b = await routeBox(page, '[data-page="map"] .mapbox');
    expect(b.inside, 'bez zapamiętanego przesunięcia').toBe(true);
    await expect(page.locator('[data-cockpit-full-route], .map-fit-btn')).toHaveCount(0);
  });

  test('telefon 390: trasa nad podpisem podkładu; kafelki nad mapą, „Strefy” w wierszu z tytułem (audyt D-05, D-06)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page, 'HHL', true);
    await openView(page, 'map');
    await page.waitForTimeout(800);
    const a = await routeBox(page, '[data-page="map"] .mapbox');
    expect(a.inside, JSON.stringify(a)).toBe(true);
    /* E1 pkt 1a–1b: podpis podkładu (na telefonie 2 linie) nie zasłania początku trasy (Śrem) */
    const at = (await page.locator('[data-page="map"] .leaflet-control-attribution').boundingBox())!;
    expect(a.u.b, 'trasa nad podpisem podkładu').toBeLessThanOrEqual(at.y - 20);
    /* E29 makieta „Po zmianie · telefon”: nagłówek → kafelki → mapa → filtry */
    const bar = (await page.locator('[data-page="map"] [data-stage-bar="page"]').boundingBox())!;
    const map = (await page.locator('[data-page="map"] .mapbox').boundingBox())!;
    const filters = (await page.locator('[data-map-filters]').boundingBox())!;
    expect(bar.y + bar.height, 'kafelki nad mapą').toBeLessThanOrEqual(map.y + 1);
    expect(map.y + map.height, 'filtry pod mapą').toBeLessThanOrEqual(filters.y + 1);
    const title = (await page.locator('[data-page="map"] > .panel-hd h2').boundingBox())!;
    const zones = (await page.locator('[data-map-zones]').boundingBox())!;
    expect(zones.y < title.y + title.height && zones.y + zones.height > title.y, '„Strefy” w wierszu z tytułem').toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test('komputer: Przegląd w panelu — przybliżenie 11, pojazd na środku', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL');
    await openView(page, 'map');
    const id = await page.locator('[data-map-table] tbody tr[data-load]').first().getAttribute('data-load');
    await page.locator('[data-map-table] tbody tr[data-load]').first().click();
    await page.waitForSelector('aside.drawer .corridor-map-el img.leaflet-tile', { timeout: 15_000 });
    await page.waitForTimeout(800);
    const d = await page.evaluate(() => {
      const root = document.querySelector('aside.drawer') as HTMLElement;
      const c = (root.querySelector('.leaflet-container') as HTMLElement).getBoundingClientRect();
      const m = root.querySelector('.leaflet-marker-icon.wt-marker');
      const r = m ? m.getBoundingClientRect() : null;
      const z = [...root.querySelectorAll<HTMLImageElement>('img.leaflet-tile')].map((i) => /\/tile\/(\d+)\//.exec(i.src)?.[1]).find(Boolean);
      return { dx: r ? Math.abs(r.left + r.width / 2 - (c.left + c.width / 2)) : 999, dy: r ? Math.abs(r.top + r.height / 2 - (c.top + c.height / 2)) : 999, z };
    });
    expect(id).toBeTruthy();
    expect(d.z).toBe('11');
    expect(d.dx).toBeLessThanOrEqual(3);
    expect(d.dy).toBeLessThanOrEqual(3);
  });

  test('Kokpit: na mapie te same transporty co na Mapie (okno śledzenia, swoja firma)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'KSH');
    await openView(page, 'map');
    await page.waitForTimeout(600);
    const onMap = await page.locator('[data-page="map"] .wt-mk').count();
    await openView(page, 'dash');
    await page.waitForTimeout(800);
    expect(await page.locator('.grid2-map-body .wt-mk').count()).toBe(onMap);
  });
});

/* wyglad/P9-e — E45 pkt 5 (zdecydowane 07.10 22:42) i D-20261009-1309-01 R5: auta jednego rejsu na promie jednym
   znacznikiem z liczbą; więcej niż 1 auto w strefie załadunku, portu PL, portu SE albo placu — jeden znacznik z liczbą;
   najechanie — rejs (miejsce) i kody; kliknięcie — lista (telefon: od dołu); tak samo w Kokpicie. */
test.describe('wyglad/P9-e grupowanie na promie i w strefie (E45 pkt 5, R5)', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });
  const groupsOf = (page: Page, root: string) => page.locator(`${root} .wt-mk.is-grp`).evaluateAll((els) => els.map((e) => `${(e as HTMLElement).dataset.mk}:${(e as HTMLElement).dataset.n}`).sort());

  test('komputer: znaczniki grup, dymek z kodami, lista, wiersz → panel; Kokpit — te same grupy', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL');
    await openView(page, 'map');
    await page.waitForTimeout(600);
    const onMap = await groupsOf(page, '[data-page="map"]');
    /* demo: 6 aut na promie Nova Star; Port PL 4, Załadunek 3, Plac Boden 3 — każde w swojej strefie */
    expect(onMap).toEqual(['ferry:6', 'zone:3', 'zone:3', 'zone:4']);
    await expect(page.locator('[data-mapkey="e29"] > span').last()).toHaveText('kilka aut w jednej strefie');
    const ferry = page.locator('[data-page="map"] .leaflet-marker-icon:has(.wt-mk[data-mk="ferry"])');
    await ferry.dispatchEvent('mouseover');
    const tip = page.locator('.leaflet-tooltip.wt-mk-tip').last();
    await expect(tip).toContainText('Prom Nova Star · 6 aut');
    await expect(tip).toContainText('Gdańsk → Nynäshamn');
    await expect(tip).toContainText('kliknij: lista transportów');
    /* kody, bez numerów zleceń (E45 pkt 5: „rejs i kody”) */
    await expect(tip).not.toContainText('HHL/2026');
    await ferry.dispatchEvent('mouseout');
    await ferry.dispatchEvent('click');
    const card = page.locator('[data-map-group="ferry"]');
    await expect(card.locator('.mapgrp-title')).toHaveText('Prom Nova Star · 6 aut');
    await expect(card.locator('[data-grp-row]')).toHaveCount(6);
    await expect(page.locator('.leaflet-tooltip.wt-mk-tip')).toHaveCount(0);
    const id = await card.locator('[data-grp-row]').nth(1).getAttribute('data-grp-row');
    await card.locator('[data-grp-row]').nth(1).click();
    await expect(page.locator('[data-map-group]')).toHaveCount(0);
    await expect(page.locator('aside.drawer')).toHaveCount(1);
    expect(id).toBeTruthy();
    await page.keyboard.press('Escape');
    const site = page.locator('[data-page="map"] .leaflet-marker-icon:has(.wt-mk[data-mk="zone"].is-site)');
    await site.dispatchEvent('mouseover');
    await expect(page.locator('.leaflet-tooltip.wt-mk-tip').last()).toContainText(/· 3 auta/);
    await expect(page.locator('.leaflet-tooltip.wt-mk-tip').last()).toContainText('plac');
    await site.dispatchEvent('mouseout');
    await openView(page, 'dash');
    await page.evaluate(() => document.querySelector('.grid2-map-body')?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(800);
    expect(await groupsOf(page, '.grid2-map-body')).toEqual(onMap);
    await page.locator('.grid2-map-body .leaflet-marker-icon:has(.wt-mk[data-mk="zone"].is-site)').dispatchEvent('click');
    await expect(page.locator('.grid2-map-body [data-map-group="zone"] [data-grp-row]')).toHaveCount(3);
  });

  test('telefon 390: znacznik promu → lista od dołu (wiersze ≥ 44 px) → arkusz transportu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page, 'HHL', true);
    await openView(page, 'map');
    await page.locator('.leaflet-marker-icon:has(.wt-mk[data-mk="ferry"])').first().dispatchEvent('click');
    const sheet = page.locator('[data-map-group-sheet="ferry"] .mapsheet');
    await expect(sheet.locator('[data-grp-row]')).toHaveCount(6);
    const small = await sheet.locator('[data-grp-row]').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).length);
    expect(small).toBe(0);
    await sheet.locator('[data-grp-row]').first().click();
    await expect(page.locator('[data-map-group-sheet]')).toHaveCount(0);
    await expect(page.locator('[data-map-load-sheet] [data-sheet-open]')).toHaveText('Otwórz panel transportu');
  });
});

/* wyglad/P9-f — E32 pkt 3 (zdecydowane 08.10 12:14) i E27: mapa w Przeglądzie panelu — bez pozycji cała trasa i powód
   („Brak pozycji · Śledzenie od 07.10.2026, 03:00”), po „Dostarczone” śledzenie zakończone, na placu strefa placu. */
test.describe('wyglad/P9-f mapa w Przeglądzie (E32 pkt 3)', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });
  async function openPanel(page: Page, code: string) {
    await openView(page, 'sched');
    await page.evaluate((c) => {
      const el = [...document.querySelectorAll('[data-load]')].find((r) => (r.textContent ?? '').includes(`${c} `)) as HTMLElement | undefined;
      el?.click();
    }, code);
    await page.waitForSelector('aside.drawer .corridor-map-el', { timeout: 15_000 });
    await page.waitForTimeout(1200);
  }

  test('komputer: przed oknem — powód i cała trasa nad dopiskiem; po „Dostarczone” — śledzenie zakończone; na placu — strefa placu', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL');
    await openPanel(page, 'SG-11');
    const note = page.locator('aside.drawer [data-drawer-note="before"]');
    await expect(note).toHaveText('Brak pozycji · Śledzenie od 07.10.2026, 03:00');
    const r = await page.evaluate(() => {
      const root = document.querySelector('aside.drawer [data-load-map]') as HTMLElement;
      const n = (root.querySelector('[data-drawer-note]') as HTMLElement).getBoundingClientRect();
      const rs = [...root.querySelectorAll('.leaflet-overlay-pane path')].map((x) => x.getBoundingClientRect()).filter((x) => x.width > 0);
      return { bottom: Math.max(...rs.map((x) => x.bottom)), noteTop: n.top, markers: root.querySelectorAll('.wt-mk').length };
    });
    expect(r.bottom, 'trasa nad dopiskiem').toBeLessThanOrEqual(r.noteTop - 20);
    expect(r.markers).toBe(0);
    await page.keyboard.press('Escape');
    await openPanel(page, 'SG-01');
    await expect(page.locator('aside.drawer [data-drawer-note="after"]')).toHaveText('Śledzenie zakończone — „Dostarczone”');
    await page.keyboard.press('Escape');
    await openPanel(page, 'T-12');
    await expect(page.locator('aside.drawer [data-drawer-note]')).toHaveCount(0);
    await expect(page.locator('aside.drawer .leaflet-overlay-pane path[fill="#1B6E5D"]')).toHaveCount(1);
  });
});

/* wyglad/P10b-b — E37 pkt 3 (Pomoc) i D-20261009-0015-01: „?” = Pomoc z zakładkami Jak pracuję, Co nowego, Kontakt,
   Skróty; „Jak pracuję” w wersji konta (w Podglądzie — wersja podglądanej firmy); kliknięcie kroku otwiera miejsce;
   na telefonie cały ekran, bez „Skrótów”, z blokiem „Na telefonie”. */
test.describe('wyglad/P10b-b Pomoc (E37 pkt 3)', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });
  const openHelp = async (page: Page) => {
    if (!(await page.locator('[data-help-panel]').count())) await page.locator('#helpBtn').click();
    await page.waitForSelector('[data-help-panel]');
  };

  test('komputer: 3 firmy — wersja, zakładki, kroki; każdy krok HHL otwiera swoje miejsce', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL');
    await openHelp(page);
    await expect(page.locator('[data-help-kind]')).toHaveText('HHL Administrator');
    await expect(page.locator('[data-help-tab]')).toHaveText(['Jak pracuję', 'Co nowego', 'Kontakt', 'Skróty']);
    await expect(page.locator('[data-help-panel] .helpp-step')).toHaveCount(17);
    await expect(page.locator('[data-help-phone]')).toHaveCount(0);
    await page.locator('[data-help-tab="keys"]').click();
    await expect(page.locator('[data-help-keys]')).toContainText('Zmień widok (Podgląd)');
    await page.locator('[data-help-tab="contact"]').click();
    await expect(page.locator('[data-help-contact] [data-help-call]').first()).toHaveText('Zadzwoń');
    await expect(page.locator('[data-help-contact]')).toContainText('Operacje HHL');
    await page.locator('[data-help-tab="news"]').click();
    await expect(page.locator('[data-help-news] .helpp-news li').first()).toBeVisible();
    await page.locator('[data-help-tab="how"]').click();
    const expectAt: Record<string, string> = {
      dash: 'dash', 'risk/todo': 'risks', sched: 'schedule', 'sched/rejsy': 'schedule', panel: 'schedule', map: 'map', docs: 'docs',
      fin: 'finance', 'fin/pack': 'finance', inv: 'invoices', geo: 'geofence', wf: 'workflows', options: 'options', 'options/users': 'options',
    };
    const targets = await page.locator('[data-help-panel] [data-help-target]').evaluateAll((e) => [...new Set(e.map((x) => x.getAttribute('data-help-target') as string))]);
    expect(targets.length).toBe(16);
    for (const tg of targets) {
      await openHelp(page);
      await page.locator(`[data-help-panel] [data-help-target="${tg}"]`).first().click();
      await expect(page.locator('[data-help-panel]')).toHaveCount(0);
      if (tg === 'konto') {
        await expect(page.locator('#accountMenu')).toBeVisible();
        await page.keyboard.press('Escape');
      } else if (tg === 'podglad') {
        await expect(page.locator('.seg.is-hint')).toHaveCount(1);
      } else {
        await expect(page.locator('[data-page]').first(), tg).toHaveAttribute('data-page', expectAt[tg]);
        if (tg === 'sched/rejsy') await expect(page.locator('[data-sched-tab="sailings"]')).toHaveAttribute('aria-pressed', 'true');
        if (tg === 'options/users') await expect(page.locator('[data-opt-nav="users"][aria-current="page"]')).toHaveCount(1);
        if (tg === 'fin/pack') await expect(page.locator('#fin-pack')).toBeInViewport();
      }
    }
    for (const [role, kind, n] of [['KSH', 'KSH Użytkownik', 10], ['SCX', 'SCX Dyspozytor', 11]] as const) {
      await page.locator(`#roleSeg button[data-role="${role}"]`).click();
      await openHelp(page);
      await expect(page.locator('[data-help-kind]')).toHaveText(kind);
      await expect(page.locator('[data-help-panel] .helpp-step')).toHaveCount(n);
      await page.locator('[data-help-tab="keys"]').click();
      await expect(page.locator('[data-help-keys]')).not.toContainText('Zmień widok');
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-help-panel]')).toHaveCount(0);
    }
  });

  test('telefon 390: menu konta → Pomoc na cały ekran, bez „Skrótów”, z „Na telefonie”; krok → miejsce', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page, 'KSH', true);
    await page.locator('#accountBtn').click();
    await page.locator('[data-acc="help"]').click();
    const panel = page.locator('[data-help-panel]');
    await expect(panel).toBeVisible();
    const box = (await panel.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(389);
    expect(box.height).toBeGreaterThanOrEqual(800);
    await expect(page.locator('[data-help-tab]')).toHaveText(['Jak pracuję', 'Co nowego', 'Kontakt']);
    await expect(page.locator('[data-help-panel] .helpp-step')).toHaveCount(12);
    await expect(page.locator('[data-help-phone] .helpp-step')).toHaveCount(2);
    const small = await page.locator('[data-help-panel] button.helpp-step, [data-help-tab]').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).length);
    expect(small).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.locator('[data-help-panel] [data-help-target="docs"]').click();
    await expect(panel).toHaveCount(0);
    await expect(page.locator('[data-page]').first()).toHaveAttribute('data-page', 'docs');
  });
});

/* wyglad/P10b-c — E23 (źródła danych), E47 (błędy aplikacji), E19 pkt 7 (bezpieczeństwo), E46 (wydajność):
   Opcje › System › Stan systemu; najpierw to, co wymaga uwagi; „Sprawdź teraz” z wynikiem w wierszu; telefon — lista. */
test.describe('wyglad/P10b-c Stan systemu (E23, E47, E19, E46)', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });
  const openStatus = async (page: Page, phone = false) => {
    await openView(page, 'options');
    if (phone) {
      await page.locator('[data-opt-group="system"]').first().click();
      await page.locator('[data-opt-nav="status"]').first().click();
    } else {
      await page.locator('[data-opt-nav="status"]').click();
    }
    await page.waitForSelector('[data-sys-screen]');
  };

  test('komputer: źródła (uwaga najpierw, Sprawdź teraz, pozostałe, progi), błędy, bezpieczeństwo, wydajność', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL');
    await openStatus(page);
    await expect(page.locator('[data-sys-tab]')).toHaveText(['Źródła danych', 'Błędy aplikacji', 'Bezpieczeństwo', 'Wydajność']);
    /* wyglad/audyt-E (E-09; E49 Z5): + „Wiatr — SMHI”; „Zagrożenia na trasie” działa (wiatr liczy SMHI) */
    await expect(page.locator('[data-sys-sum]')).toHaveText('1 nie działa · 2 częściowo albo bez pomiaru · 10 działa · 1 bez źródła');
    const states = await page.locator('[data-sys-source]').evaluateAll((e) => e.map((x) => (x as HTMLElement).dataset.state));
    expect(states.slice(0, 3)).toEqual(['down', 'partial', 'nomeasure']);
    await expect(page.locator('[data-sys-source="wind"]')).toContainText('Wiatr — SMHI');
    expect(states.at(-1)).toBe('nosource');
    await expect(page.locator('[data-sys-source][data-state="ok"] [data-sys-check]')).toHaveCount(0);
    await page.locator('[data-sys-check="fuel"]').click();
    await expect(page.locator('[data-sys-checked="fuel"]')).toHaveText(/^Sprawdzone \d{2}:\d{2}: nie działa$/);
    expect(await page.locator('.sys-tablewrap').evaluate((e) => e.scrollWidth <= e.clientWidth + 1), 'tabela bez przewijania w bok').toBe(true);
    await page.locator('[data-sys-other] summary').click();
    await expect(page.locator('[data-sys-other] li')).toHaveCount(6);
    await expect(page.locator('[data-sys-threshold]')).toHaveCount(8);
    await expect(page.locator('[data-sys-threshold="SRC_WIND_H"]')).toContainText('2 h');
    await expect(page.locator('[data-sys-threshold="SRC_TELEMATICS_MIN"]')).toContainText('10 min');
    /* bez kodów zadań (E21) */
    const txt = await page.locator('[data-sys-screen]').innerText();
    expect(txt).not.toMatch(/emtrack-web|route-hazards|web-push|email-budget|supabase/i);
    await page.locator('[data-sys-tab="errors"]').click();
    await expect(page.locator('[data-sys-errors] .sys-kpi')).toHaveCount(4);
    await expect(page.locator('[data-err]')).toHaveCount(3);
    await page.locator('[data-err="e1"]').click();
    await expect(page.locator('[data-err-more="e1"]')).toContainText('Role');
    await expect(page.locator('[data-err-state="fixed"]')).toHaveText('USTĄPIŁ PO NAPRAWIE');
    await expect(page.locator('[data-err-rule]')).toContainText('Alarm do Administratorów HHL');
    await page.locator('[data-sys-tab="security"]').click();
    await expect(page.locator('[data-sec]')).toHaveCount(5);
    await page.locator('[data-sys-tab="perf"]').click();
    await expect(page.locator('[data-perf]')).toHaveCount(5);
  });

  test('telefon 390: lista „wymagają uwagi”, reszta po dotknięciu, wiersz → przyczyna i „Sprawdź teraz”', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page, 'HHL', true);
    await openStatus(page, true);
    await expect(page.locator('[data-sys-tab]')).toHaveText(['Źródła', 'Błędy', 'Bezpieczeństwo', 'Wydajność']);
    await expect(page.locator('[data-sys-sum]')).toHaveText('3 wymagają uwagi');
    await expect(page.locator('[data-sys-source]')).toHaveCount(3);
    const tabsH = await page.locator('[data-sys-tab]').evaluateAll((e) => [...new Set(e.map((x) => Math.round(x.getBoundingClientRect().top)))].length);
    expect(tabsH, 'zakładki w jednym wierszu').toBe(1);
    expect(await page.locator('.sys-tabs').evaluate((e) => e.scrollWidth <= e.clientWidth + 1), 'zakładki mieszczą się bez przewijania').toBe(true);
    await page.locator('[data-sys-source="fuel"] .sys-m-row').click();
    await expect(page.locator('[data-sys-source="fuel"] [data-sys-check]')).toBeVisible();
    await page.locator('[data-sys-rest]').click();
    await expect(page.locator('[data-sys-source]')).toHaveCount(14);
    const small = await page.locator('[data-sys-screen] .sys-m-row, [data-sys-rest]').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).length);
    expect(small).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});

/* wyglad/P10b-d — E37 pkt 9 (pierwsze wejście, makieta E37 „zaproszona osoba”): 1 Zaproszenie, 2 Hasło, 3 Twoje dane
   (telefon wymagany), 4 Powiadomienia i telefon; potem Kokpit z „Jak pracuję” otwartym raz. Demo: `pierwsze-wejscie=1`
   (cała ścieżka dla firmy z Podglądu) i `pierwsze-wejscie=telefon` (sam krok 3 — konto bez telefonu przy logowaniu). */
test.describe('wyglad/P10b-d pierwsze wejście (E37 pkt 9)', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });
  const startFlow = async (page: Page, role: string, flag: '1' | 'telefon') => {
    await boot(page, role);
    await page.goto(`${FROZEN_URL}&pierwsze-wejscie=${flag}`, { waitUntil: 'networkidle' });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('[data-auth="first-entry"]');
  };
  const pos = (page: Page) => page.locator('[data-fe-pos]');

  test('komputer KSH: 4 ekrany „n z 4”, hasło z oceną długości, telefon wymagany, powiadomienia; potem Kokpit z „Jak pracuję”', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await startFlow(page, 'KSH', '1');
    await expect(page.locator('[data-fe-step="invite"]')).toBeVisible();
    await expect(pos(page)).toHaveText('1 z 4');
    await expect(page.locator('[data-fe-title]')).toHaveText('Zaproszenie do Watch Tower');
    await expect(page.locator('[data-fe-lead]')).toHaveText(/^.+ z .+ zaprasza Cię do systemu kontroli transportów Śrem → Boden\.$/);
    await expect(page.locator('[data-fe-invite] dt')).toHaveText(['Osoba', 'Firma', 'Konto']);
    await expect(page.locator('[data-fe-invite] dd').nth(1)).toHaveText('KSH');
    await expect(page.locator('[data-fe-invite] dd').nth(2)).toHaveText('Użytkownik');
    await page.locator('[data-fe-next]').click();

    await expect(page.locator('[data-fe-step="password"]')).toBeVisible();
    await expect(pos(page)).toHaveText('2 z 4');
    await page.fill('#fe-pw', 'krotkie');
    await expect(page.locator('[data-fe-pwlen]')).toHaveText('7 znaków — za mało (min. 12)');
    /* wyglad/audyt-E (E-12): litery i cyfry */
    await page.fill('#fe-pw', 'Dlugie-haslo-bez');
    await expect(page.locator('[data-fe-pwlen]')).toHaveText('16 znaków — brak cyfry (min. 12 znaków, litery i cyfry)');
    await page.fill('#fe-pw', 'Dlugie-haslo-2026');
    await expect(page.locator('[data-fe-pwlen]')).toHaveText('17 znaków — dobrze (min. 12)');
    await page.fill('#fe-pw2', 'Dlugie-haslo-2025');
    await expect(page.locator('[data-fe-pwsame]')).toHaveText('Hasła się różnią');
    await page.fill('#fe-pw2', 'Dlugie-haslo-2026');
    await expect(page.locator('[data-fe-pwsame]')).toHaveText('✓ Hasła są takie same');
    await page.locator('[data-fe-next]').click();

    await expect(page.locator('[data-fe-step="details"]')).toBeVisible();
    await expect(pos(page)).toHaveText('3 z 4');
    await expect(page.locator('[data-fe-first]')).not.toHaveValue('');
    await page.locator('[data-fe-next]').click();
    await expect(page.locator('[data-fe-err]')).toHaveText('Wpisz numer telefonu: 7–11 cyfr, bez kierunkowego.');
    await page.selectOption('[data-fe-cc]', 'SE');
    await page.fill('[data-fe-phone]', '070 123 45 67');
    await page.locator('[data-fe-next]').click();

    await expect(page.locator('[data-fe-step="notify"]')).toBeVisible();
    await expect(pos(page)).toHaveText('4 z 4');
    await expect(page.locator('[data-fe-gets] li')).toHaveCount(3);
    await expect(page.locator('[data-fe-push]')).toHaveText('Włącz powiadomienia na tym komputerze');
    await page.locator('[data-fe-push]').click();
    await expect(page.locator('[data-fe-push-msg]')).toHaveText('Powiadomienia włączone na tym urządzeniu.');
    /* krok 4 można pominąć — „Zaczynam” działa bez włączania */
    await page.locator('[data-fe-done]').click();

    await expect(page.locator('[data-auth="first-entry"]')).toHaveCount(0);
    await expect(page.locator('[data-help-panel]')).toBeVisible();
    await expect(page.locator('[data-help-tab="how"]')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('[data-help-kind]')).toHaveAttribute('data-help-kind', 'CLIENT_USER');
    expect(await page.evaluate(() => location.hash)).toMatch(/^#\/kokpit/);
    /* „Jak pracuję” otwarty raz: po zamknięciu i zmianie widoku nie wraca */
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-help-panel]')).toHaveCount(0);
    await openView(page, 'sched');
    await page.waitForTimeout(400);
    await expect(page.locator('[data-help-panel]')).toHaveCount(0);
  });

  test.describe('telefon 390 (iPhone)', () => {
    test.use({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' });
    test('4 ekrany: bez przewijania w bok, przyciski ≥ 44 px, tekst ≥ 12 px; iPhone — „Dodaj do ekranu głównego”', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await startFlow(page, 'SCX', '1');
      const check = async (step: string) => {
        await expect(page.locator(`[data-fe-step="${step}"]`)).toBeVisible();
        const m = await page.evaluate(() => {
          const out: string[] = [];
          if (document.documentElement.scrollWidth > window.innerWidth) out.push(`przewijanie w bok ${document.documentElement.scrollWidth}`);
          for (const b of document.querySelectorAll<HTMLElement>('[data-auth="first-entry"] .fe-btn, [data-auth="first-entry"] button[type="submit"]')) {
            if (b.getBoundingClientRect().height < 44) out.push(`przycisk < 44 px: ${b.textContent}`);
          }
          for (const n of document.querySelectorAll<HTMLElement>('[data-auth="first-entry"] .auth-form *')) {
            if (!n.childNodes.length || ![...n.childNodes].some((c) => c.nodeType === 3 && c.textContent!.trim())) continue;
            if (parseFloat(getComputedStyle(n).fontSize) < 12) out.push(`tekst < 12 px: ${n.textContent}`);
          }
          return out;
        });
        expect(m, step).toEqual([]);
      };
      await check('invite');
      await expect(page.locator('[data-fe-invite] dd').nth(1)).toHaveText('Scandinavian Express');
      await page.locator('[data-fe-next]').click();
      await check('password');
      await page.fill('#fe-pw', 'Dlugie-haslo-2026');
      await page.fill('#fe-pw2', 'Dlugie-haslo-2026');
      await page.locator('[data-fe-next]').click();
      await check('details');
      await page.fill('[data-fe-phone]', '600 100 200');
      await page.locator('[data-fe-next]').click();
      await check('notify');
      await expect(page.locator('[data-fe-push]')).toHaveText('Włącz powiadomienia na tym telefonie');
      await expect(page.locator('[data-fe-install="ios"]')).toContainText('Udostępnij → Dodaj do ekranu głównego');
      await page.locator('[data-fe-done]').click();
      await expect(page.locator('[data-help-panel]')).toBeVisible();
      await expect(page.locator('[data-help-kind]')).toHaveAttribute('data-help-kind', 'CARRIER_DISPATCH');
    });
  });

  test('telefon 390: konto bez telefonu — sam krok 3 bez numeru kroku; bez telefonu nie przejdzie', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await startFlow(page, 'HHL', 'telefon');
    await expect(page.locator('[data-fe-step="details"]')).toBeVisible();
    await expect(pos(page)).toHaveCount(0);
    await expect(page.locator('[data-fe-missing]')).toHaveText('Na Twoim koncie nie ma jeszcze telefonu. Uzupełnij go, żeby przejść dalej.');
    await expect(page.locator('[data-fe-next]')).toHaveText('Zapisz i przejdź dalej');
    await page.locator('[data-fe-next]').click();
    await expect(page.locator('[data-fe-err]')).toBeVisible();
    await expect(page.locator('[data-auth="first-entry"]')).toBeVisible();
    await page.fill('[data-fe-phone]', '600 100 200');
    await page.locator('[data-fe-next]').click();
    await expect(page.locator('[data-auth="first-entry"]')).toHaveCount(0);
    /* przy samym kroku 3 Pomoc się nie otwiera (to nie pierwsze wejście) */
    await page.waitForTimeout(400);
    await expect(page.locator('[data-help-panel]')).toHaveCount(0);
  });
});

/* wyglad/P7-c — E38 decyzja 1A (Harmonogram domyślnie w układzie pliku KSH, przyklejone „Typ” i „Wysyłka”), E30 („Widok
   skrócony” 8 kolumn bez przewijania w 1366 px, filtry tygodniem i stanem z liczbami, „Kolumny”, „Więcej ▾”, telefon),
   E20 (bez nakładania kolumn). */
test.describe('wyglad/P7-c Harmonogram w układzie pliku (E38, E30, E20)', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });
  const heads = (page: Page) => page.locator('[data-sched-layout] thead th').allInnerTexts();
  const rows = (page: Page) => page.locator('[data-sched-layout] tbody tr[data-load]');

  test('komputer 1366, HHL: układ pliku, przyklejone „Typ” i „Wysyłka”, widok skrócony bez przewijania, kolumny, filtry', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await boot(page, 'HHL');
    await openView(page, 'sched');
    await expect(page.locator('[data-sched-layout="file"]')).toBeVisible();
    expect(await heads(page)).toEqual(['Typ', 'Wysyłka', 'Rozmiar L × W × H', 'Waga elementu', 'Ilość', 'Waga [t]', 'Data załadunku', 'Dzień', 'Godzina',
      'Kierowca', 'Telefon kierowcy', 'Ciągnik', 'Naczepa', 'Nr zlecenia SCX', 'Data dostawy', 'Dzień', 'Godzina', 'Nr zlecenia HHL', 'Status', 'ETA Boden', 'Dokumenty', 'Przychód']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), 'strona bez przewijania w bok').toBeLessThanOrEqual(1366);
    /* przewijanie w bok: „Typ” i „Wysyłka” zostają na miejscu */
    const before = await page.locator('[data-sched-layout] tbody tr[data-load] td[data-col="code"]').first().boundingBox();
    await page.locator('[data-sched-layout]').evaluate((w) => { w.scrollLeft = w.scrollWidth; });
    await page.waitForTimeout(150);
    const after = await page.locator('[data-sched-layout] tbody tr[data-load] td[data-col="code"]').first().boundingBox();
    expect(Math.abs((after?.x ?? 0) - (before?.x ?? 0))).toBeLessThan(1);
    await expect(page.locator('[data-sched-layout] tbody tr[data-load]').first().locator('td.s7-wt1')).toHaveAttribute('data-col', 'status');
    /* bez „Zmień ciągnik” w tabeli (E30 pkt 5); wiersz otwiera panel */
    await expect(page.locator('[data-change-tractor]')).toHaveCount(0);
    await rows(page).first().locator('td[data-col="type"]').click();
    await expect(page.locator('aside.drawer')).toHaveCount(1);
    await page.locator('aside.drawer .dhead button[aria-label], aside.drawer button.iconbtn').first().click();
    await expect(page.locator('aside.drawer')).toHaveCount(0);

    /* „Widok skrócony” — 8 kolumn E30 + „Telefon kierowcy” (właściciel 16.10, 13:58) w 1154 px bez przewijania */
    await page.locator('[data-sched-short]').click();
    await expect(page.locator('[data-sched-short]')).toHaveAttribute('aria-pressed', 'true');
    expect(await heads(page)).toEqual(['Transport', 'Ładunek', 'Załadunek → dostawa', 'Status', 'Kierowca i zestaw', 'Telefon kierowcy', 'ETA Boden', 'Dokumenty', 'Przychód']);
    expect(await page.locator('[data-sched-layout="short"]').evaluate((w) => w.scrollWidth <= w.clientWidth + 1)).toBe(true);
    /* „Kolumny” dodaje kolumny; układ zostaje po przeładowaniu; „Więcej ▾ › Przywróć kolumny domyślne” */
    await page.locator('[data-sched-cols]').click();
    await page.locator('[data-col-toggle="trailer"] input').check();
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-sched-layout] thead th[data-col="trailer"]')).toHaveText('Naczepa');
    await page.reload({ waitUntil: 'networkidle' });
    await openView(page, 'sched');
    await expect(page.locator('[data-sched-layout="short"] thead th[data-col="trailer"]')).toBeVisible();
    await page.locator('[data-sched-more]').click();
    await expect(page.locator('[data-sched-more-menu] [role="menuitem"]')).toHaveText(['Eksport XLSX (to, co widać)', 'Eksport PDF (to, co widać)', 'Wgraj plik KSH (zapas)', 'Przywróć kolumny domyślne']);
    await page.locator('[data-action="reset-cols"]').click();
    await expect(page.locator('[data-sched-layout] thead th[data-col="trailer"]')).toHaveCount(0);
    await page.locator('[data-sched-short]').click();
    await expect(page.locator('[data-sched-layout="file"]')).toBeVisible();

    /* filtry: tydzień załadunku; liczba przy filtrze stanu = wiersze po kliknięciu; licznik „N z M” */
    const total = await rows(page).count();
    const opt = await page.locator('[data-week="load"] select option').nth(2).getAttribute('value');
    await page.locator('[data-week="load"] select').selectOption(opt!);
    const n = await rows(page).count();
    expect(n).toBeLessThan(total);
    await expect(page.locator('.sched-count')).toHaveText(new RegExp(`^${n} z \\d+$`));
    for (const q of ['late', 'nodocs', 'nodriver', 'notractor', 'cancelled']) {
      const chip = page.locator(`[data-sched-filters] [data-quick="${q}"]`);
      const c = Number(await chip.locator('.chip-n').innerText());
      await chip.click();
      await expect(rows(page), q).toHaveCount(c === 0 ? 0 : c);
      await chip.click();
    }
    await page.locator('[data-week="load"] select').selectOption('all');
    await expect(rows(page)).toHaveCount(total);
  });

  /* audyt-B B-02 (E20 08.10: „przyklejony jest tylko »Transport«… nic nie zasłania innej kolumny”; E30 pkt 1 „Kolumny”):
     przy 1280 px z 2 i z 6 dodanymi kolumnami każda kolumna ma szerokość, kolumny się nie nakładają, tabela przewija się
     w bok, a „Transport” zostaje na miejscu. */
  test('komputer 1280, HHL: widok skrócony + 2 i 6 kolumn z „Kolumny” — szerokość > 0, bez nakładania, „Transport” przyklejony', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await boot(page, 'HHL');
    await openView(page, 'sched');
    await page.locator('[data-sched-short]').click();
    const wrap = page.locator('[data-sched-layout="short"]');
    const check = async (n: number) => {
      const ths = await wrap.locator('thead th').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { col: e.getAttribute('data-col'), x: r.x, w: r.width }; }));
      expect(ths, `${n} dodanych`).toHaveLength(9 + n);
      for (const t of ths) expect(t.w, `${t.col} > 0 px`).toBeGreaterThan(40);
      for (let i = 1; i < ths.length; i++) expect(ths[i].x, `${ths[i].col} za ${ths[i - 1].col}`).toBeGreaterThanOrEqual(ths[i - 1].x + ths[i - 1].w - 1);
      expect(await wrap.evaluate((w) => w.scrollWidth > w.clientWidth + 1), 'przewijanie w bok').toBe(true);
      const cell = wrap.locator('tbody tr[data-load] td[data-col="code"]').first();
      const before = await cell.boundingBox();
      await wrap.evaluate((w) => { w.scrollLeft = w.scrollWidth; });
      await page.waitForTimeout(150);
      const after = await cell.boundingBox();
      expect(Math.abs((after?.x ?? 0) - (before?.x ?? 0)), '„Transport” przyklejony').toBeLessThan(1);
      /* przyklejona kolumna nie zasłania tekstu sąsiedniej: pierwsza widoczna za nią komórka zaczyna się za jej prawą krawędzią */
      const cover = await wrap.evaluate((w) => {
        const row = w.querySelector('tbody tr[data-load]')!;
        const stick = row.querySelector('td[data-col="code"]')!.getBoundingClientRect();
        const next = [...row.querySelectorAll('td')].slice(1).map((td) => td.getBoundingClientRect()).find((r) => r.right > stick.right + 1);
        return next ? next.right - stick.right : 1;
      });
      expect(cover).toBeGreaterThan(0);
      await wrap.evaluate((w) => { w.scrollLeft = 0; });
      expect(await page.evaluate(() => document.documentElement.scrollWidth), 'strona bez przewijania w bok').toBeLessThanOrEqual(1280);
    };
    await page.locator('[data-sched-cols]').click();
    for (const c of ['ordHhl', 'trailer']) await page.locator(`[data-col-toggle="${c}"] input`).check();
    await page.keyboard.press('Escape');
    await check(2);
    await page.locator('[data-sched-cols]').click();
    for (const c of ['ordScx', 'tractor', 'sailing', 'cost']) await page.locator(`[data-col-toggle="${c}"] input`).check();
    await page.keyboard.press('Escape');
    await check(6);
    await page.locator('[data-sched-more]').click();
    await page.locator('[data-action="reset-cols"]').click();
  });

  /* audyt-B B-14 (E6; 16.10, 13:34–13:58): transport z przepięciem naczepy w Szwecji (demo T-01, „Droga SE”) —
     w Harmonogramie numer kierowcy odcinka SE z dopiskiem „kierowca SE · teraz”, na telefonie „Zadzwoń” do niego,
     w panelu dwa odcinki, SE pierwszy i wyróżniony. */
  test('przepięcie naczepy (T-01): numer kierowcy SE w Harmonogramie, karcie i panelu', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL');
    await openView(page, 'sched');
    const row = () => page.locator('[data-sched-layout] tbody tr[data-load]').filter({ has: page.locator('td[data-col="code"]', { hasText: /^T-01\b/ }) });
    for (const view of ['file', 'short'] as const) {
      if (view === 'short') await page.locator('[data-sched-short]').click();
      await expect(page.locator(`[data-sched-layout="${view}"]`)).toBeVisible();
      const tel = row().locator('td[data-col="phone"] a[data-tel-active]');
      await expect(tel, view).toHaveAttribute('data-tel-active', 'SE');
      await expect(tel, view).toHaveText('+46 701 740 615');
      await expect(tel, view).toHaveAttribute('href', 'tel:+46701740615');
      await expect(row().locator('td[data-col="phone"] [data-tel-leg]'), view).toHaveText('kierowca SE · teraz');
    }
    await row().locator('td[data-col="code"]').click();
    await page.waitForSelector('aside.drawer [data-overview]');
    const drv = page.locator('.drawer [data-po-driver]');
    await expect(drv).toHaveCount(2);
    await expect(drv.first()).toHaveAttribute('data-po-driver', 'SE');
    await expect(drv.first()).toHaveClass(/is-now/);
    await expect(drv.first()).toContainText('Henrik Lund · +46 701 740 615');
    await expect(drv.nth(1)).toContainText('Tomasz Wójcik · +48 000 000 003');
    await expect(drv.first().locator('a.po-call')).toHaveAttribute('href', 'tel:+46701740615');

    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page, 'HHL', true);
    await openView(page, 'sched');
    const card = page.locator('[data-sched-cards] [data-code="T-01"]');
    await expect(card.locator('[data-card-driver]')).toHaveAttribute('data-card-driver', 'SE');
    await expect(card.locator('[data-card-call="SE"]')).toHaveAttribute('href', 'tel:+46701740615');
    await expect(card.locator('[data-card-vehicle]')).toContainText('BDN 417');
  });

  test('komputer 1440: KSH bez kolumn numerów i z „Twoja cena”, SCX z „Moja stawka”', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'KSH');
    await openView(page, 'sched');
    const ksh = await heads(page);
    expect(ksh).not.toContain('Nr zlecenia SCX');
    expect(ksh).not.toContain('Nr zlecenia HHL');
    expect(ksh.at(-1)).toBe('Twoja cena');
    await boot(page, 'SCX');
    await openView(page, 'sched');
    const scx = await heads(page);
    expect(scx).toContain('Nr zlecenia SCX');
    expect(scx.at(-1)).toBe('Moja stawka');
  });

  test('telefon 390: pierwsza karta na pierwszym ekranie, arkusz „Filtry” (tygodnie, stan, „Pokaż N”), cele ≥ 44 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page, 'HHL', true);
    await openView(page, 'sched');
    const card = page.locator('[data-sched-cards] [data-load]').first();
    const box = await card.boundingBox();
    expect(box && box.y + box.height <= 844 - 64, 'pierwsza karta cała nad dolnym paskiem').toBeTruthy();
    await page.locator('[data-sched-more-filters]').click();
    const sheet = page.locator('[data-sched-sheet]');
    await expect(sheet).toBeVisible();
    const small = await sheet.locator('button').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).map((e) => e.textContent));
    expect(small).toEqual([]);
    await sheet.locator('[data-sheet-load] button').nth(2).click();
    const label = (await sheet.locator('[data-sheet-show]').innerText()).replace(/\D+/g, '');
    await sheet.locator('[data-sheet-show]').click();
    await expect(page.locator('[data-sched-cards] [data-load]')).toHaveCount(Number(label));
    await expect(page.locator('[data-sched-more-filters]')).toHaveText('Filtry · 1');
    await page.locator('[data-sched-more-filters]').click();
    await page.locator('[data-sched-sheet] [data-sheet-clear]').click();
    await page.locator('[data-sched-sheet] [data-sheet-show]').click();
    await expect(page.locator('[data-sched-more-filters]')).toHaveText('Filtry');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });
});

/* wyglad/P7-d — E30 pkt 7: Harmonogram › Rejsy — nagłówek obu przepraw, domyślnie przyszłe rejsy do Szwecji, „Pokaż powroty”,
   „Stena Line” zamiast klucza, kolumna „Transporty” z kodami (kliknięcie filtruje Harmonogram), zasięg rozkładów pod tabelą,
   edycja tylko Administrator HHL; telefon — karty (E8). Rejsy dodane w teście przez „Dodaj rejs” (dane wymyślone, G-09). */
test.describe('wyglad/P7-d Rejsy (E30 pkt 7)', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });
  const openRejsy = async (page: Page) => {
    await openView(page, 'sched');
    await page.locator('[data-sched-tab="sailings"]').click();
    await expect(page.locator('[data-sailings]')).toBeVisible();
  };
  const addSailing = async (page: Page, vessel: string, route: string, dep: string, arr: string) => {
    await page.locator('[data-sail-new]').click();
    const form = page.locator('[data-sail-form]');
    await form.locator('select[name="vessel"]').selectOption(vessel);
    await form.locator('select[name="route"]').selectOption(route);
    await form.locator('input[name="dep"]').fill(dep);
    await form.locator('input[name="arr"]').fill(arr);
    await form.locator('[data-sail-submit]').click();
    await expect(form).toHaveCount(0);
  };

  test('komputer 1366, HHL: kolumny z makiety, tylko do Szwecji, „Pokaż powroty”, Stena Line, zasięg, kody filtrują Harmonogram', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await boot(page, 'HHL');
    await openRejsy(page);
    await expect(page.locator('[data-page="schedule"] .panel-hd .sub')).toHaveText('Gdańsk → Nynäshamn i Gdynia → Karlskrona');
    expect(await page.locator('[data-sailings] thead th').allInnerTexts()).toEqual(['Odejście', 'Statek', 'Trasa', 'Przypłynięcie', 'Źródło', 'Transporty', '']);
    await expect(page.locator('[data-sail-future]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-sail-returns]')).toHaveAttribute('aria-pressed', 'false');
    await addSailing(page, 'Stena Estelle', 'GDY-KAA', '2026-09-24T08:00', '2026-09-24T17:45');
    await addSailing(page, 'Stena Spirit', 'KAA-GDY', '2026-09-24T09:00', '2026-09-24T19:30');
    const routes = () => page.locator('[data-sailings] tbody tr[data-sailing] td.sv-route').allInnerTexts();
    expect((await routes()).every((r) => r === 'GDN → NYN' || r === 'GDY → KAA'), 'domyślnie tylko do Szwecji').toBe(true);
    expect(await routes()).toContain('GDY → KAA');
    await page.locator('[data-sail-returns]').click();
    expect(await routes()).toContain('KAA → GDY');
    await page.locator('[data-sail-returns]').click();
    expect(await routes()).not.toContain('KAA → GDY');
    await expect(page.locator('[data-sailings]')).not.toContainText('sail_src_');
    await expect(page.locator('[data-sailings]')).not.toContainText('sv_');
    await expect(page.locator('[data-sail-reach]')).toHaveText(/^Rozkład w bazie: Stena Line do \d\d\.\d\d\.\d{4}, Polferries do \d\d\.\d\d\.\d{4}\.$/);
    /* „Przyszłe” wyłączone pokazuje też minione rejsy */
    const futureN = await page.locator('[data-sailings] tbody tr[data-sailing]').count();
    await page.locator('[data-sail-future]').click();
    expect(await page.locator('[data-sailings] tbody tr[data-sailing]').count()).toBeGreaterThan(futureN);
    await page.locator('[data-sail-future]').click();
    /* odwołany rejs z przypisanym transportem: kod w kolumnie „Transporty” → Harmonogram z filtrem rejsu */
    const row = page.locator('[data-sailings] tbody tr[data-sail-status="ODWOLANY"]', { has: page.locator('[data-sail-loads]') }).first();
    await expect(row.locator('.pill')).toHaveText('odwołany');
    const codes = (await row.locator('[data-sail-loads]').innerText()).split(', ');
    await row.locator('[data-sail-loads]').click();
    await expect(page.locator('[data-sched-tab="loads"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-sail-filter]')).toContainText('Rejs: ');
    await expect(page.locator('[data-sched-layout] tbody tr[data-load]')).toHaveCount(codes.length);
    for (const c of codes) await expect(page.locator('[data-sched-layout] tbody')).toContainText(c);
    await page.locator('[data-sail-filter]').click();
    await expect(page.locator('[data-sail-filter]')).toHaveCount(0);
    expect(await page.locator('[data-sched-layout] tbody tr[data-load]').count()).toBeGreaterThan(codes.length);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1366);
  });

  test('komputer 1440, KSH: tylko podgląd — bez „Dodaj rejs”, „Opóźnienie” i „Odwołaj”, zdanie o Administratorze HHL', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'KSH');
    await openRejsy(page);
    await expect(page.locator('[data-sail-new]')).toHaveCount(0);
    await expect(page.locator('[data-sail-delay], [data-sail-cancel]')).toHaveCount(0);
    expect(await page.locator('[data-sailings] thead th').allInnerTexts()).toEqual(['Odejście', 'Statek', 'Trasa', 'Przypłynięcie', 'Źródło', 'Transporty']);
    await expect(page.locator('[data-sailings] .sv-foot')).toContainText('Rejsy zmienia tylko Administrator HHL.');
  });

  test('telefon 390, HHL: karty zamiast tabeli, cele ≥ 44 px, bez przewijania w bok', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page, 'HHL', true);
    await openRejsy(page);
    await expect(page.locator('[data-sailings] table')).toHaveCount(0);
    const cards = page.locator('[data-sail-cards] [data-sailing]');
    expect(await cards.count()).toBeGreaterThan(0);
    const small = await page.locator('[data-sailings] button').evaluateAll((els) => els.filter((e) => e.getBoundingClientRect().height < 44).map((e) => e.textContent));
    expect(small).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
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
    /* przepisane w wyglad/P5 — E16 telefon (img/e16-after): karta rodzaju jak karta etapu — „Marża” i „Przychód / koszt” */
    await expect(finCards.first().locator('.fin-kv dt')).toHaveText(['Marża', 'Przychód / koszt']);
    await expect(page.locator('[data-fin-type-count]')).toBeVisible();

    await openView(page, 'docs');
    const docCards = page.locator('[data-docreq-cards] [data-docreq-card]');
    expect(await docCards.count()).toBeGreaterThan(0);
    /* przepisane w wyglad/P5 — E31 telefon (img/e31-after): karta wymagania z terminem i liczbą po terminie, bez „Komplet” */
    await expect(page.locator('[data-docreq-card="PERMIT_PL"]')).toContainText('przed załadunkiem');
    await expect(page.locator('[data-docreq]')).toHaveCount(0);
    const upload = await page.locator('[data-page="docs"] [data-doc-upload]').boundingBox();
    const pg = await page.locator('[data-page="docs"]').boundingBox();
    expect(upload && pg && upload.width).toBeGreaterThan((pg?.width ?? 0) - 40);

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
<div class="subbar subbar-bcast" data-banner="system-broadcast" role="status"><p class="subbar-tx"><span class="subbar-tag">KOMUNIKAT HHL</span><b class="subbar-tag-ph">Komunikat HHL:</b> <b class="subbar-body">Prom Stena Estelle 09.10.2026 wypływa o 10:00 zamiast 08:00. Awizacje bez zmian.</b><span class="subbar-until"> · do 09.10.2026, 12:00</span></p></div>`;
const LONG_NAME = 'Przemysław Szczepański-Kowalczyk';

/**
 * wyglad/P10a-a — E22: pasek nowej wersji, „na żywo · HH:MM” / „brak połączenia od …” przy tytule strony,
 * komunikat w miejscu części, która się nie wczytała (pasek górny i menu zostają).
 */
test.describe('wyglad/P10a-a — nowa wersja, „na żywo”, zamiast pustej strony (E22)', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  test('komputer: pasek „Jest nowa wersja Watch Tower.” z „Odśwież teraz”; Harmonogram „na żywo · HH:MM”, bez sieci „brak połączenia od …”', async ({ page, context }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL', false, `${FROZEN_URL}&nowa-wersja=1`);
    const bar = page.locator('[data-banner="new-version"]');
    await expect(bar).toBeVisible();
    await expect(bar).toContainText('Jest nowa wersja Watch Tower.');
    await expect(bar).toContainText('Odśwież, kiedy skończysz to, co robisz. Nic się nie zgubi.');
    await expect(bar.locator('[data-new-version-reload]')).toHaveText('Odśwież teraz');
    await openView(page, 'sched');
    const live = page.locator('[data-page="schedule"] [data-live]');
    await expect(live).toHaveAttribute('data-live', 'on');
    await expect(live).toHaveText(/^na żywo · \d{2}:\d{2}$/);
    await context.setOffline(true);
    await expect(live).toHaveAttribute('data-live', 'off');
    await expect(live).toHaveText(/^brak połączenia od \d{2}:\d{2}$/);
    await context.setOffline(false);
    await expect(live).toHaveAttribute('data-live', 'on');
  });

  test('część, która się nie wczyta (plik Ryzyk po wdrożeniu) → komunikat i „Odśwież”; pasek górny i menu zostają', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL');
    await page.route(/\/assets\/RisksView-[^/]+\.js$/, (r) => r.abort());
    await page.evaluate(() => (document.querySelector('nav button[data-view="risk"]') as HTMLButtonElement).click());
    const fail = page.locator('[data-part-failed]');
    await expect(fail).toBeVisible({ timeout: 20_000 });
    await expect(fail.locator('h2')).toHaveText('Ta część aplikacji zmieniła się po aktualizacji');
    await expect(fail).toContainText('Odśwież stronę, żeby ją otworzyć. Twoje zapisane dane są bezpieczne.');
    await expect(fail.locator('[data-part-reload]')).toHaveText('Odśwież');
    await expect(page.locator('header.topbar')).toBeVisible();
    await expect(page.locator('nav button[data-view="sched"]')).toBeVisible();
    await page.unroute(/\/assets\/RisksView-[^/]+\.js$/);
  });

  test('telefon: pasek nowej wersji — 0 w bramie E8', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page, 'SCX', false, `${FROZEN_URL}&nowa-wersja=1`);
    await expect(page.locator('[data-banner="new-version"]')).toBeVisible();
    const hits: Hit[] = [];
    for (const width of [...WIDTHS, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(150);
      hits.push(...await measure(page, 'nowa-wersja', width, 'SCX'));
    }
    expect(hits, JSON.stringify(hits, null, 1)).toEqual([]);
  });
});

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
    /* wskazanie z menu konta obsłużone raz: po przejściu na inny ekran zmiana ustawienia nie wraca do „Moje konto” */
    await page.click('[data-opt-nav="look"]');
    const cur = page.locator('[data-deur-exempt="currency-pref"] select');
    await cur.selectOption((await cur.inputValue()) === 'PLN' ? 'EUR' : 'PLN');
    await page.waitForTimeout(200);
    await expect(page.locator('[data-opt-screen="look"]')).toBeVisible();
    await expect(page.locator('[data-opt-nav="look"]')).toHaveAttribute('aria-current', 'page');
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

/**
 * wyglad/2fa — Moje konto › urządzenia 2FA („Dodaj drugie urządzenie”, „Usuń” z pytaniem), Przełączniki › wymaganie 2FA
 * dla administratorów zablokowane z powodem (D-20261014-1420-01 „Koordynator”, I-17; E12, E19).
 */
test.describe('wyglad/2fa — Moje konto i Przełączniki', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });
  const openOpt = async (page: Page, view: 'options' | 'settings', key: string) => {
    await openView(page, view);
    await page.evaluate((k) => (document.querySelector(`[data-opt-nav="${k}"]`) as HTMLButtonElement).click(), key);
    await page.waitForTimeout(300);
  };

  test('komputer HHL: 2FA włączona — „Telefon 1 · od 12.10.2026”, „Dodaj drugie urządzenie”; Przełączniki — wymaganie 2FA nieaktywne z powodem', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await boot(page, 'HHL');
    await openOpt(page, 'options', 'account');
    await expect(page.locator('[data-mfa-devices]')).toHaveAttribute('data-mfa-devices', '1');
    await expect(page.locator('[data-mfa-device]')).toContainText('Telefon 1');
    await expect(page.locator('[data-mfa-device]')).toContainText('od 12.10.2026');
    await expect(page.locator('[data-mfa-add]')).toBeEnabled();
    await expect(page.locator('[data-mfa-remove]')).toHaveCount(0);
    await expect(page.locator('[data-mfa-needs-code]')).toHaveCount(0);
    await openOpt(page, 'options', 'flags');
    const row = page.locator('[data-flag="MFA_HHL_ADMIN"]');
    await expect(row.locator('[role="switch"]')).toBeDisabled();
    await expect(row.locator('[data-flag-blocked]')).toContainText('2FA na dwóch urządzeniach');
    await expect(page.locator('[data-flag="EXTERNAL_MESSAGING"] [role="switch"]')).toBeEnabled();
  });

  test('telefon HHL: Moje konto z urządzeniami 2FA — 0 w bramie E8', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page, 'HHL');
    await openView(page, 'options');
    await page.waitForSelector('.ox-tiles');
    await openPhoneScreen(page, 'forme', 'account');
    await expect(page.locator('[data-mfa-device]')).toHaveCount(1);
    const hits: Hit[] = [];
    for (const width of [...WIDTHS, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(150);
      hits.push(...await measure(page, 'moje-konto-2fa', width, 'HHL'));
    }
    expect(hits, JSON.stringify(hits, null, 1)).toEqual([]);
  });
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
    // Harmonogram: tylko filtry stanu (E28 pkt 2) i „Anulowane” (E30 pkt 3, wyglad/P7-c)
    const quick = await page.locator('[data-sched-filters] [data-quick]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.quick));
    expect(quick).toEqual(['late', 'nodocs', 'nodriver', 'notractor', 'cancelled']);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-stage-chip]')).toHaveCount(0);
  });

  /* wyglad/P9-c (E29 pkt 5, zdecydowane 08.10): „W oknie · Opóźnione · Brak GPS · Bez pozycji” zamiast „W trasie” z P4 */
  test('komputer: Mapa — W oknie · Opóźnione · Brak GPS · Bez pozycji; „Na mapie: 0” przy etapie bez pozycji; najbliższe włączenia śledzenia', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL');
    await openView(page, 'map');
    const timing = await page.locator('[data-map-filters] [data-timing]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.timing));
    expect(timing).toEqual(['all', 'late', 'nogps', 'nopos']);
    await expect(page.locator('[data-map-next] .map-next-hd')).toHaveText('Najbliższe włączenia śledzenia');
    await page.locator('[data-stage-bar="global"] [data-tile="PREP"]').click();
    await expect(page.locator('[data-map-empty]')).toContainText('Na mapie: 0');
  });

  test('komputer: Mapa z filtrem etapu — liczba przy chipie = wiersze po kliknięciu; bez chipa „W oknie”', async ({ page }) => {
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
      for (const k of ['late', 'nogps', 'nopos']) {
        const chip = page.locator(`[data-map-filters] [data-timing="${k}"]`);
        const c = Number((await chip.innerText()).replace(/\D+/g, ''));
        await chip.click();
        await expect(rows, `${tile} ${k}`).toHaveCount(c);
        await chip.click();
      }
      await bar.locator(`[data-tile="${tile}"]`).click();
    }
  });

  test('telefon 390: filtr z arkusza „Filtry” — liczba przy „Filtry · n” także z filtrem etapu; „⋯” — Escape i dotknięcie obok zamykają tylko menu', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page, 'HHL', true);
    await openView(page, 'sched');
    const sched = page.locator('[data-page="schedule"]');
    const row = sched.locator('[data-sched-filters]');
    // wyglad/P7-c (E30 pkt 8): filtr z arkusza „Filtry”; po wybraniu liczba przy „Filtry · n”
    await sched.locator('[data-sched-more-filters]').click();
    await page.locator('[data-sched-sheet] [data-quick="nodriver"]').click();
    await expect(page.locator('[data-sched-sheet] [data-quick="nodriver"]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-sched-sheet] [data-sheet-show]').click();
    await expect(page.locator('[data-sched-sheet]')).toHaveCount(0);
    await expect(row.locator('[data-sched-more-filters]')).toHaveText('Filtry · 1');
    // z filtrem etapu: chip etapu pod szukajką, liczba filtrów zostaje
    await sched.locator('[data-stage-bar="page"] [data-tile="PREP"]').click();
    await expect(sched.locator('[data-stage-chip="PREP"]')).toBeVisible();
    await expect(row.locator('[data-sched-more-filters]')).toHaveText('Filtry · 1');
    // „⋯”: Escape zamyka menu, filtr etapu zostaje
    const more = sched.locator('.sched-more');
    await more.click();
    await expect(sched.locator('.sched-actions-pop')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sched.locator('.sched-actions-pop')).toHaveCount(0);
    await expect(sched.locator('[data-stage-chip="PREP"]')).toBeVisible();
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
  if (!groups.length) {
    /* jedna grupa — od razu lista ekranów (Ustawienia KSH i SCX) */
    const group = (await page.getAttribute('[data-opt-level="groups"]', 'data-opt-group')) ?? '';
    const screens = await page.evaluate(() => Array.from(document.querySelectorAll('.ox-tiles [data-opt-nav]')).map((b) => b.getAttribute('data-opt-nav') ?? ''));
    return screens.map((screen) => ({ group, screen }));
  }
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
  if (await page.locator(`.ox-tiles [data-opt-group="${group}"]`).count()) {
    await page.click(`.ox-tiles [data-opt-group="${group}"]`);
    await page.waitForTimeout(120);
  }
  if (await page.locator(`.ox-tiles [data-opt-nav="${screen}"]`).count()) await page.click(`.ox-tiles [data-opt-nav="${screen}"]`);
  await page.waitForSelector(`[data-opt-screen="${screen}"]`);
  await page.waitForTimeout(250);
}

/* wyglad/P9-a (E24-1, img/e24-after) — komunikat zamiast szarej mapy. Kafelki podkładu odrzucane w przeglądarce
   (prawdziwa droga awarii: 3 przebiegi bez kafelka); po zdjęciu blokady „Spróbuj ponownie” wczytuje podkład. */
const P9A_TILE = /arcgisonline\.com\/ArcGIS\/rest\/services\/.*\/tile\//;
test.describe('wyglad/P9-a komunikat zamiast szarej mapy (E24-1, img/e24-after)', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  test('komputer: karta z makiety, mapa pod spodem działa, bez cienia; „Spróbuj ponownie” wczytuje podkład i karta znika', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route(P9A_TILE, (r) => r.abort());
    await boot(page, 'HHL');
    await openView(page, 'map');
    const card = page.locator('[data-basemap-failed="tiles"]').first();
    await expect(card).toBeVisible({ timeout: 30_000 });
    await expect(card).toHaveAttribute('data-compact', '0');
    await expect(card.locator('.bm-fail-t')).toHaveText('Nie udało się wczytać podkładu mapy');
    await expect(card.locator('.bm-fail-b')).toHaveText('Pozycje i trasa są aktualne. Brakuje tylko tła z ulicami.');
    await expect(card.locator('[data-basemap-retry]')).toHaveText('Spróbuj ponownie');
    await expect(card.locator('[data-basemap-reload]')).toHaveText('Odśwież stronę');
    await expect(card.locator('[data-basemap-src]')).toHaveText(/^Próbowano 3 razy: .+\. Zgłoszenie zapisane dla HHL\.$/);
    const look = await card.locator('.bm-fail').evaluate((el) => {
      const cs = getComputedStyle(el);
      return { shadow: cs.boxShadow, radius: cs.borderRadius, wrapEvents: getComputedStyle(el.parentElement as Element).pointerEvents };
    });
    expect(look.shadow).toBe('none');
    expect(['0px', '2px']).toContain(look.radius);
    expect(look.wrapEvents).toBe('none');
    /* trasa i pojazdy nadal na mapie (dane nie zależą od podkładu) */
    expect(await page.locator('.corridor-map-el .leaflet-overlay-pane path').count()).toBeGreaterThan(0);
    expect(await page.locator('.corridor-map-el .leaflet-marker-pane .leaflet-marker-icon').count()).toBeGreaterThan(0);
    for (const sel of ['[data-basemap-retry]', '[data-basemap-reload]']) {
      const b = await card.locator(sel).boundingBox();
      expect(b && b.height >= 44 && b.width >= 44, `${sel} ≥ 44 px`).toBeTruthy();
    }
    await page.unroute(P9A_TILE);
    await card.locator('[data-basemap-retry]').click();
    await expect(page.locator('[data-basemap-failed]')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator('.corridor-map-el img.leaflet-tile-loaded').first()).toBeAttached({ timeout: 30_000 });
  });

  test('komputer: podkład się wczytuje — karty nie ma (stan normalny jak dziś)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL');
    await openView(page, 'map');
    await expect(page.locator('.corridor-map-el img.leaflet-tile-loaded').first()).toBeAttached({ timeout: 30_000 });
    await page.waitForTimeout(500);
    await expect(page.locator('[data-basemap-failed]')).toHaveCount(0);
  });

  test('Kokpit (mapa w kafelku): wersja krótka', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.route(P9A_TILE, (r) => r.abort());
    await boot(page, 'HHL');
    await openView(page, 'dash');
    const card = page.locator('[data-basemap-failed="tiles"]').first();
    await expect(card).toBeAttached({ timeout: 30_000 });
    await expect(card).toHaveAttribute('data-compact', '1');
    await expect(card.locator('.bm-fail-t')).toHaveText('Nie udało się wczytać podkładu');
    await expect(card.locator('[data-basemap-reload], [data-basemap-src]')).toHaveCount(0);
  });

  for (const width of [360, 390, 430]) {
    test(`telefon ${width}: krótko — tytuł, jedno zdanie, „Spróbuj ponownie” ≥ 44 px; nic uciętego, tekst ≥ 12 px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await page.route(P9A_TILE, (r) => r.abort());
      await boot(page, 'HHL');
      await openView(page, 'map');
      const card = page.locator('[data-basemap-failed="tiles"]').first();
      await expect(card).toBeVisible({ timeout: 30_000 });
      await expect(card).toHaveAttribute('data-compact', '1');
      await expect(card.locator('.bm-fail-t')).toHaveText('Nie udało się wczytać podkładu');
      await expect(card.locator('.bm-fail-b')).toHaveText('Pozycje i trasa są aktualne.');
      await expect(card.locator('button')).toHaveCount(1);
      await expect(card.locator('[data-basemap-retry]')).toHaveText('Spróbuj ponownie');
      const m = await card.locator('.bm-fail').evaluate((el) => {
        const r = el.getBoundingClientRect();
        const out: string[] = [];
        if (r.left < 0 || r.right > window.innerWidth) out.push(`karta poza oknem ${Math.round(r.left)}–${Math.round(r.right)}`);
        for (const n of el.querySelectorAll<HTMLElement>('b, span, button')) {
          const cs = getComputedStyle(n);
          if (parseFloat(cs.fontSize) < 12) out.push(`tekst < 12 px: ${n.textContent}`);
          if (n.scrollWidth > n.clientWidth + 1 && cs.overflow !== 'visible') out.push(`ucięte: ${n.textContent}`);
        }
        const b = el.querySelector('button')!.getBoundingClientRect();
        if (b.width < 44 || b.height < 44) out.push(`przycisk ${Math.round(b.width)}×${Math.round(b.height)}`);
        return out;
      });
      expect(m).toEqual([]);
    });
  }
});

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
      /* KSH i SCX w demo mają jedną grupę — telefon pokazuje od razu ekrany „Dla mnie” (bez kafelka grupy) */
      /* wyglad/C (E11 menu „Dla mnie”, E5): „Ten telefon / komputer” po „Wygląd i waluta” */
      if (role !== 'HHL') expect(list.map((x) => x.screen)).toEqual(['account', 'forme', 'look', 'device']);
      const hits: Hit[] = [];
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 844 });
        for (const { group, screen } of list) {
          await openPhoneScreen(page, group, screen);
          hits.push(...await measure(page, `opcje/${screen}`, width, role));
          /* stany otwarte: edycja progu, działania przy osobie, wiadomość w „Treściach wiadomości” (wyglad/P8-a) */
          const open = screen === 'thr' ? '[data-threshold] .ox-btn' : screen === 'users' ? '.ox-morebtn' : screen === 'texts' ? '[data-mt-item="SMS_C"]' : null;
          if (open && await page.locator(open).count()) {
            await page.locator(open).first().click();
            await page.waitForTimeout(150);
            hits.push(...await measure(page, `opcje/${screen}/otwarte`, width, role));
            /* wiadomość ma własne „‹” (nagłówek ekranu jest wtedy schowany) — powrót do listy przed dalszym przejściem */
            if (screen === 'texts' && await page.locator('.mt-back').count()) await page.click('.mt-back');
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
    await expect(page.locator('.ox-side [data-opt-group="notify"] [data-opt-nav]')).toHaveText(['Kto co dostaje', 'Treści wiadomości', 'SMS przy miejscachBoden: brak', 'Komunikat dla wszystkich']);
    await page.click('[data-opt-nav="flags"]');
    await expect(page.locator('[data-opt-screen="flags"] .ox-crumb')).toHaveText('Opcje › System');
    await expect(page.locator('[data-opt-screen="flags"] tbody tr')).toHaveCount(9); /* wyglad/P9-b: bez H1, H3, H6 (16.10 01:13); wyglad/audyt-E: bez e-maila o decyzjach automatycznych (E5, E11) */
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
      /* wyglad/C (E11, E5): „Ten telefon / komputer” */
      await expect(page.locator('.ox-side [data-opt-nav]')).toHaveText(['Moje konto', 'Co dostaję', 'Wygląd i waluta', 'Ten telefon / komputer']);
    }
  });
});

/**
 * wyglad/P6-f — Dla mnie › Ten telefon / komputer: aplikacja zainstalowana / przeglądarka, „Zainstaluj aplikację”,
 * wiadomości z Czatu w powiadomieniu (D-20261016-0310-01 Cz19 pkt 5, Cz23 pkt 4–5; D-20261016-0315-01 Cz32).
 */
test.describe('wyglad/P6-f — „Ten telefon”: aplikacja i wiadomości z Czatu w powiadomieniu', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });
  const openDevice = async (page: Page, view: 'options' | 'settings') => {
    await openView(page, view);
    await page.evaluate(() => (document.querySelector('[data-opt-nav="device"]') as HTMLButtonElement).click());
    await page.waitForSelector('[data-screen="device"]', { timeout: 10_000 });
  };

  test('komputer HHL: w przeglądarce — zdanie o ikonie na ekranie; reguła z Czatem; 6 zdań o powiadomieniu z Czatu', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await boot(page, 'HHL');
    await openDevice(page, 'options');
    await expect(page.locator('[data-screen="device"] .ox-panel-note').first()).toContainText('pilne sprawy „Do zrobienia” i wiadomości z Czatu');
    await expect(page.locator('[data-dev-app]')).toHaveAttribute('data-dev-app', 'browser');
    await expect(page.locator('[data-dev-app] .ox-dev-app-st')).toContainText('uruchamiaj ją z ikony na ekranie');
    await expect(page.locator('[data-dev-install]')).toHaveCount(0);
    await expect(page.locator('[data-dev-chat] li')).toHaveCount(6);
    await expect(page.locator('[data-dev-chat]')).toContainText('„Odpowiedz” — wpisujesz odpowiedź od razu w powiadomieniu');
    await expect(page.locator('[data-dev-chat]')).toContainText('nie trafiają do KSH');
  });

  for (const role of ['SCX', 'KSH'] as const) {
    test(`telefon ${role}: Ten telefon z nowymi blokami — 0 w bramie E8`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await boot(page, role);
      await openDevice(page, 'settings');
      await expect(page.locator('[data-dev-chat] li')).toHaveCount(6);
      const hits: Hit[] = [];
      for (const width of [...WIDTHS, 768]) {
        await page.setViewportSize({ width, height: 844 });
        await page.waitForTimeout(150);
        hits.push(...await measure(page, 'ten-telefon', width, role));
      }
      expect(hits, JSON.stringify(hits, null, 1)).toEqual([]);
    });
  }
});

test.describe('wyglad/P4-b panel transportu — Status E25 (img/e25-after), pasek śledzenia E27, okno „Zmień status”', () => {
  test.describe.configure({ mode: 'serial', timeout: 180_000 });

  async function openLoad(page: Page, code: string) {
    await openView(page, 'sched');
    await page.evaluate((c) => {
      const el = [...document.querySelectorAll('[data-load]')].find((r) => (r.textContent ?? '').trim().includes(c)) as HTMLElement | undefined;
      el?.click();
    }, code);
    await page.waitForSelector('aside.drawer', { timeout: 10_000 });
  }
  const statusTab = (page: Page) => page.locator('.drawer button[aria-selected]').nth(1).click();

  test('komputer HHL: pasek śledzenia nad zakładkami; oś 3 grupy i 14 statusów; bieżący; okno z informacją przy „Dostarczone”', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL');
    await openLoad(page, 'T-12');
    const bar = page.locator('.drawer [data-tracking-bar]');
    await expect(bar).toHaveAttribute('data-tracking-bar', 'on');
    const barBox = (await bar.boundingBox())!;
    const tabsBox = (await page.locator('.drawer .dtabs').boundingBox())!;
    expect(barBox.y + barBox.height).toBeLessThanOrEqual(tabsBox.y + 1);
    await expect(page.locator('.drawer [data-eta-block]')).toBeVisible();
    await statusTab(page);
    const axis = page.locator('.drawer [data-status-axis]');
    await expect(axis.locator('[data-axis-group]')).toHaveCount(3);
    const groups = await axis.locator('[data-axis-group]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.axisGroup));
    expect(groups).toEqual(['prep', 'route', 'after']);
    const names = await axis.locator('[data-axis-row]').evaluateAll((els) => els.flatMap((e) => ((e as HTMLElement).dataset.axisRow ?? '').split(' ')));
    expect(names).toHaveLength(14);
    await expect(axis.locator('[data-axis-kind="current"]')).toHaveCount(1);
    await expect(axis.locator('[data-axis-kind="current"] .sax-name')).toHaveText('Na placu');
    await page.locator('.drawer [data-action="change-status"]').click();
    const modal = page.locator('[data-status-change-modal]');
    await expect(modal).toBeVisible();
    await expect(modal.locator('[data-status-now]')).toContainText('Na placu');
    await modal.locator('[data-status-select]').selectOption('DELIVERED');
    await expect(modal.locator('[data-status-info]')).toBeVisible();
    await modal.getByRole('button', { name: 'Anuluj' }).click();
    await expect(modal).toHaveCount(0);
  });

  test('KSH: oś statusów jako podgląd, bez „Zmień status”', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'KSH');
    await openLoad(page, 'SG-01');
    await statusTab(page);
    await expect(page.locator('.drawer [data-status-axis]')).toBeVisible();
    await expect(page.locator('.drawer [data-action="change-status"]')).toHaveCount(0);
    await expect(page.locator('.drawer .sax-who')).toBeVisible();
  });

  /* audyt-B B-04 (E25, 07.10 17:46): SCX zmienia status tylko do przodu; cofnięcie — administrator HHL, z powodem
     (pole obowiązkowe, „Zapisz status” nieaktywny bez powodu). SG-03 = „Na promie”. */
  test('okno „Zmień status”: SCX bez statusów wcześniejszych; HHL cofa tylko z powodem', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'SCX');
    await openLoad(page, 'SG-03');
    await statusTab(page);
    await page.locator('.drawer [data-action="change-status"]').click();
    const modal = page.locator('[data-status-change-modal]');
    await expect(modal.locator('[data-status-select]')).toBeVisible();
    const opts = await modal.locator('[data-status-select] option').evaluateAll((els) => els.map((e) => (e as HTMLOptionElement).value));
    expect(opts[0]).toBe('ON_FERRY');
    expect(opts).not.toContain('PLANNED');
    expect(opts).not.toContain('AT_PORT');
    await expect(modal.locator('[data-status-note]')).not.toHaveAttribute('required', '');
    await modal.getByRole('button', { name: 'Anuluj' }).click();

    await boot(page, 'HHL');
    await openLoad(page, 'SG-03');
    await statusTab(page);
    await page.locator('.drawer [data-action="change-status"]').click();
    await modal.locator('[data-status-select]').selectOption('AT_PORT');
    await expect(modal.locator('[data-status-back]')).toBeVisible();
    await expect(modal.locator('label.form-field', { has: page.locator('[data-status-note]') })).toContainText('Powód cofnięcia (wymagany)');
    await expect(modal.locator('[data-status-note]')).toHaveAttribute('data-status-reason', 'required');
    await expect(modal.locator('[data-status-save]')).toBeDisabled();
    await modal.locator('[data-status-note]').fill('status ustawiony omyłkowo');
    await expect(modal.locator('[data-status-save]')).toBeEnabled();
    await modal.locator('[data-status-select]').selectOption('IN_TRANSIT_SE');
    await expect(modal.locator('[data-status-back]')).toHaveCount(0);
    await expect(modal.locator('label.form-field', { has: page.locator('[data-status-note]') })).toContainText('Notatka (opcjonalnie)');
    await modal.getByRole('button', { name: 'Anuluj' }).click();
  });

  for (const width of [360, 390, 430]) {
    test(`telefon ${width}: oś od „W trasie”, „Przygotowanie” zwinięte; „Zmień status” nad dolnym paskiem; okno jako arkusz od dołu`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await boot(page, 'HHL', true);
      await openLoad(page, 'T-12');
      await statusTab(page);
      const groups = await page.locator('.drawer [data-axis-group]').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset.axisGroup));
      expect(groups).toEqual(['route', 'after', 'prep']);
      await expect(page.locator('.drawer [data-axis-group="prep"] [data-axis-row]')).toHaveCount(0);
      /* E8 pkt 4: w panelu (pasek śledzenia i oś) tekst ≥ 12 px, przyciski ≥ 44 px */
      const tiny = async (sel: string) => page.locator(sel).evaluateAll((roots) => roots.flatMap((root) => {
        const out: string[] = [];
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n = w.nextNode(); n; n = w.nextNode()) {
          const el = n.parentElement;
          if (!el || !(n.textContent ?? '').trim()) continue;
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (parseFloat(getComputedStyle(el).fontSize) < 12) out.push(`${(n.textContent ?? '').trim().slice(0, 30)} ${getComputedStyle(el).fontSize}`);
        }
        return out;
      }));
      expect(await tiny('.drawer [data-tracking-bar], .drawer [data-status-axis]')).toEqual([]);
      const smallBtn = await page.locator('.drawer [data-status-axis] button').evaluateAll((els) =>
        els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height < 44; }).map((e) => e.textContent));
      expect(smallBtn).toEqual([]);
      const btn = page.locator('.drawer [data-action="change-status"]');
      await btn.scrollIntoViewIfNeeded();
      const b = (await btn.boundingBox())!;
      expect(b.height).toBeGreaterThanOrEqual(44);
      const onTop = await btn.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('[data-action="change-status"]') === el;
      });
      expect(onTop, 'przycisk nie jest zasłonięty dolnym paskiem').toBe(true);
      await btn.click();
      const modal = page.locator('[data-status-change-modal]');
      await expect(modal).toBeVisible();
      const m = (await modal.boundingBox())!;
      expect(Math.round(m.x)).toBe(0);
      expect(Math.round(m.width)).toBe(width);
      expect(Math.round(m.y + m.height)).toBe(844);
      const small = await modal.locator('button, select, input').evaluateAll((els) =>
        els.filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height < 44; }).map((e) => e.outerHTML.slice(0, 60)));
      expect(small).toEqual([]);
      expect(await tiny('[data-status-change-modal]')).toEqual([]);
      const inputFont = await modal.locator('input, select').evaluateAll((els) => els.map((e) => parseFloat(getComputedStyle(e).fontSize)));
      expect(inputFont.every((f) => f >= 16), `pola ≥ 16 px: ${inputFont.join(', ')}`).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);
    });
  }
});

/**
 * wyglad/P4-c — pole „Link śledzenia” w awizacji (E44), „Gotowy” ze zdaniem, czego brakuje (L6, L9, L29),
 * sprawa „Wyjazd z placu po X min — czy dostarczono?” (E26 pkt 4, L14), Automatyzacje › „Działa samo” (E35 pkt 1, L13).
 * Dane demo (`src/lib/p4cDemo.ts`): P-01 — link RIO z ostrzeżeniami, D-02 — braki do „Gotowy”, D-01 — sprawa L14.
 * Telefon 360 / 390 / 430: każdy stan przechodzi tę samą bramę E8 (0 w każdej kolumnie). Komputer 1280 / 1440: bez przewijania w bok.
 */
test.describe('wyglad/P4-c — link śledzenia (E44), „Gotowy” (L6, L9), sprawa L14, „Działa samo” (E35)', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  async function openCode(page: Page, code: string) {
    await page.evaluate((c) => { window.location.hash = `#/transport/${c}`; }, code);
    await page.waitForSelector('aside.drawer', { timeout: 10_000 });
    await page.waitForTimeout(300);
  }
  async function closeDrawer(page: Page) {
    await page.locator('aside.drawer .dhead button[aria-label], aside.drawer button.iconbtn').first().click().catch(() => {});
    await page.evaluate(() => { window.location.hash = '#/'; });
    await page.waitForTimeout(300);
  }
  const tab = async (page: Page, i: number) => { await page.locator('.drawer .dtabs button').nth(i).click(); await page.waitForTimeout(250); };
  const noSideScroll = async (page: Page, width: number) =>
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);

  test('komputer SCX: zapisany link RIO bez adresu i klucza, wynik zapytania, lokalizator, ostrzeżenia; „Zmień link” i powrót', async ({ page }) => {
    for (const width of [1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await boot(page, 'SCX');
      await openCode(page, 'P-01');
      await page.locator('[data-awiz-open]').click();
      const f = page.locator('[data-awiz-tracking]');
      await expect(f).toHaveAttribute('data-tl-mode', 'saved');
      await expect(f.locator('[data-tl-chip]')).toHaveText(/^RIO · .+ · ••••$/);
      const html = await f.innerHTML();
      expect(html).not.toMatch(/secret|position-sharing/i);
      await expect(f.locator('[data-tl-check="ok"]')).toContainText('Link RIO działa');
      await expect(f.locator('[data-tl-tracker]')).toContainText('Lokalizator: naczepa');
      await expect(f.locator('[data-tl-note="expires-early"]')).toBeVisible();
      await expect(f.locator('[data-tl-note="starts-late"]')).toBeVisible();
      await expect(f.locator('[data-tl-open]')).toBeVisible();
      await f.locator('[data-tl-change]').click();
      await expect(f).toHaveAttribute('data-tl-mode', 'change');
      const input = f.locator('input');
      await expect(input).toHaveValue('');
      await expect(input).toBeFocused();
      /* wklejony link z kluczem znika z pola od razu (E44 pkt 8) — klucza nie ma nigdzie w stronie */
      const FAKE = 'zmyslony-P4C-1';
      await input.dispatchEvent('paste');
      await input.fill(`https://public.position-sharing.rio.cloud/?id=00000000-0000-0000-0000-000000000000&secret=${FAKE}`);
      await expect(f).toHaveAttribute('data-tl-mode', 'new-rio');
      await expect(f.locator('[data-tl-new]')).toContainText('RIO · nowy link · ••••');
      expect(await page.evaluate((k) => document.documentElement.outerHTML.includes(k), FAKE)).toBe(false);
      /* wpisany ręcznie — zakryty po wyjściu z pola */
      await f.locator('[data-tl-repaste]').click();
      await expect(f.locator('input')).toBeFocused();
      await f.locator('input').pressSequentially(`https://public.position-sharing.rio.cloud/?id=1&secret=${FAKE}`, { delay: 0 });
      await f.locator('input').blur();
      await expect(f).toHaveAttribute('data-tl-mode', 'new-rio');
      expect(await page.evaluate((k) => document.documentElement.outerHTML.includes(k), FAKE)).toBe(false);
      await f.locator('[data-tl-keep]').click();
      await expect(f).toHaveAttribute('data-tl-mode', 'saved');
      await expect(f.locator('[data-tl-change]')).toBeFocused();
      await noSideScroll(page, width);
      await page.keyboard.press('Escape');
    }
  });

  test('komputer SCX: nowy link RIO zapisany w awizacji — po ponownym otwarciu „RIO · … · ••••”, klucza nie ma w stronie', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'SCX');
    await openCode(page, 'P-01');
    await page.locator('[data-awiz-open]').click();
    const f = page.locator('[data-awiz-tracking]');
    await f.locator('[data-tl-change]').click();
    const FAKE = 'zmyslony-P4C-2';
    await f.locator('input').dispatchEvent('paste');
    await f.locator('input').fill(`https://public.position-sharing.rio.cloud/?id=11111111-1111-1111-1111-111111111111&secret=${FAKE}`);
    await page.locator('[data-awiz-save]').click();
    await expect(page.locator('.awiz-modal')).toHaveCount(0);
    await page.locator('[data-awiz-open]').click();
    await expect(page.locator('[data-awiz-tracking]')).toHaveAttribute('data-tl-mode', 'saved');
    await expect(page.locator('[data-awiz-tracking] [data-tl-chip]')).toHaveText(/^RIO · .+ · ••••$/);
    expect(await page.evaluate((k) => document.documentElement.outerHTML.includes(k), FAKE)).toBe(false);
  });

  test('komputer SCX: „Gotowy” — zdanie z brakami na osi i w oknie, „Zapisz status” zablokowany (D-02); komplet (P-01)', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'SCX');
    await openCode(page, 'D-02');
    await tab(page, 1);
    await expect(page.locator('.drawer [data-axis-row="READY"] .sax-sub')).toContainText('Brakuje:');
    await page.locator('.drawer [data-action="change-status"]').click();
    const modal = page.locator('[data-status-change-modal]');
    await modal.locator('[data-status-select]').selectOption('READY');
    await expect(modal.locator('[data-status-ready-gaps]')).toContainText('Brakuje:');
    await expect(modal.locator('[data-status-ready-gaps]')).toContainText('Uzupełnia');
    await expect(modal.locator('[data-status-save]')).toBeDisabled();
    await modal.locator('[data-status-select]').selectOption('LOADING');
    await expect(modal.locator('[data-status-ready-gaps]')).toHaveCount(0);
    await expect(modal.locator('[data-status-save]')).toBeEnabled();
    await modal.getByRole('button', { name: 'Anuluj' }).click();
    await closeDrawer(page);
    await openCode(page, 'P-01');
    await tab(page, 1);
    await page.locator('.drawer [data-action="change-status"]').click();
    await modal.locator('[data-status-select]').selectOption('READY');
    await expect(modal.locator('[data-status-ready-ok]')).toBeVisible();
  });

  test('komputer: sprawa „czy dostarczono?” (D-01) — SCX odpowiada, „Nie” zamyka bez zmiany statusu; HHL widzi, na kogo czeka', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'SCX');
    await openCode(page, 'D-01');
    await tab(page, 0);
    await page.locator('.drawer [data-dc-jump]').click();
    const card = page.locator('.drawer [data-delivered-check]');
    await expect(card).toContainText('czy dostarczono?');
    await expect(card.locator('[data-dc="yes"]')).toHaveText('Tak, dostarczono');
    await card.locator('[data-dc="no"]').click();
    await expect(card).toHaveCount(0);
    await expect(page.locator('.drawer [data-axis-kind="current"] .sax-name')).toHaveText('Na placu');
    await boot(page, 'HHL');
    await openCode(page, 'D-01');
    await tab(page, 1);
    await expect(page.locator('.drawer [data-delivered-check] [data-dc="wait"]')).toBeVisible();
    await expect(page.locator('.drawer [data-delivered-check] [data-dc="yes"]')).toHaveCount(0);
  });

  test('komputer HHL: Automatyzacje — „Działa samo” pierwsza; 4 grupy, 7 automatów; reguły stref; odnośnik do Opcji; „Własne reguły”', async ({ page }) => {
    for (const width of [1280, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await boot(page, 'HHL');
      await openView(page, 'wf');
      const tabs = page.locator('.wf-tabs [role="tab"]');
      await expect(tabs.first()).toHaveText('Działa samo');
      await expect(tabs.first()).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('[data-auto-group]')).toHaveCount(4);
      await expect(page.locator('[data-auto-row]')).toHaveCount(7);
      await page.locator('[data-auto-row="zones"] .arl-hd').click();
      await expect(page.locator('[data-auto-zone-rules] [data-zone-rule]')).toHaveCount(5);
      await expect(page.locator('[data-zone-rule="site"]')).toContainText('Dostarczone');
      await noSideScroll(page, width);
      await tabs.nth(1).click();
      /* wyglad/P8-d (E35 pkt 2, decyzja 08.10.2026, 12:14): po zmianie lista własnych reguł jest pusta — reguły START
         znikają albo przechodzą do „Kto co dostaje”; dawne wiersze `[data-wf-id]` tylko w widoku produkcji do podłączenia */
      await expect(page.locator('#wf-panel-own .rl-empty')).toBeVisible();
      await expect(page.locator('#wf-panel-auto')).toBeHidden();
    }
    await page.locator('.wf-tabs [role="tab"]').first().click();
    await page.locator('[data-auto-row="cases"] .arl-hd').click();
    await page.locator('[data-auto-go="cases"]').click();
    await expect(page.locator('[data-opt-screen="thr"]')).toBeVisible();
  });

  for (const width of WIDTHS) {
    test(`telefon ${width}: awizacja z linkiem RIO, „Gotowy” zablokowany, sprawa L14 i „Działa samo” — 0 w każdej kolumnie E8`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      const hits: Hit[] = [];
      await boot(page, 'SCX', true);
      await openCode(page, 'P-01');
      /* wyglad/P7-a — E32 pkt 9: na telefonie sekcja „Awizacja” w Przeglądzie zwinięta — rozwinięcie przed przyciskiem */
      await page.locator('.drawer details[data-po="awiz"] > summary').click();
      await page.locator('[data-awiz-open]').click();
      await page.locator('[data-awiz-tracking]').scrollIntoViewIfNeeded();
      hits.push(...await measure(page, 'awizacja-link', width, 'SCX'));
      await page.locator('[data-tl-change]').click();
      const font = await page.locator('[data-awiz-tracking] input').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
      expect(font, 'pole ≥ 16 px').toBeGreaterThanOrEqual(16);
      hits.push(...await measure(page, 'awizacja-link-zmiana', width, 'SCX'));
      await page.keyboard.press('Escape');
      await closeDrawer(page);
      await openCode(page, 'D-02');
      await tab(page, 1);
      await page.locator('.drawer [data-action="change-status"]').click();
      await page.locator('[data-status-select]').selectOption('READY');
      await expect(page.locator('[data-status-ready-gaps]')).toBeVisible();
      hits.push(...await measure(page, 'gotowy-braki', width, 'SCX'));
      await page.getByRole('button', { name: 'Anuluj' }).click();
      await closeDrawer(page);
      await openCode(page, 'D-01');
      await tab(page, 0);
      hits.push(...await measure(page, 'sprawa-przeglad', width, 'SCX'));
      await page.locator('.drawer [data-dc-jump]').click();
      await expect(page.locator('.drawer [data-delivered-check]')).toBeVisible();
      hits.push(...await measure(page, 'sprawa-status', width, 'SCX'));
      await closeDrawer(page);
      await boot(page, 'HHL', true);
      await openView(page, 'wf');
      hits.push(...await measure(page, 'dziala-samo', width, 'HHL'));
      await page.locator('[data-auto-row="zones"] .arl-hd').click();
      hits.push(...await measure(page, 'dziala-samo-strefy', width, 'HHL'));
      /* „Własne reguły” (dzisiejsza lista z warunkami w JSON, ucięte na telefonie) — przebudowa E35 w P8, POROWNANIE P4-c */
      expect(hits, JSON.stringify(hits, null, 1)).toEqual([]);
    });
  }
});

/**
 * wyglad/P5 — Finanse (E16, img/e16-after) i opłata paliwowa według tygodnia (E39, img/e39-after).
 * Komputer: HHL — etapy z marżą, rodzaje, kurs NBP, flaga marży; KSH i SCX — tylko swoja strona, bez marży.
 * Telefon 360 / 390 / 430: karty etapów i rodzajów, tydzień opłaty rozwinięty — ta sama brama E8 (0 w każdej kolumnie).
 */
test.describe('wyglad/P5 Finanse — E16, E39, E40', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  test('komputer: HHL tabela etapów z marżą, rodzaje, NBP i flaga; KSH i SCX jedna kolumna; wiersz tygodnia się rozwija', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL');
    await openView(page, 'fin');
    const stages = page.locator('[data-fin-stages="both"]');
    await expect(stages.locator('thead th')).toHaveText(['ETAP ROZLICZENIA', 'TRANSPORTY', 'PRZYCHÓD (KSH)', 'KOSZT (SCX)', 'MARŻA', '%']);
    await expect(stages.locator('tbody [data-fin-stage]')).toHaveCount(3);
    await expect(page.locator('[data-fin-types] tbody tr').first()).toBeVisible();
    await expect(page.locator('[data-fin-nbp]')).toContainText('Ostatnia tabela');
    await expect(page.locator('[data-fin-flag]')).toContainText('Próg marży');
    const week = page.locator('[data-fuel-table] tr[data-fuel-week]').first();
    await week.click();
    await expect(page.locator('[data-fuel-detail]')).toHaveCount(1);
    await week.locator('[data-fuel-toggle]').press('Enter');
    await expect(page.locator('[data-fuel-detail]')).toHaveCount(0);
    // E40: paczka tygodnia dla księgowości — dwie paczki; zablokowana wysyłka jest szara i ma powód
    await expect(page.locator('[data-fin-pack] [data-pack]')).toHaveCount(2);
    await expect(page.locator('[data-fin-pack] [data-pack-files="KSH"] li').last()).toContainText('Zestawienie_');
    for (const key of ['KSH', 'HHL'] as const) {
      const why = page.locator(`[data-pack="${key}"] [data-pack-why]`);
      if (await why.count()) await expect(page.locator(`[data-pack-send="${key}"]`)).toBeDisabled();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1441);
    for (const [r, head] of [['KSH', 'DO ZAPŁATY'], ['SCX', 'NALEŻNOŚĆ']] as const) {
      await boot(page, r);
      await openView(page, 'fin');
      const t = page.locator(`[data-fin-stages="${r === 'KSH' ? 'rev' : 'cost'}"]`);
      await expect(t.locator('thead th')).toHaveCount(3);
      await expect(t.locator('thead th').nth(2)).toContainText(head);
      await expect(page.locator('[data-page="finance"]')).not.toContainText('Marża');
      await expect(page.locator('[data-fin-nbp], [data-fin-flag], [data-fin-types], [data-fin-pack]')).toHaveCount(0);
      await expect(page.locator('[data-fuel-table]')).toBeVisible();
    }
  });

  for (const role of ['HHL', 'KSH', 'SCX'] as const) {
    test(`telefon ${role}: karty etapów, rodzajów i tygodni opłaty — 0 w bramie E8`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await boot(page, role);
      await openView(page, 'fin');
      await expect(page.locator('[data-fin-stage-cards] [data-fin-stage]')).toHaveCount(3);
      await expect(page.locator('table.fin-table')).toHaveCount(0);
      await page.locator('#fin-fuel [data-fuel-week] .fin-card-btn').first().click();
      await expect(page.locator('[data-fuel-detail]')).toHaveCount(1);
      const hits: Hit[] = [];
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 844 });
        await page.waitForTimeout(200);
        hits.push(...await measure(page, 'finanse-p5', width, role));
      }
      expect(hits, JSON.stringify(hits, null, 1)).toEqual([]);
    });
  }
});

test.describe('wyglad/P5 Faktury — E4, E4b', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  test('komputer: HHL dwie zakładki (strzałki), kafelki, obieg, lista z jednym statusem; KSH i SCX jedna sekcja', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL');
    await openView(page, 'inv');
    const koszt = page.locator('[data-inv-tab="KOSZT"]');
    await expect(koszt).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#inv-panel-PRZYCHOD')).toBeHidden();
    await expect(page.locator('[data-inv-kpis="KOSZT"] [data-inv-kpi]')).toHaveCount(4);
    await expect(page.locator('[data-inv-flow="KOSZT"] li')).toHaveCount(5);
    await expect(page.locator('#inv-panel-KOSZT table.inv-table thead th')).toHaveText(['TYDZIEŃ', 'FAKTURA', 'TRANSPORTY', 'NETTO', 'VAT 23 %', 'BRUTTO', 'TERMIN', 'STATUS', /.*/]);
    for (const row of await page.locator('#inv-panel-KOSZT tr[data-bill]').all()) {
      await expect(row.locator('[data-bill-status]')).toHaveCount(1);
    }
    await expect(page.locator('[data-verify="ZGODNA"], [data-bill-quick="ZGODNA"]')).toHaveCount(0);
    await koszt.focus();
    await koszt.press('ArrowRight');
    await expect(page.locator('[data-inv-tab="PRZYCHOD"]')).toBeFocused();
    await expect(page.locator('#inv-panel-PRZYCHOD')).toBeVisible();
    await expect(page.locator('#inv-panel-KOSZT')).toBeHidden();
    await expect(page.locator('[data-inv-flow="PRZYCHOD"]')).toContainText('Termin 30 dni od wystawienia');
    await expect(page.locator('[data-page="invoices"]')).toContainText('Kto co widzi i co robi');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1441);
    for (const [r, dir] of [['KSH', 'PRZYCHOD'], ['SCX', 'KOSZT']] as const) {
      await boot(page, r);
      await openView(page, 'inv');
      await expect(page.locator('[data-inv-tab]')).toHaveCount(0);
      await expect(page.locator('[data-bill-section]')).toHaveCount(1);
      await expect(page.locator(`[data-bill-section="${dir}"] [data-inv-kpi]`)).toHaveCount(4);
    }
    await page.locator('[data-bill-new="KOSZT"]').click();
    await expect(page.locator('[data-inv-flow="KOSZT"]')).toContainText('Termin 35 dni od wystawienia');
    await expect(page.locator('[data-bill-wizard="KOSZT"] [data-w="submit"]')).toBeVisible();
  });

  for (const role of ['HHL', 'KSH', 'SCX'] as const) {
    test(`telefon ${role}: kafelki 2 × 2 i karty faktur — 0 w bramie E8`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await boot(page, role);
      await openView(page, 'inv');
      await expect(page.locator('table.inv-table')).toHaveCount(0);
      await expect(page.locator('[data-inv-flow]')).toHaveCount(0);
      await expect(page.locator('#inv-who-h')).toHaveCount(0);
      expect(await page.locator('.inv-cards [data-bill]').count()).toBeGreaterThan(0);
      const hits: Hit[] = [];
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 844 });
        await page.waitForTimeout(200);
        hits.push(...await measure(page, 'faktury-p5', width, role));
      }
      expect(hits, JSON.stringify(hits, null, 1)).toEqual([]);
    });
  }
});

test.describe('wyglad/P5 Dokumenty — E31', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  test('komputer: wymagania (po terminie, 7 dni), terminy tylko do odczytu, zezwolenia, pliki z filtrami, okno „Wgraj dokument”', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL');
    await openView(page, 'docs');
    await expect(page.locator('table.doc-req thead th')).toHaveText(['DOKUMENT', 'KTO WGRYWA', 'TERMIN', 'PO TERMINIE', 'W CIĄGU 7 DNI', 'UWAGI']);
    await expect(page.locator('tr[data-docreq]')).toHaveCount(5);
    await expect(page.locator('[data-action="docreq-edit"]')).toHaveCount(0);
    await expect(page.locator('table.doc-req')).not.toContainText(/Rysunek|POD|mocowania/);
    const count = page.locator('tr[data-docreq] .doc-count').first();
    if (await count.count()) {
      await count.click();
      await expect(page.locator('[data-docreq-list] li').first()).toBeVisible();
    }
    await expect(page.locator('[data-doc-permits] tbody tr')).toHaveCount(3);
    await expect(page.locator('[data-doc-files] [data-doc-f]')).toHaveCount(3);
    await page.locator('[data-doc-upload]').click();
    const modal = page.locator('[data-upload-modal]');
    await expect(modal).toBeVisible();
    await modal.locator('[data-up-search]').fill('SG-0');
    await expect(modal.locator('[data-up-load]')).not.toHaveValue('');
    await expect(modal.locator('[data-up-send]')).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(modal).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1441);
    await boot(page, 'KSH');
    await openView(page, 'docs');
    await expect(page.locator('[data-doc-upload]')).toHaveCount(0);
    await expect(page.locator('tr[data-docreq="INSURANCE"]')).toHaveCount(0);
    await expect(page.locator('tr[data-docreq="OCS"]')).toHaveCount(1);
    await expect(page.locator('[data-doc-permits]')).toHaveCount(0);
  });

  for (const role of ['HHL', 'KSH', 'SCX'] as const) {
    test(`telefon ${role}: karty wymagań, pliki, paczka tygodnia${role === 'KSH' ? '' : ', okno „Wgraj dokument”'} — 0 w bramie E8`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await boot(page, role);
      await openView(page, 'docs');
      await expect(page.locator('table.doc-req')).toHaveCount(0);
      expect(await page.locator('[data-docreq-cards] [data-docreq-card]').count()).toBeGreaterThan(0);
      const hits: Hit[] = [];
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 844 });
        await page.waitForTimeout(200);
        hits.push(...await measure(page, 'dokumenty-p5', width, role));
      }
      if (role !== 'KSH') {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.locator('[data-doc-upload]').click();
        await expect(page.locator('[data-upload-modal]')).toBeVisible();
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 844 });
          await page.waitForTimeout(200);
          hits.push(...await measure(page, 'wgraj-p5', width, role));
        }
      }
      expect(hits, JSON.stringify(hits, null, 1)).toEqual([]);
    });
  }
});

/*
 * wyglad/P7-a — panel transportu › Przegląd i okno Awizacja (E32, img/e32-after; piloci D-20261009-1233-01, konwój R1).
 * Kolejność sekcji, „Do zrobienia przy tym transporcie” / linia stanu KSH, daty z dniem tygodnia i pochodzeniem, bez „Kontroli
 * trasy”, „Przeszkód” i czerwonego baneru zezwolenia; okno Awizacja z „Brakuje: …” i terminem, zapis części; piloci przy KR.
 * Telefon: strzałka wstecz, sekcje zwinięte z linią stanu, mapa 150 px, okno na cały ekran — 0 w bramie E8.
 */
test.describe('wyglad/P7-a panel transportu — Przegląd i okno Awizacja (E32)', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });
  /* SG-19: załadunek sob. 17.10.2026, bez awizacji; chwila w dniu załadunku (pilne od 16.10.2026, 12:00) */
  const NOW_URL = `/#/?now=${encodeURIComponent('2026-10-17T06:30:00Z')}`;
  async function openLoad(page: Page, code: string) {
    await page.evaluate((c) => { window.location.hash = `#/transport/${c}`; }, code);
    await page.waitForSelector('aside.drawer [data-overview]', { timeout: 10_000 });
    await page.waitForTimeout(300);
  }
  const closeDrawer = (page: Page) => page.locator('.drawer .drawer-hd button.iconbtn').last().click();

  test('komputer: kolejność sekcji, daty z dniem tygodnia, bez kontroli trasy i baneru; SCX zapisuje część awizacji; KSH linia stanu', async ({ page, browser }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await boot(page, 'HHL', false, NOW_URL);
    await openLoad(page, 'SG-19');
    await expect(page.locator('.drawer [data-hd-load]')).toHaveText('sob. 17.10.2026 · t42');
    await expect(page.locator('.drawer [data-hd-deliver]')).toHaveText('czw. 22.10.2026 · t43');
    const order = await page.locator('.drawer [data-overview] [data-po]').evaluateAll((els) => els.map((e) => e.getAttribute('data-po')));
    expect(order).toEqual(['plan', 'awiz', 'cargo', 'numbers', 'docs']);
    await expect(page.locator('.drawer [data-route-check], .drawer [data-corridor-obstacles], .drawer [data-plan-dates], .drawer .banner[data-permit]')).toHaveCount(0);
    await expect(page.locator('.drawer [data-load-when]')).toContainText('sob. 17.10.2026, 08:00–16:00');
    await expect(page.locator('.drawer [data-dates-origin]')).toContainText('z harmonogramu KSH');
    await expect(page.locator('.drawer [data-dates-origin]')).not.toContainText('potwierdził');
    await expect(page.locator('.drawer [data-awiz-state]')).toHaveAttribute('data-awiz-state', 'none');
    /* audyt-B B-13: zestaw z tabeli symboli (jak okno Awizacja) — SG: 21,69 × 2,45 × 3,75 m */
    await expect(page.locator('.drawer [data-po-set]')).toContainText('21,69 × 2,45 × 3,75 m');
    await expect(page.locator('.drawer [data-po-set]')).toContainText('z tabeli HHL (SG)');
    await expect(page.locator('.drawer [data-po-permit-kind="FIRMA"]')).toBeVisible();
    /* E32 pkt 2 / E9 krok 5: numer HHL wpisuje HHL w „Numerach zleceń”, bez okna Awizacja */
    await expect(page.locator('.drawer [data-order="hhl"] input')).toBeVisible();
    await expect(page.locator('.drawer [data-awiz-open]')).toHaveCount(0);
    await expect(page.locator('.drawer [data-awiz-fix]')).toHaveText('Popraw awizację');
    await expect(page.locator('.drawer [data-action="export-load-pdf-map"]')).toBeVisible();
    await closeDrawer(page);

    /* SCX: „Uzupełnij awizację” → „Brakuje: …” z terminem; zapis kierowcy i ciągnika → „Brakuje: telefon, naczepa” */
    await boot(page, 'SCX', false, NOW_URL);
    await openLoad(page, 'SG-19');
    await page.locator('.drawer [data-awiz-open]').click();
    const modal = page.locator('[data-awiz-modal]');
    await expect(modal.locator('#awiz-title')).toContainText('Awizacja · SG-19');
    await expect(modal.locator('[data-awiz-missing]')).toContainText('Brakuje: kierowca, telefon, ciągnik, naczepa.');
    await expect(modal.locator('[data-awiz-missing]')).toContainText('Pilne od 16.10.2026, 12:00');
    await expect(modal.locator('[data-awiz-pilots]')).toHaveCount(0);
    await expect(modal.locator('[data-awiz-seg]')).toHaveAttribute('data-awiz-seg', 'one');
    await expect(modal.locator('[data-hhl-ro]')).toBeVisible();
    await expect(modal.locator('.am-need')).toHaveCount(4);
    await modal.locator('label.form-field', { hasText: 'Imię i nazwisko' }).first().locator('input').fill('Jan Testowy');
    await modal.locator('label.form-field', { hasText: 'Ciągnik' }).first().locator('input').fill('TE 00001');
    await expect(modal.locator('[data-awiz-missing]')).toContainText('Brakuje: telefon, naczepa.');
    await modal.locator('[data-awiz-swap]').check();
    await expect(modal.locator('[data-awiz-seg="SE"]')).toBeVisible();
    await expect(modal.locator('[data-awiz-missing]')).toContainText('kierowca odcinka SE');
    await modal.locator('[data-awiz-swap]').uncheck();
    await modal.locator('[data-awiz-save]').click();
    await expect(modal).toHaveCount(0);
    await expect(page.locator('.drawer [data-awiz-state]')).toHaveAttribute('data-awiz-state', 'part');
    await expect(page.locator('.drawer [data-po-driver="one"]')).toContainText('Jan Testowy');
    await expect(page.locator('.drawer [data-awiz-open]')).toHaveText('Edytuj awizację');
    await closeDrawer(page);

    /* SCX, KR: sekcja „Piloci” — pilot PL i SE, tylko numer rejestracyjny oraz imię i nazwisko */
    await openLoad(page, 'K-03');
    await expect(page.locator('.drawer [data-po-pilot]')).toHaveCount(2);
    await page.locator('.drawer [data-awiz-open]').click();
    await expect(modal.locator('[data-awiz-pilots]')).toContainText('2 BRAKUJĄ');
    await expect(modal.locator('[data-awiz-pilot]')).toHaveCount(2);
    await expect(modal.locator('[data-awiz-pilot] input')).toHaveCount(4);
    await expect(modal.locator('[data-awiz-missing]')).toContainText('pilot PL — numer rejestracyjny, imię i nazwisko');
    await modal.locator('.iconbtn').click();
    await closeDrawer(page);

    /* SG: piloci nie pojawiają się w żadnej roli */
    await openLoad(page, 'SG-08');
    await expect(page.locator('.drawer [data-po-pilot]')).toHaveCount(0);
    await expect(page.locator('.drawer [data-po-driver="one"] a.po-call')).toHaveAttribute('href', /^tel:\+?\d+$/);
    await closeDrawer(page);

    /* KSH: bez Do zrobienia i przycisków awizacji, linia stanu; bez numerów zleceń (E41); „Edytuj” daty.
       Nowa karta bez zapisanego stanu — zapis awizacji SCX wyżej mógł dojść do pamięci po wyczyszczeniu w `boot`
       (wyścig widoczny w CI 16.10, run 38843857595) */
    const kshCtx = await browser.newContext({ baseURL: test.info().project.use.baseURL, viewport: { width: 1440, height: 1000 } });
    const ksh = await kshCtx.newPage();
    try {
      await boot(ksh, 'KSH', false, NOW_URL);
      await openLoad(ksh, 'SG-19');
      await expect(ksh.locator('.drawer [data-po-todo]')).toHaveCount(0);
      await expect(ksh.locator('.drawer [data-po-ksh-line]')).toHaveText('Awizacja: przewoźnik uzupełnia');
      await expect(ksh.locator('.drawer [data-awiz-open], .drawer [data-awiz-fix], .drawer [data-order]')).toHaveCount(0);
      await expect(ksh.locator('.drawer [data-ksh-edit]')).toHaveText('Edytuj');
    } finally {
      await kshCtx.close();
    }
  });

  for (const role of ['HHL', 'SCX', 'KSH'] as const) {
    test(`telefon ${role}: strzałka wstecz, sekcje zwinięte z linią stanu, mapa 150 px; okno Awizacja na cały ekran — 0 w bramie E8`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await boot(page, role, false, NOW_URL);
      const hits: Hit[] = [];
      const gate = async (name: string) => {
        for (const width of [...WIDTHS, 768]) {
          await page.setViewportSize({ width, height: 844 });
          await page.waitForTimeout(150);
          hits.push(...await measure(page, name, width, role));
        }
        await page.setViewportSize({ width: 390, height: 844 });
      };
      await openLoad(page, 'SG-19');
      await expect(page.locator('.drawer .wb-back')).toBeVisible();
      await expect(page.locator('.drawer .drawer-hd button.iconbtn')).toHaveCount(1);
      const folds = page.locator('.drawer details.po-fold');
      await expect(folds).toHaveCount(role === 'KSH' ? 4 : 5);
      expect(await folds.evaluateAll((els) => els.filter((d) => (d as HTMLDetailsElement).open).length)).toBe(0);
      await expect(page.locator('.drawer details[data-po="plan"] > summary')).toContainText('sob. 17.10.2026 → czw. 22.10.2026');
      await expect(page.locator('.drawer details[data-po="awiz"] > summary')).toContainText('brak');
      const map = await page.locator('.drawer [data-load-map]').boundingBox();
      expect(map && map.height).toBeLessThanOrEqual(152);
      for (const s of await page.locator('.drawer details.po-fold > summary').all()) {
        const b = await s.boundingBox();
        expect(b && b.height).toBeGreaterThanOrEqual(44);
      }
      await gate('panel-przeglad');
      await folds.evaluateAll((els) => els.forEach((d) => { (d as HTMLDetailsElement).open = true; }));
      await gate('panel-przeglad-otwarte');
      if (role === 'SCX') {
        await closeDrawer(page);
        await openLoad(page, 'K-03');
        await page.locator('.drawer details[data-po="awiz"] > summary').click();
        await page.locator('.drawer [data-awiz-open]').click();
        const box = await page.locator('[data-awiz-modal]').boundingBox();
        expect(box && Math.round(box.width)).toBe(390);
        await gate('okno-awizacja');
      }
      expect(hits, JSON.stringify(hits, null, 1)).toEqual([]);
    });
  }
});

test.describe('wyglad/P5 panel transportu — Ceny (E33) i Dokumenty (E31 pkt 5)', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });
  async function openTab(page: Page, code: string, tab: number) {
    await page.evaluate((c) => { window.location.hash = `#/transport/${c}`; }, code);
    await page.waitForSelector('aside.drawer', { timeout: 10_000 });
    await page.locator('.drawer .dtabs button').nth(tab).click();
    await page.waitForTimeout(400);
  }

  test('komputer: HHL tabela koszt / przychód, marża, karta paliwa, dopłaty, zasady, okno „Dopłata”; KSH i SCX jedna kolumna', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL');
    await openTab(page, 'SG-03', 3);
    await expect(page.locator('.drawer [data-pp-table] thead th')).toHaveText([/.*/, 'KOSZT · SCX', 'PRZYCHÓD · KSH']);
    await expect(page.locator('.drawer [data-pp-row]')).toHaveCount(4);
    /* audyt-B B-06 (E33): „Dopłaty” = suma listy dopłat — w demo żadna nie jest dodana */
    await expect(page.locator('.drawer [data-pp-row="fees"] td.num')).toHaveText(['0,00', '0,00']);
    await expect(page.locator('.drawer [data-pp-margin]')).toContainText('%');
    await expect(page.locator('.drawer [data-pp-fuel]')).toBeVisible();
    await expect(page.locator('.drawer [data-fee]')).toHaveCount(3);
    await expect(page.locator('.drawer [data-fee-rules]')).toBeVisible();
    await expect(page.locator('.drawer')).not.toContainText(/WSTĘPNE|OPL-8|Inne/);
    await page.locator('.drawer [data-fee-add]').click();
    await expect(page.locator('[data-fee-modal] [data-fee-kind]')).toHaveCount(2);
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-fee-modal]')).toHaveCount(0);
    await openTab(page, 'SG-03', 2);
    await expect(page.locator('.drawer [data-pd-req]')).toHaveCount(5);
    await expect(page.locator('.drawer [data-pd-zip]')).toBeVisible();
    for (const r of ['KSH', 'SCX'] as const) {
      await boot(page, r);
      await openTab(page, 'SG-03', 3);
      await expect(page.locator('.drawer [data-pp-table] thead')).toHaveCount(0);
      await expect(page.locator('.drawer [data-pp-margin]')).toHaveCount(0);
      await expect(page.locator('.drawer')).not.toContainText(r === 'KSH' ? 'Koszt' : 'Przychód');
      await openTab(page, 'SG-03', 2);
      await expect(page.locator(`.drawer [data-pd-req="${r === 'KSH' ? 'INSURANCE' : 'OCS'}"]`)).toHaveCount(0);
      if (r === 'KSH') await expect(page.locator('.drawer [data-pd-upload]')).toHaveCount(0);
    }
  });

  for (const role of ['HHL', 'KSH', 'SCX'] as const) {
    test(`telefon ${role}: karty ceny, szczegóły po stuknięciu${role === 'KSH' ? '' : ', „+ Dopłata”'}, dokumenty — 0 w bramie E8`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await boot(page, role);
      await openTab(page, role === 'SCX' ? 'SG-15' : 'SG-03', 3);
      await expect(page.locator('.drawer [data-pp-phone]')).toBeVisible();
      await expect(page.locator('.drawer [data-pp-table]')).toHaveCount(0);
      const hits: Hit[] = [];
      for (const key of ['fuel', 'fees', 'rules']) {
        const card = page.locator(`.drawer [data-pp-card="${key}"] .pp-card-hd`);
        if (await card.count()) await card.click();
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 844 });
          await page.waitForTimeout(150);
          hits.push(...await measure(page, `ceny-${key}`, width, role));
        }
        await page.setViewportSize({ width: 390, height: 844 });
      }
      if (role !== 'KSH') {
        await page.locator('.drawer [data-fee-add]').click();
        await expect(page.locator('[data-fee-modal]')).toBeVisible();
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 844 });
          await page.waitForTimeout(150);
          hits.push(...await measure(page, 'doplata', width, role));
        }
        await page.keyboard.press('Escape');
        await page.setViewportSize({ width: 390, height: 844 });
      }
      await openTab(page, 'SG-03', 2);
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 844 });
        await page.waitForTimeout(150);
        hits.push(...await measure(page, 'panel-dokumenty', width, role));
      }
      expect(hits, JSON.stringify(hits, null, 1)).toEqual([]);
    });
  }
});

/**
 * wyglad/E49 — zamknięty most albo droga: sprawa SCX „Objazd czy postój?” (decyzja właściciela 16.10.2026, 02:08,
 * odpowiedź 3; D-20261016-0230-01 Z3), linie wiatru / postoju / objazdu w ETA (Z1) i progi wiatru w Opcjach (Z1 pkt 5).
 * Dane demo (`src/lib/e49Demo.ts`): T-17 w drodze przez Szwecję — Högakustenbron zamknięty.
 */
test.describe('wyglad/E49 — „Objazd czy postój?”, wiatr w ETA, progi wiatru', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });
  const openRisks = async (page: Page) => {
    await page.evaluate(() => { window.location.hash = '#/ryzyka'; });
    await page.waitForTimeout(800);
    await page.locator('[data-rk-card]').filter({ hasText: 'T-17' }).first().locator('.rk-card-hd').click();
    await page.waitForTimeout(300);
  };
  const noSideScroll = async (page: Page, width: number) =>
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);

  test('komputer SCX: dwie możliwości obok siebie, szybsza oznaczona, ryzyka, decyzja „Jedziemy objazdem” → ETA z objazdem', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await boot(page, 'SCX');
    await openRisks(page);
    const card = page.locator('[data-detour]');
    await expect(card).toBeVisible();
    await expect(card.locator('.dtr-t')).toContainText('Högakustenbron (E4) zamknięty do');
    await expect(card.locator('.dtr-t')).toContainText('objazd czy postój?');
    await expect(card.locator('[data-detour-opt]')).toHaveCount(2);
    const [hold, detour] = [card.locator('[data-detour-opt="HOLD"]'), card.locator('[data-detour-opt="DETOUR"]')];
    const hb = await hold.boundingBox();
    const db = await detour.boundingBox();
    expect(Math.abs((hb?.y ?? 0) - (db?.y ?? 1)), 'obok siebie').toBeLessThan(2);
    await expect(detour.locator('.dtr-fast')).toContainText('szybciej o');
    await expect(detour.locator('.dtr-nums')).toContainText('+31');
    await expect(detour.locator('[data-detour-risk="WIND"]')).toContainText('Sandöbron');
    await expect(hold.locator('.dtr-big')).toContainText('koniec zamknięcia + 30 min');
    await noSideScroll(page, 1440);
    await card.locator('[data-detour-note]').fill('kierowca zna objazd');
    await card.locator('[data-detour-pick="DETOUR"]').click();
    await expect(page.locator('[data-detour]')).toHaveCount(0);
    await page.evaluate(() => { window.location.hash = '#/transport/T-17'; });
    await page.waitForSelector('aside.drawer', { timeout: 10_000 });
    await expect(page.locator('[data-eta-wx] [data-eta-wx-kind="DETOUR"]')).toContainText('Objazd +35');
    await expect(page.locator('[data-eta-wx] [data-eta-wx-kind="WIND"]')).toContainText('porywy 22 m/s z boku');
    await expect(page.locator('[data-eta-wx] .etab-wx-attr')).toHaveText('Źródło: SMHI (CC BY 4.0), dane przetworzone');
  });

  test('komputer HHL: ta sama sprawa bez przycisków — „Decyduje SCX”; Opcje › Progi z progami wiatru', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await boot(page, 'HHL');
    await openRisks(page);
    await expect(page.locator('[data-detour]')).toBeVisible();
    await expect(page.locator('[data-detour-pick]')).toHaveCount(0);
    await expect(page.locator('[data-detour-wait]')).toHaveText('Decyduje SCX — czeka na decyzję.');
    await openView(page, 'options');
    await page.evaluate(() => (document.querySelector('[data-opt-nav="thr"]') as HTMLButtonElement).click());
    await expect(page.locator('[data-opt-screen="thr"]')).toBeVisible();
    await expect(page.locator('[data-threshold="WIND_SLOW_MS"]')).toContainText('20 m/s');
    await expect(page.locator('[data-threshold="WIND_HOLD_MS"]')).toContainText('25 m/s');
    await expect(page.locator('[data-threshold="SLIP_RADIUS_KM"]')).toContainText('25 km');
    await page.evaluate(() => { window.location.hash = '#/transport/T-17'; });
    await page.waitForSelector('aside.drawer', { timeout: 10_000 });
    await expect(page.locator('[data-eta-wx] [data-eta-wx-kind="CLOSURE_HOLD"]')).toContainText('Högakustenbron (E4) zamknięty');
  });

  test('telefon SCX: sprawa jedna możliwość pod drugą, przyciski 48 px, pole 16 px — 0 w bramie E8', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page, 'SCX');
    await openRisks(page);
    const hits: Hit[] = [];
    for (const width of [...WIDTHS, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(200);
      hits.push(...await measure(page, 'ryzyka-objazd', width, 'SCX'));
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    const hb = await page.locator('[data-detour-opt="HOLD"]').boundingBox();
    const db = await page.locator('[data-detour-opt="DETOUR"]').boundingBox();
    expect((db?.y ?? 0) > (hb?.y ?? 0) + (hb?.height ?? 0) - 2, 'jedna pod drugą').toBe(true);
    const btn = await page.locator('[data-detour-pick="HOLD"]').evaluate((e) => e.getBoundingClientRect().height);
    expect(btn).toBeGreaterThanOrEqual(44);
    const font = await page.locator('[data-detour-note]').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(font).toBeGreaterThanOrEqual(16);
    expect(hits, JSON.stringify(hits, null, 1)).toEqual([]);
  });
});

test.describe('wyglad/P6 Ryzyka — E7 „Do zrobienia” i „Sytuacja na trasie”, E6 karta sprawy', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });

  test('komputer: liczba = menu, filtry, karta rozwija się w miejscu, karta sprawy z „Zadzwoń”; sytuacja na trasie; KSH bez listy', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const role of ['HHL', 'SCX'] as const) {
      await boot(page, role);
      await openView(page, 'risk');
      const menu = (await page.locator('nav button[data-view="risk"] .count').first().innerText()).trim();
      await expect(page.locator('[data-rk-todo] [data-rk-count]')).toHaveText(menu);
      /* zakres domyślny = liczba w menu (E7-2) */
      await expect(page.locator('[data-rk-scope][aria-pressed="true"] .rk-chip-n')).toHaveText(menu);
      await expect(page.locator('[data-rk-scope]')).toHaveCount(3);
      const first = page.locator('[data-rk-card]').first();
      await expect(first.locator('.rk-card-hd')).toHaveAttribute('aria-expanded', 'true');
      await expect(first.locator('[data-rk-issue]').first()).toBeVisible();
      await first.locator('[data-rk-details]').first().click();
      await expect(first.locator('[data-rk-case]')).toBeVisible();
      await expect(page.locator('[data-rk-card]')).toHaveCount(4);
      await page.locator('[data-rk-rest]').click();
      expect(await page.locator('[data-rk-card]').count()).toBeGreaterThan(4);
      const second = page.locator('[data-rk-card] .rk-card-hd').nth(1);
      await second.click();
      await expect(second).toHaveAttribute('aria-expanded', 'true');
      await expect(page.locator('[data-rk-route] [data-panel="ferry"] [data-ferry-row]')).toHaveCount(2);
      await expect(page.locator('[data-rk-route] [data-panel="road-se"]')).toBeVisible();
      await expect(page.locator('[data-rk-route] [data-panel="system"]')).toHaveCount(role === 'HHL' ? 1 : 0);
      await expect(page.locator('[data-rk-todo]')).not.toContainText(/NO_AWIZACJA|RESOURCE_MISSING|:\d{2}:\d{2}/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(1441);
    }
    /* E6-5: „Biorę tę sprawę” → „Oddaj”; Przejmij z potwierdzeniem */
    await boot(page, 'SCX');
    await openView(page, 'risk');
    const take = page.locator('[data-rk-take]').first();
    const id = await take.getAttribute('data-rk-take');
    await take.click();
    await expect(page.locator(`[data-rk-give="${id}"]`)).toBeVisible();
    await boot(page, 'KSH');
    await openView(page, 'risk');
    await expect(page.locator('[data-rk-todo]')).toHaveCount(0);
    await expect(page.locator('[data-panel="ferry"]')).toBeVisible();
  });

  for (const role of ['HHL', 'SCX', 'KSH'] as const) {
    test(`telefon ${role}: ${role === 'KSH' ? 'sytuacja na trasie' : 'zakładki, karty, karta sprawy, „Na trasie”'} — 0 w bramie E8`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await boot(page, role);
      await openView(page, 'risk');
      const hits: Hit[] = [];
      const gate = async (name: string) => {
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 844 });
          await page.waitForTimeout(150);
          hits.push(...await measure(page, name, width, role));
        }
        await page.setViewportSize({ width: 390, height: 844 });
      };
      if (role === 'KSH') {
        await expect(page.locator('[data-rk-tab]')).toHaveCount(0);
        await gate('ryzyka-ksh');
      } else {
        await expect(page.locator('[data-rk-tab]')).toHaveCount(role === 'HHL' ? 3 : 2);
        await gate('ryzyka-todo');
        await page.locator('[data-rk-details]').first().click();
        await gate('ryzyka-sprawa');
        await page.locator('[data-rk-tab="route"]').click();
        await expect(page.locator('[data-panel="ferry"]')).toBeVisible();
        await gate('ryzyka-trasa');
        if (role === 'HHL') {
          await page.locator('[data-rk-tab="sys"]').click();
          await expect(page.locator('[data-panel="system"]')).toBeVisible();
          await gate('ryzyka-system');
        }
      }
      expect(hits, JSON.stringify(hits, null, 1)).toEqual([]);
    });
  }
});

/**
 * wyglad/P6-e — Czat: „Przeczytali” (kto i kiedy), wiadomość w dzwonku, wejście z powiadomienia
 * (D-20261016-0250-01 Cz11, D-20261016-0310-01 Cz23, D-20261016-0315-01). Demo: SG-01 — wiadomość HHL przeczytał SCX,
 * KSH jeszcze nie; rozmowa „tylko HHL i SCX” od SCX — w dzwonku tylko u HHL, nigdy u KSH.
 */
test.describe('wyglad/P6-e — Czat: „Przeczytali”, dzwonek, odpowiedź z powiadomienia', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });
  const NOW_URL = `/#/?now=${encodeURIComponent('2026-10-14T10:00:00Z')}`;
  const openChat = async (page: Page, hash: string) => {
    await page.evaluate((h) => { window.location.hash = h; }, hash);
    await page.waitForSelector('aside.drawer [data-chat]', { timeout: 10_000 });
    await page.waitForTimeout(300);
  };
  const bellToggle = (page: Page) => page.evaluate(() => (document.querySelector('.bell-trigger') as HTMLButtonElement).click());

  test('komputer HHL: „Przeczytali: 1 osoba · KSH jeszcze nie” → lista osoba, firma, godzina; dzwonek „SG-01 · … — Jan Nowak // …” z „tylko HHL i SCX” znika po otwarciu Czatu', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL', false, NOW_URL);
    await bellToggle(page);
    const row = page.locator('.bell-pop [data-bell-chat="HHL_SCX"]').filter({ hasText: 'SG-01 ·' });
    await expect(row).toHaveCount(1);
    await expect(row.locator('.bell-title')).toHaveText('SG-01 · HHL/2026/1241 — Jan Nowak // Scandinavian Express');
    await expect(row.locator('.bell-only')).toHaveText('tylko HHL i SCX');
    await expect(row.locator('.bell-chat')).toContainText('Rejs zarezerwowany');
    await bellToggle(page);
    await openChat(page, '#/transport/SG-01?zakladka=czat');
    const rc = page.locator('.drawer [data-chat-read="yes"]');
    await expect(rc).toHaveText(/^✓✓ Przeczytali: 1\sosoba · KSH jeszcze nie/);
    await expect(rc).toHaveAttribute('aria-expanded', 'false');
    await rc.click();
    await expect(rc).toHaveAttribute('aria-expanded', 'true');
    const li = page.locator('.drawer [data-chat-readers] li');
    await expect(li).toHaveCount(1);
    await expect(li.first()).toContainText('Jan Nowak');
    await expect(li.first()).toContainText('SCX');
    await expect(li.first()).toContainText(/\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}/);
    await expect(page.locator('.drawer [data-chat-pending]')).toHaveText('Jeszcze nie otworzyli: KSH');
    await bellToggle(page);
    await expect(page.locator('.bell-pop [data-bell-chat]').filter({ hasText: 'SG-01 ·' })).toHaveCount(0);
  });

  test('komputer KSH: w dzwonku tylko wiadomości do wszystkich, nigdy „tylko HHL i SCX”; przy cudzej wiadomości „Przeczytali: 1 osoba”', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'KSH', false, NOW_URL);
    await bellToggle(page);
    await expect(page.locator('.bell-pop [data-bell-chat="HHL_SCX"]')).toHaveCount(0);
    await expect(page.locator('.bell-pop')).not.toContainText('Rejs zarezerwowany');
    const row = page.locator('.bell-pop [data-bell-chat="ALL"]').filter({ hasText: 'SG-01 —' });
    await expect(row.locator('.bell-title')).toHaveText('SG-01 — Anna Wiśniewska // H&H Logistics');
    await bellToggle(page);
    await openChat(page, '#/transport/SG-01?zakladka=czat');
    const other = page.locator('.drawer [data-chat-read="list"]');
    await expect(other).toHaveText(/^Przeczytali: 1\sosoba/);
    await other.click();
    await expect(page.locator('.drawer [data-chat-readers] li')).toHaveCount(1);
  });

  test('z powiadomienia: „?odpowiedz=1&tekst=…” → tekst w polu, kursor w polu, parametry znikają z adresu', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'SCX', false, NOW_URL);
    await openChat(page, `#/transport/SG-02?zakladka=czat&odpowiedz=1&tekst=${encodeURIComponent('Jedziemy dalej, będę o 14:00')}`);
    await expect(page.locator('.drawer [data-chat-input]')).toHaveValue('Jedziemy dalej, będę o 14:00');
    expect(await page.evaluate(() => document.activeElement?.hasAttribute('data-chat-input'))).toBe(true);
    expect(await page.evaluate(() => window.location.hash)).toBe('#/transport/SG-02?zakladka=czat');
  });

  for (const role of ['HHL', 'KSH'] as const) {
    test(`telefon ${role}: lista „Przeczytali” rozwinięta i dzwonek z wiadomością — 0 w bramie E8`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await boot(page, role, false, NOW_URL);
      const hits: Hit[] = [];
      const gate = async (name: string) => {
        for (const width of [...WIDTHS, 768]) {
          await page.setViewportSize({ width, height: 844 });
          await page.waitForTimeout(150);
          hits.push(...await measure(page, name, width, role));
        }
        await page.setViewportSize({ width: 390, height: 844 });
      };
      await bellToggle(page);
      await expect(page.locator('.bell-pop [data-bell-chat]').first()).toBeVisible();
      await gate('dzwonek-czat');
      await bellToggle(page);
      await openChat(page, '#/transport/SG-01?zakladka=czat');
      await page.locator('.drawer [data-chat-read="yes"], .drawer [data-chat-read="list"]').first().click();
      await expect(page.locator('.drawer [data-chat-readers]')).toBeVisible();
      await gate('panel-czat-przeczytali');
      expect(hits, JSON.stringify(hits, null, 1)).toEqual([]);
    });
  }
});

/**
 * wyglad/P6-b — panel transportu: Historia i Czat (E17, decyzje 07.10 20:57, img/e17-after).
 * „Teraz” 14.10.2026 — wpisy demo transportu SG-01 (dostarczony) są wtedy już w przeszłości.
 */
test.describe('wyglad/P6-b panel transportu — Historia i Czat (E17)', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });
  const NOW_URL = `/#/?now=${encodeURIComponent('2026-10-14T10:00:00Z')}`;
  async function openTab(page: Page, code: string, tab: number) {
    await page.evaluate((c) => { window.location.hash = `#/transport/${c}`; }, code);
    await page.waitForSelector('aside.drawer', { timeout: 10_000 });
    await page.locator('.drawer .dtabs button').nth(tab).click();
    await page.waitForTimeout(400);
  }

  test('komputer: Historia po polsku z filtrami i ukrytymi wpisami; Czat bez innych przycisków; KSH nie widzi „tylko HHL i SCX”; profil trasy ukryty', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await boot(page, 'HHL', false, NOW_URL);
    await openTab(page, 'SG-01', 0);
    await expect(page.locator('.drawer [data-route-profile]')).toHaveCount(0);
    await expect(page.locator('.drawer .dtabs button').nth(4)).toHaveText(/^Czat/);
    await expect(page.locator('.drawer [data-chat-unread]')).toHaveCount(1);
    /* Historia */
    await openTab(page, 'SG-01', 5);
    await expect(page.locator('.drawer [data-hist-filter]')).toHaveText(['Wszystko', 'Statusy i trasa', 'Zasoby i awizacja', 'Numery', 'Dokumenty', 'Ceny']);
    expect(await page.locator('.drawer [data-history] li').count()).toBeGreaterThan(5);
    await expect(page.locator('.drawer [data-history]')).not.toContainText(/\b[A-Z]{2,}_[A-Z_]+\b|\bREADY:|vault/);
    await expect(page.locator('.drawer [data-history]')).toContainText('Anna Wiśniewska // H&H Logistics');
    await expect(page.locator('.drawer [data-history] s').first()).toBeVisible();
    await expect(page.locator('.drawer [data-hist-hidden]')).toContainText('bez zmiany');
    await page.locator('.drawer [data-hist-filter="NUM"]').click();
    await expect(page.locator('.drawer [data-hist-filter="NUM"]')).toHaveAttribute('aria-pressed', 'true');
    const cats = await page.locator('.drawer [data-history] li').evaluateAll((els) => els.map((e) => e.getAttribute('data-hist-cat')));
    expect(cats.length).toBeGreaterThan(0);
    expect(new Set(cats)).toEqual(new Set(['NUMER']));
    /* Czat */
    await openTab(page, 'SG-01', 4);
    await expect(page.locator('.drawer [data-chat-compose] button')).toHaveCount(3);
    await expect(page.locator('.drawer [data-carrier-actions], .drawer [data-awiz-chat-note]')).toHaveCount(0);
    await expect(page.locator('.drawer [data-chat-msg][data-vis="HHL_SCX"]')).toHaveCount(1);
    const before = await page.locator('.drawer [data-chat-msg]').count();
    await page.locator('.drawer [data-chat-input]').fill('Wiadomość testowa do wszystkich');
    await page.locator('.drawer [data-chat-input]').press('Enter');
    await expect(page.locator('.drawer [data-chat-msg]')).toHaveCount(before + 1);
    await expect(page.locator('.drawer [data-chat-msg]').last()).toContainText('Wysłane do HHL, SCX i KSH · nikt jeszcze nie otworzył');
    await page.locator('.drawer [data-chat-vis="HHL_SCX"]').click();
    await expect(page.locator('.drawer [data-chat-input]')).toHaveAttribute('placeholder', 'Napisz tylko do HHL i SCX…');
    await page.locator('.drawer [data-chat-input]').fill('Druga linia');
    await page.locator('.drawer [data-chat-input]').press('Shift+Enter');
    await expect(page.locator('.drawer [data-chat-msg]')).toHaveCount(before + 1);
    await page.locator('.drawer [data-chat-send]').click();
    await expect(page.locator('.drawer [data-chat-msg]').last()).toHaveAttribute('data-vis', 'HHL_SCX');
    /* po wyjściu z „Czatu” to, co było na ekranie, jest przeczytane — zakładka bez liczby */
    await page.locator('.drawer .dtabs button').nth(5).click();
    await expect(page.locator('.drawer [data-chat-unread]')).toHaveCount(0);
    /* KSH: pisze do wszystkich, nie widzi rozmów HHL ↔ SCX */
    await boot(page, 'KSH', false, NOW_URL);
    await openTab(page, 'SG-01', 4);
    await expect(page.locator('.drawer [data-chat-msg]').first()).toBeVisible();
    await expect(page.locator('.drawer [data-chat-msg][data-vis="HHL_SCX"]')).toHaveCount(0);
    await expect(page.locator('.drawer [data-chat-vis]')).toHaveCount(0);
    await expect(page.locator('.drawer [data-chat-compose] button')).toHaveCount(1);
  });

  for (const role of ['HHL', 'SCX', 'KSH'] as const) {
    test(`telefon ${role}: Historia (filtry w bok) i Czat (pole pisania na dole) — 0 w bramie E8`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await boot(page, role, false, NOW_URL);
      const hits: Hit[] = [];
      const gate = async (name: string) => {
        for (const width of [...WIDTHS, 768]) {
          await page.setViewportSize({ width, height: 844 });
          await page.waitForTimeout(150);
          hits.push(...await measure(page, name, width, role));
        }
        await page.setViewportSize({ width: 390, height: 844 });
      };
      await openTab(page, 'SG-01', 5);
      await expect(page.locator('.drawer [data-hist-filter="RES"]')).toHaveText('Zasoby');
      /* E41: KSH bez numerów zleceń — także w Historii */
      await expect(page.locator('.drawer [data-hist-filter="NUM"]')).toHaveCount(role === 'KSH' ? 0 : 1);
      if (role === 'KSH') await expect(page.locator('.drawer [data-history] [data-hist-cat="NUMER"]')).toHaveCount(0);
      await expect(page.locator('.drawer .ph-tag')).toHaveCount(0);
      await gate('panel-historia');
      await openTab(page, 'SG-01', 4);
      const box = await page.locator('.drawer [data-chat-compose]').boundingBox();
      expect(box && box.y + box.height).toBeLessThanOrEqual(844 + 1);
      await gate('panel-czat');
      expect(hits, JSON.stringify(hits, null, 1)).toEqual([]);
    });
  }
});

test.describe('wyglad/P8-c Strefy (E34, img/e34-after)', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });
  const ZONES_URL = `/#/?now=${encodeURIComponent('2026-10-15T18:00:00Z')}`;

  test('komputer HHL: lista według trasy, karta strefy, zmiana z powodem i podglądem wpływu, wyłączenie z powodem', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await boot(page, 'HHL', false, ZONES_URL);
    await openView(page, 'geo');
    await expect(page.locator('.zv-grp-h')).toHaveText(['ŚREM · ZAŁADUNEK', 'GDAŃSK · POLFERRIES → NYNÄSHAMN', 'GDYNIA · STENA → KARLSKRONA', 'PORTY W SZWECJI', 'BODEN · ROZŁADUNEK']);
    await expect(page.locator('[data-zone-card] h3')).toHaveText('Plac budowy Stegra Boden');
    await page.locator('[data-zone-edit]').click();
    await page.locator('[data-zone-f="radius"]').fill('1100');
    await expect(page.locator('[data-zone-impact]')).toContainText('status bez zmian');
    await page.locator('[data-zone-save]').click();
    await expect(page.locator('[data-zone-f="reason"]')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('[data-zone-f="reason"]')).toBeFocused();
    await page.locator('[data-zone-f="reason"]').fill('wjazd na plac jest od północy');
    await page.locator('[data-zone-save]').click();
    await expect(page.locator('.zv-live')).toHaveText('Zapisano. Wpis jest w historii zmian strefy.');
    await expect(page.locator('[data-zone-edit]')).toBeFocused();
    await expect(page.locator('.zv-hist li').first()).toContainText('powód: wjazd na plac jest od północy');
    await page.locator('[data-zone-off]').click();
    await page.locator('[data-zone-off-yes]').click();
    await expect(page.locator('.zv-ask .zv-err')).toHaveText('Wpisz powód zmiany.');
    await page.locator('[data-zone-off-reason]').fill('plac zamknięty');
    await page.locator('[data-zone-off-yes]').click();
    await expect(page.locator('[data-zone-off]')).toHaveText('Włącz');
    await expect(page.locator('[data-zone-off]')).toBeFocused();
  });

  /* menu Strefy jest tylko w grupie administracyjnej HHL (E9) */
  for (const role of ['HHL'] as const) {
    test(`telefon ${role}: mapa trasy, karty według miejsca, karta strefy, zmiana strefy, wyłączenie z powodem — 0 w bramie E8`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await boot(page, role, false, ZONES_URL);
      await openView(page, 'geo');
      const hits: Hit[] = [];
      const gate = async (name: string) => {
        for (const width of [...WIDTHS, 768]) {
          await page.setViewportSize({ width, height: 844 });
          await page.waitForTimeout(200);
          hits.push(...await measure(page, name, width, role));
        }
        await page.setViewportSize({ width: 390, height: 844 });
        await page.waitForTimeout(200);
      };
      await gate('strefy-lista');
      await page.locator('[data-zone="z-bod"]').click();
      await expect(page.locator('[data-zone-card] h3')).toBeFocused();
      await gate('strefy-karta');
      await page.locator('[data-zone-off]').click();
      await gate('strefy-wylacz');
      await page.locator('.zv-ask .btn.ghost').click();
      await page.locator('[data-zone-edit]').click();
      await page.locator('[data-zone-save]').click();
      await gate('strefy-zmiana');
      expect(hits, JSON.stringify(hits, null, 1)).toEqual([]);
    });
  }
});

test.describe('wyglad/P8-d Automatyzacje (E35, img/e35-after)', () => {
  test.describe.configure({ mode: 'serial', timeout: 300_000 });
  const noSideScroll = async (page: Page, width: number) =>
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width + 1);

  test('komputer HHL: 4 zakładki, kreator „Gdy … wtedy …” obok listy, sprawdzenie na 30 dniach, zapis, wyłączenie z powodem, przebiegi i historia', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await boot(page, 'HHL');
    await openView(page, 'wf');
    await expect(page.locator('.rl-tabs [role="tab"]')).toHaveText(['Działa samo', 'Własne reguły · 0', 'Przebiegi', 'Historia zmian']);
    await page.locator('[data-rule-new]').click();
    await expect(page.locator('[data-rule-creator] h2')).toBeFocused();
    await expect(page.locator('.rl-main')).toBeVisible();
    await page.locator('[data-rule-save]').click();
    await expect(page.locator('[data-rule-f="name"]')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('[data-rule-f="name"]')).toBeFocused();
    await page.locator('[data-rule-f="name"]').fill('Długi pobyt na placu');
    await page.locator('[data-rule-f="zone"]').selectOption({ label: 'Plac budowy Stegra Boden' });
    await page.locator('[data-rule-then="notify-HHL_OPS"]').click();
    await page.locator('[data-rule-then="notify-SCX"]').click();
    await expect(page.locator('[data-rule-check]')).toContainText('zadziałałaby 1 raz');
    await expect(page.locator('[data-rule-check]')).toContainText('SG-03 · plac od 07.10.2026, 08:35 → 07.10.2026, 11:35 (wyjazd 12:19)');
    await expect(page.locator('[data-rule-check]')).toContainText('Wbudowane automaty robiące to samo: brak.');
    await noSideScroll(page, 1440);
    await page.locator('[data-rule-save]').click();
    await expect(page.locator('.rl-live')).toHaveText('Dodano regułę. Wpis jest w historii zmian.');
    await expect(page.locator('[data-wf-tab="own"]')).toHaveText('Własne reguły · 1');
    const row = page.locator('.rl-rule').first();
    /* nowa reguła startuje wyłączona (img/e35-after: „włączona” niezaznaczone) */
    await expect(row.locator('.rl-state')).toHaveText('wyłączona');
    await expect(row).toContainText('Gdy auto jest w strefie „Plac budowy Stegra Boden” dłużej niż 3');
    await expect(row.locator('.rl-rule-name')).toBeFocused();
    await row.locator('[data-rule-toggle]').click();
    await row.locator('[data-rule-ask-yes]').click();
    await expect(row.locator('.rl-err')).toHaveText('Wpisz powód zmiany.');
    await row.locator('[data-rule-reason]').fill('SCX prosi o sygnał po 3 h na placu');
    await row.locator('[data-rule-ask-yes]').click();
    await expect(page.locator('.rl-live')).toHaveText('Reguła włączona.');
    await expect(row.locator('[data-rule-toggle]')).toHaveText('Wyłącz');
    await expect(row.locator('[data-rule-toggle]')).toBeFocused();
    await page.locator('[data-wf-tab="runs"]').click();
    await expect(page.locator('[data-rule-runs] tbody tr')).toHaveCount(5);
    await expect(page.locator('[data-rule-runs]')).toContainText('powiadomienie: KSH 4 osoby, SCX 1 osoba');
    await expect(page.locator('[data-rule-runs]')).not.toContainText('SKIPPED');
    await page.locator('[data-wf-tab="hist"]').click();
    await expect(page.locator('[data-rule-hist] li').first()).toContainText('włączona · „Długi pobyt na placu” · powód: SCX prosi o sygnał po 3 h na placu');
  });

  test('komputer 1280 → 1100: kreator zamiast listy; zmiana reguły wymaga powodu', async ({ page }) => {
    await page.setViewportSize({ width: 1100, height: 900 });
    await boot(page, 'HHL');
    await openView(page, 'wf');
    await page.locator('[data-rule-new]').click();
    await expect(page.locator('.rl-main')).toBeHidden();
    await page.locator('[data-rule-f="name"]').fill('Brak awizacji — SCX');
    await page.locator('[data-rule-when="issue"]').click();
    await page.locator('[data-rule-then="todo"]').click();
    await page.locator('[data-rule-f="todo"]').selectOption('SCX');
    await page.locator('[data-rule-save]').click();
    await expect(page.locator('.rl-main')).toBeVisible();
    await page.locator('.rl-rule [data-rule-edit]').first().click();
    await page.locator('[data-rule-save]').click();
    await expect(page.locator('[data-rule-f="reason"]')).toBeFocused();
    await noSideScroll(page, 1100);
  });

  test('telefon HHL: zakładki, „+ Nowa reguła”, kreator na cały ekran, przebiegi kartami, historia — 0 w bramie E8', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page, 'HHL');
    await openView(page, 'wf');
    const hits: Hit[] = [];
    const gate = async (name: string) => {
      for (const width of [...WIDTHS, 768]) {
        await page.setViewportSize({ width, height: 844 });
        await page.waitForTimeout(200);
        hits.push(...await measure(page, name, width, 'HHL'));
      }
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(200);
    };
    await gate('automatyzacje-dziala-samo');
    await page.locator('[data-wf-tab="own"]').click();
    await gate('automatyzacje-wlasne');
    await page.locator('#wf-panel-own [data-rule-new]').click();
    await expect(page.locator('[data-rule-creator] h2')).toBeFocused();
    const font = await page.locator('[data-rule-f="name"]').evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
    expect(font, 'pole ≥ 16 px').toBeGreaterThanOrEqual(16);
    await page.locator('[data-rule-save]').click();
    await gate('automatyzacje-kreator');
    await page.locator('.rl-back').click();
    await page.locator('[data-wf-tab="runs"]').click();
    await expect(page.locator('.rl-run-card')).toHaveCount(5);
    await gate('automatyzacje-przebiegi');
    await page.locator('[data-wf-tab="hist"]').click();
    await gate('automatyzacje-historia');
    expect(hits, JSON.stringify(hits, null, 1)).toEqual([]);
  });
});
