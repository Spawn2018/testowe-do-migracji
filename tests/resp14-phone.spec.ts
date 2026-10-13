/**
 * RESP-14 / D-31 — brama telefonu: pasek górny nie wychodzi poza viewport 390 i 768.
 * Użycie: PW_BASE_URL=http://127.0.0.1:4173 npx playwright test tests/resp14-phone.spec.ts
 */
import { test, expect } from '@playwright/test';

const WIDTHS = [390, 768] as const;

for (const width of WIDTHS) {
  test(`RESP-14 topbar mieści się w ${width}px (bez overflow)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.waitForSelector('.topbar');
    const metrics = await page.evaluate(() => {
      const bar = document.querySelector('.topbar') as HTMLElement | null;
      if (!bar) return null;
      return {
        clientWidth: bar.clientWidth,
        scrollWidth: bar.scrollWidth,
        bodyScroll: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      };
    });
    expect(metrics).not.toBeNull();
    expect(metrics!.scrollWidth, `topbar scrollWidth ≤ clientWidth @${width}`).toBeLessThanOrEqual(metrics!.clientWidth + 1);
    expect(metrics!.bodyScroll, `document nie szerszy niż viewport @${width}`).toBeLessThanOrEqual(metrics!.viewport + 1);
  });
}

// wyglad/P3 (E37 pkt 1–2): konto (imię i nazwisko, firma, rodzaj, „Wyloguj”) jest w pasku górnym, nie w lewym menu.
test('RESP-14 menu telefon: konto w pasku górnym (E37, UI-12)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.waitForSelector('.topbar');
  await expect(page.locator('nav .nav-session')).toHaveCount(0);
  await page.click('#accountBtn');
  await expect(page.locator('#accountMenu')).toBeVisible();
  await expect(page.locator('#accountMenu .acc-hd b')).not.toBeEmpty();
});
