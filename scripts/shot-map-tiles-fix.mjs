import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'fs';

const out = '/workspace/watch-tower-app/shots-start';
mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--ignore-gpu-blocklist',
    '--window-size=1440,900',
  ],
  defaultViewport: { width: 1440, height: 900 },
});

const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
const failed = [];
page.on('requestfailed', (r) => failed.push(`${r.url()} :: ${r.failure()?.errorText}`));

await page.goto('http://127.0.0.1:4177/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.evaluate(() => {
  try {
    sessionStorage.setItem('wtNavCollapsed', '0');
    for (const k of Object.keys(localStorage)) {
      if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k);
    }
  } catch {}
});
await page.reload({ waitUntil: 'networkidle0', timeout: 90000 });
await page.waitForSelector('nav', { timeout: 20000 });
await new Promise((r) => setTimeout(r, 600));

await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  btns.find((b) => (b.textContent || '').trim() === 'HHL' || b.textContent?.includes('HHL'))?.click();
});
await new Promise((r) => setTimeout(r, 400));

await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  btns.find((b) => /mapa|map/i.test(b.getAttribute('aria-label') || '') || (b.textContent || '').includes('⌖'))?.click();
});

await page.waitForSelector('.leaflet-container', { timeout: 30000 });
await page.waitForSelector('.leaflet-tile-loaded', { timeout: 30000 }).catch(() => null);
await new Promise((r) => setTimeout(r, 4000));

const info = await page.evaluate(() => {
  const mapEl = document.querySelector('.leaflet-container');
  const tiles = [...document.querySelectorAll('.leaflet-tile-loaded')];
  const note = document.querySelector('.wt-mapkey-note')?.textContent || '';
  const pane = document.querySelector('.leaflet-tile-pane');
  return {
    hasLeaflet: !!mapEl,
    tileCount: tiles.length,
    note,
    theme: document.documentElement.getAttribute('data-theme'),
    mapSize: mapEl ? { w: mapEl.clientWidth, h: mapEl.clientHeight } : null,
    paneChildren: pane?.childElementCount ?? 0,
  };
});
console.log('map info', JSON.stringify(info, null, 2));

await page.screenshot({ path: `${out}/map-tiles-fix.png`, fullPage: false });
console.log('wrote map-tiles-fix.png');

const buf = await page.screenshot({
  encoding: 'binary',
  type: 'png',
  clip: { x: 220, y: 160, width: 420, height: 280 },
});
writeFileSync(`${out}/map-tiles-crop.png`, buf);

const view = Buffer.from(buf);
let sum = 0;
for (let i = 100; i < view.length; i += 97) sum += view[i];
const avg = sum / Math.max(1, Math.floor((view.length - 100) / 97));
console.log('crop sample', { avg, bytes: view.length });
console.log('failed reqs', failed.filter((u) => /carto|leaflet|tile|basemap/i.test(u)).slice(0, 20));
console.log('error logs', logs.filter((l) => /error|CorridorMap|leaflet|fail|404/i.test(l)).slice(0, 30));

await browser.close();
