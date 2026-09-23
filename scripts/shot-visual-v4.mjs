import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';

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

await page.goto('http://127.0.0.1:4177/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.evaluate(() => {
  try {
    sessionStorage.setItem('wtNavCollapsed', '0');
    sessionStorage.removeItem('wtNavCollapsed'); // expanded default
    sessionStorage.setItem('wtNavCollapsed', '0');
    for (const k of Object.keys(localStorage)) {
      if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k);
    }
  } catch {}
});
await page.reload({ waitUntil: 'networkidle0', timeout: 90000 });
await page.waitForSelector('nav', { timeout: 20000 });
await new Promise((r) => setTimeout(r, 1000));

// Force expand nav if collapsed
await page.evaluate(() => {
  try { sessionStorage.setItem('wtNavCollapsed', '0'); } catch {}
  const nav = document.querySelector('nav');
  if (nav && nav.getBoundingClientRect().width < 100) {
    const btns = [...document.querySelectorAll('button')];
    btns.find((b) => (b.textContent || '').includes('»') || b.title?.toLowerCase().includes('expand'))?.click();
  }
});
await new Promise((r) => setTimeout(r, 400));

const navW = await page.evaluate(() => {
  const n = document.querySelector('nav');
  return n ? Math.round(n.getBoundingClientRect().width) : -1;
});
console.log('nav width:', navW);

// HHL + dash cockpit
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  btns.find((b) => (b.textContent || '').trim() === 'HHL' || (b.textContent || '').includes('HHL'))?.click();
});
await new Promise((r) => setTimeout(r, 500));
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  btns
    .find(
      (b) =>
        /kokpit|dashboard|dash/i.test(b.getAttribute('aria-label') || '') ||
        (b.textContent || '').includes('▣'),
    )
    ?.click();
});
await new Promise((r) => setTimeout(r, 2500)); // allow map tiles in triad
await page.screenshot({ path: `${out}/visual-v4-cockpit.png`, fullPage: false });
console.log('wrote visual-v4-cockpit.png');
const cockpitCopy = await page.evaluate(() => ({
  titles: [...document.querySelectorAll('.wt-ex-t')].map((e) => e.textContent.trim()),
  metas: [...document.querySelectorAll('.wt-ex-m')].slice(0, 3).map((e) => e.textContent.trim()),
  chartHd: document.querySelector('.wt-cockpit-chart .wt-panel-hd')?.innerText?.replace(/\s+/g, ' ').trim(),
  mapNote: document.querySelector('.wt-mapkey-note')?.textContent?.trim() || '',
  roles: [...document.querySelectorAll('.wt-seg-role button')].map((b) => ({
    text: b.textContent.trim(),
    pressed: b.getAttribute('aria-pressed'),
    hasImg: !!b.querySelector('img'),
  })),
  banner: document.querySelector('.wt-banner')?.innerText?.replace(/\s+/g, ' ').trim() || '',
}));
console.log('cockpitCopy', JSON.stringify(cockpitCopy, null, 2));

// Map full view
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  btns
    .find(
      (b) =>
        /mapa|map/i.test(b.getAttribute('aria-label') || '') ||
        (b.textContent || '').includes('⌖'),
    )
    ?.click();
});
await page.waitForSelector('.leaflet-container, .maplibregl-canvas', { timeout: 30000 }).catch(() => null);
await new Promise((r) => setTimeout(r, 6000));
const mapInfo = await page.evaluate(() => {
  const canvas = document.querySelector('.maplibregl-canvas, .leaflet-container');
  const note = document.querySelector('.wt-mapkey-note')?.textContent || '';
  const exTitles = [...document.querySelectorAll('.wt-ex-t')].slice(0, 6).map((e) => e.textContent.trim());
  const chartSub = document.querySelector('.wt-cockpit-chart .wt-panel-hd .sub')?.textContent?.trim() || '';
  return {
    hasCanvas: !!canvas,
    note,
    exTitles,
    chartSub,
    theme: document.documentElement.getAttribute('data-theme'),
  };
});
console.log('map info', mapInfo);
await page.screenshot({ path: `${out}/visual-v4-map.png`, fullPage: false });
console.log('wrote visual-v4-map.png');

// KSH light
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  btns.find((b) => (b.textContent || '').trim() === 'KSH' || (b.textContent || '').includes('KSH'))?.click();
});
await new Promise((r) => setTimeout(r, 600));
await page.evaluate(() => {
  const theme = document.documentElement.getAttribute('data-theme');
  if (theme !== 'light') {
    const btns = [...document.querySelectorAll('button')];
    btns
      .find(
        (b) =>
          /Dark|Light|theme|motyw/i.test(b.textContent || '') ||
          b.title?.toLowerCase().includes('theme'),
      )
      ?.click();
  }
});
await new Promise((r) => setTimeout(r, 400));
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  btns
    .find(
      (b) =>
        /kokpit|dash|▣/i.test(b.getAttribute('aria-label') || '') ||
        (b.textContent || '').includes('▣'),
    )
    ?.click();
});
await new Promise((r) => setTimeout(r, 2000));
const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
console.log('ksh theme:', theme);
await page.screenshot({ path: `${out}/visual-v4-ksh-light.png`, fullPage: false });
console.log('wrote visual-v4-ksh-light.png');

const errLogs = logs.filter((l) => /error|WebGL|CorridorMap|map|fail/i.test(l)).slice(0, 30);
console.log('notable logs', errLogs);
await browser.close();
console.log('done');
