import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--use-gl=swiftshader'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1440, height: 900 });
const logs = [];
const reqs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => logs.push(`[reqfail] ${r.url().slice(0,160)} :: ${r.failure()?.errorText}`));
page.on('response', (res) => {
  const u = res.url();
  if (/openfreemap|demotiles|maptiler|basemaps|maplibre|style|\.pbf|fonts|sprites/.test(u)) {
    reqs.push({ status: res.status(), u: u.slice(0, 140) });
  }
});

await page.goto('http://127.0.0.1:4177/', { waitUntil: 'networkidle0', timeout: 90000 });
await page.evaluate(() => {
  // zustand persist? try click map nav by aria-label
  const btn = [...document.querySelectorAll('button')].find((b) =>
    /mapa|map/i.test(b.getAttribute('aria-label') || b.textContent || ''),
  );
  if (btn) btn.click();
});
await new Promise((r) => setTimeout(r, 8000));

const info = await page.evaluate(() => {
  const canvas = document.querySelector('.maplibregl-canvas');
  const mapEl = document.querySelector('.maplibregl-map');
  let avg = null;
  if (canvas instanceof HTMLCanvasElement) {
    // WebGL: draw to 2d via read... can't. Use toDataURL and sample via Image
  }
  return {
    href: location.href,
    hasMap: !!mapEl,
    canvas: canvas ? { w: canvas.width, h: canvas.height, className: canvas.className } : null,
    legend: document.querySelector('.wt-mapkey')?.textContent?.trim(),
    ferryCard: document.body.innerText.includes('Prom dziś'),
    workerScripts: [...document.querySelectorAll('script')].map(s => s.src).filter(Boolean).slice(0,10),
  };
});

// sample canvas brightness via screenshot crop
await page.screenshot({ path: '/workspace/watch-tower-app/shots-start/diag-map-before.png', fullPage: false });

// try reading map errors from maplibre if exposed
const ml = await page.evaluate(() => {
  // check CSS canvas background
  const c = document.querySelector('.maplibregl-canvas');
  const map = document.querySelector('.maplibregl-map');
  if (!map) return { noMap: true };
  const cs = getComputedStyle(map);
  return {
    mapBg: cs.backgroundColor,
    mapSize: { w: map.clientWidth, h: map.clientHeight },
    canvasSize: c ? { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight } : null,
    missingCss: !document.querySelector('link[href*="maplibre"], style') && true,
  };
});

console.log(JSON.stringify({ info, ml, logs: logs.slice(0, 100), reqs: reqs.slice(0, 50) }, null, 2));
await browser.close();
