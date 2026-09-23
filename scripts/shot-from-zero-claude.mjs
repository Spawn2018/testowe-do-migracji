import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'fs';
import { pathToFileURL } from 'url';

const out = '/workspace/watch-tower-app/shots-start';
mkdirSync(out, { recursive: true });
const BASE = 'http://127.0.0.1:4173/';
const MAKIETA = pathToFileURL('/workspace/watch-tower/claude-makieta.html').href;

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

async function reset() {
  await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.evaluate(() => {
    try {
      sessionStorage.setItem('wtNavCollapsed', '0');
      for (const k of Object.keys(localStorage)) {
        if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k);
      }
    } catch {}
  });
  await page.reload({ waitUntil: 'networkidle0', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 800));
}

async function ensureNavExpanded() {
  await page.evaluate(() => {
    try { sessionStorage.setItem('wtNavCollapsed', '0'); } catch {}
    const app = document.querySelector('.app');
    if (app && app.classList.contains('nav-collapsed')) {
      const btn = [...document.querySelectorAll('button')].find(
        (b) =>
          (b.textContent || '').includes('»') ||
          (b.textContent || '').includes('☰') ||
          /rozwiń|expand|nawigacj|menu/i.test(b.getAttribute('title') || '') ||
          /nawigacj|menu/i.test(b.getAttribute('aria-label') || ''),
      );
      btn?.click();
    }
  });
  await new Promise((r) => setTimeout(r, 450));
}

async function clickRole(code) {
  await page.evaluate((code) => {
    const btn = [...document.querySelectorAll('.roleswitch .seg button, .seg button')].find(
      (b) => (b.textContent || '').includes(code),
    );
    btn?.click();
  }, code);
  await new Promise((r) => setTimeout(r, 900));
}

async function clickNav(reSrc) {
  await page.evaluate((reSrc) => {
    const re = new RegExp(reSrc, 'i');
    const btn = [...document.querySelectorAll('nav button')].find((b) =>
      re.test(b.getAttribute('aria-label') || b.textContent || ''),
    );
    btn?.click();
  }, reSrc);
  await new Promise((r) => setTimeout(r, 1200));
}

async function metrics() {
  return page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const body = getComputedStyle(document.body);
    const brand = document.querySelector('.brand b') || document.querySelector('.brand');
    const topbar = document.querySelector('.topbar');
    const nav = document.querySelector('nav');
    const corridor = document.querySelector('.corridor');
    const bcs = brand ? getComputedStyle(brand) : null;
    return {
      fontBody: body.fontFamily,
      fontSize: body.fontSize,
      brandFont: bcs?.fontFamily ?? null,
      brandSize: bcs?.fontSize ?? null,
      topbarH: topbar ? Math.round(topbar.getBoundingClientRect().height) : null,
      navW: nav ? Math.round(nav.getBoundingClientRect().width) : null,
      corridorPad: corridor ? getComputedStyle(corridor).padding : null,
      page: cs.getPropertyValue('--page').trim(),
      surface: cs.getPropertyValue('--surface').trim(),
      ink: cs.getPropertyValue('--ink').trim(),
      hasApp: !!document.querySelector('.app'),
      hasTopbar: !!document.querySelector('.topbar'),
      hasCorridor: !!document.querySelector('.corridor'),
      hasBody: !!document.querySelector('.body'),
      hasPanel: !!document.querySelector('.panel'),
      hasKpis: !!document.querySelector('.kpis, .kpi'),
      theme: document.documentElement.getAttribute('data-theme'),
      wtClassLeft: [...document.querySelectorAll('[class*="wt-"]')].slice(0, 8).map((e) => String(e.className)),
    };
  });
}

await reset();
await ensureNavExpanded();
await clickRole('H&H');
await ensureNavExpanded();
await page.screenshot({ path: `${out}/from-zero-claude-hhl-dark.png`, fullPage: false });
const mHhl = await metrics();

await clickRole('KSH');
await ensureNavExpanded();
await page.screenshot({ path: `${out}/from-zero-claude-ksh-light.png`, fullPage: false });
const mKsh = await metrics();

await clickRole('H&H');
await clickNav('Mapa|Map|Karta');
await new Promise((r) => setTimeout(r, 2500));
await page.screenshot({ path: `${out}/from-zero-claude-map.png`, fullPage: false });

await clickNav('Kokpit|Overview|Översikt|Dashboard');
await ensureNavExpanded();
await page.screenshot({ path: `${out}/from-zero-claude-nav.png`, fullPage: false });

await page.goto(MAKIETA, { waitUntil: 'networkidle0', timeout: 90000 });
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: `${out}/from-zero-makieta-dark.png`, fullPage: false });

writeFileSync(`${out}/from-zero-claude-metrics.json`, JSON.stringify({ hhl: mHhl, ksh: mKsh, at: new Date().toISOString() }, null, 2));
console.log(JSON.stringify({ hhl: mHhl, ksh: mKsh }, null, 2));
await browser.close();
