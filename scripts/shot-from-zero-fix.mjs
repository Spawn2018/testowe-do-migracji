import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'fs';

const out = '/workspace/watch-tower-app/shots-start';
mkdirSync(out, { recursive: true });
const BASE = 'http://127.0.0.1:4177/';

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
  await new Promise((r) => setTimeout(r, 900));
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
  await new Promise((r) => setTimeout(r, 1000));
}

async function clickNav(reSrc) {
  await page.evaluate((reSrc) => {
    const re = new RegExp(reSrc, 'i');
    const btn = [...document.querySelectorAll('nav button')].find((b) =>
      re.test(b.getAttribute('aria-label') || b.textContent || ''),
    );
    btn?.click();
  }, reSrc);
  await new Promise((r) => setTimeout(r, 1400));
}

await reset();
await ensureNavExpanded();

// HHL dark cockpit
await clickRole('H&H');
await ensureNavExpanded();
await clickNav('Kokpit|Overview|Översikt|Dashboard');
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: `${out}/from-zero-fix-hhl-dark.png`, fullPage: false });

// KSH light cockpit
await clickRole('KSH');
await ensureNavExpanded();
await clickNav('Kokpit|Overview|Översikt|Dashboard');
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({ path: `${out}/from-zero-fix-ksh-light.png`, fullPage: false });

// Map (HHL dark)
await clickRole('H&H');
await clickNav('Mapa|Map|Karta');
await new Promise((r) => setTimeout(r, 2800));
await page.screenshot({ path: `${out}/from-zero-fix-map.png`, fullPage: false });

// Nav expanded on dash
await clickNav('Kokpit|Overview|Översikt|Dashboard');
await ensureNavExpanded();
await new Promise((r) => setTimeout(r, 600));
await page.screenshot({ path: `${out}/from-zero-fix-nav.png`, fullPage: false });

// DOM smoke checks for gate
const smoke = await page.evaluate(() => {
  const stages = [...document.querySelectorAll('.corridor .stage .l, .corridor button .l')].map(
    (e) => e.textContent?.trim(),
  );
  const heads = [...document.querySelectorAll('.panel-hd h2, header.panel-hd h2')].map((e) =>
    e.textContent?.trim(),
  );
  return {
    stages,
    stageCount: stages.length,
    heads,
    hasWymaga: heads.some((h) => h === 'Wymaga decyzji'),
    hasPostep: heads.some((h) => h === 'Postęp dostaw'),
    hasGdansk: stages.includes('Gdańsk'),
  };
});
console.log(JSON.stringify(smoke, null, 2));
await browser.close();
