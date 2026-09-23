import puppeteer from 'puppeteer-core';
import fs from 'fs';
const dataUrl = fs.readFileSync('/tmp/wt-p5-sample.dataurl', 'utf8');
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto('http://127.0.0.1:4177/', { waitUntil: 'networkidle0' });
await page.evaluate(() => Object.keys(localStorage).filter(k=>k.startsWith('watch-tower')).forEach(k=>localStorage.removeItem(k)));
await page.reload({ waitUntil: 'networkidle0' });
await page.evaluate((png) => {
  const raw = localStorage.getItem('watch-tower-ui-v6-ready-gate');
  const parsed = JSON.parse(raw);
  const doc = parsed.state.documents.find(d => d.status === 'UPLOADED' && d.category === 'LASHING_PHOTOS')
    || parsed.state.documents.find(d => d.status === 'UPLOADED');
  doc.dataUrl = png; doc.mimeType = 'image/png'; doc.bytes = 9000;
  doc.name = 'SG-01_mocowanie_04.jpg';
  localStorage.setItem('watch-tower-ui-v6-ready-gate', JSON.stringify(parsed));
}, dataUrl);
await page.reload({ waitUntil: 'networkidle0' });
await page.evaluate(() => [...document.querySelectorAll('nav button')].find(b=>/Dokumenty/i.test(b.textContent||''))?.click());
await new Promise(r => setTimeout(r, 600));
await page.screenshot({ path: '/tmp/wt-p5-docs.png' });
await page.evaluate(() => {
  const b = [...document.querySelectorAll('button.docrow-name')].find(x => /mocowanie|LASHING|jpg|png/i.test(x.textContent||''));
  (b || document.querySelector('button.docrow-name'))?.click();
});
await new Promise(r => setTimeout(r, 500));
console.log(await page.evaluate(() => ({
  open: !!document.querySelector('.docpreview'),
  imgW: document.querySelector('.docpreview img')?.naturalWidth,
  imgDisp: document.querySelector('.docpreview img')?.getBoundingClientRect()?.width,
})));
await page.screenshot({ path: '/tmp/wt-p5-preview.png' });
await browser.close();
