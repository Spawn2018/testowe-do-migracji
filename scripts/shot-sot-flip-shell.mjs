import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'fs';

const out = '/workspace/watch-tower-app/shots-start';
mkdirSync(out, { recursive: true });

const chrome = '/usr/bin/google-chrome-stable';
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--window-size=1440,900',
  ],
  defaultViewport: { width: 1440, height: 900 },
});

async function shotApp() {
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle0', timeout: 90000 });
  await page.evaluate(() => {
    try {
      sessionStorage.setItem('wtNavCollapsed', '0');
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    } catch {}
  });
  // expand nav if needed
  await page.evaluate(() => {
    const nav = document.querySelector('nav');
    if (nav && nav.getBoundingClientRect().width < 100) {
      [...document.querySelectorAll('button')].find((b) => (b.textContent || '').includes('»'))?.click();
    }
  });
  await page.waitForSelector('.wt-topbar', { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 800));

  const fonts = await page.evaluate(() => {
    const brand = document.querySelector('.wt-brand');
    const body = getComputedStyle(document.body);
    const brandCs = brand ? getComputedStyle(brand) : null;
    const top = document.querySelector('.wt-topbar');
    const nav = document.querySelector('nav');
    const spine = document.querySelector('.wt-corridor');
    return {
      bodyFont: body.fontFamily,
      bodySize: body.fontSize,
      brandFont: brandCs?.fontFamily,
      brandSize: brandCs?.fontSize,
      topH: top?.getBoundingClientRect().height,
      navW: nav?.getBoundingClientRect().width,
      spinePad: spine ? getComputedStyle(spine).padding : null,
      pageBg: getComputedStyle(document.documentElement).getPropertyValue('--wt-bg').trim(),
      surface: getComputedStyle(document.documentElement).getPropertyValue('--wt-surface').trim(),
      ink: getComputedStyle(document.documentElement).getPropertyValue('--wt-ink').trim(),
    };
  });

  await page.screenshot({ path: `${out}/sot-flip-app-shell.png`, fullPage: false });
  // crop topbar+spine+nav strip
  await page.screenshot({
    path: `${out}/sot-flip-app-chrome.png`,
    clip: { x: 0, y: 0, width: 1440, height: 160 },
  });
  await page.close();
  return fonts;
}

async function shotMakieta() {
  const page = await browser.newPage();
  await page.goto('file:///workspace/watch-tower/claude-makieta.html', {
    waitUntil: 'networkidle0',
    timeout: 60000,
  });
  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
  });
  await new Promise((r) => setTimeout(r, 500));
  const fonts = await page.evaluate(() => {
    const brand = document.querySelector('.brand b');
    const body = getComputedStyle(document.body);
    const brandCs = brand ? getComputedStyle(brand) : null;
    const top = document.querySelector('.topbar');
    const nav = document.querySelector('nav');
    const spine = document.querySelector('.corridor');
    return {
      bodyFont: body.fontFamily,
      bodySize: body.fontSize,
      brandFont: brandCs?.fontFamily,
      brandSize: brandCs?.fontSize,
      topH: top?.getBoundingClientRect().height,
      navW: nav?.getBoundingClientRect().width,
      spinePad: spine ? getComputedStyle(spine).padding : null,
      pageBg: getComputedStyle(document.documentElement).getPropertyValue('--page').trim(),
      surface: getComputedStyle(document.documentElement).getPropertyValue('--surface').trim(),
      ink: getComputedStyle(document.documentElement).getPropertyValue('--ink').trim(),
    };
  });
  await page.screenshot({ path: `${out}/sot-flip-makieta-shell.png`, fullPage: false });
  await page.screenshot({
    path: `${out}/sot-flip-makieta-chrome.png`,
    clip: { x: 0, y: 0, width: 1440, height: 160 },
  });
  await page.close();
  return fonts;
}

const app = await shotApp();
const makieta = await shotMakieta();
const report = { app, makieta, match: {
  bodyFontBarlow: /Barlow/i.test(app.bodyFont) && /Barlow/i.test(makieta.bodyFont),
  brandCondensed: /Condensed/i.test(app.brandFont || '') && /Condensed/i.test(makieta.brandFont || ''),
  topH: app.topH === makieta.topH,
  navW: Math.abs((app.navW || 0) - (makieta.navW || 0)) < 2,
  pageBg: app.pageBg.toLowerCase() === makieta.pageBg.toLowerCase(),
  surface: app.surface.toLowerCase() === makieta.surface.toLowerCase(),
  ink: app.ink.toLowerCase() === makieta.ink.toLowerCase(),
}};
writeFileSync(`${out}/sot-flip-shell-metrics.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
