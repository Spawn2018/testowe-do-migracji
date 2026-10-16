/**
 * B-7a / B-7b (05.10.2026, słowa właściciela z części B).
 * B-7a: mapa ma stały rozmiar, niezależny od wysokości tabeli obok; po otwarciu widoku MAPA widoczna w całości.
 * B-7b: checkboxy warstw zawsze widoczne; na telefonie nie nachodzą na inne elementy.
 * Użycie: PW_BASE_URL=http://127.0.0.1:4173 npx playwright test tests/b7-map.spec.ts
 */
import { test, expect, type Page } from '@playwright/test';

const SIZES = [
  { w: 1920, h: 1080 },
  { w: 1440, h: 900 },
  { w: 1280, h: 720 },
  { w: 768, h: 1024 },
  { w: 390, h: 844 },
  { w: 360, h: 740 },
] as const;

async function openMap(page: Page, w: number, h: number) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto('/#/?now=2026-09-23T14:32:00Z', { waitUntil: 'networkidle' });
  await page.evaluate(() => (document.querySelector('[data-view="map"]') as HTMLElement | null)?.click());
  await page.waitForSelector('.page-sections[data-page="map"] .mapbox .leaflet-container');
  await page.waitForTimeout(300);
}

type Box = { x: number; y: number; w: number; h: number; right: number; bottom: number };
const box = (page: Page, sel: string) =>
  page.evaluate((s) => {
    const e = document.querySelector(s);
    if (!e) return null;
    const r = e.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right, bottom: r.bottom };
  }, sel) as Promise<Box | null>;
const overlap = (a: Box, b: Box) => a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;

for (const { w, h } of SIZES) {
  test(`B-7a mapa w całości po otwarciu i niezależna od tabeli @${w}x${h}`, async ({ page }) => {
    await openMap(page, w, h);
    const map = (await box(page, '.page-sections[data-page="map"] .mapbox'))!;
    const list = (await box(page, '.page-sections[data-page="map"] .mlist'))!;
    expect(map.y).toBeGreaterThanOrEqual(0);
    expect(map.bottom, 'dół mapy w oknie').toBeLessThanOrEqual(h);
    expect(map.right, 'mapa nie wychodzi w prawo').toBeLessThanOrEqual(w);
    expect(map.h).toBeGreaterThanOrEqual(320);
    // tabela jest dłuższa niż okno, a mapa się z nią nie rozciąga
    expect(list.h).toBeGreaterThan(h);
    expect(map.h).toBeLessThan(list.h);
    // mniej wierszy → ta sama wysokość mapy
    await page.fill('.page-sections[data-page="map"] .mlist .filters input', 'SG-01');
    await page.waitForTimeout(200);
    const map2 = (await box(page, '.page-sections[data-page="map"] .mapbox'))!;
    expect(Math.abs(map2.h - map.h)).toBeLessThanOrEqual(1);
  });

  test(`B-7b checkboxy warstw widoczne i bez nachodzenia @${w}x${h}`, async ({ page }) => {
    await openMap(page, w, h);
    /* wyglad/P9-c (E29 pkt 9, 08.10 — nowsze niż B-7b 05.10): na telefonie „Warstwy ▾” na mapie → arkusz od dołu */
    if (w <= 768) {
      const btn = (await box(page, '.page-sections[data-page="map"] [data-map-layers-btn]'))!;
      expect(btn.h).toBeGreaterThanOrEqual(44);
      expect(btn.right).toBeLessThanOrEqual(w);
      await page.click('.page-sections[data-page="map"] [data-map-layers-btn]');
      await expect(page.locator('[data-map-layers-sheet] input[type="checkbox"]')).toHaveCount(5);
      const doc = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(doc, 'strona nie szersza niż ekran').toBeLessThanOrEqual(w + 1);
      return;
    }
    const layers = (await box(page, '.page-sections[data-page="map"] .maplayers'))!;
    expect(layers.y).toBeGreaterThanOrEqual(0);
    expect(layers.bottom).toBeLessThanOrEqual(h);
    expect(layers.right).toBeLessThanOrEqual(w);
    const n = await page.locator('.page-sections[data-page="map"] .maplayers input[type="checkbox"]').count();
    expect(n).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < n; i++) {
      await expect(page.locator('.page-sections[data-page="map"] .maplayers input[type="checkbox"]').nth(i)).toBeVisible();
    }
    const zoom = await box(page, '.page-sections[data-page="map"] .leaflet-control-zoom');
    if (zoom) {
      expect(overlap(layers, zoom), 'warstwy nie zasłaniają przycisków powiększenia').toBe(false);
      expect(zoom.right).toBeLessThanOrEqual(w);
    }
    if (w <= 768) {
      const leaflet = (await box(page, '.page-sections[data-page="map"] .leaflet-container'))!;
      expect(overlap(layers, leaflet), 'na telefonie pas warstw jest nad mapą, nie na niej').toBe(false);
      const legend = await box(page, '.page-sections[data-page="map"] .mapkey');
      if (legend) expect(overlap(layers, legend)).toBe(false);
      const doc = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(doc, 'strona nie szersza niż ekran').toBeLessThanOrEqual(w + 1);
    }
  });
}
