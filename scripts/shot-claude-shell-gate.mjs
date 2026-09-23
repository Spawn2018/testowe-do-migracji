import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'fs';

const out = '/workspace/watch-tower-app/shots-start';
mkdirSync(out, { recursive: true });
const BASE = 'http://127.0.0.1:4173/';

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

async function resetExpanded() {
  await page.evaluate(() => {
    try {
      sessionStorage.setItem('wtNavCollapsed', '0');
      for (const k of Object.keys(localStorage)) {
        if (/watch|tower|wt/i.test(k)) localStorage.removeItem(k);
      }
    } catch {}
  });
}

async function ensureNavExpanded() {
  await page.evaluate(() => {
    try { sessionStorage.setItem('wtNavCollapsed', '0'); } catch {}
    const nav = document.querySelector('nav');
    if (nav && nav.getBoundingClientRect().width < 100) {
      const btn = [...document.querySelectorAll('button')].find(
        (b) =>
          (b.textContent || '').includes('»') ||
          /rozwiń|expand/i.test(b.getAttribute('title') || '') ||
          /nawigacji|menu/i.test(b.getAttribute('aria-label') || ''),
      );
      btn?.click();
    }
  });
  await new Promise((r) => setTimeout(r, 350));
}

async function clickRole(code) {
  await page.evaluate((code) => {
    const btn = [...document.querySelectorAll('.wt-seg-role button')].find(
      (b) => (b.textContent || '').trim() === code,
    );
    btn?.click();
  }, code);
  await new Promise((r) => setTimeout(r, 600));
}

async function clickNav(ariaRe) {
  await page.evaluate((reSrc) => {
    const re = new RegExp(reSrc, 'i');
    const btn = [...document.querySelectorAll('nav button')].find((b) =>
      re.test(b.getAttribute('aria-label') || ''),
    );
    btn?.click();
  }, ariaRe);
  await new Promise((r) => setTimeout(r, 800));
}

async function metrics() {
  return page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const body = getComputedStyle(document.body);
    const brand = document.querySelector('.wt-brand');
    const top = document.querySelector('.wt-topbar');
    const nav = document.querySelector('nav');
    const spineN = document.querySelector('.wt-stage .n');
    const kpiV = document.querySelector('.wt-kpi .v');
    const current = document.querySelector('nav button[aria-current="page"]');
    const curCs = current ? getComputedStyle(current) : null;
    const segs = [...document.querySelectorAll('.wt-seg-role button')].map((b) => ({
      t: b.textContent.trim(),
      pressed: b.getAttribute('aria-pressed'),
    }));
    const pressedSeg = document.querySelector('.wt-seg-role button[aria-pressed="true"]');
    const pCs = pressedSeg ? getComputedStyle(pressedSeg) : null;
    return {
      theme: document.documentElement.getAttribute('data-theme'),
      bodyFont: body.fontFamily,
      bodySize: body.fontSize,
      brandFont: brand ? getComputedStyle(brand).fontFamily : null,
      brandSize: brand ? getComputedStyle(brand).fontSize : null,
      topH: top ? Math.round(top.getBoundingClientRect().height) : null,
      navW: nav ? Math.round(nav.getBoundingClientRect().width) : null,
      spineN: spineN ? getComputedStyle(spineN).fontSize : null,
      kpiV: kpiV ? getComputedStyle(kpiV).fontSize : null,
      page: cs.getPropertyValue('--wt-bg').trim() || cs.getPropertyValue('--page').trim(),
      surface: cs.getPropertyValue('--wt-surface').trim(),
      ink: cs.getPropertyValue('--wt-ink').trim(),
      amber: cs.getPropertyValue('--wt-accent').trim(),
      navCurrentBorder: curCs?.borderLeftColor,
      navCurrentBorderW: curCs?.borderLeftWidth,
      roles: segs,
      segPressedBg: pCs?.backgroundColor,
      segPressedColor: pCs?.color,
      seps: document.querySelectorAll('nav .sep').length,
      plex: /Plex|Inter|Roboto|Poppins/i.test(body.fontFamily + (brand?.textContent || '')),
      glassOnKpi: (() => {
        const k = document.querySelector('.wt-kpi');
        if (!k) return false;
        const bg = getComputedStyle(k).backgroundColor;
        return bg.includes('rgba') && !bg.endsWith(', 1)');
      })(),
    };
  });
}

await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await resetExpanded();
await page.reload({ waitUntil: 'networkidle0', timeout: 90000 });
await page.waitForSelector('.wt-topbar', { timeout: 20000 });
await ensureNavExpanded();

// 1) HHL dark cockpit
await clickRole('HHL');
await clickNav('kokpit|dashboard|dash');
await ensureNavExpanded();
await new Promise((r) => setTimeout(r, 1800));
const mHhl = await metrics();
await page.screenshot({ path: `${out}/claude-shell-hhl-dark.png`, fullPage: false });
console.log('wrote claude-shell-hhl-dark.png', mHhl.theme, mHhl.navW);

// 2) nav expanded chrome (same state, labeled shot)
await page.screenshot({ path: `${out}/claude-shell-nav-expanded.png`, fullPage: false });
console.log('wrote claude-shell-nav-expanded.png seps=', mHhl.seps);

// 3) map
await clickNav('mapa|map');
await page.waitForSelector('.leaflet-container, .maplibregl-canvas', { timeout: 30000 }).catch(() => null);
await new Promise((r) => setTimeout(r, 4500));
await ensureNavExpanded();
const mMap = await metrics();
await page.screenshot({ path: `${out}/claude-shell-map.png`, fullPage: false });
console.log('wrote claude-shell-map.png', mMap.theme);

// 4) KSH light cockpit
await clickRole('KSH');
await clickNav('kokpit|dashboard|dash');
await ensureNavExpanded();
await new Promise((r) => setTimeout(r, 1500));
const mKsh = await metrics();
await page.screenshot({ path: `${out}/claude-shell-ksh-light.png`, fullPage: false });
console.log('wrote claude-shell-ksh-light.png', mKsh.theme, mKsh.page);

const gate = {
  when: new Date().toISOString(),
  hhl: mHhl,
  ksh: mKsh,
  map: mMap,
  checks: {
    barlow: /Barlow/i.test(mHhl.bodyFont) && /Condensed/i.test(mHhl.brandFont || ''),
    noPlex: !mHhl.plex,
    top52: mHhl.topH === 52,
    nav186: mHhl.navW === 186,
    spine26: mHhl.spineN === '26px',
    kpi29: mHhl.kpiV === '29px',
    hhlDark: mHhl.theme === 'dark' && mHhl.page.toLowerCase() === '#080f15',
    kshLight: mKsh.theme === 'light' && mKsh.page.toLowerCase() === '#e3e9ed',
    amberRail: (mHhl.navCurrentBorderW || '').startsWith('3'),
    solidKpi: !mHhl.glassOnKpi,
    sepsPresent: mHhl.seps >= 2,
    rolesOnly: mHhl.roles.map((r) => r.t).join(',') === 'HHL,KSH,SCX',
  },
};
writeFileSync(`${out}/claude-shell-gate-metrics.json`, JSON.stringify(gate, null, 2));
console.log(JSON.stringify(gate.checks, null, 2));
await browser.close();
