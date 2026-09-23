import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome',
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto('http://127.0.0.1:4177/', { waitUntil: 'networkidle0', timeout: 60000 });
await page.evaluate(() => {
  Object.keys(localStorage).filter((k) => k.startsWith('watch-tower')).forEach((k) => localStorage.removeItem(k));
});
await page.reload({ waitUntil: 'networkidle0' });

const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6aAAAAAElFTkSuQmCC';

await page.evaluate((png) => {
  const raw = localStorage.getItem('watch-tower-ui-v6-ready-gate');
  const parsed = JSON.parse(raw);
  const s = parsed.state;
  // Prefer LASHING or inject on first UPLOADED with image-like name
  let doc = (s.documents || []).find((d) => d.status === 'UPLOADED' && d.category === 'LASHING_PHOTOS');
  if (!doc) doc = (s.documents || []).find((d) => d.status === 'UPLOADED');
  if (doc) {
    doc.dataUrl = png;
    doc.mimeType = 'image/png';
    doc.bytes = 68;
    doc.name = (doc.name || 'foto.png').replace(/\.[^.]+$/, '') + '.png';
    localStorage.setItem('watch-tower-ui-v6-ready-gate', JSON.stringify(parsed));
  }
  return doc?.id;
}, PNG);
await page.reload({ waitUntil: 'networkidle0' });

await page.evaluate(() => {
  [...document.querySelectorAll('nav button')].find((b) => /Dokumenty/i.test(b.textContent || ''))?.click();
});
await new Promise((r) => setTimeout(r, 700));
await page.screenshot({ path: '/tmp/wt-p5-docs.png' });

// Click lashing or any ✓ name
await page.evaluate(() => {
  const btn = [...document.querySelectorAll('button.docrow-name')].find((b) => /\.png/i.test(b.textContent || ''))
    || document.querySelector('button.docrow-name');
  btn?.click();
});
await new Promise((r) => setTimeout(r, 600));
console.log('preview', await page.evaluate(() => ({
  open: !!document.querySelector('.docpreview'),
  hasImg: !!document.querySelector('.docpreview img'),
  title: document.querySelector('.docpreview h2')?.textContent,
})));
await page.screenshot({ path: '/tmp/wt-p5-preview.png' });
await page.keyboard.press('Escape');
await new Promise((r) => setTimeout(r, 300));

// Drawer: sched → SG-01 → Dokumenty
await page.evaluate(() => {
  [...document.querySelectorAll('nav button')].find((b) => /Harmonogram/i.test(b.textContent || ''))?.click();
});
await new Promise((r) => setTimeout(r, 500));
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.code')].find((c) => (c.textContent || '').includes('SG-01'));
  el?.closest('tr')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  el?.closest('tr')?.click();
});
await new Promise((r) => setTimeout(r, 700));
const drawerOpen = await page.evaluate(() => !!document.querySelector('.drawer'));
console.log('drawerOpen', drawerOpen);
await page.evaluate(() => {
  [...document.querySelectorAll('.dtabs button')].find((b) => /Dokumenty/i.test(b.textContent || ''))?.click();
});
await new Promise((r) => setTimeout(r, 500));
const drawerStats = await page.evaluate(() => ({
  mrows: document.querySelectorAll('.drawer .mrow').length,
  downs: [...document.querySelectorAll('.drawer .iconbtn')].map((b) => b.textContent?.trim()),
  wgraj: [...document.querySelectorAll('.drawer button')].filter((b) => /Wgraj/i.test(b.textContent || '')).map((b) => b.textContent?.trim()),
  sample: [...document.querySelectorAll('.drawer .mrow')].slice(0, 3).map((r) => r.textContent?.replace(/\s+/g, ' ').trim()),
}));
console.log('drawerStats', drawerStats);
await page.screenshot({ path: '/tmp/wt-p5-drawer-docs.png' });

// Faktury attachments
await page.keyboard.press('Escape');
await new Promise((r) => setTimeout(r, 200));
await page.evaluate(() => {
  [...document.querySelectorAll('nav button')].find((b) => /Faktury/i.test(b.textContent || ''))?.click();
});
await new Promise((r) => setTimeout(r, 600));
const inv = await page.evaluate(() => ({
  title: [...document.querySelectorAll('h2')].map((h) => h.textContent),
  cmrRows: [...document.querySelectorAll('.mrow')].filter((r) => /CMR|POD/.test(r.textContent || '')).length,
  downs: document.querySelectorAll('.iconbtn').length,
}));
console.log('inv', inv);
await page.screenshot({ path: '/tmp/wt-p5-invoices.png' });

// Claude ref drawer docs for eye compare
await page.goto('http://127.0.0.1:4177/claude-v2-ref.html', { waitUntil: 'networkidle0' });
await page.evaluate(() => {
  [...document.querySelectorAll('nav button')].find((b) => /Harmonogram|Schedule/i.test(b.textContent || ''))?.click();
});
await new Promise((r) => setTimeout(r, 400));
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.code')].find((c) => /SG-/.test(c.textContent || ''));
  el?.closest('tr')?.click();
});
await new Promise((r) => setTimeout(r, 500));
await page.evaluate(() => {
  [...document.querySelectorAll('.dtabs button')].find((b) => /Dokument/i.test(b.textContent || ''))?.click();
});
await new Promise((r) => setTimeout(r, 400));
await page.screenshot({ path: '/tmp/wt-p5-ref-drawer-docs.png' });

await browser.close();
console.log('done');
