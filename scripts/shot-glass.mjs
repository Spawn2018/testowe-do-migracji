import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu', '--window-size=1440,900'],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto('http://127.0.0.1:4177/', { waitUntil: 'networkidle0', timeout: 60000 });
await page.waitForSelector('.wt-glass-chrome', { timeout: 15000 });
await new Promise((r) => setTimeout(r, 800));
await page.screenshot({
  path: '/workspace/watch-tower-app/shots-start/glass-dense-cockpit.png',
  fullPage: false,
});

// Navigate to map via nav button / label
const clicked = await page.evaluate(() => {
  const buttons = [...document.querySelectorAll('button, a, [role="button"]')];
  const mapBtn = buttons.find((b) => /mapa|map/i.test(b.textContent || '') || /map/i.test(b.getAttribute('aria-label') || ''));
  if (mapBtn) { mapBtn.click(); return mapBtn.textContent?.trim() || 'clicked'; }
  return null;
});
console.log('map nav:', clicked);
await new Promise((r) => setTimeout(r, 2000));
await page.screenshot({
  path: '/workspace/watch-tower-app/shots-start/glass-dense-map.png',
  fullPage: false,
});

// Close-up of map glass overlay if present
const overlay = await page.$('.wt-glass-chrome');
if (overlay) {
  await overlay.screenshot({
    path: '/workspace/watch-tower-app/shots-start/glass-dense-map-overlay.png',
  });
}

await browser.close();
console.log('shots written');
