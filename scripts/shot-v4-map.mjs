import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'fs';
import { createRequire } from 'module';

const out = '/workspace/watch-tower-app/shots-start';
mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--ignore-gpu-blocklist',
    '--enable-webgl',
    '--use-gl=angle',
    '--use-angle=swiftshader-webgl',
    '--window-size=1440,900',
  ],
  defaultViewport: { width: 1440, height: 900 },
});

const page = await browser.newPage();
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

const webgl = await page.evaluate(() => {
  const c = document.createElement('canvas');
  const gl2 = c.getContext('webgl2');
  return { webgl2: !!gl2, renderer: gl2?.getParameter(gl2.RENDERER) };
});
console.log('webgl', webgl);

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
await new Promise((r) => setTimeout(r, 800));

// HHL + dash cockpit
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  btns.find((b) => (b.textContent || '').trim() === 'HHL' || b.textContent?.includes('HHL'))?.click();
});
await new Promise((r) => setTimeout(r, 400));
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  btns.find((b) => /kokpit|dashboard|dash/i.test(b.getAttribute('aria-label') || '') || (b.textContent || '').includes('▣'))?.click();
});
await new Promise((r) => setTimeout(r, 900));
await page.screenshot({ path: `${out}/visual-v4-cockpit.png`, fullPage: false });
console.log('wrote visual-v4-cockpit.png');

// Map
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  btns.find((b) => /mapa|map/i.test(b.getAttribute('aria-label') || '') || (b.textContent || '').includes('⌖'))?.click();
});
await page.waitForSelector('.maplibregl-canvas', { timeout: 30000 }).catch(() => null);
await new Promise((r) => setTimeout(r, 6000));

const info = await page.evaluate(() => {
  const canvas = document.querySelector('.maplibregl-canvas');
  const note = document.querySelector('.wt-mapkey-note')?.textContent || '';
  return {
    hasCanvas: !!canvas,
    w: canvas?.width,
    h: canvas?.height,
    note,
    theme: document.documentElement.getAttribute('data-theme'),
  };
});
console.log('map info', info);

await page.screenshot({ path: `${out}/map-tiles-fix.png`, fullPage: false });
console.log('wrote map-tiles-fix.png');

// brightness sample via screenshot buffer
const buf = await page.screenshot({ encoding: 'binary', type: 'png', clip: { x: 220, y: 160, width: 420, height: 280 } });
writeFileSync(`${out}/map-tiles-crop.png`, buf);

// crude non-black check: count non-near-black pixels
function isNotBlack(pngBuf) {
  // PNG IHDR + simple scan without pngjs: look at raw bytes variance
  let sum = 0;
  const view = Buffer.from(pngBuf);
  // sample every 64th byte after header
  for (let i = 100; i < view.length; i += 97) sum += view[i];
  const avg = sum / Math.max(1, Math.floor((view.length - 100) / 97));
  return { avg, bytes: view.length };
}
console.log('crop sample', isNotBlack(buf));
console.log('logs', logs.filter((l) => /error|WebGL|CorridorMap|map|fail/i.test(l)).slice(0, 40));

await browser.close();
