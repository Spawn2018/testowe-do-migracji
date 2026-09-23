import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import { pathToFileURL } from 'url';

const out = '/workspace/watch-tower-app/shots-start';
mkdirSync(out, { recursive: true });
const BASE = 'http://127.0.0.1:4177/';
const MAKIETA = pathToFileURL('/workspace/watch-tower/claude-visual-ref/tower-makieta.html').href;

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
  await new Promise((r) => setTimeout(r, 700));
}

async function clickNav(ariaRe) {
  await page.evaluate((reSrc) => {
    const re = new RegExp(reSrc, 'i');
    const btn = [...document.querySelectorAll('nav button')].find((b) =>
      re.test(b.getAttribute('aria-label') || b.textContent || ''),
    );
    btn?.click();
  }, ariaRe);
  await new Promise((r) => setTimeout(r, 900));
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
    const stages = [...document.querySelectorAll('.wt-stage .l')].map((el) => el.textContent.trim());
    const navLabels = [...document.querySelectorAll('nav button .lbl')].map((el) => el.textContent.trim());
    return {
      theme: document.documentElement.getAttribute('data-theme'),
      bodyFont: body.fontFamily,
      brandFont: brand ? getComputedStyle(brand).fontFamily : null,
      brandSize: brand ? getComputedStyle(brand).fontSize : null,
      topH: top ? Math.round(top.getBoundingClientRect().height) : null,
      navW: nav ? Math.round(nav.getBoundingClientRect().width) : null,
      spineN: spineN ? getComputedStyle(spineN).fontSize : null,
      kpiV: kpiV ? getComputedStyle(kpiV).fontSize : null,
      page: (cs.getPropertyValue('--wt-bg') || cs.getPropertyValue('--page')).trim(),
      surface: cs.getPropertyValue('--wt-surface').trim(),
      ink: cs.getPropertyValue('--wt-ink').trim(),
      stages,
      navLabels,
      leaflet: !!document.querySelector('.leaflet-container'),
      tileImgs: document.querySelectorAll('.leaflet-tile-pane img').length,
    };
  });
}

// --- APP shots ---
await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
await resetExpanded();
await page.reload({ waitUntil: 'networkidle0', timeout: 90000 });
await page.waitForSelector('.wt-topbar', { timeout: 20000 });
await ensureNavExpanded();

await clickRole('HHL');
await clickNav('kokpit|dashboard|dash');
await ensureNavExpanded();
await new Promise((r) => setTimeout(r, 1800));
const mCockpit = await metrics();
await page.screenshot({ path: `${out}/resume-claude-shell-cockpit.png`, fullPage: false });
console.log('cockpit', mCockpit.theme, mCockpit.navW, mCockpit.stages?.slice(0, 4));

await clickNav('mapa|map');
await page.waitForSelector('.leaflet-container', { timeout: 30000 }).catch(() => null);
await new Promise((r) => setTimeout(r, 5000));
await ensureNavExpanded();
const mMap = await metrics();
await page.screenshot({ path: `${out}/resume-claude-shell-map.png`, fullPage: false });
console.log('map', mMap.leaflet, mMap.tileImgs);

await clickRole('KSH');
await clickNav('kokpit|dashboard|dash');
await ensureNavExpanded();
await new Promise((r) => setTimeout(r, 1500));
const mKsh = await metrics();
await page.screenshot({ path: `${out}/resume-claude-shell-ksh.png`, fullPage: false });
console.log('ksh', mKsh.theme, mKsh.page);

// --- Makieta side-by-side ref ---
const mp = await browser.newPage();
await mp.goto(MAKIETA, { waitUntil: 'networkidle0', timeout: 60000 });
await mp.waitForSelector('.topbar', { timeout: 15000 });
await mp.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'dark');
  const hhl = document.querySelector('button[data-role="HHL"]');
  hhl?.click();
  const dash = document.querySelector('nav button[data-view="dash"]');
  dash?.click();
});
await new Promise((r) => setTimeout(r, 800));
await mp.screenshot({ path: `${out}/resume-claude-makieta-cockpit.png`, fullPage: false });
await mp.evaluate(() => {
  document.documentElement.setAttribute('data-theme', 'light');
  const ksh = document.querySelector('button[data-role="KSH"]');
  ksh?.click();
});
await new Promise((r) => setTimeout(r, 600));
await mp.screenshot({ path: `${out}/resume-claude-makieta-ksh.png`, fullPage: false });
console.log('makieta refs written');

const summary = {
  when: new Date().toISOString(),
  preview: BASE,
  cockpit: mCockpit,
  map: mMap,
  ksh: mKsh,
  checks: {
    barlow: /Barlow/i.test(mCockpit.bodyFont || ''),
    condensed: /Condensed/i.test(mCockpit.brandFont || ''),
    top52: mCockpit.topH === 52,
    nav186: mCockpit.navW === 186,
    spine26: mCockpit.spineN === '26px',
    kpi29: mCockpit.kpiV === '29px',
    hhlDark: mCockpit.theme === 'dark' && String(mCockpit.page).toLowerCase() === '#080f15',
    kshLight: mKsh.theme === 'light' && String(mKsh.page).toLowerCase() === '#e3e9ed',
    leaflet: !!mMap.leaflet,
    tiles: (mMap.tileImgs || 0) > 0,
    spineClaudeVoice: (mCockpit.stages || []).includes('Przygotowanie') && (mCockpit.stages || []).includes('Boden'),
  },
};
writeFileSync(`${out}/resume-claude-shell-metrics.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary.checks, null, 2));
await browser.close();
