import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome', headless: 'new',
  args: ['--no-sandbox','--disable-dev-shm-usage'],
  defaultViewport: { width: 1280, height: 800 },
});
const page = await browser.newPage();
await page.goto('http://127.0.0.1:4177/', { waitUntil: 'networkidle0' });
await page.evaluate(() => Object.keys(localStorage).filter(k=>k.startsWith('watch-tower')).forEach(k=>localStorage.removeItem(k)));
await page.reload({ waitUntil: 'networkidle0' });

// Find a TRIP RESOURCES_PENDING (SG-09 after seed)
const target = await page.evaluate(() => {
  const raw = localStorage.getItem('watch-tower-ui-v6-ready-gate');
  const s = JSON.parse(raw).state;
  const l = s.loads.find(x => x.status === 'RESOURCES_PENDING' && x.permit?.attachmentKind === 'TRIP')
    || s.loads.find(x => x.code === 'SG-09');
  return l ? { id: l.id, code: l.code, status: l.status, kind: l.permit?.attachmentKind, driver: l.resources.driverName } : null;
});
console.log('target', target);
if (!target) { await browser.close(); process.exit(0); }

await page.evaluate((code) => {
  [...document.querySelectorAll('button')].find(b=>/Harmonogram/i.test(b.textContent||''))?.click();
  setTimeout(() => {
    const el = [...document.querySelectorAll('.code')].find(c => c.textContent.includes(code));
    el?.closest('tr')?.click();
  }, 200);
}, target.code);
await new Promise(r => setTimeout(r, 700));
await page.evaluate(() => [...document.querySelectorAll('button')].find(b=>/Ustalenia/i.test(b.textContent||''))?.click());
await new Promise(r => setTimeout(r, 300));

const hasForm = await page.evaluate(() => {
  const form = [...document.querySelectorAll('form')].find(f => /Zapisz zasoby/i.test(f.textContent||''));
  if (!form) return false;
  // If already has driver, still overwrite
  const set = (n,v) => { const i=form.querySelector(`[name="${n}"]`); if(i){ i.value=v; i.dispatchEvent(new Event('input',{bubbles:true})); }};
  set('driverName','Trip Driver'); set('driverPhone','+48 111'); set('tractorPlate','AAA 111'); set('trailerPlate','BBB 222');
  form.querySelector('button[type="submit"]')?.click();
  return true;
});
console.log('form', hasForm);
await new Promise(r => setTimeout(r, 800));

const after = await page.evaluate((code) => {
  const raw = localStorage.getItem('watch-tower-ui-v6-ready-gate');
  const s = JSON.parse(raw).state;
  const l = s.loads.find(x => x.code === code);
  const ev = s.events.filter(e => e.loadId === l.id).slice(0,6).map(e => e.type + (e.note?` · ${e.note}`:''));
  return { status: l.status, docMissing: l.docMissing, ev };
}, target.code);
console.log('after TRIP fill', after);
await browser.close();
