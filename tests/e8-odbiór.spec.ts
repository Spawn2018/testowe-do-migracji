/**
 * P2-wyglad V4 — zrzuty dowodu. Uruchamiane ręcznie: ODBIOR=1.
 * Nie wchodzi do fresh-smoke (nie jest bramą).
 */
import { mkdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const OUT = 'docs/handover/odbior/P2';
const FROZEN_URL = `/#/?now=${encodeURIComponent('2026-09-23T14:32:00Z')}`;
const ROLES = ['HHL', 'SCX', 'KSH'] as const;
const SCREENS = [
  { id: 'kokpit', view: 'dash' },
  { id: 'harmonogram', view: 'sched' },
  { id: 'dokumenty', view: 'docs' },
  { id: 'finanse', view: 'fin' },
] as const;

async function boot(page: Page, width: number, height: number) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width, height });
  await page.goto(FROZEN_URL, { waitUntil: 'networkidle', timeout: 120_000 });
  await page.evaluate(() => {
    try {
      sessionStorage.setItem('wtNavCollapsed', '0');
      sessionStorage.removeItem('wt-persist-wipe-notice');
    } catch { /* ignore */ }
    try {
      for (const k of Object.keys(localStorage)) {
        if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k);
      }
    } catch { /* ignore */ }
  });
  await page.reload({ waitUntil: 'networkidle', timeout: 120_000 });
  await page.waitForSelector('#roleSeg', { state: 'attached', timeout: 30_000 });
}

async function role(page: Page, id: string) {
  await page.evaluate((roleId) => {
    (document.querySelector(`#roleSeg button[data-role="${roleId}"]`) as HTMLButtonElement).click();
  }, id);
  await page.waitForTimeout(300);
}

async function view(page: Page, id: string) {
  await page.evaluate((key) => {
    (document.querySelector(`nav button[data-view="${key}"]`) as HTMLButtonElement).click();
  }, id);
  await page.waitForTimeout(id === 'map' ? 800 : 400);
}

test('zrzuty odbioru P2', async ({ page }) => {
  test.skip(!process.env.ODBIOR, 'ustaw ODBIOR=1');
  test.setTimeout(180_000);
  mkdirSync(OUT, { recursive: true });
  const shots: Array<{ file: string; width: number; height: number; role: string; screen: string; panel?: boolean }> = [];
  for (const width of [390, 1440] as const) {
    const height = width === 390 ? 844 : 900;
    for (const r of ROLES) {
      for (const s of SCREENS) shots.push({ file: `${s.id}__${r.toLowerCase()}__${width}.png`, width, height, role: r, screen: s.view });
      shots.push({ file: `panel__${r.toLowerCase()}__${width}.png`, width, height, role: r, screen: 'sched', panel: true });
    }
  }
  let current = '';
  for (const shot of shots) {
    const key = `${shot.width}x${shot.role}`;
    if (current !== key) {
      await boot(page, shot.width, shot.height);
      await role(page, shot.role);
      current = key;
    }
    await view(page, shot.screen);
    if (shot.panel) {
      const card = page.locator(shot.width <= 768 ? '.sched-card' : 'table.sched-table tbody tr[data-code]').first();
      await card.click();
      await page.waitForSelector('.drawer', { timeout: 10_000 });
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: `${OUT}/${shot.file}`, animations: 'disabled' });
    if (shot.panel) {
      await page.evaluate(() => {
        (document.querySelector('.drawer .iconbtn') as HTMLButtonElement | null)?.click();
      });
      await page.waitForTimeout(200);
    }
  }
  expect(shots.length).toBe(30);
});
