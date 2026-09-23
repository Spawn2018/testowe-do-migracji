import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';

const out = '/workspace/watch-tower-app/shots-start';
mkdirSync(out, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,900'],
  defaultViewport: { width: 1440, height: 900 },
});

async function shot(page, name) {
  await page.screenshot({ path: `${out}/${name}`, fullPage: false });
  console.log('wrote', name);
}

async function resetStorage(page) {
  await page.evaluate(() => {
    try {
      sessionStorage.removeItem('wtNavCollapsed');
      sessionStorage.setItem('wtNavCollapsed', '1');
      const keys = Object.keys(localStorage);
      for (const k of keys) {
        if (k.includes('watch-tower') || k.includes('tower')) {
          localStorage.removeItem(k);
        }
      }
    } catch {}
  });
}

const page = await browser.newPage();
await page.goto('http://127.0.0.1:4177/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await resetStorage(page);
await page.reload({ waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForSelector('nav', { timeout: 15000 });
await new Promise((r) => setTimeout(r, 1200));

const navW = await page.evaluate(() => {
  const n = document.querySelector('nav');
  return n ? Math.round(n.getBoundingClientRect().width) : -1;
});
console.log('nav width:', navW);

// Ensure HHL / dark cockpit
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  btns.find((b) => (b.textContent || '').trim() === 'HHL')?.click();
});
await new Promise((r) => setTimeout(r, 400));
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  const dash = btns.find((b) => /kokpit|dash|cockpit|▣/i.test(b.getAttribute('aria-label') || '') || b.textContent?.includes('▣'));
  dash?.click();
});
await new Promise((r) => setTimeout(r, 600));
await shot(page, 'visual-v3-cockpit.png');

// Map
await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('button')];
  const mapBtn = buttons.find(
    (b) => /mapa|map/i.test(b.getAttribute('aria-label') || '') || /⌖/.test(b.textContent || ''),
  );
  mapBtn?.click();
});
await new Promise((r) => setTimeout(r, 2800));
await shot(page, 'visual-v3-map.png');

// KSH light theme
await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')];
  btns.find((b) => (b.textContent || '').includes('KSH') || (b.textContent || '').trim() === 'KSH')?.click();
});
await new Promise((r) => setTimeout(r, 500));
// Force light if role default didn't
await page.evaluate(() => {
  const theme = document.documentElement.getAttribute('data-theme');
  if (theme !== 'light') {
    const btns = [...document.querySelectorAll('button')];
    btns.find((b) => /Dark|Light|theme/i.test(b.textContent || '') || b.title?.toLowerCase().includes('theme'))?.click();
  }
});
await new Promise((r) => setTimeout(r, 400));
await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('button')];
  const dash = buttons.find((b) => /kokpit|dash|▣/i.test(b.getAttribute('aria-label') || '') || b.textContent?.includes('▣'));
  dash?.click();
});
await new Promise((r) => setTimeout(r, 800));
const theme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
console.log('ksh theme:', theme);
await shot(page, 'visual-v3-ksh-light.png');

await browser.close();
console.log('done');
