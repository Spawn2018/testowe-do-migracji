/**
 * E8 pkt 1 i 7 (P2-wyglad V3, D-20261013-1535-01).
 * 9 widoków, konto HHL, 360 / 390 / 430 px: elementy poza ekranem, cele < 44 px, tekst < 12 px = 0.
 * Wyjątki: tests/fixtures/e8-exceptions.txt.
 */
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const FROZEN_URL = `/#/?now=${encodeURIComponent('2026-09-23T14:32:00Z')}`;
const VIEWS = ['dash', 'map', 'sched', 'risk', 'docs', 'fin', 'inv', 'geo', 'options'] as const;
const WIDTHS = [360, 390, 430] as const;

const EXCEPTIONS = readFileSync('tests/fixtures/e8-exceptions.txt', 'utf8')
  .split(/\r?\n/)
  .map((line) => line.replace(/#.*$/, '').trim())
  .filter(Boolean)
  .map((line) => line.split('|')[0].trim())
  .filter(Boolean);

type Hit = { kind: string; view: string; width: number; n: number; sample: string[] };

async function boot(page: Page, navCollapsed = false) {
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
  await page.waitForSelector('#roleSeg button[data-role="HHL"]', { state: 'attached', timeout: 30_000 });
  await page.evaluate(() => {
    (document.querySelector('#roleSeg button[data-role="HHL"]') as HTMLButtonElement).click();
  });
  await page.waitForTimeout(300);
}

async function openView(page: Page, view: string) {
  await page.evaluate((key) => {
    const btn = document.querySelector(`nav button[data-view="${key}"]`);
    if (!btn) throw new Error('brak widoku ' + key);
    (btn as HTMLButtonElement).click();
  }, view);
  await page.waitForTimeout(view === 'map' ? 1200 : 500);
}

async function measure(page: Page, view: string, width: number): Promise<Hit[]> {
  const raw = await page.evaluate((selectors) => {
    const skip = (el: Element) => selectors.some((s) => {
      try { return el.matches(s); } catch { return false; }
    });
    const visible = (el: Element) => {
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
      const r = el.getBoundingClientRect();
      return r.width >= 1 && r.height >= 1;
    };
    const name = (el: Element) => {
      const id = (el as HTMLElement).id ? '#' + (el as HTMLElement).id : '';
      const cls = typeof (el as HTMLElement).className === 'string'
        ? (el as HTMLElement).className.trim().split(/\s+/).slice(0, 2).map((c) => '.' + c).join('')
        : '';
      const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 36);
      return `${el.tagName}${id}${cls} ${text}`;
    };
    const outside = (el: Element) => {
      const vw = window.innerWidth;
      const r = el.getBoundingClientRect();
      if (r.right <= vw + 1 && r.left >= -1) return false;
      let n: Element | null = el.parentElement;
      while (n) {
        const cs = getComputedStyle(n);
        const ox = cs.overflowX;
        if ((ox === 'auto' || ox === 'scroll') && n.scrollWidth > n.clientWidth + 1) {
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
    const seen = new Set<Element>();
    document.querySelectorAll('body *').forEach((el) => {
      if (skip(el) || !visible(el) || seen.has(el)) return;
      if (outside(el)) out.push(name(el));
      const own = Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').trim().length > 0);
      if (own && parseFloat(getComputedStyle(el).fontSize) < 12) small.push(name(el));
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
    const pageWide = document.documentElement.scrollWidth > window.innerWidth + 1;
    return {
      out: pageWide ? ['STRONA szersza od okna', ...out] : out,
      small,
      tight,
    };
  }, EXCEPTIONS);
  const pack = (kind: string, list: string[]): Hit | null =>
    list.length ? { kind, view, width, n: list.length, sample: list.slice(0, 8) } : null;
  return [pack('poza', raw.out), pack('tekst', raw.small), pack('cel', raw.tight)].filter((x): x is Hit => x !== null);
}

test.describe('brama E8 telefon', () => {
  test.describe.configure({ mode: 'serial', timeout: 240_000 });
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  test('0 poza ekranem, 0 celów poniżej 44 px, 0 tekstu poniżej 12 px', async ({ page }) => {
    await boot(page);
    const hits: Hit[] = [];
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 844 });
      for (const view of VIEWS) {
        await openView(page, view);
        hits.push(...await measure(page, view, width));
      }
    }
    const report = hits.map((h) => `${h.width} ${h.view} ${h.kind}=${h.n}: ${h.sample.join(' | ')}`).join('\n');
    expect(hits, report).toEqual([]);
  });
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
