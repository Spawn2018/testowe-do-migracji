import puppeteer from 'puppeteer-core';
import fs from 'fs';
const executablePath = '/usr/bin/google-chrome';
const browser = await puppeteer.launch({
  executablePath, headless: 'new',
  args: ['--no-sandbox','--disable-dev-shm-usage','--window-size=1440,900'],
  defaultViewport: { width: 1440, height: 900 },
});
const page = await browser.newPage();
await page.goto('http://127.0.0.1:4177/', { waitUntil: 'networkidle0', timeout: 60000 });
await page.evaluate(() => {
  Object.keys(localStorage).filter(k => k.startsWith('watch-tower')).forEach(k => localStorage.removeItem(k));
});
await page.reload({ waitUntil: 'networkidle0' });

// Hook into zustand persist storage after hydrate
const before = await page.evaluate(() => {
  const raw = localStorage.getItem('watch-tower-ui-v6-ready-gate');
  if (!raw) return { noPersist: true };
  const s = JSON.parse(raw).state;
  const l = s.loads.find(x => x.code === 'SG-19');
  return { status: l?.status, driver: l?.resources?.driverName, risks: s.risks?.filter(r => r.loadId === l?.id).map(r => r.title) };
});
console.log('before', before);

await page.evaluate(() => {
  const nav = [...document.querySelectorAll('button')].find(b => /Harmonogram/i.test(b.textContent||''));
  nav?.click();
});
await new Promise(r => setTimeout(r, 400));
await page.evaluate(() => {
  const el = [...document.querySelectorAll('.code')].find(c => c.textContent.includes('SG-19'));
  el?.closest('tr')?.click();
});
await new Promise(r => setTimeout(r, 500));
await page.evaluate(() => {
  [...document.querySelectorAll('button')].find(b => /Ustalenia/i.test(b.textContent||''))?.click();
});
await new Promise(r => setTimeout(r, 300));

await page.evaluate(() => {
  const form = [...document.querySelectorAll('form')].find(f => /Zapisz zasoby/i.test(f.textContent||''));
  const set = (n,v) => { const i=form.querySelector(`[name="${n}"]`); i.value=v; i.dispatchEvent(new Event('input',{bubbles:true})); };
  set('driverName','Jan Kowalski'); set('driverPhone','+48 600 111 222');
  set('tractorPlate','WWL 4P40'); set('trailerPlate','WWL N4P0');
  form.querySelector('button[type="submit"]')?.click();
});
await new Promise(r => setTimeout(r, 700));

const mid = await page.evaluate(() => {
  const raw = localStorage.getItem('watch-tower-ui-v6-ready-gate');
  const s = JSON.parse(raw).state;
  const l = s.loads.find(x => x.code === 'SG-19');
  const ev = s.events.filter(e => e.loadId === l.id).slice(0, 8).map(e => e.type + (e.note ? ` · ${e.note}` : ''));
  const risks = s.risks.filter(r => r.loadId === l.id).map(r => r.title);
  const ex = s.exceptions.filter(e => e.loadId === l.id).map(e => e.title);
  return { status: l.status, docMissing: l.docMissing, driver: l.resources.driverName, plate: l.resources.tractorPlate, ev, risks, ex };
});
console.log('after resources', JSON.stringify(mid, null, 2));

await page.evaluate(() => {
  const form = [...document.querySelectorAll('form')].find(f => /Zapisz awizację/i.test(f.textContent||''));
  const set = (n,v) => { const i=form.querySelector(`[name="${n}"]`); if(i){ i.value=v; i.dispatchEvent(new Event('input',{bubbles:true})); }};
  set('loadWindowStart','2026-10-17T08:00'); set('loadWindowEnd','2026-10-17T16:00');
  const c = form.querySelector('[name="confirmed"]'); if (c && !c.checked) c.click();
  form.querySelector('button[type="submit"]')?.click();
});
await new Promise(r => setTimeout(r, 700));

const end = await page.evaluate(() => {
  const raw = localStorage.getItem('watch-tower-ui-v6-ready-gate');
  const s = JSON.parse(raw).state;
  const l = s.loads.find(x => x.code === 'SG-19');
  const ev = s.events.filter(e => e.loadId === l.id).slice(0, 10).map(e => e.type + (e.note ? ` · ${e.note}` : ''));
  // schedule row text
  const row = [...document.querySelectorAll('tr')].find(tr => tr.textContent.includes('SG-19'));
  return {
    status: l.status,
    awi: l.awizacja,
    ev,
    rowText: row?.innerText?.replace(/\s+/g,' ').slice(0, 200),
  };
});
console.log('after awi', JSON.stringify(end, null, 2));
fs.writeFileSync('/tmp/wt-p4-verify.json', JSON.stringify({ before, mid, end }, null, 2));
await browser.close();
