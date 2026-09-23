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

const page = await browser.newPage();
// Clear storage so default collapsed applies
await page.goto('http://127.0.0.1:4177/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.evaluate(() => {
  try {
    sessionStorage.removeItem('wtNavCollapsed');
    // strip navCollapsed from zustand persist if present
    const k = Object.keys(localStorage).find((x) => x.includes('watch-tower-ui'));
    if (k) {
      const raw = JSON.parse(localStorage.getItem(k) || '{}');
      if (raw?.state) {
        delete raw.state.navCollapsed;
        localStorage.setItem(k, JSON.stringify(raw));
      }
    }
  } catch {}
});
await page.reload({ waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForSelector('nav', { timeout: 15000 });
await new Promise((r) => setTimeout(r, 1000));

const navW = await page.evaluate(() => {
  const n = document.querySelector('nav');
  return n ? Math.round(n.getBoundingClientRect().width) : -1;
});
console.log('nav width after default:', navW);

await shot(page, 'visual-v2-cockpit.png');

// Map
await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('button')];
  const mapBtn = buttons.find(
    (b) => /mapa|map/i.test(b.textContent || '') || /map/i.test(b.getAttribute('aria-label') || ''),
  );
  mapBtn?.click();
});
await new Promise((r) => setTimeout(r, 2500));
await shot(page, 'visual-v2-map.png');

// Claude ref for side-by-side (inspiration)
await page.goto('http://127.0.0.1:4177/claude-ref.html', { waitUntil: 'networkidle0', timeout: 60000 });
await new Promise((r) => setTimeout(r, 800));
await shot(page, 'visual-v2-claude-ref.png');

await browser.close();
console.log('done');
